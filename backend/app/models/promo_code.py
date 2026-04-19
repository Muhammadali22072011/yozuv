import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PromoCode(Base):
    """Business-owned promo code. Discount by percent OR by fixed amount."""

    __tablename__ = "promo_codes"
    __table_args__ = (UniqueConstraint("business_id", "code", name="uq_promo_biz_code"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    code: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    discount_percent: Mapped[int] = mapped_column(Integer, default=0)  # 0-100
    discount_amount: Mapped[int] = mapped_column(Integer, default=0)  # UZS
    max_uses: Mapped[int] = mapped_column(Integer, default=0)  # 0 = unlimited
    uses_count: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.utcnow())

    business = relationship("Business")
