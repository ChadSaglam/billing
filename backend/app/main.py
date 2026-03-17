import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import auth, clients, dashboard, documents, services, settings
from app.database import Base, engine, get_db
from sqlalchemy.orm import Session
from app.auth import get_current_user
from app.models.user import User


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="ChaDev Billing API",
    description="Offerte & Rechnungen management for ChaDev",
    version="2.0.0",
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

# Protected routes (JWT required via get_tenant_id dependency)
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