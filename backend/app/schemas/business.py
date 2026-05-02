from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import BusinessCategory, ConfirmationMode, LanguageCode


class BusinessCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    slug: str = Field(min_length=1, max_length=128)
    category: BusinessCategory = BusinessCategory.OTHER
    description: str = ""
    address: str = ""
    phone: str = ""
    viloyat: str = ""
    tuman: str = ""
    latitude: float | None = None
    longitude: float | None = None


class BusinessUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    address: str | None = None
    phone: str | None = None
    logo_url: str | None = None
    welcome_text: str | None = None
    after_booking_text: str | None = None
    reminder_text: str | None = None
    confirmation_mode: ConfirmationMode | None = None
    language: LanguageCode | None = None
    viloyat: str | None = None
    tuman: str | None = None
    latitude: float | None = None
    longitude: float | None = None
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
    is_active: bool
    created_at: datetime
    viloyat: str = ""
    tuman: str = ""
    latitude: float | None = None
    longitude: float | None = None

    class Config:
        from_attributes = True
