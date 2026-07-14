"""log permissions flags + author + audit trail (#164)

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-07-14
"""
from alembic import op
import sqlalchemy as sa

revision = 'c9d0e1f2a3b4'
down_revision = 'b8c9d0e1f2a3'
branch_labels = None
depends_on = None


def upgrade():
    # Flags de permissão por métrica (default seguro: desligado). batch_alter_table
    # para compatibilidade com SQLite (não faz ALTER de constraints diretamente).
    with op.batch_alter_table('usermetricassignment', schema=None) as batch_op:
        batch_op.add_column(sa.Column('can_edit_entry', sa.Boolean(), nullable=False, server_default=sa.false()))
        batch_op.add_column(sa.Column('can_delete_entry', sa.Boolean(), nullable=False, server_default=sa.false()))

    # Autor do lançamento (nulo em registros antigos) + índice + FK.
    with op.batch_alter_table('logentry', schema=None) as batch_op:
        batch_op.add_column(sa.Column('created_by', sa.Integer(), nullable=True))
        batch_op.create_index(batch_op.f('ix_logentry_created_by'), ['created_by'], unique=False)
        batch_op.create_foreign_key('fk_logentry_created_by', 'user', ['created_by'], ['id'])

    # Trilha de auditoria de edição/exclusão.
    op.create_table(
        'logentryaudit',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('log_entry_id', sa.Integer(), sa.ForeignKey('logentry.id'), nullable=False, index=True),
        sa.Column('action', sa.String(length=20), nullable=False),
        sa.Column('actor_id', sa.Integer(), sa.ForeignKey('user.id'), nullable=False, index=True),
        sa.Column('valor_anterior', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )


def downgrade():
    op.drop_table('logentryaudit')
    with op.batch_alter_table('logentry', schema=None) as batch_op:
        batch_op.drop_constraint('fk_logentry_created_by', type_='foreignkey')
        batch_op.drop_index(batch_op.f('ix_logentry_created_by'))
        batch_op.drop_column('created_by')
    with op.batch_alter_table('usermetricassignment', schema=None) as batch_op:
        batch_op.drop_column('can_delete_entry')
        batch_op.drop_column('can_edit_entry')
