from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.auth import get_tenant_id
from app.database import get_db
from app.models.client import Client
from app.models.document import Document
from app.schemas.dashboard import DashboardStats

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardStats)
def get_dashboard(db: Session = Depends(get_db), tenant_id: int = Depends(get_tenant_id)):
    total_revenue = (
        db.query(func.coalesce(func.sum(Document.total), 0))
        .filter(Document.tenant_id == tenant_id, Document.document_type == "rechnung", Document.status == "paid")
        .scalar()
    ) or Decimal("0")

    outstanding = (
        db.query(func.coalesce(func.sum(Document.total), 0))
        .filter(Document.tenant_id == tenant_id, Document.document_type == "rechnung", Document.status == "sent")
        .scalar()
    ) or Decimal("0")

    overdue_count = (
        db.query(func.count(Document.id))
        .filter(Document.tenant_id == tenant_id, Document.document_type == "rechnung", Document.status == "overdue")
        .scalar()
    ) or 0

    client_count = db.query(func.count(Client.id)).filter(Client.tenant_id == tenant_id).scalar() or 0

    recent_docs = (
        db.query(Document)
        .options(joinedload(Document.client))
        .filter(Document.tenant_id == tenant_id)
        .order_by(Document.created_at.desc())
        .limit(10)
        .all()
    )

    return DashboardStats(
        total_revenue=total_revenue,
        outstanding=outstanding,
        overdue_count=overdue_count,
        total_clients=client_count,
        recent_documents=recent_docs,
    )
