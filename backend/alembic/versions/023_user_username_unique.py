"""case-insensitive unique username for standalone login

Revision ID: 023
Revises: 022
Create Date: 2026-06-25
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "023"
down_revision: Union[str, None] = "022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Resolve any pre-existing case-insensitive duplicates before the unique
    # index goes on. Keep the oldest account in each collision group and blank
    # the rest — a blanked username just disables username login for that
    # account (it can still sign in via Telegram). Empty usernames are left
    # alone; they're excluded from the index below.
    op.execute(
        sa.text(
            """
            UPDATE users SET username = ''
            WHERE id IN (
                SELECT id FROM (
                    SELECT id,
                           row_number() OVER (
                               PARTITION BY lower(username)
                               ORDER BY created_at, id
                           ) AS rn
                    FROM users
                    WHERE username <> ''
                ) ranked
                WHERE ranked.rn > 1
            )
            """
        )
    )
    op.create_index(
        "uq_users_username_lower",
        "users",
        [sa.text("lower(username)")],
        unique=True,
        postgresql_where=sa.text("username <> ''"),
    )


def downgrade() -> None:
    op.drop_index("uq_users_username_lower", table_name="users")
