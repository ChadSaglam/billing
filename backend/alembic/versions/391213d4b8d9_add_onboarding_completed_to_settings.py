from alembic import op
import sqlalchemy as sa

revision = '391213d4b8d9'
down_revision = 'f7978eefd0b8'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('company_settings', sa.Column('onboarding_completed', sa.Boolean(), server_default=sa.text('false'), nullable=False))


def downgrade():
    op.drop_column('company_settings', 'onboarding_completed')