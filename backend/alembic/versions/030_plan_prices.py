"""configurable subscription plan prices

Adds monthly_price / yearly_price to platform_settings so an admin can
change subscription pricing from the panel. Default 0 means "use the
code default" (MONTHLY_AMOUNT_UZS / YEARLY_AMOUNT_UZS), so existing
deployments keep their current prices until an admin overrides them.

Revision ID: 030
Revises: 029
Create Date: 2026-06-26
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "030"
down_revision: Union[str, None] = "029"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "platform_settings",
        sa.Column("monthly_price", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "platform_settings",
        sa.Column("yearly_price", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("platform_settings", "yearly_price")
    op.drop_column("platform_settings", "monthly_price")
