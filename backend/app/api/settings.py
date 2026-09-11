import io
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session

from app.auth import get_tenant_id, require_editor
from app.database import get_db
from app.limiter import TENANT_LIMIT, limiter, tenant_or_ip_key
from app.models.settings import CompanySettings
from app.schemas.settings import SettingsRead, SettingsUpdate
from app.services.storage import get_storage
from app.services.tenancy import scoped

router = APIRouter(prefix="/api/settings", tags=["settings"])

def _get_settings(db: Session, tenant_id: int) -> CompanySettings:
    settings = scoped(db, CompanySettings, tenant_id).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    return settings

@router.get("", response_model=SettingsRead)
def get_settings(db: Session = Depends(get_db), tenant_id: int = Depends(get_tenant_id)):
    return _get_settings(db, tenant_id)

@router.put("", response_model=SettingsRead, dependencies=[Depends(require_editor)])
def update_settings(data: SettingsUpdate, db: Session = Depends(get_db), tenant_id: int = Depends(get_tenant_id)):
    settings = _get_settings(db, tenant_id)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(settings, key, value)
    db.commit()
    db.refresh(settings)
    return settings

MAX_LOGO_BYTES = 2 * 1024 * 1024  # 2 MB
# SVG is deliberately excluded: it is an XML document that can carry <script>,
# and these files are served from the same origin as the app (R-09).
ALLOWED_LOGO_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
}


@router.post("/logo", dependencies=[Depends(require_editor)])
@limiter.limit(TENANT_LIMIT, key_func=tenant_or_ip_key)
async def upload_logo(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_tenant_id),
):
    """Store a tenant logo.

    Validates the declared content type, the real image content and the size,
    and generates the filename itself. Previously it trusted the client's
    filename extension and wrote unbounded bytes to disk (R-09).
    """
    settings = _get_settings(db, tenant_id)

    if file.content_type not in ALLOWED_LOGO_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported type {file.content_type}. Allowed: PNG, JPEG, WebP",
        )

    content = await file.read(MAX_LOGO_BYTES + 1)
    if len(content) > MAX_LOGO_BYTES:
        raise HTTPException(status_code=413, detail="Logo must be 2 MB or smaller")
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    # Verify it really is the image it claims to be, not just a renamed file.
    try:
        from PIL import Image

        Image.open(io.BytesIO(content)).verify()
    except Exception:
        raise HTTPException(status_code=400, detail="File is not a valid image") from None

    storage = get_storage()
    key = f"logos/{uuid.uuid4().hex}{ALLOWED_LOGO_TYPES[file.content_type]}"
    logo_url = storage.save(key, content, file.content_type)

    # Remove the previous logo so uploads cannot accumulate unbounded — but
    # only if it lives in this backend (R-90).
    old_key = storage.key_for_url(settings.logo_url or "")
    if old_key and old_key != key:
        storage.delete(old_key)

    settings.logo_url = logo_url
    db.commit()
    db.refresh(settings)
    return {"logo_url": settings.logo_url}


@router.post("/onboarding-complete", dependencies=[Depends(require_editor)])
def complete_onboarding(db: Session = Depends(get_db), tenant_id: int = Depends(get_tenant_id)):
    settings = _get_settings(db, tenant_id)
    settings.onboarding_completed = True
    db.commit()
    return {"status": "ok"}
