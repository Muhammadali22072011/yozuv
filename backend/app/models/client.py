import uuid
from datetime import date, datetime, timezone

from sqlalchemy import BigInteger, Date, DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # One client row per Telegram user. The lookups in booking_service
    # (`get_or_create_client`) and the bot already assume there is at
    # most one row per telegram_id; without the constraint two
    # concurrent first-time bookings could create duplicates and
    # subsequent .first() lookups would silently pick one.
    telegram_id: Mapped[int] = mapped_column(
        BigInteger, nullable=False, unique=True, index=True
    )
    first_name: Mapped[str] = mapped_column(String(255), default="")
    last_name: Mapped[str] = mapped_column(String(255), default="")
    phone: Mapped[str] = mapped_column(String(32), default="")
    # Optional birthday for the daily greeting task. Date only — no
    # year is required (some clients don't want to share age), so we
    # compare month+day only when picking who to message today.
    birthday: Mapped[date | None] = mapped_column(Date, nullable=True)
    # Last time we sent any retention message to this client (birthday,
    # re-engagement, etc.). Used to dedupe so a client doesn't get two
    # bot pings in a row when several daily tasks happen to overlap.
    last_outreach_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    bookings: Mapped[list["Booking"]] = relationship("Booking", back_populates="client")
