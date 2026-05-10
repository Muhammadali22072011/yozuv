"""bookings.recurrence_id

Revision ID: 020
Revises: 019
Create Date: 2026-05-08
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "020"
down_revision: Union[str, None] = "019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "bookings",
        sa.Column("recurrence_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index(
        "ix_bookings_recurrence_id",
        "bookings",
        ["recurrence_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_bookings_recurrence_id", table_name="bookings")
    op.drop_column("bookings", "recurrence_id")
