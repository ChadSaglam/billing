from decimal import Decimal

from sqlalchemy import Numeric, String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CompanySettings(Base):
    __tablename__ = "company_settings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), unique=True, nullable=False)
    company_name: Mapped[str] = mapped_column(String(255), default="ChaDev")
    street: Mapped[str] = mapped_column(String(255), default="Hohlstrasse 485A")
    postal_code: Mapped[str] = mapped_column(String(10), default="8048")
    city: Mapped[str] = mapped_column(String(100), default="Zürich")
    country: Mapped[str] = mapped_column(String(100), default="Schweiz")
    uid: Mapped[str] = mapped_column(String(50), default="***REMOVED***")
    bank_name: Mapped[str] = mapped_column(String(255), default="Migros Bank AG")
    iban: Mapped[str] = mapped_column(String(50), default="***REMOVED***")
    bic: Mapped[str] = mapped_column(String(50), default="MIGRCHZZXXX")
    email: Mapped[str] = mapped_column(String(255), default="info@chadev.ch")
    phone: Mapped[str] = mapped_column(String(50), default="***REMOVED***")
    website: Mapped[str] = mapped_column(String(255), default="www.chadev.ch")
    default_hourly_rate: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("250.00")
    )
    default_payment_terms_days: Mapped[int] = mapped_column(default=30)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    next_invoice_number: Mapped[int] = mapped_column(default=1326)
    next_offerte_number: Mapped[int] = mapped_column(default=2001)
