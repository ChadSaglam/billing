"""Dedicated job runner — `python -m app.jobs` (R-84).

Runs the scheduled jobs (overdue marking, recurring invoices) outside the
API process, one pass every JOBS_INTERVAL_SECONDS. In compose this is the
`jobs` service and the API runs with RUN_JOBS_IN_API=false, so there is
exactly one runner; the advisory lock in `run_scheduled_jobs` keeps it safe
even if both are on.

    python -m app.jobs          # loop forever
    python -m app.jobs --once   # one pass, then exit (smoke tests, cron)
"""

import argparse
import logging
import signal
import threading

from app.config import settings
from app.core.logging_config import configure_logging
from app.core.sentry import configure_sentry
from app.services.jobs import run_jobs_once

logger = logging.getLogger(__name__)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.jobs", description=__doc__)
    parser.add_argument("--once", action="store_true", help="run one pass and exit")
    parser.add_argument(
        "--interval",
        type=int,
        default=settings.JOBS_INTERVAL_SECONDS,
        help="seconds between passes (default: JOBS_INTERVAL_SECONDS)",
    )
    args = parser.parse_args(argv)

    configure_logging(settings.LOG_LEVEL)
    configure_sentry(settings.SENTRY_DSN, settings.APP_ENV)

    if args.once:
        run_jobs_once("jobs-once")
        return 0

    stop = threading.Event()

    def _shutdown(signum, _frame):
        logger.info("[jobs] signal %s — stopping after this pass", signum)
        stop.set()

    signal.signal(signal.SIGTERM, _shutdown)
    signal.signal(signal.SIGINT, _shutdown)

    logger.info("[jobs] runner started, interval=%ss", args.interval)
    while not stop.is_set():
        run_jobs_once("jobs")
        stop.wait(args.interval)
    logger.info("[jobs] runner stopped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
