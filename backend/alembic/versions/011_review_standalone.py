"""allow standalone reviews (no booking required)

Revision ID: 011
Revises: 010
Create Date: 2026-05-04

"""

from typing import Sequence, Union

from alembic import op

revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the column-level UNIQUE constraint that PostgreSQL auto-named when
    # we declared `booking_id ... unique=True` in the model.
    op.drop_constraint("reviews_booking_id_key", "reviews", type_="unique")
    op.alter_column("reviews", "booking_id", nullable=True)
    # One review per booking still holds when booking_id is set:
    op.create_index(
        "uq_reviews_booking_id_when_set",
        "reviews",
        ["booking_id"],
        unique=True,
        postgresql_where="booking_id IS NOT NULL",
    )
    # And one standalone review per (business, client):
    op.create_index(
        "uq_reviews_standalone_per_client",
        "reviews",
        ["business_id", "client_id"],
        unique=True,
        postgresql_where="booking_id IS NULL",
    )


def downgrade() -> None:
    op.drop_index("uq_reviews_standalone_per_client", table_name="reviews")
    op.drop_index("uq_reviews_booking_id_when_set", table_name="reviews")
    op.alter_column("reviews", "booking_id", nullable=False)
    op.create_unique_constraint("reviews_booking_id_key", "reviews", ["booking_id"])
