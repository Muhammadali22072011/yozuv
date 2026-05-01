from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import get_owned_business
from app.models import Booking, BookingStatus, Business, Client, Service, User
from app.schemas.booking import BookingCancelBody, BookingCreatePublic, BookingRead
from app.services import booking_service
from app.services.notification_service import send_telegram_message
from app.utils.ratelimit import rate_limit
from app.utils.slots import get_available_slots

router = APIRouter(tags=["bookings"])
me_router = APIRouter(prefix="/business/me", tags=["bookings"])
public_router = APIRouter(prefix="/business", tags=["bookings"])

# 10/min per IP — protects public booking endpoint from slot spam.
_booking_rate = rate_limit("public_booking", limit=10, window_seconds=60)


@router.post("/bookings", response_model=BookingRead)
def create_public_booking(
    body: BookingCreatePublic,
    db: Session = Depends(get_db),
    _: None = Depends(_booking_rate),
):
    try:
        booking = booking_service.create_booking(db, body)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    db.commit()

    # Reload with relationships in a single query to avoid N+1
    booking = (
        db.query(Booking)
        .options(joinedload(Booking.business), joinedload(Booking.service), joinedload(Booking.client))
        .filter(Booking.id == booking.id)
        .first()
    )

    business = booking.business
    service = booking.service
    client = booking.client
    if business and business.owner_id and client:
        owner = db.query(User).filter(User.id == business.owner_id).first()
        if owner:
            from app.bot.locales import t

            lang = str(business.language)
            text = t(lang, "new_booking_owner").format(
                client=f"{client.first_name} {client.last_name}".strip() or str(client.telegram_id),
                service=service.name if service else "",
                date=booking.date.strftime("%d-%b"),
                time=booking.start_time.strftime("%H:%M"),
            )
            kb = {
                "inline_keyboard": [
                    [
                        {"text": "✅ Tasdiqlash", "callback_data": f"own_confirm:{booking.id}"},
                        {"text": "❌ Rad etish", "callback_data": f"own_reject:{booking.id}"},
                    ]
                ]
            }
            send_telegram_message(int(owner.telegram_id), text, reply_markup=kb)

    return booking


@me_router.get("/bookings", response_model=list[BookingRead])
def list_bookings(
    db: Session = Depends(get_db),
    business: Business = Depends(get_owned_business),
    booking_date: date | None = None,
    status: BookingStatus | None = None,
    offset: int = 0,
    limit: int = Query(50, le=200),
):
    q = (
        db.query(Booking)
        .options(joinedload(Booking.service), joinedload(Booking.client))
        .filter(Booking.business_id == business.id)
    )
    if booking_date:
        q = q.filter(Booking.date == booking_date)
    if status:
        q = q.filter(Booking.status == status)
    return q.order_by(Booking.date.desc(), Booking.start_time.desc()).offset(offset).limit(limit).all()


@me_router.put("/bookings/{booking_id}/confirm", response_model=BookingRead)
def confirm(
    booking_id: UUID,
    db: Session = Depends(get_db),
    business: Business = Depends(get_owned_business),
):
    b = booking_service.confirm_booking(db, booking_id, business.id)
    if not b:
        raise HTTPException(404, "Not found")
    db.commit()
    db.refresh(b)
    return b


@me_router.put("/bookings/{booking_id}/cancel", response_model=BookingRead)
def cancel(
    booking_id: UUID,
    body: BookingCancelBody,
    db: Session = Depends(get_db),
    business: Business = Depends(get_owned_business),
):
    b = booking_service.cancel_booking(db, booking_id, business.id, body.reason)
    if not b:
        raise HTTPException(404, "Not found")
    db.commit()
    db.refresh(b)
    return b


@public_router.get("/{slug}/slots")
def slots_for_date(
    slug: str,
    service_id: UUID,
    date: date = Query(...),
    db: Session = Depends(get_db),
):
    if slug == "me":
        raise HTTPException(404, "Not found")
    b = db.query(Business).filter(Business.slug == slug).first()
    if not b:
        raise HTTPException(404, "Not found")
    service = db.query(Service).filter(Service.id == service_id, Service.business_id == b.id).first()
    if not service:
        raise HTTPException(404, "Service not found")
    times = get_available_slots(b.id, date, service.duration_minutes, db)
    return {"slots": [t.strftime("%H:%M") for t in times]}
