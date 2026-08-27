"""add SaaS subscription fields to tenants

Revision ID: b1c2d3e4f5a6
Revises: 391213d4b8d9
Create Date: 2026-08-26
"""

from datetime import datetime, timedelta

import sqlalchemy as sa
from alembic import op

revision = "b1c2d3e4f5a6"
down_revision = "391213d4b8d9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tenants", sa.Column("plan", sa.String(32), nullable=False, server_default="trial"))
    op.add_column("tenants", sa.Column("status", sa.String(32), nullable=False, server_default="active"))
    op.add_column("tenants", sa.Column("trial_ends_at", sa.DateTime(), nullable=True))
    op.add_column("tenants", sa.Column("billing_customer_id", sa.String(255), nullable=True))
    op.add_column("tenants", sa.Column("billing_subscription_id", sa.String(255), nullable=True))
    op.add_column("tenants", sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()))

    # Existing tenants predate the paywall — grandfather them onto "pro".
    op.execute("UPDATE tenants SET plan = 'pro' WHERE plan = 'trial'")

    # Anyone signing up from now on gets a real trial window.
    op.execute(
        sa.text("UPDATE tenants SET trial_ends_at = :ends WHERE plan = 'trial'").bindparams(
            ends=datetime.utcnow() + timedelta(days=14)
        )
    )

    op.create_index("ix_tenants_plan", "tenants", ["plan"], if_not_exists=True)
    op.create_index("ix_tenants_status", "tenants", ["status"], if_not_exists=True)


def downgrade() -> None:
    op.drop_index("ix_tenants_status", table_name="tenants", if_exists=True)
    op.drop_index("ix_tenants_plan", table_name="tenants", if_exists=True)
    for col in (
        "is_active",
        "billing_subscription_id",
        "billing_customer_id",
        "trial_ends_at",
        "status",
        "plan",
    ):
        op.drop_column("tenants", col)
