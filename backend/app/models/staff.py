"""Staff member of a business.

A business with multiple workers (salon, clinic, barbershop) needs
to expose them as bookable resources: client picks a master, sees
that master's slots, books them. Until this model exists every
business operates in single-resource mode (one calendar shared by
the owner).

Two-step rollout — backwards compatible:

1. THIS PR: model + migration + CRUD endpoints. Bookings still
   default to staff_id=NULL, which means "any/owner" and behaves
   exactly like before (per-business slot conflict).

2. Next PR: bot picker + frontend dashboard UI + per-staff schedule
   overrides.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# Many-to-many: one staff member can perform several services, one
# service can be performed by several staff. We use a Table rather
# than a model class because the association has no extra columns.
staff_services = Table(
    "staff_services",
    Base.metadata,
    Column(
        "staff_id",
        UUID(as_uuid=True),
        ForeignKey("staff.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "service_id",
        UUID(as_uuid=True),
        ForeignKey("services.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Staff(Base):
    __tablename__ = "staff"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(32), default="")
    photo_url: Mapped[str] = mapped_column(String(1024), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )

    business = relationship("Business")
    services = relationship(
        "Service",
        secondary=staff_services,
        backref="staff",
    )
