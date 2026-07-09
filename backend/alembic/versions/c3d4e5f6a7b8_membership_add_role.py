"""membership: add role column

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-07-09 09:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('membership', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('role', sa.String(length=30), nullable=False, server_default='user')
        )


def downgrade() -> None:
    with op.batch_alter_table('membership', schema=None) as batch_op:
        batch_op.drop_column('role')
