from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CompanySettings(Base):
    """Per-tenant company profile.

    IMPORTANT (SaaS): every field here belongs to the tenant, not to us.
    Defaults must stay empty or generic — never seed one customer's real
    address, UID or IBAN as a column default. Onboarding collects these.
    """

    __tablename__ = "company_settings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), unique=True, nullable=False
    )

    # Identity — filled during onboarding
    company_name: Mapped[str] = mapped_column(String(255), default="")
    street: Mapped[str] = mapped_column(String(255), default="")
    postal_code: Mapped[str] = mapped_column(String(10), default="")
    city: Mapped[str] = mapped_column(String(100), default="")
    country: Mapped[str] = mapped_column(String(100), default="Schweiz")
    uid: Mapped[str] = mapped_column(String(50), default="")

    # Banking — required for the Swiss QR-bill
    bank_name: Mapped[str] = mapped_column(String(255), default="")
    iban: Mapped[str] = mapped_column(String(50), default="")
    bic: Mapped[str] = mapped_column(String(50), default="")

    # Contact
    email: Mapped[str] = mapped_column(String(255), default="")
    phone: Mapped[str] = mapped_column(String(50), default="")
    website: Mapped[str] = mapped_column(String(255), default="")

    # Document defaults
    default_hourly_rate: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0.00")
    )
    default_payment_terms_days: Mapped[int] = mapped_column(default=30)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    next_invoice_number: Mapped[int] = mapped_column(default=1)
    next_offerte_number: Mapped[int] = mapped_column(default=1)
    pdf_template: Mapped[str] = mapped_column(String(50), default="modern")
    onboarding_completed: Mapped[bool] = mapped_column(default=False)
