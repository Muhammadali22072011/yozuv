import uuid
from datetime import datetime, timezone

from sqlalchemy import BigInteger, DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AdminUser(Base):
    """A platform admin managed from the panel.

    Additive to the ADMIN_TELEGRAM_IDS env list: env ids are the
    bootstrap "superadmins" that can never be removed from the UI, while
    rows here can be granted/revoked at runtime by any admin. Checked by
    deps.is_admin_user alongside the env set.
    """

    __tablename__ = "admin_users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    telegram_id: Mapped[int] = mapped_column(BigInteger, nullable=False, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), default="")
    # "admin" — can use the panel; "superadmin" — can also grant/revoke
    # other admins. ENV ADMIN_TELEGRAM_IDS are always superadmins.
    role: Mapped[str] = mapped_column(String(16), default="admin", nullable=False)
    added_by_telegram_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
