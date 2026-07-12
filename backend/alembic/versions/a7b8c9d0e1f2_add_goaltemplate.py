"""add goaltemplate (catálogo de metas-modelo)

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-07-12 20:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a7b8c9d0e1f2'
down_revision: Union[str, None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'goaltemplate',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('nome', sa.String(length=150), nullable=False),
        sa.Column('descricao', sa.String(), nullable=False),
        sa.Column('metric_codigo', sa.String(length=50), nullable=False),
        sa.Column('alvo_sugerido', sa.String(length=255), nullable=False),
        sa.Column('estrategia', sa.String(length=30), nullable=False),
        sa.Column('categoria', sa.String(length=50), nullable=False),
        sa.Column('deleted', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('goaltemplate', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_goaltemplate_metric_codigo'), ['metric_codigo'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('goaltemplate', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_goaltemplate_metric_codigo'))
    op.drop_table('goaltemplate')
