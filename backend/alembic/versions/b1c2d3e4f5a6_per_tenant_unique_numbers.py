"""Per-tenant uniqueness for customer and document numbers (R-04)

Global UNIQUE constraints meant tenant B could not create invoice 1326 if
tenant A already had it, and the collision leaked the existence of another
tenant's document. Numbering is a per-tenant sequence, so the constraint
must include tenant_id.

Revision ID: b1c2d3e4f5a6
Revises: 391213d4b8d9
Create Date: 2026-09-03
"""
from collections.abc import Sequence

from alembic import op

revision: str = "b1c2d3e4f5a6"
down_revision: str | None = "391213d4b8d9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# PostgreSQL's implicit names for the original column-level UNIQUE constraints.
OLD_CLIENT_UQ = "clients_customer_number_key"
OLD_DOCUMENT_UQ = "documents_document_number_key"

NEW_CLIENT_UQ = "uq_clients_tenant_customer_number"
NEW_DOCUMENT_UQ = "uq_documents_tenant_document_number"


def upgrade() -> None:
    # DROP ... IF EXISTS keeps this safe on databases created by the old
    # create_all() path, where the constraint may carry a different name.
    op.execute(f"ALTER TABLE clients DROP CONSTRAINT IF EXISTS {OLD_CLIENT_UQ}")
    op.execute(f"ALTER TABLE documents DROP CONSTRAINT IF EXISTS {OLD_DOCUMENT_UQ}")

    op.create_unique_constraint(NEW_CLIENT_UQ, "clients", ["tenant_id", "customer_number"])
    op.create_unique_constraint(NEW_DOCUMENT_UQ, "documents", ["tenant_id", "document_number"])


def downgrade() -> None:
    op.drop_constraint(NEW_DOCUMENT_UQ, "documents", type_="unique")
    op.drop_constraint(NEW_CLIENT_UQ, "clients", type_="unique")

    # Restoring the global constraints can only succeed if no two tenants
    # share a number. If they do, this raises — which is correct: silently
    # dropping rows to satisfy a downgrade would destroy invoices.
    op.create_unique_constraint(OLD_CLIENT_UQ, "clients", ["customer_number"])
    op.create_unique_constraint(OLD_DOCUMENT_UQ, "documents", ["document_number"])
