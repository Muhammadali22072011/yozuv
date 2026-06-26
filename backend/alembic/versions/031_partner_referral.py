"""partner (B2B) referral program

Per-business partner-referral columns, the payment partner-discount column,
and the business_referrals table backing salon-invites-salon rewards.

Revision ID: 027
Revises: 026
Create Date: 2026-06-26
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "031"
down_revision: Union[str, None] = "030"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("businesses") as batch:
        batch.add_column(sa.Column("partner_code", sa.String(length=16), nullable=True))
        batch.add_column(
            sa.Column("referred_by_business_id", UUID(as_uuid=True), nullable=True)
        )
        batch.add_column(
            sa.Column(
                "pending_partner_discount_percent",
                sa.Integer(),
                nullable=False,
                server_default="0",
            )
        )
        batch.create_unique_constraint("uq_businesses_partner_code", ["partner_code"])
        batch.create_foreign_key(
            "fk_businesses_referred_by",
            "businesses",
            ["referred_by_business_id"],
            ["id"],
            ondelete="SET NULL",
        )

    with op.batch_alter_table("payment_transactions") as batch:
        batch.add_column(
            sa.Column(
                "partner_discount_percent",
                sa.Integer(),
                nullable=False,
                server_default="0",
            )
        )

    op.create_table(
        "business_referrals",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "referrer_business_id",
            UUID(as_uuid=True),
            sa.ForeignKey("businesses.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "referred_business_id",
            UUID(as_uuid=True),
            sa.ForeignKey("businesses.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="PENDING"),
        sa.Column("reward_percent", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("referred_business_id", name="uq_business_referral_referred"),
    )


def downgrade() -> None:
    op.drop_table("business_referrals")
    with op.batch_alter_table("payment_transactions") as batch:
        batch.drop_column("partner_discount_percent")
    with op.batch_alter_table("businesses") as batch:
        batch.drop_constraint("fk_businesses_referred_by", type_="foreignkey")
        batch.drop_constraint("uq_businesses_partner_code", type_="unique")
        batch.drop_column("pending_partner_discount_percent")
        batch.drop_column("referred_by_business_id")
        batch.drop_column("partner_code")
