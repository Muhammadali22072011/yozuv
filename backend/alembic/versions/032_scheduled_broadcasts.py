"""scheduled broadcasts

Adds status + scheduled_at to broadcast_messages so an admin can queue a
broadcast for a future time. Existing rows backfill to status="sent"
(they were all immediate sends), so history is unaffected.

Revision ID: 032
Revises: 031
Create Date: 2026-06-26
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "032"
down_revision: Union[str, None] = "031"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "broadcast_messages",
        sa.Column("status", sa.String(length=16), nullable=False, server_default="sent"),
    )
    op.add_column(
        "broadcast_messages",
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_broadcast_messages_scheduled_at",
        "broadcast_messages",
        ["scheduled_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_broadcast_messages_scheduled_at", table_name="broadcast_messages"
    )
    op.drop_column("broadcast_messages", "scheduled_at")
    op.drop_column("broadcast_messages", "status")
