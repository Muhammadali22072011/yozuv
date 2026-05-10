"""staff + staff_services + bookings.staff_id

Revision ID: 019
Revises: 018
Create Date: 2026-05-07
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "019"
down_revision: Union[str, None] = "018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "staff",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "business_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("businesses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=32), nullable=False, server_default=""),
        sa.Column(
            "photo_url", sa.String(length=1024), nullable=False, server_default=""
        ),
        sa.Column(
            "is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
        sa.Column("order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index("ix_staff_business_id", "staff", ["business_id"], unique=False)

    op.create_table(
        "staff_services",
        sa.Column(
            "staff_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("staff.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "service_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("services.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )

    op.add_column(
        "bookings",
        sa.Column(
            "staff_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("staff.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_bookings_staff_id", "bookings", ["staff_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_bookings_staff_id", table_name="bookings")
    op.drop_column("bookings", "staff_id")
    op.drop_table("staff_services")
    op.drop_index("ix_staff_business_id", table_name="staff")
    op.drop_table("staff")
