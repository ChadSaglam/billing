from decimal import Decimal

from pydantic import BaseModel

from app.schemas.document import DocumentRead


class MonthlyRevenue(BaseModel):
    month: str
    revenue: Decimal
    outstanding: Decimal

class StatusCount(BaseModel):
    status: str
    count: int

class DashboardStats(BaseModel):
    model_config = {"from_attributes": True}
    total_revenue: Decimal
    outstanding: Decimal
    overdue_count: int
    total_clients: int
    recent_documents: list[DocumentRead]
    monthly_revenue: list[MonthlyRevenue]
    status_distribution: list[StatusCount]
