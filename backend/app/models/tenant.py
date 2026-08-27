import datetime as dt

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Tenant(Base):
    """A customer workspace. Every row in every other table hangs off this."""

    __tablename__ = "tenants"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)

    # ── Subscription ────────────────────────────────────────
    # plan:   trial | starter | pro | business
    # status: active | past_due | canceled | suspended
    plan: Mapped[str] = mapped_column(
        String(32), default="trial", nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(
        String(32), default="active", nullable=False, index=True
    )
    trial_ends_at: Mapped[dt.datetime | None] = mapped_column(DateTime, nullable=True)

    # Set once the tenant is paying through an external provider (Stripe etc.)
    billing_customer_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    billing_subscription_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime, default=lambda: dt.datetime.now(dt.UTC)
    )

    users: Mapped[list["User"]] = relationship(back_populates="tenant")  # noqa: F821

    @property
    def trial_expired(self) -> bool:
        if self.plan != "trial" or self.trial_ends_at is None:
            return False
        return dt.datetime.utcnow() > self.trial_ends_at

    @property
    def is_usable(self) -> bool:
        """False means: read-only, show the upgrade wall."""
        return self.is_active and self.status == "active" and not self.trial_expired
