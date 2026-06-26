"""payment_transactions.kind + booking_id — booking deposits

Chains: 025 → 026 (review) → 027 (phone) → 028 (this).

Revision ID: 028
Revises: 027
Create Date: 2026-06-26
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "029"
down_revision: Union[str, None] = "028"
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
