"""unique phone for standalone login

Revision ID: 026
Revises: 025
Create Date: 2026-06-26
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "026"
down_revision: Union[str, None] = "025"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Phone is now a standalone-login identifier (set via /set-password), so it
    # needs the same DB-level uniqueness as username. Resolve any pre-existing
    # exact-duplicate phones first: keep the oldest account in each collision
    # group and blank the rest — a blanked phone just disables phone login for
    # that account (it can still sign in via Telegram/username). Empty phones
    # are the "no phone" sentinel and are excluded from the index below.
    op.execute(
        sa.text(
            """
            UPDATE users SET phone = ''
            WHERE id IN (
                SELECT id FROM (
                    SELECT id,
                           row_number() OVER (
                               PARTITION BY phone
                               ORDER BY created_at, id
                           ) AS rn
                    FROM users
                    WHERE phone <> ''
                ) ranked
                WHERE ranked.rn > 1
            )
            """
        )
    )
    op.create_index(
        "uq_users_phone",
        "users",
        ["phone"],
        unique=True,
        postgresql_where=sa.text("phone <> ''"),
    )


def downgrade() -> None:
    op.drop_index("uq_users_phone", table_name="users")
