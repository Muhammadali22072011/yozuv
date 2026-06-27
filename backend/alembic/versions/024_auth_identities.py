"""auth_identities: one account, many linked login methods

Phase 1 of the multi-provider identity rollout (docs/IDENTITY_ARCHITECTURE.md).
Adds the auth_identities table and backfills existing users into it WITHOUT
changing any behavior — auth.py still reads User.telegram_id / password_hash.
A later phase switches the login paths over to this table.

Revision ID: 024
Revises: 023
Create Date: 2026-06-25
"""

import uuid
from datetime import datetime, timezone
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "024"
down_revision: Union[str, None] = "023"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "auth_identities",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("provider", sa.String(16), nullable=False),
        sa.Column("subject", sa.String(255), nullable=False),
        sa.Column("email", sa.String(320), nullable=True),
        sa.Column(
            "email_verified",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("secret", sa.String(255), nullable=True),
        sa.Column(
            "display_name", sa.String(255), nullable=False, server_default=""
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint(
            "provider", "subject", name="uq_auth_identity_provider_subject"
        ),
        sa.UniqueConstraint(
            "user_id", "provider", name="uq_auth_identity_user_provider"
        ),
    )
    op.create_index("ix_auth_identities_user", "auth_identities", ["user_id"])

    # Backfill: every existing account gets a 'telegram' identity, and any
    # account with a password_hash also gets a 'password' identity. Done in
    # Python for Postgres/SQLite portability (no gen_random_uuid()).
    bind = op.get_bind()
    users = bind.execute(
        sa.text(
            "SELECT id, telegram_id, username, phone, password_hash, "
            "first_name, created_at FROM users"
        )
    ).fetchall()

    now = datetime.now(timezone.utc)
    insert = sa.text(
        "INSERT INTO auth_identities "
        "(id, user_id, provider, subject, email, email_verified, secret, "
        " display_name, created_at, last_login_at) VALUES "
        "(:id, :user_id, :provider, :subject, :email, :email_verified, "
        " :secret, :display_name, :created_at, :last_login_at)"
    )

    rows = []
    # Guard the uq_auth_identity_provider_subject constraint: real data can
    # contain two accounts that share a phone (phone uniqueness isn't enforced
    # until a later migration) or a collidable lowercased username. Without
    # dedup the single batch INSERT would violate the constraint and abort the
    # whole upgrade. First occurrence wins; later collisions are skipped.
    seen: set[tuple[str, str]] = set()

    def _add(provider: str, subject: str, **rest) -> None:
        key = (provider, subject)
        if key in seen:
            return
        seen.add(key)
        rows.append(
            {"id": str(uuid.uuid4()), "provider": provider, "subject": subject, **rest}
        )

    for u in users:
        created = u.created_at or now
        _add(
            "telegram",
            str(u.telegram_id),
            user_id=str(u.id),
            email=None,
            email_verified=False,
            secret=None,
            display_name=(u.username or u.first_name or "")[:255],
            created_at=created,
            last_login_at=created,
        )
        if u.password_hash:
            subject = ((u.username or "").strip().lower()) or (u.phone or "").strip()
            if subject:
                _add(
                    "password",
                    subject,
                    user_id=str(u.id),
                    email=None,
                    email_verified=False,
                    secret=u.password_hash,
                    display_name=(u.username or "")[:255],
                    created_at=created,
                    last_login_at=None,
                )

    if rows:
        bind.execute(insert, rows)


def downgrade() -> None:
    op.drop_index("ix_auth_identities_user", table_name="auth_identities")
    op.drop_table("auth_identities")
