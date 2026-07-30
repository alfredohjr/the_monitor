"""organization: add moeda column

Revision ID: d6e7f8a9b0c1
Revises: c5d6e7f8a9b0
Create Date: 2026-07-30 15:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd6e7f8a9b0c1'
down_revision: Union[str, None] = 'c5d6e7f8a9b0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # batch_alter_table pelo SQLite dos testes; server_default porque a coluna é
    # NOT NULL numa tabela com dados. 'BRL' e não outra: a organização que já
    # existe tem valores lançados em reais, e mudar a moeda mudaria o
    # significado desses números sem tocar num único deles.
    with op.batch_alter_table('organization', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('moeda', sa.String(length=3), nullable=False, server_default='BRL')
        )


def downgrade() -> None:
    with op.batch_alter_table('organization', schema=None) as batch_op:
        batch_op.drop_column('moeda')
