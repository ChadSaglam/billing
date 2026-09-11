"""Outbound platform events (R-104, chadev-platform/contracts/events.md).

Two halves, deliberately separate:

* `emit()` writes an `outbound_events` row **in the caller's transaction** —
  the event commits (or rolls back) together with the business change.
* `deliver_pending()` posts due rows to buchhaltung with an HMAC signature,
  retries with backoff and marks them delivered / failed. It is called from
  the scheduled-jobs pass (`services/jobs.py`) and, right after a change, as
  a one-off background attempt so local dev does not wait for the next pass.

Unset `BUCHHALTUNG_API_URL` or `PLATFORM_SHARED_SECRET` = events are still
recorded (so nothing is lost when the platform is wired up later) but never
sent; `deliver_pending` returns `{"skipped": n}`.
"""

import datetime as dt
import hashlib
import hmac
import json
import logging
import time

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models.outbound_event import OutboundEvent

logger = logging.getLogger(__name__)

EVENTS_PATH = "/api/platform/events"
HTTP_TIMEOUT_SECONDS = 10.0
MAX_ATTEMPTS = 6
# Delay before attempt n+1, indexed by the number of attempts already made.
BACKOFF = (
    dt.timedelta(minutes=1),
    dt.timedelta(minutes=5),
    dt.timedelta(minutes=30),
    dt.timedelta(hours=2),
    dt.timedelta(hours=24),
)
# How many due rows one pass takes; the next pass picks up the rest.
BATCH_SIZE = 100


def utcnow() -> dt.datetime:
    """Naive UTC, like every DateTime column in this app."""
    return dt.datetime.now(dt.UTC).replace(tzinfo=None)


def emit(db: Session, event: str, tid: int, payload: dict) -> OutboundEvent:
    """Queue an event. Adds to `db` only — the caller commits."""
    row = OutboundEvent(event=event, tid=tid, payload=payload)
    db.add(row)
    return row


def invoice_paid_payload(doc) -> dict:
    """`invoice.paid` v1 body (contracts/events.md). Money as decimal strings,
    dates as ISO dates — the receiver parses, never trusts floats."""
    return {
        "event": "invoice.paid",
        "version": 1,
        "tid": doc.tenant_id,
        "invoice": {
            "id": doc.id,
            "number": doc.document_number,
            "date": doc.date.isoformat(),
            "paid_at": doc.paid_at.isoformat() if doc.paid_at else None,
            "currency": doc.currency,
            "total": str(doc.total),
            "vat_total": str(doc.vat_amount),
            "client": {"id": doc.client.id, "name": doc.client.company_name},
            "payment_method": doc.payment_method,
            "payment_reference": doc.payment_reference,
        },
    }


def emit_invoice_paid(db: Session, doc) -> OutboundEvent:
    return emit(db, "invoice.paid", doc.tenant_id, invoice_paid_payload(doc))


def is_configured() -> bool:
    return bool(settings.BUCHHALTUNG_API_URL and settings.PLATFORM_SHARED_SECRET)


def sign(secret: str, timestamp: int, body: bytes) -> str:
    """`sha256=<hex HMAC-SHA256(secret, f"{timestamp}.{raw body}")>`."""
    digest = hmac.new(secret.encode(), f"{timestamp}.".encode() + body, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def encode_body(payload: dict) -> bytes:
    """Canonical bytes: what is signed is exactly what is sent."""
    return json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode()


def backoff_for(attempts: int) -> dt.timedelta:
    return BACKOFF[min(attempts, len(BACKOFF)) - 1]


def http_client() -> httpx.Client:
    """Factory, so tests can swap in a `MockTransport` — never the network."""
    return httpx.Client(timeout=HTTP_TIMEOUT_SECONDS)


def _due_query(db: Session, now: dt.datetime):
    return db.query(OutboundEvent).filter(
        OutboundEvent.delivered_at.is_(None),
        OutboundEvent.attempts < MAX_ATTEMPTS,
        OutboundEvent.next_attempt_at <= now,
    )


def _due_ids(db: Session, now: dt.datetime) -> list[int]:
    rows = _due_query(db, now).order_by(OutboundEvent.id).limit(BATCH_SIZE).with_entities(OutboundEvent.id).all()
    return [row[0] for row in rows]


def _claim(db: Session, event_id: int, now: dt.datetime) -> OutboundEvent | None:
    """Re-select one due row under a row lock (skip if another runner has it).

    The jobs pass runs under the advisory lock, but the immediate background
    attempt after a status change does not — so two deliverers can overlap.
    `SKIP LOCKED` makes them take turns per row instead of double-posting.
    """
    query = _due_query(db, now).filter(OutboundEvent.id == event_id)
    if db.bind.dialect.name == "postgresql":
        query = query.with_for_update(skip_locked=True)
    return query.first()


def _attempt(client: httpx.Client, row: OutboundEvent, *, url: str, secret: str) -> None:
    """One delivery attempt; mutates the row (flush/commit is the caller's)."""
    body = encode_body(row.payload)
    timestamp = int(time.time())
    headers = {
        "Content-Type": "application/json",
        "X-Platform-Event": row.event,
        "X-Platform-Delivery": str(row.delivery_id),
        "X-Platform-Timestamp": str(timestamp),
        "X-Platform-Signature": sign(secret, timestamp, body),
    }
    now = utcnow()
    row.attempts += 1
    try:
        response = client.post(url, content=body, headers=headers)
    except httpx.HTTPError as exc:
        row.last_error = f"{type(exc).__name__}: {exc}"[:2000]
        row.next_attempt_at = now + backoff_for(row.attempts)
        return

    if response.status_code in (200, 202):
        row.delivered_at = now
        row.last_error = None
        return

    row.last_error = f"HTTP {response.status_code}: {response.text[:500]}"
    if response.status_code == 404:
        # unknown_tenant: the receiver has never seen this tid via SSO.
        # Retrying cannot fix that, so the row is final (attempts maxed out
        # keeps it out of the due query; last_error tells the health page why).
        row.attempts = MAX_ATTEMPTS
        return
    row.next_attempt_at = now + backoff_for(row.attempts)


def deliver_pending(db: Session, *, now: dt.datetime | None = None) -> dict[str, int]:
    """Deliver every due event. Returns counts for logs / tests.

    Each row is committed on its own, so a crash mid-pass loses at most the
    attempt in flight — never a delivered flag.
    """
    now = now or utcnow()
    due = _due_ids(db, now)
    if not due:
        return {"delivered": 0, "failed": 0, "skipped": 0}
    if not is_configured():
        logger.info("platform events: %d pending, BUCHHALTUNG_API_URL/PLATFORM_SHARED_SECRET unset — skipped", len(due))
        return {"delivered": 0, "failed": 0, "skipped": len(due)}

    url = settings.BUCHHALTUNG_API_URL.rstrip("/") + EVENTS_PATH
    secret = settings.PLATFORM_SHARED_SECRET
    delivered = failed = 0
    with http_client() as client:
        for event_id in due:
            row = _claim(db, event_id, now)
            if row is None:
                continue
            _attempt(client, row, url=url, secret=secret)
            db.commit()
            if row.delivered_at is not None:
                delivered += 1
            else:
                failed += 1
                logger.warning(
                    "platform event %s #%s attempt %d failed: %s",
                    row.event,
                    row.id,
                    row.attempts,
                    row.last_error,
                )
    if delivered:
        logger.info("platform events: delivered %d", delivered)
    return {"delivered": delivered, "failed": failed, "skipped": 0}


def deliver_pending_once() -> None:
    """Fresh-session wrapper for `BackgroundTasks` — failures are logged only."""
    if not is_configured():
        return
    try:
        db = SessionLocal()
        try:
            deliver_pending(db)
        finally:
            db.close()
    except Exception:
        logger.exception("platform events: immediate delivery failed")


def delivery_health(db: Session) -> dict[str, int]:
    """`pending` = still to be tried, `failed` = gave up (final)."""
    pending = (
        db.query(OutboundEvent)
        .filter(OutboundEvent.delivered_at.is_(None), OutboundEvent.attempts < MAX_ATTEMPTS)
        .count()
    )
    failed = (
        db.query(OutboundEvent)
        .filter(OutboundEvent.delivered_at.is_(None), OutboundEvent.attempts >= MAX_ATTEMPTS)
        .count()
    )
    return {"pending": pending, "failed": failed}
