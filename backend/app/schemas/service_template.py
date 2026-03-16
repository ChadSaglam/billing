from datetime import datetime
from decimal import Decimal
from typing import Optional

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
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    unit: Optional[str] = None
    default_price: Optional[Decimal] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class ServiceTemplateRead(ServiceTemplateBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}
