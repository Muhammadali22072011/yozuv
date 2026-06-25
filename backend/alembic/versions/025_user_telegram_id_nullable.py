"""users.telegram_id nullable — allow Google/password-only accounts

Phase 2 of the multi-provider identity rollout. A Google-only (or future
password-only) account has no Telegram id, so the NOT NULL constraint must go.
telegram_id stays UNIQUE; multiple NULLs are allowed in Postgres and SQLite.

Revision ID: 025
Revises: 024
Create Date: 2026-06-25
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "025"
down_revision: Union[str, None] = "024"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # batch_alter_table so the op also works on SQLite (table-rebuild).
    with op.batch_alter_table("users") as batch:
        batch.alter_column(
            "telegram_id", existing_type=sa.BigInteger(), nullable=True
        )


def downgrade() -> None:
    # Reversible only if no NULL telegram_id rows exist (Google-only accounts).
    with op.batch_alter_table("users") as batch:
        batch.alter_column(
            "telegram_id", existing_type=sa.BigInteger(), nullable=False
        )
