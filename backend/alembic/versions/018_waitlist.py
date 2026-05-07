"""waitlist_entries

Revision ID: 018
Revises: 017
Create Date: 2026-05-07
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "018"
down_revision: Union[str, None] = "017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "waitlist_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "business_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("businesses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "service_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("services.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "client_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("clients.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("notified_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint(
            "business_id",
            "service_id",
            "date",
            "start_time",
            "client_id",
            name="uq_waitlist_unique_entry",
        ),
    )
    op.create_index(
        "ix_waitlist_business", "waitlist_entries", ["business_id"], unique=False
    )
    op.create_index(
        "ix_waitlist_service", "waitlist_entries", ["service_id"], unique=False
    )
    op.create_index(
        "ix_waitlist_client", "waitlist_entries", ["client_id"], unique=False
    )
    op.create_index(
        "ix_waitlist_date", "waitlist_entries", ["date"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_waitlist_date", table_name="waitlist_entries")
    op.drop_index("ix_waitlist_client", table_name="waitlist_entries")
    op.drop_index("ix_waitlist_service", table_name="waitlist_entries")
    op.drop_index("ix_waitlist_business", table_name="waitlist_entries")
    op.drop_table("waitlist_entries")
