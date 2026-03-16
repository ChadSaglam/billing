from decimal import Decimal

from pydantic import BaseModel


class SettingsBase(BaseModel):
    company_name: str
    street: str
    postal_code: str
    city: str
    country: str
    uid: str
    bank_name: str
    iban: str
    bic: str
    email: str
    phone: str
    website: str
    default_hourly_rate: Decimal
    default_payment_terms_days: int
    logo_url: str | None = None
    next_invoice_number: int
    next_offerte_number: int


class SettingsRead(SettingsBase):
    id: int

    model_config = {"from_attributes": True}


class SettingsUpdate(BaseModel):
    company_name: str | None = None
    street: str | None = None
    postal_code: str | None = None
    city: str | None = None
    country: str | None = None
    uid: str | None = None
    bank_name: str | None = None
    iban: str | None = None
    bic: str | None = None
    email: str | None = None
    phone: str | None = None
    website: str | None = None
    default_hourly_rate: Decimal | None = None
    default_payment_terms_days: int | None = None
    logo_url: str | None = None
    next_invoice_number: int | None = None
    next_offerte_number: int | None = None
