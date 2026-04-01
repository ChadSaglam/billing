import datetime as dt
import secrets
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (
        CheckConstraint(
            "document_type IN ('offerte', 'rechnung')",
            name="ck_document_type",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    document_type: Mapped[str] = mapped_column(String(20), nullable=False)
    document_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), nullable=False)
    date: Mapped[dt.date] = mapped_column(Date, nullable=False)
    due_date: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    payment_terms_days: Mapped[int] = mapped_column(Integer, default=30)
    status: Mapped[str] = mapped_column(String(20), default="draft")
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))
    discount_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0"))
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))
    vat_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))
    currency: Mapped[str] = mapped_column(String(3), default="CHF")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    converted_from_id: Mapped[int | None] = mapped_column(
        ForeignKey("documents.id"), nullable=True
    )

    # Payment tracking
    paid_at: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    payment_method: Mapped[str | None] = mapped_column(String(50), nullable=True)
    payment_reference: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Recurring invoices
    recurrence: Mapped[str | None] = mapped_column(String(20), nullable=True)  # monthly/quarterly/yearly
    next_recurrence_date: Mapped[dt.date | None] = mapped_column(Date, nullable=True)

    # Client portal
    portal_token: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True, index=True)

    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.utcnow)
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime, default=dt.datetime.utcnow, onupdate=dt.datetime.utcnow
    )

    client: Mapped["Client"] = relationship(back_populates="documents")  # noqa: F821
    line_items: Mapped[list["LineItem"]] = relationship(  # noqa: F821
        back_populates="document", cascade="all, delete-orphan", order_by="LineItem.position"
    )
    converted_from: Mapped["Document | None"] = relationship(
        remote_side="Document.id", foreign_keys=[converted_from_id]
    )

    def generate_portal_token(self) -> str:
        self.portal_token = secrets.token_urlsafe(48)
        return self.portal_token
