import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from app.api import clients, dashboard, documents, services, settings
from app.database import Base, engine, get_db
from app.models import Client, CompanySettings, Document, LineItem, ServiceTemplate  # noqa: F401 — ensure models registered
from app.seed import run_seed


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables
    Base.metadata.create_all(bind=engine)

    # Seed default company settings if none exist
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        existing = db.query(CompanySettings).first()
        if not existing:
            db.add(CompanySettings())
            db.commit()

        # Seed default service templates if none exist
        from app.models.service_template import ServiceTemplate as ST
        if db.query(ST).count() == 0:
            from app.seed import seed_services
            seed_services(db)
    finally:
        db.close()

    yield


app = FastAPI(
    title="ChaDev Billing API",
    description="Offerte & Rechnungen management for ChaDev",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
def seed_data(db: Session = Depends(get_db)):
    result = run_seed(db)
    return {"message": "Seed data created", **result}
