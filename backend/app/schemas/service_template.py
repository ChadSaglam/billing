from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class ServiceTemplateBase(BaseModel):
    name: str
    category: str = "General"
    description: str = ""
    unit: str = "Stunde"
    default_price: Decimal = Decimal("250.00")
    is_active: bool = True
    sort_order: int = 0


class ServiceTemplateCreate(ServiceTemplateBase):
    pass


class ServiceTemplateUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    description: str | None = None
    unit: str | None = None
    default_price: Decimal | None = None
    is_active: bool | None = None
    sort_order: int | None = None


class ServiceTemplateRead(ServiceTemplateBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}
