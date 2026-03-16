from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.client import Client
from app.models.document import Document
from app.schemas.dashboard import DashboardStats

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardStats)
def get_dashboard(db: Session = Depends(get_db)):
    # Total revenue (paid rechnungen)
    total_revenue = (
        db.query(func.coalesce(func.sum(Document.total), 0))
        .filter(Document.document_type == "rechnung", Document.status == "paid")
        .scalar()
    ) or Decimal("0")

    # Outstanding (sent rechnungen)
    outstanding = (
        db.query(func.coalesce(func.sum(Document.total), 0))
        .filter(Document.document_type == "rechnung", Document.status == "sent")
        .scalar()
    ) or Decimal("0")

    # Overdue count
    overdue_count = (
        db.query(func.count(Document.id))
        .filter(Document.document_type == "rechnung", Document.status == "overdue")
        .scalar()
    ) or 0

    # Client count
    client_count = db.query(func.count(Client.id)).scalar() or 0

    # Recent documents
    recent_docs = (
        db.query(Document)
        .options(joinedload(Document.client))
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
