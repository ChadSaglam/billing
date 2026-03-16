from datetime import date as DateType
from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel

from app.schemas.client import ClientRead


class LineItemBase(BaseModel):
    position: int
    description: str
    quantity: Decimal = Decimal("1")
    unit_price: Decimal
    total_price: Decimal
    unit: str = "Stunde"


class LineItemCreate(LineItemBase):
    pass


class LineItemRead(LineItemBase):
    id: int
    document_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentBase(BaseModel):
    document_type: str
    client_id: int
    date: DateType
    due_date: Optional[DateType] = None
    payment_terms_days: int = 30
    status: str = "draft"
    subtotal: Decimal = Decimal("0")
    discount_percent: Decimal = Decimal("0")
    discount_amount: Decimal = Decimal("0")
    total: Decimal = Decimal("0")
    currency: str = "CHF"
    notes: Optional[str] = None


class DocumentCreate(DocumentBase):
    document_number: Optional[str] = None
    line_items: list[LineItemCreate] = []


class DocumentUpdate(BaseModel):
    document_type: Optional[str] = None
    client_id: Optional[int] = None
    date: Optional[DateType] = None
    due_date: Optional[DateType] = None
    payment_terms_days: Optional[int] = None
    status: Optional[str] = None
    subtotal: Optional[Decimal] = None
    discount_percent: Optional[Decimal] = None
    discount_amount: Optional[Decimal] = None
    total: Optional[Decimal] = None
    currency: Optional[str] = None
    notes: Optional[str] = None
    line_items: Optional[list[LineItemCreate]] = None


class StatusUpdate(BaseModel):
    status: str


class DocumentRead(DocumentBase):
    id: int
    document_number: str
    converted_from_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    line_items: list[LineItemRead] = []
    client: Optional[ClientRead] = None

    model_config = {"from_attributes": True}


class DocumentListRead(BaseModel):
    id: int
    document_type: str
    document_number: str
    client_id: int
    date: DateType
    due_date: Optional[DateType] = None
    status: str
    total: Decimal
    currency: str
    created_at: datetime
    client: Optional[ClientRead] = None

    model_config = {"from_attributes": True}
