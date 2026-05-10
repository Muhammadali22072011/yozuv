"""client.birthday + last_outreach_at

Revision ID: 017
Revises: 016
Create Date: 2026-05-07
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "017"
down_revision: Union[str, None] = "016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "clients",
        sa.Column("birthday", sa.Date(), nullable=True),
    )
    op.add_column(
        "clients",
        sa.Column("last_outreach_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("clients", "last_outreach_at")
    op.drop_column("clients", "birthday")
