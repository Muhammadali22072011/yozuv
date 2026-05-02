"""business location fields

Revision ID: 006
Revises: 005
Create Date: 2026-05-02

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("businesses", sa.Column("viloyat", sa.String(length=64), nullable=False, server_default=""))
    op.add_column("businesses", sa.Column("tuman", sa.String(length=128), nullable=False, server_default=""))
    op.add_column("businesses", sa.Column("latitude", sa.Float(), nullable=True))
    op.add_column("businesses", sa.Column("longitude", sa.Float(), nullable=True))
    op.create_index("ix_businesses_viloyat", "businesses", ["viloyat"])
    op.create_index("ix_businesses_tuman", "businesses", ["tuman"])


def downgrade() -> None:
    op.drop_index("ix_businesses_tuman", table_name="businesses")
    op.drop_index("ix_businesses_viloyat", table_name="businesses")
    op.drop_column("businesses", "longitude")
    op.drop_column("businesses", "latitude")
    op.drop_column("businesses", "tuman")
    op.drop_column("businesses", "viloyat")
