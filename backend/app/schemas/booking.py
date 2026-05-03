from datetime import date, datetime, time
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import BookingStatus, PaymentStatus


class BookingCreatePublic(BaseModel):
    business_id: UUID
    service_id: UUID
    client_telegram_id: int
    client_first_name: str = ""
    client_last_name: str = ""
    client_phone: str = ""
    date: date
    start_time: time
    promo_code: str = ""


class BookingCreateOwner(BaseModel):
    client_id: UUID
    service_id: UUID
    date: date
    start_time: time


class BookingRead(BaseModel):
    id: UUID
    business_id: UUID
    service_id: UUID | None
    client_id: UUID | None
    date: date
    start_time: time
    end_time: time
    status: BookingStatus
    cancel_reason: str | None
    payment_status: PaymentStatus
    payment_amount: int
    notes: str
    created_at: datetime

    class Config:
        from_attributes = True


class BookingCancelBody(BaseModel):
    reason: str = Field(default="", max_length=512)
