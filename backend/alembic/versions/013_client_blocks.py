"""client_blocks (per-business client block list)

Revision ID: 013
Revises: 012
Create Date: 2026-05-07
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "013"
down_revision: Union[str, None] = "012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "client_blocks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "business_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("businesses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "client_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("clients.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("reason", sa.String(length=512), nullable=False, server_default=""),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.UniqueConstraint("business_id", "client_id", name="uq_block_biz_client"),
    )
    op.create_index(
        "ix_client_blocks_business_id", "client_blocks", ["business_id"], unique=False
    )
    op.create_index(
        "ix_client_blocks_client_id", "client_blocks", ["client_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_client_blocks_client_id", table_name="client_blocks")
    op.drop_index("ix_client_blocks_business_id", table_name="client_blocks")
    op.drop_table("client_blocks")
