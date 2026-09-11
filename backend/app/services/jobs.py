"""Scheduled jobs: overdue marking, recurring invoices, outbound events.

One pass = `run_scheduled_jobs()`. It is called from two places:

* `app.main` lifespan, when `RUN_JOBS_IN_API` is true (default; single
  container / local dev),
* `python -m app.jobs`, the dedicated worker process in compose (R-84).

Both go through the same Postgres advisory lock, so however many API
workers and job runners exist, exactly one of them executes a given pass.
"""
import asyncio
import logging

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal

logger = logging.getLogger(__name__)

# Postgres advisory lock id for the scheduled jobs. Any constant works — it
# just has to be the same in every process so they contend on one lock.
JOBS_LOCK_ID = 727272


def run_scheduled_jobs(db: Session, source: str) -> None:
    """Run the hourly jobs, but on exactly one process per pass.

    These used to run in-process in every uvicorn worker, so N workers meant
    N copies of the same recurring invoice (R-14). `pg_try_advisory_lock`
    elects a single runner database-wide; everyone else skips this pass.
    On non-Postgres databases (none today) it simply runs unlocked.
    """
    from app.services.events import deliver_pending
    from app.services.overdue_checker import mark_overdue_invoices
    from app.services.recurring_invoices import process_recurring_invoices

    locked = False
    if db.bind.dialect.name == "postgresql":
        locked = db.execute(
            text("SELECT pg_try_advisory_lock(:lock_id)"), {"lock_id": JOBS_LOCK_ID}
        ).scalar()
        if not locked:
            return  # another process owns this pass
    try:
        count = mark_overdue_invoices(db)
        if count:
            logger.info("[%s] Marked %d invoices as overdue", source, count)

        created = process_recurring_invoices(db)
        if created:
            logger.info("[%s] Created %d recurring invoices", source, created)

        # Platform events outbox (R-104): retries with backoff live here, so
        # `python -m app.jobs` and the in-API loop both deliver.
        events = deliver_pending(db)
        if events["delivered"] or events["failed"]:
            logger.info(
                "[%s] Platform events: %d delivered, %d failed", source, events["delivered"], events["failed"]
            )
    finally:
        if locked:
            db.execute(
                text("SELECT pg_advisory_unlock(:lock_id)"), {"lock_id": JOBS_LOCK_ID}
            )


def run_jobs_once(source: str) -> None:
    """One pass in a fresh session; failures are logged, never raised."""
    try:
        db = SessionLocal()
        try:
            run_scheduled_jobs(db, source)
        finally:
            db.close()
    except Exception:
        logger.exception("[%s] scheduled jobs failed", source)


async def background_jobs_loop() -> None:
    """In-API runner: one pass every JOBS_INTERVAL_SECONDS, forever."""
    while True:
        await asyncio.to_thread(run_jobs_once, "background")
        await asyncio.sleep(settings.JOBS_INTERVAL_SECONDS)
