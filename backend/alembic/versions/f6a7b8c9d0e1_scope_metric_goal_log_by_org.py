"""metric/goal/logentry: add organization_id (escopo por organização)

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-07-11 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for tabela in ('metric', 'goal', 'logentry'):
        with op.batch_alter_table(tabela, schema=None) as batch_op:
            batch_op.add_column(
                sa.Column('organization_id', sa.Integer(), nullable=True)
            )
            batch_op.create_foreign_key(
                f'fk_{tabela}_organization_id', 'organization', ['organization_id'], ['id']
            )
            batch_op.create_index(
                batch_op.f(f'ix_{tabela}_organization_id'), ['organization_id'], unique=False
            )


def downgrade() -> None:
    for tabela in ('metric', 'goal', 'logentry'):
        with op.batch_alter_table(tabela, schema=None) as batch_op:
            batch_op.drop_index(batch_op.f(f'ix_{tabela}_organization_id'))
            batch_op.drop_constraint(f'fk_{tabela}_organization_id', type_='foreignkey')
            batch_op.drop_column('organization_id')
