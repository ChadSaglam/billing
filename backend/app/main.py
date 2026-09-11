import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api import auth, clients, dashboard, documents, portal, services, settings, sso, users
from app.auth import get_current_user
from app.config import settings as app_settings
from app.core.errors import RequestContextMiddleware, install_error_handlers
from app.core.logging_config import configure_logging
from app.core.sentry import configure_sentry
from app.database import SessionLocal, get_db
from app.limiter import limiter, rate_limit_exceeded_handler
from app.models.user import User
from app.services.events import delivery_health
from app.services.jobs import background_jobs_loop, run_scheduled_jobs

configure_logging(app_settings.LOG_LEVEL)
configure_sentry(app_settings.SENTRY_DSN, app_settings.APP_ENV)
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOADS_DIR = BASE_DIR / "uploads"
LOGOS_DIR = UPLOADS_DIR / "logos"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Schema is owned by Alembic only — `alembic upgrade head`.
    # create_all() here silently diverged from the migrations (R-10).
    #
    # Scheduled jobs run here only when RUN_JOBS_IN_API is true (the default,
    # for single-container and local dev). In compose the API sets it false
    # and the `jobs` service (`python -m app.jobs`) is the one runner (R-84).
    task = None
    if app_settings.RUN_JOBS_IN_API:
        db = SessionLocal()
        try:
            run_scheduled_jobs(db, "startup")
        finally:
            db.close()
        task = asyncio.create_task(background_jobs_loop())
    else:
        logger.info("RUN_JOBS_IN_API=false — scheduled jobs left to the jobs worker")
    yield
    if task is not None:
        task.cancel()


_is_production = app_settings.APP_ENV == "production"

app = FastAPI(
    title="ChaDev Billing API",
    description="Offerte & Rechnungen management for ChaDev",
    version="2.5.0",
    lifespan=lifespan,
    # Swagger/ReDoc and the schema list every route and model. Hidden in
    # production (R-89); still served in dev/test, where tests rely on them.
    docs_url=None if _is_production else "/docs",
    redoc_url=None if _is_production else "/redoc",
    openapi_url=None if _is_production else "/openapi.json",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
install_error_handlers(app)
app.add_middleware(RequestContextMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=app_settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(clients.router)
app.include_router(documents.router)
app.include_router(dashboard.router)
app.include_router(settings.router)
app.include_router(services.router)
app.include_router(portal.router)
app.include_router(users.router)
app.include_router(sso.router)

LOGOS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    """Unauthenticated liveness/readiness probe (CI, compose healthcheck).

    Always: status, version, database, migration, storage, jobs. Disk usage
    and the outbound-events backlog are operational details and only
    reported outside production (R-75, R-104).
    """
    health = {
        "status": "ok",
        "version": app.version,
        "database": "unknown",
        "migration": "unknown",
        "storage": app_settings.STORAGE_BACKEND,
        "jobs": "in-api" if app_settings.RUN_JOBS_IN_API else "worker",
    }

    try:
        db.execute(text("SELECT 1"))
        health["database"] = "connected"
    except Exception as e:
        health["database"] = f"error: {e}"
        health["status"] = "degraded"

    try:
        row = db.execute(text("SELECT version_num FROM alembic_version LIMIT 1")).fetchone()
        health["migration"] = row[0] if row else "none"
    except Exception:
        health["migration"] = "unknown"

    if not _is_production:
        import shutil

        try:
            usage = shutil.disk_usage(str(UPLOADS_DIR))
            health["disk"] = {
                "total_gb": round(usage.total / (1024**3), 2),
                "free_gb": round(usage.free / (1024**3), 2),
                "used_percent": round(usage.used / usage.total * 100, 1),
            }
        except Exception:
            health["disk"] = "unavailable"

        # Outbound platform events (R-104): rows still to be tried and rows
        # that gave up. Operational detail like `disk`, so non-production only.
        try:
            health["events"] = delivery_health(db)
        except Exception:
            health["events"] = "unavailable"

    return health


if app_settings.APP_ENV != "production":

    @app.post("/api/seed")
    def seed_data(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
        """Demo data. Not registered when APP_ENV=production (R-08)."""
        from app.seed import run_seed

        result = run_seed(db, user.tenant_id)
        return {"message": "Seed data created", **result}
