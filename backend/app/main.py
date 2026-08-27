"""Billing — multi-tenant invoicing & quoting SaaS.

Every request is scoped to a tenant. See CLAUDE.md before adding an endpoint.
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text
from sqlalchemy.orm import Session
from starlette.middleware.base import BaseHTTPMiddleware

from app.api import auth, clients, dashboard, documents, portal, services, settings, tenant, users
from app.auth import get_current_user
from app.config import settings as app_settings
from app.database import Base, SessionLocal, engine, get_db
from app.models.user import User
from app.rate_limit import limiter

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s | %(message)s",
)
log = logging.getLogger("billing")

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOADS_DIR = BASE_DIR / "uploads"
LOGOS_DIR = UPLOADS_DIR / "logos"

BACKGROUND_INTERVAL_SECONDS = 3600


def _run_scheduled_jobs(source: str) -> None:
    """Overdue marking + recurring invoice generation. Idempotent by design."""
    db = SessionLocal()
    try:
        from app.services.overdue_checker import mark_overdue_invoices
        from app.services.recurring_invoices import process_recurring_invoices

        count = mark_overdue_invoices(db)
        if count:
            log.info("[%s] marked %d invoices overdue", source, count)

        created = process_recurring_invoices(db)
        if created:
            log.info("[%s] created %d recurring invoices", source, created)
    except Exception:
        log.exception("[%s] scheduled job failed", source)
    finally:
        db.close()


async def _background_loop() -> None:
    import asyncio

    while True:
        await asyncio.sleep(BACKGROUND_INTERVAL_SECONDS)
        _run_scheduled_jobs("background")


@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio

    app_settings.validate_runtime()
    log.info("Starting %s (%s)", app_settings.APP_NAME, app_settings.APP_ENV)

    # Schema is owned by Alembic. create_all() is a dev-only convenience so a
    # fresh clone boots without running migrations first.
    if not app_settings.is_production:
        Base.metadata.create_all(bind=engine)

    _run_scheduled_jobs("startup")

    # NOTE(scale): this loop lives in the web process, so it runs once per
    # worker. Safe at 1 worker. Before scaling out, move it to a dedicated
    # worker container or guard it with a Postgres advisory lock.
    task = asyncio.create_task(_background_loop())
    try:
        yield
    finally:
        task.cancel()


app = FastAPI(
    title=f"{app_settings.APP_NAME} API",
    description="Multi-tenant invoicing and quoting for small businesses.",
    version="3.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


class CatchUnhandledErrors(BaseHTTPMiddleware):
    """Turn an unhandled exception into a normal 500 response.

    Starlette's own 500 handler sits OUTSIDE CORSMiddleware, so a crash comes
    back with no Access-Control-Allow-Origin header and the browser reports it
    as a CORS error. That sends you looking at CORS config when the real
    problem is a traceback in the log. Catching it here — inside CORS — means
    a crash looks like a crash.
    """

    async def dispatch(self, request: Request, call_next):
        try:
            return await call_next(request)
        except Exception:
            log.exception("Unhandled error on %s %s", request.method, request.url.path)
            return JSONResponse(
                status_code=500,
                content={"detail": "Internal server error"},
            )


# Order matters: this is added FIRST so CORSMiddleware ends up outermost and
# gets to attach its headers to the response above.
app.add_middleware(CatchUnhandledErrors)

app.add_middleware(
    CORSMiddleware,
    allow_origins=app_settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in (
    auth.router,
    tenant.router,
    clients.router,
    documents.router,
    dashboard.router,
    settings.router,
    services.router,
    portal.router,
    users.router,
):
    app.include_router(router)

LOGOS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


@app.get("/api/health", tags=["ops"])
def health(db: Session = Depends(get_db)):
    import shutil

    report: dict = {"status": "ok", "app": app_settings.APP_NAME, "env": app_settings.APP_ENV}

    try:
        db.execute(text("SELECT 1"))
        report["database"] = "connected"
    except Exception as exc:
        report["database"] = f"error: {exc}"
        report["status"] = "degraded"

    try:
        usage = shutil.disk_usage(str(UPLOADS_DIR))
        report["disk"] = {
            "total_gb": round(usage.total / (1024**3), 2),
            "free_gb": round(usage.free / (1024**3), 2),
            "used_percent": round(usage.used / usage.total * 100, 1),
        }
    except Exception:
        report["disk"] = "unavailable"

    try:
        row = db.execute(text("SELECT version_num FROM alembic_version LIMIT 1")).fetchone()
        report["migration"] = row[0] if row else "none"
    except Exception:
        report["migration"] = "unknown"

    return report


@app.post("/api/seed", tags=["ops"])
def seed_data(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Fill the caller's own workspace with demo data. Never touches other tenants."""
    from app.seed import run_seed

    result = run_seed(db, user.tenant_id)
    return {"message": "Demo data created", **result}
