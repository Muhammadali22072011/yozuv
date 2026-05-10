from datetime import date, datetime, time
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import BookingStatus, PaymentStatus


class BookingCreatePublic(BaseModel):
    """Body for the public POST /api/bookings endpoint.

    `client_telegram_id` is populated server-side from the verified
    `init_data` and MUST NOT be trusted from the client. It stays on the
    schema (and not as a router-only kwarg) because the bot reuses this
    schema to call the service in-process — there it's already trusted
    because it comes from `cb.from_user.id`. The router resets it from
    initData before passing the payload onwards, so any client-supplied
    value is overwritten.
    """

    business_id: UUID
    service_id: UUID
    init_data: str = Field(default="", description="Telegram WebApp initData; required for HTTP callers")
    client_telegram_id: int = 0
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


class BookingUpdate(BaseModel):
    service_id: Optional[UUID] = None
    date: Optional[date] = None
    start_time: Optional[time] = None
