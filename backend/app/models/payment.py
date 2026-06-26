import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import PaymentProvider, PaymentRecordStatus


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class PaymentTransaction(Base):
    """Оплата подписки (Payme / Click / Card)."""

    __tablename__ = "payment_transactions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider: Mapped[PaymentProvider] = mapped_column(String(16), nullable=False)
    external_id: Mapped[str] = mapped_column(String(255), default="", index=True)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[PaymentRecordStatus] = mapped_column(
        String(32), default=PaymentRecordStatus.PENDING, nullable=False
    )
    plan: Mapped[str] = mapped_column(String(32), default="MONTHLY")
    # 'subscription' (default, billing) or 'deposit' (booking prepayment). A
    # deposit tx also carries booking_id; the webhook routes on this.
    kind: Mapped[str] = mapped_column(String(16), default="subscription", nullable=False)
    booking_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bookings.id", ondelete="SET NULL"), nullable=True, index=True
    )
    raw_payload: Mapped[str] = mapped_column(Text, default="")
    screenshot_url: Mapped[str] = mapped_column(String(512), default="")
    user_comment: Mapped[str] = mapped_column(Text, default="")
    reviewed_by: Mapped[str] = mapped_column(String(64), default="")
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    business: Mapped["Business"] = relationship("Business")
