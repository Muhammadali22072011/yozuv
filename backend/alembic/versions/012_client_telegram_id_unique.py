"""dedup clients by telegram_id and add unique constraint

Revision ID: 012
Revises: 011
Create Date: 2026-05-07

The Client model already assumed one row per telegram_id but the
column carried only a regular index, so two concurrent first-time
bookings (or a get_or_create_client retry) could insert duplicates.
Subsequent .first() lookups would silently pick whichever row hashed
first — bookings, reviews and notifications could end up split across
several Client rows for the same human.

This migration:
1. Re-points every Booking and Review at the canonical (oldest) Client
   row for its telegram_id.
2. Deletes the now-orphaned duplicate Client rows.
3. Adds a UNIQUE constraint so the database refuses future duplicates.

The dedup query uses raw SQL because we need to express it in a
dialect-portable way — Postgres in production, SQLite in tests.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "012"
down_revision: Union[str, None] = "011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    # Build a (canonical_id, duplicate_id) mapping in Python so we don't
    # depend on UPDATE ... FROM (Postgres) vs UPDATE ... JOIN (SQLite).
    rows = bind.execute(
        sa.text(
            "SELECT id, telegram_id, created_at FROM clients ORDER BY telegram_id, created_at, id"
        )
    ).fetchall()

    canonical: dict[int, str] = {}
    remap: dict[str, str] = {}
    for row in rows:
        cid, tg, _created = str(row[0]), int(row[1]), row[2]
        if tg not in canonical:
            canonical[tg] = cid
        elif cid != canonical[tg]:
            remap[cid] = canonical[tg]

    if remap:
        for dup_id, keep_id in remap.items():
            bind.execute(
                sa.text("UPDATE bookings SET client_id = :k WHERE client_id = :d"),
                {"k": keep_id, "d": dup_id},
            )
            bind.execute(
                sa.text("UPDATE reviews SET client_id = :k WHERE client_id = :d"),
                {"k": keep_id, "d": dup_id},
            )
            bind.execute(
                sa.text("DELETE FROM clients WHERE id = :d"),
                {"d": dup_id},
            )

    if dialect == "postgresql":
        op.create_unique_constraint(
            "uq_clients_telegram_id", "clients", ["telegram_id"]
        )
    else:
        # SQLite can't add a constraint to an existing table, so create
        # a unique index — same effect for our purposes.
        op.create_index(
            "uq_clients_telegram_id",
            "clients",
            ["telegram_id"],
            unique=True,
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.drop_constraint("uq_clients_telegram_id", "clients", type_="unique")
    else:
        op.drop_index("uq_clients_telegram_id", table_name="clients")
