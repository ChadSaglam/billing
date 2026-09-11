"""outbound events outbox

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
Create Date: 2026-09-11

R-104: durable outbox for platform events (chadev-platform/contracts/events.md).
A row is written in the same transaction as the business change; the jobs
runner delivers it with backoff. `tid` is the platform tenant id.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e3f4a5b6c7d8"
down_revision: Union[str, None] = "d2e3f4a5b6c7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "outbound_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("event", sa.String(length=64), nullable=False),
        sa.Column("tid", sa.Integer(), nullable=False),
        sa.Column("delivery_id", sa.Uuid(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("next_attempt_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("delivered_at", sa.DateTime(), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_outbound_events_delivery_id", "outbound_events", ["delivery_id"], unique=True)
    op.create_index("ix_outbound_events_tid", "outbound_events", ["tid"])
    op.create_index("ix_outbound_events_next_attempt_at", "outbound_events", ["next_attempt_at"])


def downgrade() -> None:
    op.drop_index("ix_outbound_events_next_attempt_at", table_name="outbound_events")
    op.drop_index("ix_outbound_events_tid", table_name="outbound_events")
    op.drop_index("ix_outbound_events_delivery_id", table_name="outbound_events")
    op.drop_table("outbound_events")
