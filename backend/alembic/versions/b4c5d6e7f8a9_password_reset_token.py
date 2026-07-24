"""password reset: passwordresettoken table

Revision ID: b4c5d6e7f8a9
Revises: a3b4c5d6e7f8
Create Date: 2026-07-24 08:10:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b4c5d6e7f8a9'
down_revision: Union[str, None] = 'a3b4c5d6e7f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'passwordresettoken',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('token', sa.String(length=64), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('used_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_passwordresettoken_user_id'), 'passwordresettoken', ['user_id'], unique=False)
    op.create_index(op.f('ix_passwordresettoken_token'), 'passwordresettoken', ['token'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_passwordresettoken_token'), table_name='passwordresettoken')
    op.drop_index(op.f('ix_passwordresettoken_user_id'), table_name='passwordresettoken')
    op.drop_table('passwordresettoken')
