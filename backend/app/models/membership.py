"""User <-> Business membership join.

Until now Business.owner_id was the only relationship — strictly one
business per user, one owner per business. This model is the
foundation for the multi-business / multi-owner future:

* one user can be a member of several businesses (network of salons)
* one business can have several members with different roles
* ownership can be transferred without recreating rows

The legacy `Business.owner_id` column stays in place for the
gradual rewire. Migration 021 backfills a Membership(role=OWNER) row
for every existing (user, business) pair and adds a unique
constraint so the membership graph never drifts past the legacy
field.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import MembershipRole


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Membership(Base):
    __tablename__ = "memberships"
    __table_args__ = (
        # One row per (user, business) — a user can't have two roles
        # at the same business. Promoting a STAFF to OWNER is an UPDATE,
        # not an INSERT.
        UniqueConstraint("user_id", "business_id", name="uq_membership_user_biz"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[MembershipRole] = mapped_column(
        String(16), default=MembershipRole.OWNER, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )

    user = relationship("User")
    business = relationship("Business")
