from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CompanySettings(Base):
    """Per-tenant company profile.

    Deliberately has no business defaults: a tenant fills these in during
    onboarding. Hardcoded defaults meant every new tenant started with
    another company's IBAN and UID, which produced valid-looking but wrong
    QR-bills (R-05).
    """

    __tablename__ = "company_settings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), unique=True, nullable=False)
    company_name: Mapped[str] = mapped_column(String(255), default="")
    street: Mapped[str] = mapped_column(String(255), default="")
    postal_code: Mapped[str] = mapped_column(String(10), default="")
    city: Mapped[str] = mapped_column(String(100), default="")
    country: Mapped[str] = mapped_column(String(100), default="Schweiz")
    uid: Mapped[str] = mapped_column(String(50), default="")
    bank_name: Mapped[str] = mapped_column(String(255), default="")
    iban: Mapped[str] = mapped_column(String(50), default="")
    bic: Mapped[str] = mapped_column(String(50), default="")
    email: Mapped[str] = mapped_column(String(255), default="")
    phone: Mapped[str] = mapped_column(String(50), default="")
    website: Mapped[str] = mapped_column(String(255), default="")
    default_hourly_rate: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    default_payment_terms_days: Mapped[int] = mapped_column(default=30)
    # Billing locale defaults (R-12). These seed new line items / documents;
    # the Swiss values are defaults of last resort, not constants.
    default_vat_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("8.10"))
    default_currency: Mapped[str] = mapped_column(String(3), default="CHF")
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    next_invoice_number: Mapped[int] = mapped_column(default=1)
    next_offerte_number: Mapped[int] = mapped_column(default=1)
    pdf_template: Mapped[str] = mapped_column(String(50), default="modern")
    onboarding_completed: Mapped[bool] = mapped_column(default=False)
