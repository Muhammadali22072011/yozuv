import uuid
from datetime import date, datetime, time

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, Time
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import BookingStatus, PaymentStatus


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    service_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("services.id", ondelete="SET NULL"), nullable=True, index=True
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="SET NULL"), nullable=True, index=True
    )
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    status: Mapped[BookingStatus] = mapped_column(String(32), default=BookingStatus.PENDING, nullable=False)
    cancel_reason: Mapped[str | None] = mapped_column(String(512), nullable=True)
    payment_status: Mapped[PaymentStatus] = mapped_column(
        String(32), default=PaymentStatus.UNPAID, nullable=False
    )
    payment_amount: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[str] = mapped_column(Text, default="")
    # Shared id for every booking that belongs to the same recurrence
    # series ("каждый вторник на 4 недели"). NULL for one-off bookings.
    # We use a plain UUID rather than a Recurrence row because every
    # booking already has the date / start_time the recurrence resolved
    # to — there's nothing to look up at fetch time, just to delete the
    # whole series in one DELETE WHERE recurrence_id = ?.
    recurrence_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.utcnow())
    # Set when the 1-hour-before reminder is delivered. Used by
    # send_hourly_reminders to skip rows already notified — Celery beat
    # runs every minute, so without dedup the same booking can fall in
    # two windows and the client gets the reminder twice.
    reminder_sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    business: Mapped["Business"] = relationship("Business", back_populates="bookings")
    service: Mapped["Service | None"] = relationship("Service", back_populates="bookings")
    client: Mapped["Client | None"] = relationship("Client", back_populates="bookings")
