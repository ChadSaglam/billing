from datetime import UTC, datetime, timedelta

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password[:72].encode(), bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain[:72].encode(), hashed.encode())

def create_access_token(user_id: int, tenant_id: int) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "tid": tenant_id, "exp": expire, "type": "access"}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def create_refresh_token(user_id: int, tenant_id: int) -> str:
    expire = datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {"sub": str(user_id), "tid": tenant_id, "exp": expire, "type": "refresh"}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_refresh_token(token: str) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired refresh token",
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "refresh":
            raise credentials_exception
        return payload
    except (JWTError, ValueError):
        raise credentials_exception from None


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "access":
            raise credentials_exception
        user_id = int(payload.get("sub", 0))
        if not user_id:
            raise credentials_exception
    except (JWTError, ValueError):
        raise credentials_exception from None

    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise credentials_exception
    return user

def get_tenant_id(user: User = Depends(get_current_user)) -> int:
    return user.tenant_id


# ── Tenant / plan dependencies ───────────────────────────────

def get_current_tenant(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The caller's tenant row. Use when you need plan/status, not just the id."""
    from app.models.tenant import Tenant

    tenant = db.get(Tenant, user.tenant_id)
    if not tenant:
        raise HTTPException(status_code=401, detail="Workspace not found")
    return tenant


def require_writable_tenant(tenant=Depends(get_current_tenant)):
    """Gate every write endpoint. Expired trials and unpaid accounts go read-only."""
    if not tenant.is_usable:
        reason = (
            "trial_expired" if tenant.trial_expired
            else "subscription_inactive"
        )
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "error": reason,
                "plan": tenant.plan,
                "status": tenant.status,
                "message": "Your workspace is read-only. Upgrade to continue.",
            },
        )
    return tenant
