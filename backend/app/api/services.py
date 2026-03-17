from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_tenant_id
from app.database import get_db
from app.models.service_template import ServiceTemplate
from app.schemas.service_template import (
    ServiceTemplateCreate,
    ServiceTemplateRead,
    ServiceTemplateUpdate,
)

router = APIRouter(prefix="/api/services", tags=["services"])


@router.get("", response_model=list[ServiceTemplateRead])
def list_services(
    category: str | None = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_tenant_id),
):
    q = db.query(ServiceTemplate).filter(ServiceTemplate.tenant_id == tenant_id)
    if active_only:
        q = q.filter(ServiceTemplate.is_active.is_(True))
    if category:
        q = q.filter(ServiceTemplate.category == category)
    return q.order_by(ServiceTemplate.category, ServiceTemplate.sort_order, ServiceTemplate.name).all()


@router.post("", response_model=ServiceTemplateRead, status_code=201)
def create_service(payload: ServiceTemplateCreate, db: Session = Depends(get_db), tenant_id: int = Depends(get_tenant_id)):
    svc = ServiceTemplate(**payload.model_dump(), tenant_id=tenant_id)
    db.add(svc)
    db.commit()
    db.refresh(svc)
    return svc


@router.put("/{service_id}", response_model=ServiceTemplateRead)
def update_service(
    service_id: int,
    payload: ServiceTemplateUpdate,
    db: Session = Depends(get_db),
    tenant_id: int = Depends(get_tenant_id),
):
    svc = db.query(ServiceTemplate).filter(ServiceTemplate.id == service_id, ServiceTemplate.tenant_id == tenant_id).first()
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(svc, key, value)
    db.commit()
    db.refresh(svc)
    return svc


@router.delete("/{service_id}", status_code=204)
def delete_service(service_id: int, db: Session = Depends(get_db), tenant_id: int = Depends(get_tenant_id)):
    svc = db.query(ServiceTemplate).filter(ServiceTemplate.id == service_id, ServiceTemplate.tenant_id == tenant_id).first()
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")
    db.delete(svc)
    db.commit()
