"""subscription tiers, founder pricing, B2B partner referral

Adds:
  • subscriptions.tier            — SOLO/SALON/BIZNES packaging (default SALON)
  • payment_transactions.tier     — tier a payment buys (default SALON)
  • platform_settings.{solo,salon,biznes}_price + founder_discount_percent
  • businesses.is_founder / partner_code / referred_by_id / partner_reward_claimed

All new columns have safe server defaults so existing rows keep working
without a backfill (historical subs read as SALON = the old behaviour).

Revision ID: 037
Revises: 036
Create Date: 2026-06-28

Renumbered from 036 → 037: revision 036 collided with 036_business_notifications
(already on main via the dup-migration-034 fix). Sequenced after it so the
chain stays linear: 035_multi_business_owner → 036_business_notifications → 037.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "037"
down_revision: Union[str, None] = "036"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "subscriptions",
        sa.Column("tier", sa.String(length=16), nullable=False, server_default="SALON"),
    )
    op.add_column(
        "payment_transactions",
        sa.Column("tier", sa.String(length=16), nullable=False, server_default="SALON"),
    )
    for col in ("solo_price", "salon_price", "biznes_price", "founder_discount_percent"):
        op.add_column(
            "platform_settings",
            sa.Column(col, sa.Integer(), nullable=False, server_default="0"),
        )

    op.add_column(
        "businesses",
        sa.Column("is_founder", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "businesses",
        sa.Column("partner_code", sa.String(length=16), nullable=False, server_default=""),
    )
    op.add_column(
        "businesses",
        sa.Column("referred_by_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "businesses",
        sa.Column(
            "partner_reward_claimed", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
    )
    op.create_index("ix_businesses_partner_code", "businesses", ["partner_code"])
    op.create_foreign_key(
        "fk_businesses_referred_by",
        "businesses",
        "businesses",
        ["referred_by_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_businesses_referred_by", "businesses", type_="foreignkey")
    op.drop_index("ix_businesses_partner_code", table_name="businesses")
    op.drop_column("businesses", "partner_reward_claimed")
    op.drop_column("businesses", "referred_by_id")
    op.drop_column("businesses", "partner_code")
    op.drop_column("businesses", "is_founder")
    for col in ("founder_discount_percent", "biznes_price", "salon_price", "solo_price"):
        op.drop_column("platform_settings", col)
    op.drop_column("payment_transactions", "tier")
    op.drop_column("subscriptions", "tier")
