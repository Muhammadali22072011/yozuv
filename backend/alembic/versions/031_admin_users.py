"""admin_users — panel-managed platform admins

Additive to the ADMIN_TELEGRAM_IDS env list (those stay as immutable
superadmins). Lets an admin grant/revoke admin access from the panel.

Revision ID: 031
Revises: 030
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
    op.create_table(
        "admin_users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("telegram_id", sa.BigInteger(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("added_by_telegram_id", sa.BigInteger(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index(
        "ix_admin_users_telegram_id", "admin_users", ["telegram_id"], unique=True
    )


def downgrade() -> None:
    op.drop_index("ix_admin_users_telegram_id", table_name="admin_users")
    op.drop_table("admin_users")
