import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.auth import get_tenant_id
from app.database import get_db
from app.models.settings import CompanySettings
from app.schemas.settings import SettingsRead, SettingsUpdate

router = APIRouter(prefix="/api/settings", tags=["settings"])

UPLOAD_DIR = "/app/uploads/logos"


def _get_settings(db: Session, tenant_id: int) -> CompanySettings:
    settings = db.query(CompanySettings).filter(CompanySettings.tenant_id == tenant_id).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    return settings


@router.get("", response_model=SettingsRead)
def get_settings(db: Session = Depends(get_db), tenant_id: int = Depends(get_tenant_id)):
    return _get_settings(db, tenant_id)


@router.put("", response_model=SettingsRead)
def update_settings(data: SettingsUpdate, db: Session = Depends(get_db), tenant_id: int = Depends(get_tenant_id)):
    settings = _get_settings(db, tenant_id)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(settings, key, value)
    db.commit()
    db.refresh(settings)
    return settings


@router.post("/logo")
def upload_logo(file: UploadFile = File(...), db: Session = Depends(get_db), tenant_id: int = Depends(get_tenant_id)):
    settings = _get_settings(db, tenant_id)

    os.makedirs(UPLOAD_DIR, exist_ok=True)

    ext = os.path.splitext(file.filename or "logo.png")[1]
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        f.write(file.file.read())

    logo_url = f"/uploads/logos/{filename}"
    settings.logo_url = logo_url
    db.commit()
    db.refresh(settings)

    return {"logo_url": logo_url}
