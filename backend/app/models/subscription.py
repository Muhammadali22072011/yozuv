import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import SubscriptionPlan, SubscriptionStatus, SubscriptionTier


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    plan: Mapped[SubscriptionPlan] = mapped_column(String(32), default=SubscriptionPlan.TRIAL, nullable=False)
    # Packaging tier (seat cap). Defaults to SALON so historical rows keep
    # the original "up to 5 masters" behaviour without a data backfill.
    tier: Mapped[SubscriptionTier] = mapped_column(
        String(16), default=SubscriptionTier.SALON, nullable=False
    )
    status: Mapped[SubscriptionStatus] = mapped_column(
        String(32), default=SubscriptionStatus.ACTIVE, nullable=False
    )
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    amount_paid: Mapped[int] = mapped_column(Integer, default=0)

    business: Mapped["Business"] = relationship("Business", back_populates="subscriptions")
