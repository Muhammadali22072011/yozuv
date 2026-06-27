from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import BusinessCategory, ConfirmationMode, LanguageCode


# Slug rule: must start with a lowercase letter or digit and may contain
# only lowercase letters, digits and dashes. Mirrors the pattern already
# enforced in the admin create-business endpoint and avoids slugs like
# "me", "..", or anything that would alias an existing route prefix.
SLUG_PATTERN = r"^[a-z0-9][a-z0-9-]{0,127}$"


# Caps for the long-form text fields the owner controls. Telegram caps
# message text at 4096 chars; the welcome/after-booking/reminder
# templates are sent as-is, so bounding them at 2000 leaves headroom for
# emoji and formatting while preventing pathological 10MB blobs.
LONG_TEXT_MAX = 2000


class BusinessCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    slug: str = Field(min_length=2, max_length=128, pattern=SLUG_PATTERN)
    category: BusinessCategory = BusinessCategory.OTHER
    description: str = Field(default="", max_length=LONG_TEXT_MAX)
    address: str = Field(default="", max_length=512)
    phone: str = Field(default="", max_length=32)
    viloyat: str = Field(default="", max_length=64)
    tuman: str = Field(default="", max_length=128)
    latitude: float | None = None
    longitude: float | None = None


class BusinessUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=LONG_TEXT_MAX)
    address: str | None = Field(default=None, max_length=512)
    phone: str | None = Field(default=None, max_length=32)
    logo_url: str | None = Field(default=None, max_length=1024)
    welcome_text: str | None = Field(default=None, max_length=LONG_TEXT_MAX)
    after_booking_text: str | None = Field(default=None, max_length=LONG_TEXT_MAX)
    reminder_text: str | None = Field(default=None, max_length=LONG_TEXT_MAX)
    confirmation_mode: ConfirmationMode | None = None
    language: LanguageCode | None = None
    notifications_enabled: bool | None = None
    viloyat: str | None = Field(default=None, max_length=64)
    tuman: str | None = Field(default=None, max_length=128)
    latitude: float | None = None
    longitude: float | None = None
    # 0 = no policy. 168 = 1 week — anything bigger is almost certainly
    # a typo, so cap there to avoid silently flagging every cancel.
    cancel_window_hours: int | None = Field(default=None, ge=0, le=168)
    # NOTE: is_active is intentionally NOT here. A blocked owner could
    # otherwise re-activate themselves via PUT /business/me. Toggling
    # is_active belongs in admin endpoints only.


class BusinessPublic(BaseModel):
    id: UUID
    name: str
    slug: str
    category: BusinessCategory
    description: str
    address: str
    phone: str
    logo_url: str
    language: LanguageCode
    viloyat: str = ""
    tuman: str = ""
    latitude: float | None = None
    longitude: float | None = None

    class Config:
        from_attributes = True


class BusinessMe(BaseModel):
    id: UUID
    name: str
    slug: str
    category: BusinessCategory
    description: str
    address: str
    phone: str
    logo_url: str
    welcome_text: str
    after_booking_text: str
    reminder_text: str
    confirmation_mode: ConfirmationMode
    language: LanguageCode
    notifications_enabled: bool = True
    is_active: bool
    created_at: datetime
    viloyat: str = ""
    tuman: str = ""
    latitude: float | None = None
    longitude: float | None = None
    cancel_window_hours: int = 0

    class Config:
        from_attributes = True
