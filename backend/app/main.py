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
from app.models.user import User

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOADS_DIR = BASE_DIR / "uploads"
LOGOS_DIR = UPLOADS_DIR / "logos"

async def _background_jobs():
    import asyncio

    while True:
        try:
            db = SessionLocal()

            from app.services.overdue_checker import mark_overdue_invoices
            count = mark_overdue_invoices(db)
            if count:
                print(f"[overdue] Marked {count} invoices as overdue")

            from app.services.recurring_invoices import process_recurring_invoices
            created = process_recurring_invoices(db)
            if created:
                print(f"[recurring] Created {created} recurring invoices")

            db.close()
        except Exception as e:
            print(f"[background] Error: {e}")

        await asyncio.sleep(3600)

@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio

    # Schema is owned by Alembic only — `alembic upgrade head`.
    # create_all() here silently diverged from the migrations (R-10).
    db = SessionLocal()

    try:
        from app.services.overdue_checker import mark_overdue_invoices
        count = mark_overdue_invoices(db)
        if count:
            print(f"[startup] Marked {count} invoices as overdue")

        from app.services.recurring_invoices import process_recurring_invoices
        created = process_recurring_invoices(db)
        if created:
            print(f"[startup] Created {created} recurring invoices")
    finally:
        db.close()

    task = asyncio.create_task(_background_jobs())
    yield
    task.cancel()

app = FastAPI(
    title="ChaDev Billing API",
    description="Offerte & Rechnungen management for ChaDev",
    version="2.4.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=app_settings.ALLOWED_ORIGINS,
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

if app_settings.APP_ENV != "production":

    @app.post("/api/seed")
    def seed_data(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
        """Demo data. Not registered when APP_ENV=production (R-08)."""
        from app.seed import run_seed

        result = run_seed(db, user.tenant_id)
        return {"message": "Seed data created", **result}