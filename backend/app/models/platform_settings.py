from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class PlatformSettings(Base):
    """Singleton row with platform-wide payment settings (card number, holder, comment)."""

    __tablename__ = "platform_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    card_number: Mapped[str] = mapped_column(String(32), default="")
    card_holder: Mapped[str] = mapped_column(String(128), default="")
    payment_comment: Mapped[str] = mapped_column(Text, default="")
    # Subscription plan prices in UZS. 0 means "fall back to the code
    # default" (MONTHLY_AMOUNT_UZS / YEARLY_AMOUNT_UZS in payment_service),
    # so an unconfigured row keeps the historical pricing.
    monthly_price: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    yearly_price: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )
