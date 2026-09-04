from datetime import UTC, datetime, timedelta

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
from app.limiter import limiter
from app.models.settings import CompanySettings
from app.models.tenant import Tenant
from app.models.user import User

router = APIRouter(prefix="/api/auth", tags=["auth"])


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
    token_type: str = "bearer"  # noqa: S105 - OAuth2 token type, not a secret


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    tenant_id: int
    tenant_name: str
    # Subscription state (R-11) so the frontend can show trial status.
    subscription_plan: str
    trial_ends_at: datetime | None

    model_config = {"from_attributes": True}


@router.post("/register", response_model=TokenResponse, status_code=201)
@limiter.limit("5/minute")
def register(request: Request, data: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")

    slug = data.company_name.lower().replace(" ", "-").replace(".", "")
    if db.query(Tenant).filter(Tenant.slug == slug).first():
        slug = f"{slug}-{db.query(Tenant).count() + 1}"

    # The plan/trial env settings finally land on a real model (R-11).
    # A paid/default plan gets no trial clock at all.
    trial_ends = None
    if app_settings.DEFAULT_PLAN == "trial":
        trial_ends = (datetime.now(UTC) + timedelta(days=app_settings.TRIAL_DAYS)).replace(tzinfo=None)

    tenant = Tenant(
        name=data.company_name,
        slug=slug,
        subscription_plan=app_settings.DEFAULT_PLAN,
        trial_ends_at=trial_ends,
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
        subscription_plan=user.tenant.subscription_plan,
        trial_ends_at=user.tenant.trial_ends_at,
    )
