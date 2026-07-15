"""add GoalAnchor + goal.anchor_id (metas ancoradas #167)

Revision ID: e1f2a3b4c5d6
Revises: d0e1f2a3b4c5
Create Date: 2026-07-14
"""
from alembic import op
import sqlalchemy as sa

revision = 'e1f2a3b4c5d6'
down_revision = 'd0e1f2a3b4c5'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'goalanchor',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('metric_id', sa.Integer(), sa.ForeignKey('metric.id'), nullable=False, index=True),
        sa.Column('organization_id', sa.Integer(), sa.ForeignKey('organization.id'), nullable=False, index=True),
        sa.Column('index_id', sa.Integer(), sa.ForeignKey('externalindex.id'), nullable=False, index=True),
        sa.Column('strategy', sa.String(length=20), nullable=False),
        sa.Column('estrategia_base', sa.String(length=30), nullable=False),
        sa.Column('alvo_base', sa.String(length=50), nullable=False),
        sa.Column('inicio', sa.String(length=10), nullable=False),
        sa.Column('fim', sa.String(length=10), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    with op.batch_alter_table('goal', schema=None) as batch_op:
        batch_op.add_column(sa.Column('anchor_id', sa.Integer(), nullable=True))
        batch_op.create_index(batch_op.f('ix_goal_anchor_id'), ['anchor_id'], unique=False)
        batch_op.create_foreign_key('fk_goal_anchor_id', 'goalanchor', ['anchor_id'], ['id'])


def downgrade():
    with op.batch_alter_table('goal', schema=None) as batch_op:
        batch_op.drop_constraint('fk_goal_anchor_id', type_='foreignkey')
        batch_op.drop_index(batch_op.f('ix_goal_anchor_id'))
        batch_op.drop_column('anchor_id')
    op.drop_table('goalanchor')
