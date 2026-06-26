import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import ReferralStatus


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class BusinessReferral(Base):
    """Partner (B2B) referral: one salon invites another salon to Yozuv.

    Created PENDING when the new business signs up via a partner code,
    flipped to COMPLETED on that business's first paid subscription — at
    which point the referrer earns a discount on their next payment
    (held as Business.pending_partner_discount_percent).
    """

    __tablename__ = "business_referrals"
    __table_args__ = (
        UniqueConstraint("referred_business_id", name="uq_business_referral_referred"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    referrer_business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    referred_business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[ReferralStatus] = mapped_column(
        String(16), default=ReferralStatus.PENDING, nullable=False
    )
    reward_percent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
