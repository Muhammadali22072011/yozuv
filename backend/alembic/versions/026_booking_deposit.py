"""payment_transactions.kind + booking_id — booking deposits

NOTE: chains off 025. Other feature branches also add a child of 025 (e.g.
review-replies' 026). When merging more than one, rebase this down_revision to
whichever migration lands first (or `alembic merge` the heads).

Revision ID: 026_deposit
Revises: 025
Create Date: 2026-06-26
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "026_deposit"
down_revision: Union[str, None] = "025"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "payment_transactions",
        sa.Column(
            "kind", sa.String(16), nullable=False, server_default="subscription"
        ),
    )
    op.add_column(
        "payment_transactions",
        sa.Column("booking_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index(
        "ix_payment_transactions_booking", "payment_transactions", ["booking_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_payment_transactions_booking", table_name="payment_transactions")
    op.drop_column("payment_transactions", "booking_id")
    op.drop_column("payment_transactions", "kind")
