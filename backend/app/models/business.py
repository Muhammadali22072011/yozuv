import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import BusinessCategory, ConfirmationMode, LanguageCode


class Business(Base):
    __tablename__ = "businesses"
    __table_args__ = (UniqueConstraint("slug", name="uq_businesses_slug"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    category: Mapped[BusinessCategory] = mapped_column(
        String(32), default=BusinessCategory.OTHER, nullable=False
    )
    description: Mapped[str] = mapped_column(Text, default="")
    address: Mapped[str] = mapped_column(String(512), default="")
    phone: Mapped[str] = mapped_column(String(32), default="")
    logo_url: Mapped[str] = mapped_column(String(1024), default="")
    welcome_text: Mapped[str] = mapped_column(Text, default="")
    after_booking_text: Mapped[str] = mapped_column(Text, default="")
    reminder_text: Mapped[str] = mapped_column(Text, default="")
    confirmation_mode: Mapped[ConfirmationMode] = mapped_column(
        String(32), default=ConfirmationMode.AUTO, nullable=False
    )
    language: Mapped[LanguageCode] = mapped_column(String(8), default=LanguageCode.UZ, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.utcnow())

    owner: Mapped["User"] = relationship("User", back_populates="business")
    services: Mapped[list["Service"]] = relationship("Service", back_populates="business", cascade="all, delete-orphan")
    schedules: Mapped[list["Schedule"]] = relationship(
        "Schedule", back_populates="business", cascade="all, delete-orphan"
    )
    holidays: Mapped[list["HolidayDate"]] = relationship(
        "HolidayDate", back_populates="business", cascade="all, delete-orphan"
    )
    bookings: Mapped[list["Booking"]] = relationship("Booking", back_populates="business")
    subscriptions: Mapped[list["Subscription"]] = relationship(
        "Subscription", back_populates="business", cascade="all, delete-orphan"
    )
