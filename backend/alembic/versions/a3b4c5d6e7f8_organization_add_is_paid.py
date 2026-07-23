"""organization: add is_paid column

Revision ID: a3b4c5d6e7f8
Revises: f2a3b4c5d6e7
Create Date: 2026-07-22 21:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a3b4c5d6e7f8'
down_revision: Union[str, None] = 'f2a3b4c5d6e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Coluna NOT NULL nova em tabela com dados precisa de server_default (SQLite/Postgres).
    with op.batch_alter_table('organization', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('is_paid', sa.Boolean(), nullable=False, server_default=sa.false())
        )


def downgrade() -> None:
    with op.batch_alter_table('organization', schema=None) as batch_op:
        batch_op.drop_column('is_paid')
