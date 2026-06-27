"""business owner notification toggle

Adds businesses.notifications_enabled (default true) backing the
Sozlamalar → Bildirishnomalar switch. When false, the owner stops
receiving the per-booking Telegram alerts. Client-side messages
(confirmations, reminders) are unaffected.

Revision ID: 034
Revises: 033
Create Date: 2026-06-28
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "034"
down_revision: Union[str, None] = "033"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "businesses",
        sa.Column(
            "notifications_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )


def downgrade() -> None:
    op.drop_column("businesses", "notifications_enabled")
