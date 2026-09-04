from datetime import datetime

from pydantic import BaseModel


class ClientBase(BaseModel):
    customer_number: str
    company_name: str
    contact_person: str | None = None
    email: str | None = None
    phone: str | None = None
    street: str
    postal_code: str
    city: str
    country: str = "Schweiz"
    notes: str | None = None


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    customer_number: str | None = None
    company_name: str | None = None
    contact_person: str | None = None
    email: str | None = None
    phone: str | None = None
    street: str | None = None
    postal_code: str | None = None
    city: str | None = None
    country: str | None = None
    notes: str | None = None


class ClientRead(ClientBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ClientPage(BaseModel):
    """Paginated envelope for the list endpoint (R-13)."""

    items: list[ClientRead]
    total: int
    page: int
    page_size: int
