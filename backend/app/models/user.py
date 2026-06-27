import uuid
from datetime import datetime, timezone

from sqlalchemy import BigInteger, Boolean, DateTime, Index, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        # Telegram usernames are case-insensitive, so uniqueness is on
        # lower(username). Empty string is the "no login set" sentinel and
        # is excluded so multiple password-less accounts can coexist.
        Index(
            "uq_users_username_lower",
            text("lower(username)"),
            unique=True,
            postgresql_where=text("username <> ''"),
            sqlite_where=text("username <> ''"),
        ),
        # Phone is also a standalone-login identifier, so it needs the same
        # DB-level uniqueness as username. Empty string is the "no phone"
        # sentinel and is excluded so password-less accounts can coexist.
        Index(
            "uq_users_phone",
            text("phone"),
            unique=True,
            postgresql_where=text("phone <> ''"),
            sqlite_where=text("phone <> ''"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Nullable since Google/password-only accounts have no Telegram id.
    # Still unique — multiple NULLs are allowed in both Postgres and SQLite.
    telegram_id: Mapped[int | None] = mapped_column(BigInteger, unique=True, nullable=True, index=True)
    username: Mapped[str] = mapped_column(String(64), default="")
    first_name: Mapped[str] = mapped_column(String(255), default="")
    last_name: Mapped[str] = mapped_column(String(255), default="")
    phone: Mapped[str] = mapped_column(String(32), default="")
    # Bcrypt hash for standalone (non-Telegram) login. NULL = password
    # login disabled for this user; they can still sign in via Telegram.
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    # A user may own several businesses (a salon network). Each one points
    # back here via Business.owner_id; the membership graph carries roles.
    businesses: Mapped[list["Business"]] = relationship(
        "Business", back_populates="owner", order_by="Business.created_at"
    )
    # Linked login methods (Telegram, Google, password, …). The account is
    # this User row; each identity is one way to authenticate as it.
    identities: Mapped[list["AuthIdentity"]] = relationship(
        "AuthIdentity", back_populates="user", cascade="all, delete-orphan"
    )

    @property
    def business(self) -> "Business | None":
        """Back-compat accessor for the single-business era.

        Returns the user's primary (oldest, non-deleted) business so code
        written before multi-business — and admin lookups — keep working.
        New code should resolve the *active* business via Membership /
        the X-Business-Id header instead.
        """
        live = [b for b in self.businesses if getattr(b, "deleted_at", None) is None]
        pool = live or self.businesses
        return pool[0] if pool else None
