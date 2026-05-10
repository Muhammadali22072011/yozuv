import uuid
from datetime import date, datetime, time, timezone

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, Time
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import BookingStatus, PaymentStatus


def _utcnow() -> datetime:
    """tz-aware UTC default for ``DateTime(timezone=True)`` columns.

    ``datetime.utcnow()`` returns a naive datetime; mixing it with the
    aware values produced everywhere else (``datetime.now(timezone.utc)``)
    triggers ``can't compare offset-naive and offset-aware`` mid-query.
    """
    return datetime.now(timezone.utc)


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
    # Optional staff member who'll perform the booking. NULL means the
    # business operates in single-resource mode (legacy bookings + any
    # business that hasn't onboarded staff yet). Conflict logic in the
    # booking service treats NULL as "shared calendar" and a set value
    # as "this specific staff calendar" so multi-staff and single-staff
    # businesses coexist without a forced migration.
    staff_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("staff.id", ondelete="SET NULL"), nullable=True, index=True
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
    # Set when cancel_booking ran inside business.cancel_window_hours of
    # start_time. Owner-side cancellations don't flip it — only client
    # initiated cancels via the bot count as "late".
    late_cancel: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Shared id for every booking that belongs to the same recurrence
    # series ("каждый вторник на 4 недели"). NULL for one-off bookings.
    recurrence_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
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
