"""admin audit log

Revision ID: 009
Revises: 008
Create Date: 2026-05-03

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "admin_audit_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("admin_telegram_id", sa.BigInteger(), nullable=False),
        sa.Column("admin_name", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("target_type", sa.String(length=64), nullable=False, server_default=""),
        sa.Column("target_id", sa.String(length=64), nullable=False, server_default=""),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_admin_audit_log_admin_telegram_id", "admin_audit_log", ["admin_telegram_id"])
    op.create_index("ix_admin_audit_log_action", "admin_audit_log", ["action"])
    op.create_index("ix_admin_audit_log_target_type", "admin_audit_log", ["target_type"])
    op.create_index("ix_admin_audit_log_created_at", "admin_audit_log", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_admin_audit_log_created_at", table_name="admin_audit_log")
    op.drop_index("ix_admin_audit_log_target_type", table_name="admin_audit_log")
    op.drop_index("ix_admin_audit_log_action", table_name="admin_audit_log")
    op.drop_index("ix_admin_audit_log_admin_telegram_id", table_name="admin_audit_log")
    op.drop_table("admin_audit_log")
