"""Outbound platform events (R-104, chadev-platform/contracts/events.md).

No network: every HTTP call goes through an `httpx.MockTransport` swapped in
for `events.http_client`.
"""
import datetime as dt
import hashlib
import hmac
import json
import uuid
from decimal import Decimal

import httpx
import pytest

from app.config import settings
from app.models.outbound_event import OutboundEvent
from app.services import events
from app.services.jobs import run_scheduled_jobs

SECRET = "platform-test-secret"  # noqa: S105 - test fixture
API_URL = "http://buchhaltung.test:8000"


@pytest.fixture
def platform_configured(monkeypatch):
    monkeypatch.setattr(settings, "PLATFORM_SHARED_SECRET", SECRET)
    monkeypatch.setattr(settings, "BUCHHALTUNG_API_URL", API_URL + "/")


@pytest.fixture
def unconfigured(monkeypatch):
    monkeypatch.setattr(settings, "PLATFORM_SHARED_SECRET", None)
    monkeypatch.setattr(settings, "BUCHHALTUNG_API_URL", None)


@pytest.fixture
def receiver(monkeypatch):
    """Fake buchhaltung: records requests, answers what `state["respond"]` says."""
    state = {"requests": [], "respond": lambda request: httpx.Response(202, json={"status": "accepted"})}

    def handler(request: httpx.Request) -> httpx.Response:
        state["requests"].append(request)
        return state["respond"](request)

    monkeypatch.setattr(events, "http_client", lambda: httpx.Client(transport=httpx.MockTransport(handler)))
    # The immediate background attempt would open its own session on the real
    # database and see none of the test's uncommitted rows; keep it out.
    monkeypatch.setattr(events, "deliver_pending_once", lambda: None)
    return state


def _client(client, headers):
    resp = client.post(
        "/api/clients",
        json={
            "customer_number": f"K-{uuid.uuid4().hex[:8]}",
            "company_name": "Beispiel GmbH",
            "street": "Teststrasse 1",
            "postal_code": "8000",
            "city": "Zürich",
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _document(client, headers, cid, document_type="rechnung"):
    resp = client.post(
        "/api/documents",
        json={
            "document_type": document_type,
            "client_id": cid,
            "date": "2026-09-01",
            "line_items": [
                {"position": 1, "description": "Beratung", "quantity": "1", "unit_price": "1000.00", "vat_rate": "8.1"},
            ],
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _pending(db):
    return db.query(OutboundEvent).order_by(OutboundEvent.id).all()


# ── emit on transition ────────────────────────────────────────────────

def test_paid_transition_emits_contract_payload(client, db, make_tenant, unconfigured):
    t = make_tenant()
    cid = _client(client, t["headers"])
    doc = _document(client, t["headers"], cid)

    resp = client.patch(
        f"/api/documents/{doc['id']}/status",
        json={"status": "paid", "paid_at": "2026-09-11", "payment_method": "bank", "payment_reference": "RF18"},
        headers=t["headers"],
    )
    assert resp.status_code == 200, resp.text

    rows = _pending(db)
    assert len(rows) == 1
    row = rows[0]
    assert row.event == "invoice.paid"
    assert row.attempts == 0 and row.delivered_at is None
    assert isinstance(row.delivery_id, uuid.UUID)
    assert row.payload == {
        "event": "invoice.paid",
        "version": 1,
        "tid": row.tid,
        "invoice": {
            "id": doc["id"],
            "number": doc["document_number"],
            "date": "2026-09-01",
            "paid_at": "2026-09-11",
            "currency": "CHF",
            "total": "1081.00",
            "vat_total": "81.00",
            "client": {"id": cid, "name": "Beispiel GmbH"},
            "payment_method": "bank",
            "payment_reference": "RF18",
        },
    }
    # Money travels as decimal strings, never floats.
    assert Decimal(row.payload["invoice"]["total"]) == Decimal("1081.00")


def test_resaving_a_paid_invoice_does_not_emit_again(client, db, make_tenant, unconfigured):
    t = make_tenant()
    cid = _client(client, t["headers"])
    doc = _document(client, t["headers"], cid)
    url = f"/api/documents/{doc['id']}/status"

    assert client.patch(url, json={"status": "paid"}, headers=t["headers"]).status_code == 200
    assert client.patch(url, json={"status": "paid", "payment_method": "twint"}, headers=t["headers"]).status_code == 200
    assert len(_pending(db)) == 1

    # Back to sent and paid again is a new transition → a second event.
    assert client.patch(url, json={"status": "sent"}, headers=t["headers"]).status_code == 200
    assert client.patch(url, json={"status": "paid"}, headers=t["headers"]).status_code == 200
    assert len(_pending(db)) == 2


def test_offerte_status_changes_never_emit(client, db, make_tenant, unconfigured):
    t = make_tenant()
    cid = _client(client, t["headers"])
    doc = _document(client, t["headers"], cid, document_type="offerte")
    assert client.patch(f"/api/documents/{doc['id']}/status", json={"status": "accepted"}, headers=t["headers"]).status_code == 200
    assert client.patch(f"/api/documents/{doc['id']}/status", json={"status": "sent"}, headers=t["headers"]).status_code == 200
    assert _pending(db) == []


def test_bulk_paid_emits_once_per_transition(client, db, make_tenant, unconfigured):
    t = make_tenant()
    cid = _client(client, t["headers"])
    a = _document(client, t["headers"], cid)
    b = _document(client, t["headers"], cid)
    assert client.patch(f"/api/documents/{a['id']}/status", json={"status": "paid"}, headers=t["headers"]).status_code == 200

    resp = client.post(
        "/api/documents/bulk/status",
        json={"document_ids": [a["id"], b["id"]], "status": "paid", "paid_at": "2026-09-11"},
        headers=t["headers"],
    )
    assert resp.status_code == 200, resp.text
    rows = _pending(db)
    assert [r.payload["invoice"]["id"] for r in rows] == [a["id"], b["id"]]


def test_status_change_triggers_immediate_delivery_attempt(client, make_tenant, monkeypatch):
    calls = []
    monkeypatch.setattr("app.api.documents.deliver_pending_once", lambda: calls.append(1))
    t = make_tenant()
    cid = _client(client, t["headers"])
    doc = _document(client, t["headers"], cid)
    url = f"/api/documents/{doc['id']}/status"
    assert client.patch(url, json={"status": "sent"}, headers=t["headers"]).status_code == 200
    assert calls == []
    assert client.patch(url, json={"status": "paid"}, headers=t["headers"]).status_code == 200
    assert calls == [1]


# ── delivery ──────────────────────────────────────────────────────────

def _queue(db, tid=1, payload=None):
    row = events.emit(db, "invoice.paid", tid, payload or {"event": "invoice.paid", "version": 1, "tid": tid, "invoice": {"id": 1, "total": "1.00", "client": {"name": "Ümlaut & Co"}}})
    db.commit()
    return row


def test_delivery_signature_matches_contract(db, platform_configured, receiver):
    row = _queue(db)
    result = events.deliver_pending(db)
    assert result == {"delivered": 1, "failed": 0, "skipped": 0}

    (request,) = receiver["requests"]
    assert str(request.url) == API_URL + "/api/platform/events"
    assert request.headers["X-Platform-Event"] == "invoice.paid"
    assert request.headers["X-Platform-Delivery"] == str(row.delivery_id)
    assert request.headers["Content-Type"] == "application/json"
    timestamp = int(request.headers["X-Platform-Timestamp"])
    assert abs(dt.datetime.now(dt.UTC).timestamp() - timestamp) < 60

    # Recompute HMAC-SHA256(secret, f"{timestamp}.{raw body}") independently.
    expected = hmac.new(SECRET.encode(), f"{timestamp}.".encode() + request.content, hashlib.sha256).hexdigest()
    assert request.headers["X-Platform-Signature"] == f"sha256={expected}"
    assert json.loads(request.content) == row.payload

    db.refresh(row)
    assert row.delivered_at is not None
    assert row.attempts == 1
    assert row.last_error is None


def test_200_duplicate_counts_as_delivered(db, platform_configured, receiver):
    receiver["respond"] = lambda request: httpx.Response(200, json={"status": "duplicate"})
    row = _queue(db)
    assert events.deliver_pending(db)["delivered"] == 1
    db.refresh(row)
    assert row.delivered_at is not None


def test_backoff_schedule_and_max_attempts(db, platform_configured, receiver):
    receiver["respond"] = lambda request: httpx.Response(500, text="boom")
    row = _queue(db)
    now = dt.datetime(2026, 9, 11, 12, 0, 0)
    expected_delays = [
        dt.timedelta(minutes=1),
        dt.timedelta(minutes=5),
        dt.timedelta(minutes=30),
        dt.timedelta(hours=2),
        dt.timedelta(hours=24),
        dt.timedelta(hours=24),
    ]
    for attempt, delay in enumerate(expected_delays, start=1):
        before = events.utcnow()
        result = events.deliver_pending(db, now=row.next_attempt_at)
        assert result["failed"] == 1, attempt
        db.refresh(row)
        assert row.attempts == attempt
        assert row.delivered_at is None
        assert row.last_error.startswith("HTTP 500")
        assert abs((row.next_attempt_at - before) - delay) < dt.timedelta(seconds=5)
    assert row.attempts == events.MAX_ATTEMPTS == 6
    assert len(receiver["requests"]) == 6

    # Attempts exhausted: the row is left alone from now on, error kept.
    assert events.deliver_pending(db, now=now + dt.timedelta(days=365)) == {"delivered": 0, "failed": 0, "skipped": 0}
    assert len(receiver["requests"]) == 6
    assert events.delivery_health(db) == {"pending": 0, "failed": 1}


def test_not_due_rows_are_left_alone(db, platform_configured, receiver):
    receiver["respond"] = lambda request: httpx.Response(503)
    row = _queue(db)
    events.deliver_pending(db)
    db.refresh(row)
    assert row.next_attempt_at > events.utcnow()
    # Same pass again, right away: nothing is due yet.
    assert events.deliver_pending(db) == {"delivered": 0, "failed": 0, "skipped": 0}
    assert len(receiver["requests"]) == 1


def test_transport_error_is_retried(db, platform_configured, receiver):
    def _boom(request):
        raise httpx.ConnectError("refused", request=request)

    receiver["respond"] = _boom
    row = _queue(db)
    assert events.deliver_pending(db)["failed"] == 1
    db.refresh(row)
    assert row.attempts == 1
    assert "ConnectError" in row.last_error
    assert row.delivered_at is None


def test_404_unknown_tenant_is_final(db, platform_configured, receiver):
    receiver["respond"] = lambda request: httpx.Response(
        404, json={"error": {"code": "unknown_tenant", "message": "tenant 7 never did SSO"}}
    )
    row = _queue(db, tid=7)
    assert events.deliver_pending(db) == {"delivered": 0, "failed": 1, "skipped": 0}
    db.refresh(row)
    assert row.delivered_at is None
    assert row.attempts == events.MAX_ATTEMPTS
    assert "unknown_tenant" in row.last_error
    # Never retried, even far in the future.
    assert events.deliver_pending(db, now=events.utcnow() + dt.timedelta(days=30))["failed"] == 0
    assert len(receiver["requests"]) == 1
    assert events.delivery_health(db) == {"pending": 0, "failed": 1}


def test_delivery_skipped_when_unconfigured(db, unconfigured, receiver):
    row = _queue(db)
    assert events.deliver_pending(db) == {"delivered": 0, "failed": 0, "skipped": 1}
    assert receiver["requests"] == []
    db.refresh(row)
    # Recorded, untouched — sent once the platform is wired up.
    assert row.attempts == 0 and row.delivered_at is None and row.last_error is None
    assert events.delivery_health(db) == {"pending": 1, "failed": 0}


def test_scheduled_jobs_pass_delivers_events(db, platform_configured, receiver):
    row = _queue(db)
    run_scheduled_jobs(db, "test")
    db.refresh(row)
    assert row.delivered_at is not None
    assert len(receiver["requests"]) == 1


def test_health_reports_event_backlog(client, db, unconfigured):
    assert settings.APP_ENV != "production"
    _queue(db)
    body = client.get("/api/health").json()
    assert body["events"] == {"pending": 1, "failed": 0}
