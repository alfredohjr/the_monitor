"""add ExternalIndex + ExternalIndexPoint (#167)

Revision ID: d0e1f2a3b4c5
Revises: c9d0e1f2a3b4
Create Date: 2026-07-14
"""
from alembic import op
import sqlalchemy as sa

revision = 'd0e1f2a3b4c5'
down_revision = 'c9d0e1f2a3b4'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'externalindex',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('code', sa.String(length=50), nullable=False, index=True, unique=True),
        sa.Column('nome', sa.String(length=150), nullable=False),
        sa.Column('provider', sa.String(length=50), nullable=False),
        sa.Column('frequencia', sa.String(length=20), nullable=False),
        sa.Column('unidade', sa.String(length=20), nullable=False),
        sa.Column('value_type', sa.String(length=20), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_table(
        'externalindexpoint',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('index_id', sa.Integer(), sa.ForeignKey('externalindex.id'), nullable=False, index=True),
        sa.Column('ref_date', sa.String(length=10), nullable=False),
        sa.Column('value', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('index_id', 'ref_date'),
    )


def downgrade():
    op.drop_table('externalindexpoint')
    op.drop_table('externalindex')
