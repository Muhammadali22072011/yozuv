"""client referral program

Adds the per-business referral config columns and the referral_codes /
referrals tables backing the "invite a friend" feature.

Revision ID: 033
Revises: 032

Renumbered from 026 → 033: revision id "026" was already taken by
026_review_owner_reply (live in prod as 026, with 027/028/029 on top),
so this migration collided on "026" and broke every backend deploy at
`alembic upgrade head` (status 255 — same failure mode as the earlier
media_blobs renumber to 029). Slot it after the current head (032)
instead. The already-applied 026/027/028/029 are untouched, so prod's
alembic state stays consistent; `upgrade head` now applies 030→033.

Create Date: 2026-06-26
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "033"
down_revision: Union[str, None] = "032"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("businesses") as batch:
        batch.add_column(
            sa.Column("referral_enabled", sa.Boolean(), nullable=False, server_default=sa.false())
        )
        batch.add_column(
            sa.Column("referral_friend_percent", sa.Integer(), nullable=False, server_default="0")
        )
        batch.add_column(
            sa.Column("referral_reward_percent", sa.Integer(), nullable=False, server_default="0")
        )

    op.create_table(
        "referral_codes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "business_id",
            UUID(as_uuid=True),
            sa.ForeignKey("businesses.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "client_id",
            UUID(as_uuid=True),
            sa.ForeignKey("clients.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("code", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("code", name="uq_referral_code_code"),
        sa.UniqueConstraint("business_id", "client_id", name="uq_referral_code_biz_client"),
    )

    op.create_table(
        "referrals",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "business_id",
            UUID(as_uuid=True),
            sa.ForeignKey("businesses.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "referrer_client_id",
            UUID(as_uuid=True),
            sa.ForeignKey("clients.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "referred_client_id",
            UUID(as_uuid=True),
            sa.ForeignKey("clients.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "referred_booking_id",
            UUID(as_uuid=True),
            sa.ForeignKey("bookings.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "reward_promo_id",
            UUID(as_uuid=True),
            sa.ForeignKey("promo_codes.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="PENDING"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("referrals")
    op.drop_table("referral_codes")
    with op.batch_alter_table("businesses") as batch:
        batch.drop_column("referral_reward_percent")
        batch.drop_column("referral_friend_percent")
        batch.drop_column("referral_enabled")
