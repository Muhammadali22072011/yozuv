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
    is_active: bool | None = None


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

    class Config:
        from_attributes = True
