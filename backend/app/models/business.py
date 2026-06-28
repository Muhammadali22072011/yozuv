import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import BusinessCategory, ConfirmationMode, LanguageCode


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Business(Base):
    __tablename__ = "businesses"
    __table_args__ = (UniqueConstraint("slug", name="uq_businesses_slug"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # The creator / primary owner. No longer UNIQUE: one user may own
    # several businesses (a salon network). Fine-grained access lives in
    # the Membership graph; owner_id stays as the creator pointer that
    # drives the ON DELETE CASCADE, admin lookups and owner notifications.
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    category: Mapped[BusinessCategory] = mapped_column(
        String(32), default=BusinessCategory.OTHER, nullable=False
    )
    description: Mapped[str] = mapped_column(Text, default="")
    address: Mapped[str] = mapped_column(String(512), default="")
    viloyat: Mapped[str] = mapped_column(String(64), default="", index=True)
    tuman: Mapped[str] = mapped_column(String(128), default="", index=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    phone: Mapped[str] = mapped_column(String(32), default="")
    logo_url: Mapped[str] = mapped_column(String(1024), default="")
    welcome_text: Mapped[str] = mapped_column(Text, default="")
    after_booking_text: Mapped[str] = mapped_column(Text, default="")
    reminder_text: Mapped[str] = mapped_column(Text, default="")
    confirmation_mode: Mapped[ConfirmationMode] = mapped_column(
        String(32), default=ConfirmationMode.AUTO, nullable=False
    )
    language: Mapped[LanguageCode] = mapped_column(String(8), default=LanguageCode.UZ, nullable=False)
    # How close to start_time a client may still cancel without it being
    # flagged as a "late" cancel. 0 = no policy / always on time.
    cancel_window_hours: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Client referral program ("invite a friend"). When enabled, a friend
    # who books via a client's referral link gets referral_friend_percent
    # off their first booking, and the referrer earns a one-time promo
    # code worth referral_reward_percent. Both 0-100.
    referral_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    referral_friend_percent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    referral_reward_percent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Owner's master switch for the per-booking Telegram alerts they get
    # (Sozlamalar → Bildirishnomalar). Off = no new-booking pings; the
    # client-facing flow (confirmations, reminders) is unaffected.
    notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # "Founder narx" lock — see PlatformSettings.founder_discount_percent.
    is_founder: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # B2B referral ("owner brings owner"): this business's own share code,
    # the business that referred it (set at signup via ?ref=), and a guard so
    # the +30-day reward is granted exactly once (on the referred business's
    # first paid subscription).
    partner_code: Mapped[str] = mapped_column(String(16), default="", index=True)
    referred_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True
    )
    partner_reward_claimed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Server-side intro/onboarding flag so a returning owner isn't re-walked
    # through the WelcomeModal + tour on a new device (localStorage is
    # per-device, so it can't carry this across devices/WebView resets).
    onboarding_seen: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    owner: Mapped["User"] = relationship("User", back_populates="businesses")
    services: Mapped[list["Service"]] = relationship("Service", back_populates="business", cascade="all, delete-orphan")
    schedules: Mapped[list["Schedule"]] = relationship(
        "Schedule", back_populates="business", cascade="all, delete-orphan"
    )
    holidays: Mapped[list["HolidayDate"]] = relationship(
        "HolidayDate", back_populates="business", cascade="all, delete-orphan"
    )
    # passive_deletes: rely on the DB-level ON DELETE CASCADE on
    # Booking.business_id when a business is hard-deleted, instead of
    # SQLAlchemy loading every historical booking and trying to NULL the
    # NOT NULL business_id (which raised on any business with past bookings).
    bookings: Mapped[list["Booking"]] = relationship(
        "Booking",
        back_populates="business",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    subscriptions: Mapped[list["Subscription"]] = relationship(
        "Subscription", back_populates="business", cascade="all, delete-orphan"
    )
