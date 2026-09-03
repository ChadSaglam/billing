from datetime import date as DateType
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel

from app.schemas.client import ClientRead


class LineItemBase(BaseModel):
    position: int
    description: str
    quantity: Decimal = Decimal("1")
    unit_price: Decimal
    total_price: Decimal
    vat_rate: Decimal = Decimal("8.10")
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
    due_date: DateType | None = None
    payment_terms_days: int = 30
    status: str = "draft"
    subtotal: Decimal = Decimal("0")
    discount_percent: Decimal = Decimal("0")
    discount_amount: Decimal = Decimal("0")
    vat_amount: Decimal = Decimal("0")
    total: Decimal = Decimal("0")
    currency: str = "CHF"
    notes: str | None = None
    recurrence: str | None = None


class DocumentCreate(DocumentBase):
    document_number: str | None = None
    line_items: list[LineItemCreate] = []


class DocumentUpdate(BaseModel):
    document_type: str | None = None
    client_id: int | None = None
    date: DateType | None = None
    due_date: DateType | None = None
    payment_terms_days: int | None = None
    status: str | None = None
    subtotal: Decimal | None = None
    discount_percent: Decimal | None = None
    discount_amount: Decimal | None = None
    vat_amount: Decimal | None = None
    total: Decimal | None = None
    currency: str | None = None
    notes: str | None = None
    recurrence: str | None = None
    line_items: list[LineItemCreate] | None = None


class StatusUpdate(BaseModel):
    status: str
    paid_at: DateType | None = None
    payment_method: str | None = None
    payment_reference: str | None = None


class DocumentRead(DocumentBase):
    id: int
    document_number: str
    converted_from_id: int | None = None
    paid_at: DateType | None = None
    payment_method: str | None = None
    payment_reference: str | None = None
    next_recurrence_date: DateType | None = None
    portal_token: str | None = None
    created_at: datetime
    updated_at: datetime
    line_items: list[LineItemRead] = []
    client: ClientRead | None = None
    model_config = {"from_attributes": True}


class DocumentListRead(BaseModel):
    id: int
    document_type: str
    document_number: str
    client_id: int
    date: DateType
    due_date: DateType | None = None
    status: str
    total: Decimal
    vat_amount: Decimal = Decimal("0")
    currency: str
    recurrence: str | None = None
    created_at: datetime
    client: ClientRead | None = None
    model_config = {"from_attributes": True}


# Portal (public, no auth)
class PortalDocumentRead(BaseModel):
    id: int
    document_type: str
    document_number: str
    date: DateType
    due_date: DateType | None = None
    payment_terms_days: int
    status: str
    subtotal: Decimal
    discount_percent: Decimal
    discount_amount: Decimal
    vat_amount: Decimal
    total: Decimal
    currency: str
    notes: str | None = None
    line_items: list[LineItemRead] = []
    client: ClientRead | None = None
    company_name: str | None = None
    model_config = {"from_attributes": True}


# Bulk actions
class BulkActionRequest(BaseModel):
    document_ids: list[int]


class BulkStatusRequest(BaseModel):
    document_ids: list[int]
    status: str
    paid_at: DateType | None = None
    payment_method: str | None = None
    payment_reference: str | None = None
