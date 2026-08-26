import datetime as dt
import re
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.auth import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.config import settings as app_settings
from app.database import get_db
from app.models.settings import CompanySettings
from app.models.tenant import Tenant
from app.models.user import User
from app.plans import get_plan
from app.rate_limit import limiter

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return (slug or "workspace")[:80]


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    company_name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"  # noqa: S105


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    tenant_id: int
    tenant_name: str
    plan: str
    plan_name: str
    tenant_status: str
    trial_ends_at: dt.datetime | None = None

    model_config = {"from_attributes": True}


@router.post("/register", response_model=TokenResponse, status_code=201)
@limiter.limit("5/minute")
def register(request: Request, data: RegisterRequest, db: Session = Depends(get_db)):
    """Self-serve signup: creates the workspace, the owner, and a trial."""
    if not app_settings.SIGNUP_ENABLED:
        raise HTTPException(status_code=403, detail="Signups are currently closed")

    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")

    slug = _slugify(data.company_name)
    if db.query(Tenant).filter(Tenant.slug == slug).first():
        slug = f"{slug}-{secrets.token_hex(3)}"

    plan = app_settings.DEFAULT_PLAN
    tenant = Tenant(
        name=data.company_name,
        slug=slug,
        plan=plan,
        status="active",
        trial_ends_at=(
            dt.datetime.utcnow() + dt.timedelta(days=app_settings.TRIAL_DAYS)
            if plan == "trial"
            else None
        ),
    )
    db.add(tenant)
    db.flush()

    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        role="admin",
        tenant_id=tenant.id,
    )
    db.add(user)
    db.flush()

    db.add(CompanySettings(tenant_id=tenant.id, company_name=data.company_name))
    db.commit()

    return TokenResponse(
        access_token=create_access_token(user.id, tenant.id),
        refresh_token=create_refresh_token(user.id, tenant.id),
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(request: Request, data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")
    return TokenResponse(
        access_token=create_access_token(user.id, user.tenant_id),
        refresh_token=create_refresh_token(user.id, user.tenant_id),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(data: RefreshRequest, db: Session = Depends(get_db)):
    payload = decode_refresh_token(data.refresh_token)
    user_id = int(payload["sub"])
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or disabled")
    return TokenResponse(
        access_token=create_access_token(user.id, user.tenant_id),
        refresh_token=create_refresh_token(user.id, user.tenant_id),
    )


@router.get("/me", response_model=UserResponse)
def get_me(user: User = Depends(get_current_user)):
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        tenant_id=user.tenant_id,
        tenant_name=user.tenant.name,
        plan=user.tenant.plan,
        plan_name=get_plan(user.tenant.plan).name,
        tenant_status=user.tenant.status,
        trial_ends_at=user.tenant.trial_ends_at,
    )
