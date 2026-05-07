from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_owned_business
from app.models import Booking, Business, Client, ClientBlock

router = APIRouter(prefix="/business/me", tags=["clients"])


class BlockBody(BaseModel):
    reason: str = Field(default="", max_length=512)


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
    block = (
        db.query(ClientBlock)
        .filter(
            ClientBlock.business_id == business.id,
            ClientBlock.client_id == client_id,
        )
        .first()
    )
    return {
        "client": {
            "id": str(c.id),
            "first_name": c.first_name,
            "last_name": c.last_name,
            "phone": c.phone,
            "telegram_id": c.telegram_id,
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
        "block": (
            {
                "reason": block.reason or "",
                "created_at": block.created_at.isoformat() if block.created_at else None,
            }
            if block
            else None
        ),
    }


def _client_in_business_or_404(
    db: Session, business_id, client_id: UUID
) -> Client:
    """A client is "in" a business if they have at least one booking there.
    Without this check an owner could block any client UUID system-wide,
    which is a privacy leak (you'd learn which UUIDs exist)."""
    c = db.query(Client).filter(Client.id == client_id).first()
    if not c:
        raise HTTPException(404, "Not found")
    has_booking = (
        db.query(Booking.id)
        .filter(Booking.business_id == business_id, Booking.client_id == client_id)
        .first()
    )
    if not has_booking:
        raise HTTPException(404, "Not found")
    return c


@router.post("/clients/{client_id}/block", status_code=201)
def block_client(
    client_id: UUID,
    body: BlockBody,
    db: Session = Depends(get_db),
    business: Business = Depends(get_owned_business),
):
    """Owner adds a client to the business's block list. Idempotent: if
    a block already exists we just update the reason."""
    _client_in_business_or_404(db, business.id, client_id)
    existing = (
        db.query(ClientBlock)
        .filter(
            ClientBlock.business_id == business.id,
            ClientBlock.client_id == client_id,
        )
        .first()
    )
    if existing:
        existing.reason = body.reason or existing.reason
        db.commit()
        block = existing
    else:
        block = ClientBlock(
            business_id=business.id,
            client_id=client_id,
            reason=body.reason or "",
        )
        db.add(block)
        db.commit()
        db.refresh(block)
    return {
        "blocked": True,
        "reason": block.reason,
        "created_at": block.created_at.isoformat() if block.created_at else None,
    }


@router.delete("/clients/{client_id}/block")
def unblock_client(
    client_id: UUID,
    db: Session = Depends(get_db),
    business: Business = Depends(get_owned_business),
):
    block = (
        db.query(ClientBlock)
        .filter(
            ClientBlock.business_id == business.id,
            ClientBlock.client_id == client_id,
        )
        .first()
    )
    if block is not None:
        db.delete(block)
        db.commit()
    return {"blocked": False}


@router.get("/blocked-clients")
def list_blocked(
    db: Session = Depends(get_db),
    business: Business = Depends(get_owned_business),
):
    rows = (
        db.query(ClientBlock, Client)
        .join(Client, Client.id == ClientBlock.client_id)
        .filter(ClientBlock.business_id == business.id)
        .order_by(ClientBlock.created_at.desc())
        .all()
    )
    return [
        {
            "client_id": str(c.id),
            "first_name": c.first_name or "",
            "last_name": c.last_name or "",
            "phone": c.phone or "",
            "reason": block.reason or "",
            "created_at": block.created_at.isoformat() if block.created_at else None,
        }
        for block, c in rows
    ]
