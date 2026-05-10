"""memberships join + backfill from Business.owner_id

Revision ID: 021
Revises: 020
Create Date: 2026-05-08
"""

import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "021"
down_revision: Union[str, None] = "020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "memberships",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "business_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("businesses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "role", sa.String(length=16), nullable=False, server_default="OWNER"
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.UniqueConstraint(
            "user_id", "business_id", name="uq_membership_user_biz"
        ),
    )
    op.create_index("ix_memberships_user", "memberships", ["user_id"], unique=False)
    op.create_index(
        "ix_memberships_business", "memberships", ["business_id"], unique=False
    )

    # Backfill: every existing business gets a Membership(OWNER) for
    # its current owner so the legacy code paths (still keyed off
    # Business.owner_id) and the new membership-aware code see the
    # same permission graph from day one.
    bind = op.get_bind()
    pairs = bind.execute(
        sa.text("SELECT id AS business_id, owner_id FROM businesses WHERE owner_id IS NOT NULL")
    ).fetchall()
    for row in pairs:
        bind.execute(
            sa.text(
                "INSERT INTO memberships (id, user_id, business_id, role) "
                "VALUES (:id, :user_id, :business_id, 'OWNER')"
            ),
            {
                "id": str(uuid.uuid4()),
                "user_id": str(row.owner_id),
                "business_id": str(row.business_id),
            },
        )


def downgrade() -> None:
    op.drop_index("ix_memberships_business", table_name="memberships")
    op.drop_index("ix_memberships_user", table_name="memberships")
    op.drop_table("memberships")
