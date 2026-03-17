from decimal import Decimal
from pydantic import BaseModel
from app.schemas.document import DocumentRead


class DashboardStats(BaseModel):
    model_config = {"from_attributes": True}

    total_revenue: Decimal
    outstanding: Decimal
    overdue_count: int
    total_clients: int
    recent_documents: list[DocumentRead]