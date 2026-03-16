from decimal import Decimal

from pydantic import BaseModel

from app.schemas.document import DocumentListRead


class DashboardStats(BaseModel):
    total_revenue: Decimal
    outstanding: Decimal
    overdue_count: int
    total_clients: int
    recent_documents: list[DocumentListRead]
