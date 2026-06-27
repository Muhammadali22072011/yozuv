"""business owner notification toggle

Adds businesses.notifications_enabled (default true) backing the
Sozlamalar → Bildirishnomalar switch. When false, the owner stops
receiving the per-booking Telegram alerts. Client-side messages
(confirmations, reminders) are unaffected.

Revision ID: 036
Revises: 035
Create Date: 2026-06-28

Renumbered from 034 → 036: revision 034 collided with 034_admin_role
(merged via the admin-panel PR and already applied in prod), which made
``alembic upgrade head`` abort with a duplicate-revision error and crashed
the Render deploy (exit 255). Sequenced after 035_multi_business_owner so
the chain is linear: 033 → 034_admin_role → 035 → 036.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "036"
down_revision: Union[str, None] = "035"
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
