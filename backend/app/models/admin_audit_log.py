import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, BigInteger, DateTime, String
from sqlalchemy.dialects.postgresql import JSONB, UUID

# JSONB on Postgres; SQLite (tests) has no JSONB, fall back to portable JSON.
_JsonB = JSONB().with_variant(JSON(), "sqlite")
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AdminAuditLog(Base):
    __tablename__ = "admin_audit_log"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    admin_telegram_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    admin_name: Mapped[str] = mapped_column(String(255), default="")
    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    target_type: Mapped[str] = mapped_column(String(64), default="", index=True)
    target_id: Mapped[str] = mapped_column(String(64), default="")
    payload: Mapped[dict] = mapped_column(_JsonB, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, index=True
    )
