import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.settings import CompanySettings
from app.schemas.settings import SettingsRead, SettingsUpdate

router = APIRouter(prefix="/api/settings", tags=["settings"])

UPLOAD_DIR = "/app/uploads/logos"


@router.get("", response_model=SettingsRead)
def get_settings(db: Session = Depends(get_db)):
    settings = db.query(CompanySettings).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    return settings


@router.put("", response_model=SettingsRead)
def update_settings(data: SettingsUpdate, db: Session = Depends(get_db)):
    settings = db.query(CompanySettings).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(settings, key, value)
    db.commit()
    db.refresh(settings)
    return settings


@router.post("/logo")
def upload_logo(file: UploadFile = File(...), db: Session = Depends(get_db)):
    settings = db.query(CompanySettings).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")

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
