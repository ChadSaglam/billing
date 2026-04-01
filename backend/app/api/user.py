import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user, get_tenant_id, hash_password
from app.database import get_db
from app.models.user import User
from app.schemas.user import InviteRequest, InviteResponse, UserRead, UserUpdate

router = APIRouter(prefix="/api/users", tags=["users"])


def _require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@router.get("", response_model=list[UserRead])
def list_users(
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_tenant_id),
    _admin: User = Depends(_require_admin),
):
    return (
        db.query(User)
        .filter(User.tenant_id == tenant_id)
        .order_by(User.created_at.asc())
        .all()
    )


@router.post("/invite", response_model=InviteResponse, status_code=201)
def invite_user(
    data: InviteRequest,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_tenant_id),
    _admin: User = Depends(_require_admin),
):
    if data.role not in ("admin", "editor", "viewer"):
        raise HTTPException(status_code=400, detail="Role must be admin, editor, or viewer")

    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")

    temp_password = secrets.token_urlsafe(12)

    user = User(
        email=data.email,
        full_name=data.full_name,
        hashed_password=hash_password(temp_password),
        role=data.role,
        tenant_id=tenant_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return InviteResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        temp_password=temp_password,
    )


@router.patch("/{user_id}", response_model=UserRead)
def update_user(
    user_id: int,
    data: UserUpdate,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_tenant_id),
    admin: User = Depends(_require_admin),
):
    user = db.query(User).filter(User.id == user_id, User.tenant_id == tenant_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if data.role is not None:
        if data.role not in ("admin", "editor", "viewer"):
            raise HTTPException(status_code=400, detail="Invalid role")
        if user.id == admin.id and data.role != "admin":
            raise HTTPException(status_code=400, detail="Cannot remove your own admin role")
        user.role = data.role

    if data.full_name is not None:
        user.full_name = data.full_name

    if data.is_active is not None:
        if user.id == admin.id and not data.is_active:
            raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
        user.is_active = data.is_active

    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
def remove_user(
    user_id: int,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_tenant_id),
    admin: User = Depends(_require_admin),
):
    user = db.query(User).filter(User.id == user_id, User.tenant_id == tenant_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    db.delete(user)
    db.commit()