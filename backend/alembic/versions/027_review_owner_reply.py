"""reviews.owner_reply + replied_at — owner replies shown on the public page

Revision ID: 026
Revises: 025
Create Date: 2026-06-26
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "027"
down_revision: Union[str, None] = "026"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "reviews",
        sa.Column("owner_reply", sa.Text(), nullable=False, server_default=""),
    )
    op.add_column(
        "reviews",
        sa.Column("replied_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("reviews", "replied_at")
    op.drop_column("reviews", "owner_reply")
