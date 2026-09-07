import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api import auth, clients, dashboard, documents, portal, services, settings, users
from app.auth import get_current_user
from app.config import settings as app_settings
from app.database import SessionLocal, get_db
from app.limiter import limiter
from app.logging_config import configure_logging
from app.middleware import RequestContextMiddleware
from app.models.user import User
from app.sentry import configure_sentry

configure_logging(app_settings.LOG_LEVEL)
configure_sentry(app_settings.SENTRY_DSN, app_settings.APP_ENV)
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOADS_DIR = BASE_DIR / "uploads"
LOGOS_DIR = UPLOADS_DIR / "logos"

# Postgres advisory lock id for the scheduled jobs. Any constant works — it
# just has to be the same in every worker so they contend on one lock.
JOBS_LOCK_ID = 727272


def _run_scheduled_jobs(db: Session, source: str) -> None:
    """Run the hourly jobs, but on exactly one worker per pass.

    These used to run in-process in every uvicorn worker, so N workers meant
    N copies of the same recurring invoice (R-14). `pg_try_advisory_lock`
    elects a single runner database-wide; everyone else skips this pass.
    On non-Postgres databases (none today) it simply runs unlocked.
    """
    from app.services.overdue_checker import mark_overdue_invoices
    from app.services.recurring_invoices import process_recurring_invoices

    locked = False
    if db.bind.dialect.name == "postgresql":
        locked = db.execute(
            text("SELECT pg_try_advisory_lock(:lock_id)"), {"lock_id": JOBS_LOCK_ID}
        ).scalar()
        if not locked:
            return  # another worker owns this pass
    try:
        count = mark_overdue_invoices(db)
        if count:
            logger.info("[%s] Marked %d invoices as overdue", source, count)

        created = process_recurring_invoices(db)
        if created:
            logger.info("[%s] Created %d recurring invoices", source, created)
    finally:
        if locked:
            db.execute(
                text("SELECT pg_advisory_unlock(:lock_id)"), {"lock_id": JOBS_LOCK_ID}
            )


async def _background_jobs():
    import asyncio

    while True:
        try:
            db = SessionLocal()
            try:
                _run_scheduled_jobs(db, "background")
            finally:
                db.close()
        except Exception:
            logger.exception("[background] scheduled jobs failed")

        await asyncio.sleep(3600)


@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio

    # Schema is owned by Alembic only — `alembic upgrade head`.
    # create_all() here silently diverged from the migrations (R-10).
    db = SessionLocal()
    try:
        _run_scheduled_jobs(db, "startup")
    finally:
        db.close()

    task = asyncio.create_task(_background_jobs())
    yield
    task.cancel()


app = FastAPI(
    title="ChaDev Billing API",
    description="Offerte & Rechnungen management for ChaDev",
    version="2.5.0",
    lifespan=lifespan,
    # The interactive docs enumerate every route and schema. Nothing in
    # production needs that, so they are not registered there (2.1).
    docs_url=None if app_settings.is_production else "/docs",
    redoc_url=None if app_settings.is_production else "/redoc",
    openapi_url=None if app_settings.is_production else "/openapi.json",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=app_settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)
# add_middleware() prepends, so this is the outermost layer: the id exists
# before CORS and every handler run, and preflight responses carry it too.
app.add_middleware(RequestContextMiddleware)

app.include_router(auth.router)
app.include_router(clients.router)
app.include_router(documents.router)
app.include_router(dashboard.router)
app.include_router(settings.router)
app.include_router(services.router)
app.include_router(portal.router)
app.include_router(users.router)

LOGOS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    import shutil

    health = {"status": "ok"}

    try:
        db.execute(text("SELECT 1"))
        health["database"] = "connected"
    except Exception as e:
        health["database"] = f"error: {e}"
        health["status"] = "degraded"

    try:
        usage = shutil.disk_usage(str(UPLOADS_DIR))
        health["disk"] = {
            "total_gb": round(usage.total / (1024**3), 2),
            "free_gb": round(usage.free / (1024**3), 2),
            "used_percent": round(usage.used / usage.total * 100, 1),
        }
    except Exception:
        health["disk"] = "unavailable"

    try:
        result = db.execute(text("SELECT version_num FROM alembic_version LIMIT 1"))
        row = result.fetchone()
        health["migration"] = row[0] if row else "none"
    except Exception:
        health["migration"] = "unknown"

    return health


if not app_settings.is_production:

    @app.post("/api/seed")
    def seed_data(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
        """Demo data. Not registered when APP_ENV=production (R-08)."""
        from app.seed import run_seed

        result = run_seed(db, user.tenant_id)
        return {"message": "Seed data created", **result}
