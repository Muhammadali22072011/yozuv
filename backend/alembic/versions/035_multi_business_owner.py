"""drop UNIQUE(owner_id) so one user can own many businesses

Multi-business: the strict one-business-per-user rule lived as a UNIQUE
constraint on businesses.owner_id (created unnamed in 001 → Postgres
default name "businesses_owner_id_key"). Drop it and replace with a plain
index, since owner_id stays as the creator pointer and is still queried.
Access control now flows through the memberships graph (021).

Revision ID: 035
Revises: 034
Create Date: 2026-06-28
"""
from typing import Sequence, Union

from alembic import op

revision: str = "035"
down_revision: Union[str, None] = "034"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        # Unnamed UniqueConstraint("owner_id") → default name.
        op.drop_constraint("businesses_owner_id_key", "businesses", type_="unique")
        op.create_index(
            "ix_businesses_owner_id", "businesses", ["owner_id"], unique=False
        )
    # SQLite (tests) builds the schema from the models via create_all, so
    # there's nothing to alter there.


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.drop_index("ix_businesses_owner_id", table_name="businesses")
        op.create_unique_constraint(
            "businesses_owner_id_key", "businesses", ["owner_id"]
        )
