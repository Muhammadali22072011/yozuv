"""media_blobs — store business logos/photos in the DB

Render's filesystem is ephemeral: files written under UPLOADS_DIR (default
/tmp) are wiped on every deploy/restart, so logo/photo uploads became 404s.
Move the bytes into Postgres. Existing logo_url/photo rows that pointed at
already-lost files simply resolve to no blob (404 → frontend avatar fallback);
new uploads persist.

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
