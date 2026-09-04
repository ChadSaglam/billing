from datetime import UTC, datetime, timedelta

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.tenant import Tenant
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

    # Tenant-level gate (R-11). The subscription lives on the tenant, so a
    # disabled tenant or an expired trial locks every user under it.
    tenant = db.get(Tenant, user.tenant_id)
    if tenant is None or not tenant.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is disabled",
        )
    if (
        tenant.subscription_plan == "trial"
        and tenant.trial_ends_at is not None
        and tenant.trial_ends_at < datetime.now(UTC).replace(tzinfo=None)
    ):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Trial expired — please choose a plan to continue",
        )
    return user


def get_tenant_id(user: User = Depends(get_current_user)) -> int:
    return user.tenant_id


# ── Role-based access control (R-07) ────────────────────────────────
# viewer  read only
# editor  read + write business data (clients, documents, services, settings)
# admin   everything, including user management
ROLE_RANK = {"viewer": 0, "editor": 1, "admin": 2}


def require_role(minimum: str):
    """Dependency factory: reject users below `minimum`.

    Use on every state-changing endpoint. Read endpoints stay open to all
    authenticated roles.
    """
    required = ROLE_RANK[minimum]

    def _check(user: User = Depends(get_current_user)) -> User:
        if ROLE_RANK.get(user.role, -1) < required:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires {minimum} role or higher",
            )
        return user

    return _check


require_editor = require_role("editor")
require_admin = require_role("admin")
