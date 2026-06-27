"""admin role (admin / superadmin)

Only superadmins can grant or revoke admin access; a regular "admin"
can use the panel but cannot manage other admins. Existing rows default
to "admin". ENV ADMIN_TELEGRAM_IDS are always treated as superadmins.

Revision ID: 034
Revises: 033
Create Date: 2026-06-26
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "034"
down_revision: Union[str, None] = "033"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "admin_users",
        sa.Column("role", sa.String(length=16), nullable=False, server_default="admin"),
    )


def downgrade() -> None:
    op.drop_column("admin_users", "role")
