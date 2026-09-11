import datetime as dt
import uuid

from sqlalchemy import JSON, DateTime, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class OutboundEvent(Base):
    """Durable outbox for platform events (R-104, contracts/events.md).

    A row is written in the same transaction as the business change it
    describes, so an event is never lost to a crashed request; delivery is a
    separate, retried step (`services/events.py`). `tid` is the platform
    tenant id (= billing tenant id) as the receiver expects it in the payload;
    the column is deliberately not named `tenant_id` because the outbox is
    infrastructure, not tenant-scoped business data.
    """

    __tablename__ = "outbound_events"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    event: Mapped[str] = mapped_column(String(64), nullable=False)
    tid: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    # One per delivery group; every retry reuses it so the receiver can dedupe.
    delivery_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, nullable=False, unique=True, index=True, default=uuid.uuid4
    )
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    next_attempt_at: Mapped[dt.datetime] = mapped_column(
        DateTime, nullable=False, default=dt.datetime.utcnow, index=True
    )
    delivered_at: Mapped[dt.datetime | None] = mapped_column(DateTime, nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, nullable=False, default=dt.datetime.utcnow)
