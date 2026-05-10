import uuid as _uuid
from datetime import date, datetime, time, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import get_owned_business
from app.models import (
    Booking,
    BookingStatus,
    Business,
    Client,
    PaymentStatus,
    Service,
    User,
)
from app.models.enums import ConfirmationMode
from app.schemas.booking import (
    BookingCancelBody,
    BookingCreateOwner,
    BookingCreatePublic,
    BookingRead,
    BookingUpdate,
)
from app.config import get_settings
from app.services import booking_service
from app.services.event_bus import publish as publish_event
from app.services.notification_service import send_telegram_message
from app.utils.ratelimit import rate_limit
from app.utils.slots import get_available_slots
from app.utils.telegram_webapp import parse_user_from_init, validate_telegram_init_data

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
    # Trust the verified Telegram WebApp initData, not the client-supplied
    # client_telegram_id field. Anyone hitting this endpoint directly could
    # otherwise impersonate any Telegram account or fill a competitor's
    # calendar with bookings tied to fake identities.
    settings = get_settings()
    if not body.init_data:
        raise HTTPException(401, "init_data is required")
    if not settings.bot_token:
        raise HTTPException(500, "BOT_TOKEN not configured")
    try:
        parsed = validate_telegram_init_data(body.init_data, settings.bot_token)
        tg_user = parse_user_from_init(parsed)
        body.client_telegram_id = int(tg_user["id"])
    except Exception as exc:
        raise HTTPException(401, f"Invalid initData: {exc}") from exc

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
            from bot.locales import t
            from app.utils.htmlsafe import h

            lang = str(business.language)
            client_name = (
                f"{client.first_name} {client.last_name}".strip()
                or str(client.telegram_id)
            )
            text = t(lang, "new_booking_owner").format(
                client=h(client_name),
                service=h(service.name) if service else "",
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

    # Notify any open SSE streams for this business so the dashboard
    # bell updates without a 60s wait.
    publish_event(business.id, "booking_new")

    return booking


@me_router.post("/bookings", response_model=BookingRead)
def create_owner_booking(
    body: BookingCreateOwner,
    db: Session = Depends(get_db),
    business: Business = Depends(get_owned_business),
):
    """Owner-created booking from the dashboard. Picks an existing client by id
    and bypasses the public-flow telegram_id lookup."""
    service = (
        db.query(Service)
        .filter(
            Service.id == body.service_id,
            Service.business_id == business.id,
            Service.is_active.is_(True),
        )
        .first()
    )
    if not service:
        raise HTTPException(404, "Service not found")
    client = db.query(Client).filter(Client.id == body.client_id).first()
    if not client:
        raise HTTPException(404, "Client not found")

    end_dt = datetime.combine(body.date, body.start_time) + timedelta(
        minutes=service.duration_minutes
    )
    end_time = end_dt.time()

    conflict = (
        db.query(Booking)
        .filter(
            Booking.business_id == business.id,
            Booking.date == body.date,
            Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED]),
            Booking.start_time < end_time,
            Booking.end_time > body.start_time,
        )
        .with_for_update()
        .first()
    )
    if conflict:
        raise HTTPException(400, "Vaqt band")

    try:
        mode = (
            business.confirmation_mode
            if isinstance(business.confirmation_mode, ConfirmationMode)
            else ConfirmationMode(str(business.confirmation_mode))
        )
    except ValueError:
        mode = ConfirmationMode.AUTO
    status = (
        BookingStatus.CONFIRMED if mode == ConfirmationMode.AUTO else BookingStatus.PENDING
    )

    booking = Booking(
        business_id=business.id,
        service_id=service.id,
        client_id=client.id,
        date=body.date,
        start_time=body.start_time,
        end_time=end_time,
        status=status,
        payment_status=PaymentStatus.UNPAID,
        payment_amount=service.price,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
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


@me_router.patch("/bookings/{booking_id}", response_model=BookingRead)
def update_booking(
    booking_id: UUID,
    body: BookingUpdate,
    db: Session = Depends(get_db),
    business: Business = Depends(get_owned_business),
):
    """Owner edit: change service / date / start_time. Recomputes end_time
    and price (only when service changed) and re-validates the slot."""
    booking = (
        db.query(Booking)
        .filter(Booking.id == booking_id, Booking.business_id == business.id)
        .first()
    )
    if not booking:
        raise HTTPException(404, "Not found")
    if booking.status == BookingStatus.CANCELLED:
        raise HTTPException(400, "Bekor qilingan yozilishni tahrirlab bo'lmaydi")

    new_service = booking.service
    if body.service_id is not None and body.service_id != booking.service_id:
        new_service = (
            db.query(Service)
            .filter(
                Service.id == body.service_id,
                Service.business_id == business.id,
                Service.is_active.is_(True),
            )
            .first()
        )
        if not new_service:
            raise HTTPException(404, "Service not found")
    new_date = body.date if body.date is not None else booking.date
    new_start = body.start_time if body.start_time is not None else booking.start_time
    duration = (
        new_service.duration_minutes
        if new_service is not None
        else (
            booking.end_time.hour * 60
            + booking.end_time.minute
            - booking.start_time.hour * 60
            - booking.start_time.minute
        )
    )
    new_end = (datetime.combine(new_date, new_start) + timedelta(minutes=duration)).time()

    conflict = (
        db.query(Booking)
        .filter(
            Booking.business_id == business.id,
            Booking.id != booking.id,
            Booking.date == new_date,
            Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED]),
            Booking.start_time < new_end,
            Booking.end_time > new_start,
        )
        .with_for_update()
        .first()
    )
    if conflict:
        raise HTTPException(400, "Vaqt band")

    booking.date = new_date
    booking.start_time = new_start
    booking.end_time = new_end
    if body.service_id is not None and new_service is not None:
        booking.service_id = new_service.id
        booking.payment_amount = int(new_service.price)
    db.commit()
    db.refresh(booking)
    return booking


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


@me_router.put("/bookings/{booking_id}/complete", response_model=BookingRead)
def complete(
    booking_id: UUID,
    db: Session = Depends(get_db),
    business: Business = Depends(get_owned_business),
):
    """Owner marks a booking as actually finished. Distinct from confirm
    (which only acknowledges a pending request) so the dashboard's
    'Bajarildi' button means what its label says."""
    b = (
        db.query(Booking)
        .filter(Booking.id == booking_id, Booking.business_id == business.id)
        .first()
    )
    if not b:
        raise HTTPException(404, "Not found")
    if b.status == BookingStatus.CANCELLED:
        raise HTTPException(400, "Bekor qilingan yozilishni yakunlab bo'lmaydi")
    b.status = BookingStatus.COMPLETED
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
    publish_event(business.id, "booking_cancelled")
    db.refresh(b)
    return b


class RecurringBookingBody(BaseModel):
    """Owner-created recurring booking series.

    The recurrence is materialised: we create N concrete Booking rows
    sharing the same recurrence_id, one for every weekly occurrence
    counting from `start_date`. Materialising up-front (vs lazy) keeps
    the existing slot-conflict, reminder, and notifications code paths
    working unchanged — every occurrence is a real Booking row.
    """

    client_id: UUID
    service_id: UUID
    staff_id: UUID | None = None
    start_date: date
    start_time: time
    # Number of weekly occurrences. We cap at 26 (half a year) because
    # past that point owner schedules drift and the value of a "set
    # and forget" series collapses.
    occurrences: int = Field(..., ge=2, le=26)
    # If a particular slot in the series collides with an existing
    # booking, the default behaviour is "skip and continue". Setting
    # `strict=True` aborts the entire series creation on the first
    # conflict so the owner doesn't end up with a half-filled series.
    strict: bool = False


@me_router.post("/bookings/recurring")
def create_recurring(
    body: "RecurringBookingBody",
    db: Session = Depends(get_db),
    business: Business = Depends(get_owned_business),
):
    service = (
        db.query(Service)
        .filter(
            Service.id == body.service_id,
            Service.business_id == business.id,
            Service.is_active.is_(True),
        )
        .first()
    )
    if not service:
        raise HTTPException(404, "Service not found")
    client = db.query(Client).filter(Client.id == body.client_id).first()
    if not client:
        raise HTTPException(404, "Client not found")

    # If owner targeted a specific staff, validate.
    staff_id = body.staff_id
    if staff_id is not None:
        from app.models import Staff

        staff_row = (
            db.query(Staff)
            .filter(
                Staff.id == staff_id,
                Staff.business_id == business.id,
                Staff.is_active.is_(True),
            )
            .first()
        )
        if not staff_row:
            raise HTTPException(404, "Staff not found")

    try:
        mode = (
            business.confirmation_mode
            if isinstance(business.confirmation_mode, ConfirmationMode)
            else ConfirmationMode(str(business.confirmation_mode))
        )
    except ValueError:
        mode = ConfirmationMode.AUTO
    status = (
        BookingStatus.CONFIRMED
        if mode == ConfirmationMode.AUTO
        else BookingStatus.PENDING
    )

    series_id = _uuid.uuid4()
    created: list[Booking] = []
    skipped: list[str] = []

    for i in range(body.occurrences):
        slot_date = body.start_date + timedelta(weeks=i)
        end_dt = datetime.combine(slot_date, body.start_time) + timedelta(
            minutes=service.duration_minutes
        )
        end_time = end_dt.time()

        conflict_q = (
            db.query(Booking)
            .filter(
                Booking.business_id == business.id,
                Booking.date == slot_date,
                Booking.status.in_(
                    [BookingStatus.PENDING, BookingStatus.CONFIRMED]
                ),
                Booking.start_time < end_time,
                Booking.end_time > body.start_time,
            )
        )
        if staff_id is not None:
            conflict_q = conflict_q.filter(Booking.staff_id == staff_id)
        conflict = conflict_q.first()
        if conflict is not None:
            if body.strict:
                # Roll back partial inserts before erroring out so an
                # owner sees an all-or-nothing result.
                for b in created:
                    db.delete(b)
                db.commit()
                raise HTTPException(
                    400,
                    f"Conflict on {slot_date.isoformat()} {body.start_time.strftime('%H:%M')}",
                )
            skipped.append(slot_date.isoformat())
            continue

        booking = Booking(
            business_id=business.id,
            service_id=service.id,
            client_id=client.id,
            staff_id=staff_id,
            date=slot_date,
            start_time=body.start_time,
            end_time=end_time,
            status=status,
            payment_status=PaymentStatus.UNPAID,
            payment_amount=service.price,
            recurrence_id=series_id,
        )
        db.add(booking)
        created.append(booking)
    db.commit()

    return {
        "recurrence_id": str(series_id),
        "created": [str(b.id) for b in created],
        "skipped_dates": skipped,
        "occurrences_requested": body.occurrences,
        "occurrences_created": len(created),
    }


@me_router.delete("/bookings/recurring/{recurrence_id}")
def cancel_recurring(
    recurrence_id: UUID,
    only_future: bool = True,
    db: Session = Depends(get_db),
    business: Business = Depends(get_owned_business),
):
    """Cancel every booking in a recurrence series. By default only
    future occurrences are cancelled (past visits already happened),
    pass `only_future=false` to cancel the whole series including
    historic rows."""
    today = date.today()
    q = (
        db.query(Booking)
        .filter(
            Booking.business_id == business.id,
            Booking.recurrence_id == recurrence_id,
            Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED]),
        )
    )
    if only_future:
        q = q.filter(Booking.date >= today)
    affected = q.all()
    if not affected:
        raise HTTPException(404, "No active bookings in series")
    for b in affected:
        b.status = BookingStatus.CANCELLED
        b.cancel_reason = "series_cancelled"
    db.commit()
    return {
        "recurrence_id": str(recurrence_id),
        "cancelled": len(affected),
    }


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
