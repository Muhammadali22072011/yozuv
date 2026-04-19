"""card payment flow

Revision ID: 002
Revises: 001
Create Date: 2026-04-18

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "payment_transactions",
        sa.Column("screenshot_url", sa.String(length=512), nullable=False, server_default=""),
    )
    op.add_column(
        "payment_transactions",
        sa.Column("user_comment", sa.Text(), nullable=False, server_default=""),
    )
    op.add_column(
        "payment_transactions",
        sa.Column("reviewed_by", sa.String(length=64), nullable=False, server_default=""),
    )
    op.add_column(
        "payment_transactions",
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "platform_settings",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("card_number", sa.String(length=32), nullable=False, server_default=""),
        sa.Column("card_holder", sa.String(length=128), nullable=False, server_default=""),
        sa.Column("payment_comment", sa.Text(), nullable=False, server_default=""),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("platform_settings")
    op.drop_column("payment_transactions", "reviewed_at")
    op.drop_column("payment_transactions", "reviewed_by")
    op.drop_column("payment_transactions", "user_comment")
    op.drop_column("payment_transactions", "screenshot_url")
