"""push_subscription: tabela de inscrições de push

Revision ID: f8a9b0c1d2e3
Revises: e7f8a9b0c1d2
Create Date: 2026-08-01 09:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
import sqlmodel

revision: str = 'f8a9b0c1d2e3'
down_revision: Union[str, None] = 'e7f8a9b0c1d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Tabela nova, então `create_table` direto — `batch_alter_table` é para
    # ALTER de constraint, que o SQLite dos testes não faz. O batch aparece
    # abaixo, nos índices, pelo mesmo motivo do resto do projeto.
    op.create_table(
        'pushsubscription',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('organization_id', sa.Integer(), nullable=False),
        # NOT NULL com server_default: a tabela nasce vazia, mas o default vale
        # para quem inserir sem informar a plataforma (o cliente web atual).
        sa.Column('platform', sqlmodel.sql.sqltypes.AutoString(length=20), nullable=False, server_default='web'),
        sa.Column('endpoint', sqlmodel.sql.sqltypes.AutoString(length=500), nullable=False),
        sa.Column('p256dh', sqlmodel.sql.sqltypes.AutoString(length=200), nullable=False),
        sa.Column('auth', sqlmodel.sql.sqltypes.AutoString(length=100), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organization.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id'),
        # Único de verdade no banco, não só na aplicação: o endpoint é o que
        # identifica o aparelho, e duplicata faria a mesma notificação chegar
        # duas vezes.
        sa.UniqueConstraint('endpoint'),
    )
    with op.batch_alter_table('pushsubscription', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_pushsubscription_organization_id'), ['organization_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_pushsubscription_user_id'), ['user_id'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('pushsubscription', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_pushsubscription_user_id'))
        batch_op.drop_index(batch_op.f('ix_pushsubscription_organization_id'))
    op.drop_table('pushsubscription')
