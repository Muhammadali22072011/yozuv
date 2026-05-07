from datetime import date as _date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_owned_business
from app.models import Booking, Business, Client

router = APIRouter(prefix="/business/me", tags=["clients"])


class ClientPatchBody(BaseModel):
    birthday: _date | None = None


@router.get("/clients")
def list_clients(
    db: Session = Depends(get_db),
    business: Business = Depends(get_owned_business),
):
    rows = (
        db.query(
            Client.id,
            Client.telegram_id,
            Client.first_name,
            Client.last_name,
            Client.phone,
            func.count(Booking.id).label("visits"),
            func.max(Booking.date).label("last_visit"),
        )
        .join(Booking, Booking.client_id == Client.id)
        .filter(Booking.business_id == business.id)
        .group_by(
            Client.id,
            Client.telegram_id,
            Client.first_name,
            Client.last_name,
            Client.phone,
        )
        .order_by(func.max(Booking.date).desc())
        .all()
    )
    return [
        {
            "id": str(r.id),
            "telegram_id": int(r.telegram_id) if r.telegram_id else None,
            "first_name": r.first_name,
            "last_name": r.last_name,
            "phone": r.phone,
            "visits": int(r.visits),
            "last_visit": r.last_visit.isoformat() if r.last_visit else None,
        }
        for r in rows
    ]


@router.get("/clients/{client_id}")
def client_detail(
    client_id: UUID,
    db: Session = Depends(get_db),
    business: Business = Depends(get_owned_business),
):
    c = db.query(Client).filter(Client.id == client_id).first()
    if not c:
        raise HTTPException(404, "Not found")
    bookings = (
        db.query(Booking)
        .filter(Booking.business_id == business.id, Booking.client_id == client_id)
        .order_by(Booking.date.desc(), Booking.start_time.desc())
        .all()
    )
    return {
        "client": {
            "id": str(c.id),
            "first_name": c.first_name,
            "last_name": c.last_name,
            "phone": c.phone,
            "telegram_id": c.telegram_id,
            "birthday": c.birthday.isoformat() if c.birthday else None,
        },
        "bookings": [
            {
                "id": str(b.id),
                "date": b.date.isoformat(),
                "start_time": b.start_time.strftime("%H:%M"),
                "status": str(b.status),
            }
            for b in bookings
        ],
    }


@router.patch("/clients/{client_id}")
def patch_client(
    client_id: UUID,
    body: ClientPatchBody,
    db: Session = Depends(get_db),
    business: Business = Depends(get_owned_business),
):
    """Owner-edit fields the client doesn't surface themselves yet —
    currently birthday only. Restricted to clients who've actually
    booked with this business so an owner can't enumerate the global
    Client table."""
    c = db.query(Client).filter(Client.id == client_id).first()
    if not c:
        raise HTTPException(404, "Not found")
    has_booking = (
        db.query(Booking.id)
        .filter(Booking.business_id == business.id, Booking.client_id == client_id)
        .first()
    )
    if not has_booking:
        raise HTTPException(404, "Not found")
    if body.birthday is not None:
        c.birthday = body.birthday
    db.commit()
    db.refresh(c)
    return {
        "id": str(c.id),
        "birthday": c.birthday.isoformat() if c.birthday else None,
    }
