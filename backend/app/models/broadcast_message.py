import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, BigInteger, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID

# JSONB on Postgres; SQLite (tests) has no JSONB, fall back to portable JSON.
_JsonB = JSONB().with_variant(JSON(), "sqlite")
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class BroadcastMessage(Base):
    __tablename__ = "broadcast_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sent_by_telegram_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    sent_by_name: Mapped[str] = mapped_column(String(255), default="")
    text: Mapped[str] = mapped_column(Text, nullable=False)
    filters: Mapped[dict] = mapped_column(_JsonB, default=dict, nullable=False)
    sent_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failed_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failed_recipients: Mapped[list] = mapped_column(_JsonB, default=list, nullable=False)
    # Delivery lifecycle. "sent" — delivered immediately (the historical
    # default for every existing row); "scheduled" — queued for a future
    # send picked up by the Celery beat task; "cancelled" — a scheduled
    # row an admin called off before it fired.
    status: Mapped[str] = mapped_column(String(16), default="sent", nullable=False)
    # Set only for status="scheduled": when the beat task should send it.
    scheduled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, index=True
    )
