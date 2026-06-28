"""business onboarding_seen flag

Adds businesses.onboarding_seen so the dashboard intro/tour state lives
server-side, not just in per-device localStorage — a returning owner isn't
re-onboarded on a new device or after a Telegram Mini App WebView reset.

Safe server default (false) so existing rows keep working without a backfill;
historical owners simply see the intro once more, then it sticks.

Revision ID: 038
Revises: 037
Create Date: 2026-06-28
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "038"
down_revision: Union[str, None] = "037"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "businesses",
        sa.Column(
            "onboarding_seen",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("businesses", "onboarding_seen")
