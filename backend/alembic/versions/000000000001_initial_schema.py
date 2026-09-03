"""Initial schema — the baseline every other migration assumed

The migration chain never had a starting point: the oldest revision
(de3425de9d0d) ALTERs company_settings, documents and line_items, tables
that nothing in the chain created. It worked only because
Base.metadata.create_all() built the schema at application startup before
Alembic ran. Removing that (R-10) made `alembic upgrade head` fail on any
fresh database — CI, a new developer, a new environment.

This revision creates the schema as it stood immediately before
de3425de9d0d, so the chain is now self-contained.

Existing databases are already stamped at a later revision and skip this.

Revision ID: 000000000001
Revises:
Create Date: 2026-09-03
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "tenants",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug", name="tenants_slug_key"),
    )

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("role", sa.String(20), nullable=True),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email", name="users_email_key"),
    )

    op.create_table(
        "company_settings",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("company_name", sa.String(255), nullable=True),
        sa.Column("street", sa.String(255), nullable=True),
        sa.Column("postal_code", sa.String(10), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("country", sa.String(100), nullable=True),
        sa.Column("uid", sa.String(50), nullable=True),
        sa.Column("bank_name", sa.String(255), nullable=True),
        sa.Column("iban", sa.String(50), nullable=True),
        sa.Column("bic", sa.String(50), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("website", sa.String(255), nullable=True),
        sa.Column("default_hourly_rate", sa.Numeric(12, 2), nullable=True),
        sa.Column("default_payment_terms_days", sa.Integer(), nullable=True),
        sa.Column("logo_url", sa.String(500), nullable=True),
        sa.Column("next_invoice_number", sa.Integer(), nullable=True),
        sa.Column("next_offerte_number", sa.Integer(), nullable=True),
        # de3425de9d0d makes this NOT NULL and expects this server default.
        sa.Column(
            "pdf_template",
            sa.String(50),
            server_default=sa.text("'modern'::character varying"),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", name="company_settings_tenant_id_key"),
    )

    op.create_table(
        "clients",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        # Global uniqueness here is deliberate: b1c2d3e4f5a6 replaces it with
        # a per-tenant constraint. Recreating history faithfully keeps that
        # migration's DROP meaningful.
        sa.Column("customer_number", sa.String(20), nullable=False),
        sa.Column("company_name", sa.String(255), nullable=False),
        sa.Column("contact_person", sa.String(255), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("street", sa.String(255), nullable=False),
        sa.Column("postal_code", sa.String(10), nullable=False),
        sa.Column("city", sa.String(100), nullable=False),
        sa.Column("country", sa.String(100), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("customer_number", name="clients_customer_number_key"),
    )
    op.create_index("ix_clients_tenant_id", "clients", ["tenant_id"])

    op.create_table(
        "service_templates",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("category", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("unit", sa.String(50), nullable=False),
        sa.Column("default_price", sa.Numeric(12, 2), server_default="250.00", nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_service_templates_tenant_id", "service_templates", ["tenant_id"])

    op.create_table(
        "documents",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("document_type", sa.String(20), nullable=False),
        sa.Column("document_number", sa.String(20), nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("payment_terms_days", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(20), nullable=True),
        sa.Column("subtotal", sa.Numeric(12, 2), nullable=True),
        sa.Column("discount_percent", sa.Numeric(5, 2), nullable=True),
        sa.Column("discount_amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("total", sa.Numeric(12, 2), nullable=True),
        sa.Column("currency", sa.String(3), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("converted_from_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.CheckConstraint("document_type IN ('offerte', 'rechnung')", name="ck_document_type"),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"]),
        sa.ForeignKeyConstraint(["converted_from_id"], ["documents.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("document_number", name="documents_document_number_key"),
    )
    op.create_index("ix_documents_tenant_id", "documents", ["tenant_id"])

    op.create_table(
        "line_items",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("document_id", sa.Integer(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("description", sa.String(500), nullable=False),
        sa.Column("quantity", sa.Numeric(10, 2), nullable=True),
        sa.Column("unit_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("total_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("unit", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("line_items")
    op.drop_index("ix_documents_tenant_id", table_name="documents")
    op.drop_table("documents")
    op.drop_index("ix_service_templates_tenant_id", table_name="service_templates")
    op.drop_table("service_templates")
    op.drop_index("ix_clients_tenant_id", table_name="clients")
    op.drop_table("clients")
    op.drop_table("company_settings")
    op.drop_table("users")
    op.drop_table("tenants")
