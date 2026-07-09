"""email verification: user.email_verified + emailverificationtoken

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-07-09 09:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Usuários já existentes ficam verificados (server_default=true) para não
    # travar o login de quem já usava o sistema. Cadastros novos definem False
    # explicitamente na aplicação.
    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('email_verified', sa.Boolean(), nullable=False, server_default=sa.true())
        )

    op.create_table(
        'emailverificationtoken',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('token', sa.String(length=64), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('used_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['user.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_emailverificationtoken_user_id'), 'emailverificationtoken', ['user_id'], unique=False)
    op.create_index(op.f('ix_emailverificationtoken_token'), 'emailverificationtoken', ['token'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_emailverificationtoken_token'), table_name='emailverificationtoken')
    op.drop_index(op.f('ix_emailverificationtoken_user_id'), table_name='emailverificationtoken')
    op.drop_table('emailverificationtoken')
    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.drop_column('email_verified')
