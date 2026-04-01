"""add payment tracking, recurrence, portal token

Revision ID: a2b3c4d5e6f7
Revises: de3425de9d0d
Create Date: 2026-03-31 20:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "a2b3c4d5e6f7"
down_revision = "de3425de9d0d"
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Drop old status constraint if exists
    op.execute("ALTER TABLE documents DROP CONSTRAINT IF EXISTS ck_document_status")
    op.execute("""
        ALTER TABLE documents ADD CONSTRAINT ck_document_status
        CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'paid', 'overdue', 'cancelled'))
    """)
    op.add_column("documents", sa.Column("paid_at", sa.Date(), nullable=True))
    op.add_column("documents", sa.Column("payment_method", sa.String(50), nullable=True))
    op.add_column("documents", sa.Column("payment_reference", sa.String(100), nullable=True))
    op.add_column("documents", sa.Column("recurrence", sa.String(20), nullable=True))
    op.add_column("documents", sa.Column("next_recurrence_date", sa.Date(), nullable=True))
    op.add_column("documents", sa.Column("portal_token", sa.String(64), nullable=True))
    op.create_index("ix_documents_portal_token", "documents", ["portal_token"], unique=True)

def downgrade() -> None:
    op.drop_index("ix_documents_portal_token", table_name="documents")
    op.drop_column("documents", "portal_token")
    op.drop_column("documents", "next_recurrence_date")
    op.drop_column("documents", "recurrence")
    op.drop_column("documents", "payment_reference")
    op.drop_column("documents", "payment_method")
    op.drop_column("documents", "paid_at")
