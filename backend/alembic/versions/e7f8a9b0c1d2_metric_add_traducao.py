"""metric: add nome_en / descricao_en

Revision ID: e7f8a9b0c1d2
Revises: d6e7f8a9b0c1
Create Date: 2026-07-30 18:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'e7f8a9b0c1d2'
down_revision: Union[str, None] = 'd6e7f8a9b0c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Ambas NULLABLE: sem server_default, porque métrica sem tradução deve
    # continuar aparecendo no idioma original em vez de virar string vazia.
    with op.batch_alter_table('metric', schema=None) as batch_op:
        batch_op.add_column(sa.Column('nome_en', sa.String(length=150), nullable=True))
        batch_op.add_column(sa.Column('descricao_en', sa.String(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('metric', schema=None) as batch_op:
        batch_op.drop_column('descricao_en')
        batch_op.drop_column('nome_en')
