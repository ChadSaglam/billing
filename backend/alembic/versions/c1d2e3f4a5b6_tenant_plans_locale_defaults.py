"""tenant plans + per-tenant locale defaults

Revision ID: c1d2e3f4a5b6
Revises: b1c2d3e4f5a6
Create Date: 2026-09-04

R-11: tenants get subscription_plan / trial_ends_at / is_active, so the
DEFAULT_PLAN / TRIAL_DAYS env settings are finally backed by a model.
R-12: company_settings get default_vat_rate / default_currency, so the
Swiss defaults live per tenant instead of being hardcoded.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c1d2e3f4a5b6"
down_revision: Union[str, None] = "b1c2d3e4f5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # server_default backfills existing rows: current tenants keep behaving
    # exactly as before (active, no trial clock, 8.10 % VAT, CHF).
    op.add_column(
        "tenants",
        sa.Column("subscription_plan", sa.String(length=20), nullable=False, server_default="trial"),
    )
    op.add_column("tenants", sa.Column("trial_ends_at", sa.DateTime(), nullable=True))
    op.add_column(
        "tenants",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "company_settings",
        sa.Column(
            "default_vat_rate",
            sa.Numeric(precision=5, scale=2),
            nullable=False,
            server_default="8.10",
        ),
    )
    op.add_column(
        "company_settings",
        sa.Column("default_currency", sa.String(length=3), nullable=False, server_default="CHF"),
    )


def downgrade() -> None:
    op.drop_column("company_settings", "default_currency")
    op.drop_column("company_settings", "default_vat_rate")
    op.drop_column("tenants", "is_active")
    op.drop_column("tenants", "trial_ends_at")
    op.drop_column("tenants", "subscription_plan")
