import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import auth, clients, dashboard, documents, services, settings
from app.database import Base, engine, get_db, SessionLocal
from sqlalchemy.orm import Session
from app.auth import get_current_user
from app.models.user import User


async def _check_overdue():
    """Run overdue check in background."""
    import asyncio
    while True:
        try:
            db = SessionLocal()
            from app.services.overdue_checker import mark_overdue_invoices
            count = mark_overdue_invoices(db)
            if count:
                print(f"[overdue] Marked {count} invoices as overdue")
            db.close()
        except Exception as e:
            print(f"[overdue] Error: {e}")
        await asyncio.sleep(3600)  # check every hour


@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio
    Base.metadata.create_all(bind=engine)

    # Run once on startup
    db = SessionLocal()
    try:
        from app.services.overdue_checker import mark_overdue_invoices
        count = mark_overdue_invoices(db)
        if count:
            print(f"[startup] Marked {count} invoices as overdue")
    finally:
        db.close()

    # Schedule hourly check
    task = asyncio.create_task(_check_overdue())
    yield
    task.cancel()


app = FastAPI(
    title="ChaDev Billing API",
    description="Offerte & Rechnungen management for ChaDev",
    version="2.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth routes (no JWT required)
app.include_router(auth.router)

# Protected routes
app.include_router(clients.router)
app.include_router(documents.router)
app.include_router(dashboard.router)
app.include_router(settings.router)
app.include_router(services.router)

os.makedirs("/app/uploads/logos", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="/app/uploads"), name="uploads")


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/seed")
def seed_data(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from app.seed import run_seed
    result = run_seed(db, user.tenant_id)
    return {"message": "Seed data created", **result}
