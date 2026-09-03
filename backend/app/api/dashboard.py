import datetime as dt
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import case, func
from sqlalchemy.orm import Session, joinedload

from app.auth import get_tenant_id
from app.database import get_db
from app.models.client import Client
from app.models.document import Document
from app.schemas.dashboard import DashboardStats, MonthlyRevenue, StatusCount

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

@router.get("", response_model=DashboardStats)
def get_dashboard(db: Session = Depends(get_db), tenant_id: int = Depends(get_tenant_id)):
    base = Document.tenant_id == tenant_id
    rechnung = Document.document_type == "rechnung"

    total_revenue = (
        db.query(func.coalesce(func.sum(Document.total), 0))
        .filter(base, rechnung, Document.status == "paid")
        .scalar()
    ) or Decimal("0")

    outstanding = (
        db.query(func.coalesce(func.sum(Document.total), 0))
        .filter(base, rechnung, Document.status == "sent")
        .scalar()
    ) or Decimal("0")

    overdue_count = (
        db.query(func.count(Document.id))
        .filter(base, rechnung, Document.status == "overdue")
        .scalar()
    ) or 0

    client_count = db.query(func.count(Client.id)).filter(Client.tenant_id == tenant_id).scalar() or 0

    recent_docs = (
        db.query(Document)
        .options(joinedload(Document.client))
        .filter(base)
        .order_by(Document.created_at.desc())
        .limit(10)
        .all()
    )

    # Monthly revenue (last 12 months)
    twelve_months_ago = dt.date.today().replace(day=1) - dt.timedelta(days=365)
    month_label = func.to_char(Document.date, 'YYYY-MM')

    monthly_rows = (
        db.query(
            month_label.label("month"),
            func.coalesce(func.sum(
                case((Document.status == "paid", Document.total), else_=Decimal("0"))
            ), 0).label("revenue"),
            func.coalesce(func.sum(
                case((Document.status.in_(["sent", "overdue"]), Document.total), else_=Decimal("0"))
            ), 0).label("outstanding"),
        )
        .filter(base, rechnung, Document.date >= twelve_months_ago)
        .group_by(month_label)
        .order_by(month_label)
        .all()
    )

    monthly_revenue = [
        MonthlyRevenue(month=r.month, revenue=r.revenue, outstanding=r.outstanding)
        for r in monthly_rows
    ]

    # Status distribution (all document types)
    status_rows = (
        db.query(Document.status, func.count(Document.id).label("count"))
        .filter(base)
        .group_by(Document.status)
        .all()
    )

    status_distribution = [
        StatusCount(status=r.status, count=r.count) for r in status_rows
    ]

    return DashboardStats(
        total_revenue=total_revenue,
        outstanding=outstanding,
        overdue_count=overdue_count,
        total_clients=client_count,
        recent_documents=recent_docs,
        monthly_revenue=monthly_revenue,
        status_distribution=status_distribution,
    )
