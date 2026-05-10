"""Waitlist for full slots.

When a client tries to book a slot that's already taken, they can opt
into the waitlist for that exact (business, service, date, start_time).
On cancellation we ping the first eligible entry. Notifying once per
entry avoids spamming the same client every time their slot churns.
"""

import uuid
from datetime import date as _date, datetime, time as _time, timezone

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Time,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class WaitlistEntry(Base):
    __tablename__ = "waitlist_entries"
    __table_args__ = (
        # One client can wait on each (business, service, date, time)
        # combination at most once. Re-tapping "уведоми меня" is
        # idempotent at the DB level.
        UniqueConstraint(
            "business_id",
            "service_id",
            "date",
            "start_time",
            "client_id",
            name="uq_waitlist_unique_entry",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    service_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("services.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    date: Mapped[_date] = mapped_column(Date, nullable=False, index=True)
    start_time: Mapped[_time] = mapped_column(Time, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )
    # Set when the slot opens up and we've messaged the client. We
    # don't delete the row so the next cancellation knows this entry
    # already used its turn.
    notified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    business = relationship("Business")
    service = relationship("Service")
    client = relationship("Client")
