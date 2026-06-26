"""media_blobs — store business logos/photos in the DB

Render's filesystem is ephemeral: files written under UPLOADS_DIR (default
/tmp) are wiped on every deploy/restart, so logo/photo uploads became 404s.
Move the bytes into Postgres. Existing logo_url/photo rows that pointed at
already-lost files simply resolve to no blob (404 → frontend avatar fallback);
new uploads persist.

Revision ID: 029
Revises: 028

Renumbered from 026 → 029: three other migrations (review_owner_reply=026,
user_phone_unique=027, booking_deposit=028) already shipped and applied in
production with those ids, so this one collided on "026" and broke every
deploy. Slot it after the live head (028) instead.

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
    op.create_table(
        "media_blobs",
        sa.Column("key", sa.String(length=128), primary_key=True),
        sa.Column("content_type", sa.String(length=64), nullable=False),
        sa.Column("data", sa.LargeBinary(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )


def downgrade() -> None:
    op.drop_table("media_blobs")
