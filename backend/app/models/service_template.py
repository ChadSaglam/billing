import datetime as dt
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ServiceTemplate(Base):
    __tablename__ = "service_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False, default="General")
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    unit: Mapped[str] = mapped_column(String(50), nullable=False, default="Stunde")
    default_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, server_default="250.00"
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime, server_default=func.now()
    )
