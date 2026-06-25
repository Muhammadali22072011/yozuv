import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AuthIdentity(Base):
    """One external login method linked to one User (the account).

    The User row IS the account; each AuthIdentity row is one way to prove
    you are that account (Telegram, Google, password, …). The JWT subject
    is already the User.id UUID, so multiple identities share one session.

    Invariants (DB-enforced):
      - UNIQUE(provider, subject): one external account → one Yozuv account.
      - UNIQUE(user_id, provider): at most one of each provider per account.
    """

    __tablename__ = "auth_identities"
    __table_args__ = (
        UniqueConstraint(
            "provider", "subject", name="uq_auth_identity_provider_subject"
        ),
        UniqueConstraint(
            "user_id", "provider", name="uq_auth_identity_user_provider"
        ),
        Index("ix_auth_identities_user", "user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    # AuthProvider.value: 'telegram' | 'google' | 'password' | 'apple'.
    provider: Mapped[str] = mapped_column(String(16), nullable=False)
    # Stable external id: telegram numeric id as text, google OIDC `sub`,
    # or the normalized password login (lowercased username / phone).
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    # Provider-supplied email — display + takeover checks only, never the key.
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Bcrypt hash for provider='password'; NULL for every other provider.
    secret: Mapped[str | None] = mapped_column(String(255), nullable=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    user: Mapped["User"] = relationship("User", back_populates="identities")
