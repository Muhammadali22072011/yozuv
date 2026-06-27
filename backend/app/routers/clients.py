from datetime import date as _date
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_active_business
from app.models import Booking, BookingStatus, Business, Client, ClientBlock, Service
from app.services.notification_service import send_telegram_message_async
from app.utils.htmlsafe import h

router = APIRouter(prefix="/business/me", tags=["clients"])


class ClientPatchBody(BaseModel):
    birthday: _date | None = None


class BlockBody(BaseModel):
    reason: str = Field(default="", max_length=512)


@router.get("/clients")
def list_clients(
    db: Session = Depends(get_db),
    business: Business = Depends(get_active_business),
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
            func.coalesce(
                func.sum(
                    case(
                        (Booking.status == BookingStatus.COMPLETED, Booking.payment_amount),
                        else_=0,
                    )
                ),
                0,
            ).label("total_spent"),
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
    # Favourite service per client = the service they've booked most often here.
    fav_rows = (
        db.query(
            Booking.client_id,
            Service.name,
            func.count(Booking.id).label("n"),
        )
        .join(Service, Service.id == Booking.service_id)
        .filter(Booking.business_id == business.id)
        .group_by(Booking.client_id, Service.name)
        .all()
    )
    favorite: dict = {}
    for cid, sname, n in fav_rows:
        cur = favorite.get(cid)
        if cur is None or n > cur[1]:
            favorite[cid] = (sname, n)

    # VIP = 5+ visits here; "new" = first-ever (or single) visit. Both were
    # referenced by the dashboard filters but never sent by the API.
    VIP_VISIT_THRESHOLD = 5
    return [
        {
            "id": str(r.id),
            "telegram_id": int(r.telegram_id) if r.telegram_id else None,
            "first_name": r.first_name,
            "last_name": r.last_name,
            "phone": r.phone,
            "visits": int(r.visits),
            "last_visit": r.last_visit.isoformat() if r.last_visit else None,
            "total_spent": int(r.total_spent or 0),
            "favorite_service": favorite.get(r.id, (None,))[0],
            "is_vip": int(r.visits) >= VIP_VISIT_THRESHOLD,
            "is_new": int(r.visits) <= 1,
        }
        for r in rows
    ]


@router.get("/clients/{client_id}")
def client_detail(
    client_id: UUID,
    db: Session = Depends(get_db),
    business: Business = Depends(get_active_business),
):
    # Scope to clients who have actually booked with THIS business, otherwise
    # an owner can read any client's PII cross-tenant by guessing/reusing a
    # UUID (IDOR). _client_in_business_or_404 enforces the booking link.
    c = _client_in_business_or_404(db, business.id, client_id)
    bookings = (
        db.query(Booking)
        .filter(Booking.business_id == business.id, Booking.client_id == client_id)
        .order_by(Booking.date.desc(), Booking.start_time.desc())
        .all()
    )
    no_show_count = sum(1 for b in bookings if b.status == BookingStatus.NO_SHOW)
    late_cancel_count = sum(1 for b in bookings if getattr(b, "late_cancel", False))
    total_spent = sum(
        int(b.payment_amount or 0)
        for b in bookings
        if b.status == BookingStatus.COMPLETED
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
            "birthday": c.birthday.isoformat() if c.birthday else None,
        },
        "bookings": [
            {
                "id": str(b.id),
                "date": b.date.isoformat(),
                "start_time": b.start_time.strftime("%H:%M"),
                "status": str(b.status),
                "late_cancel": bool(getattr(b, "late_cancel", False)),
            }
            for b in bookings
        ],
        "stats": {
            "total_bookings": len(bookings),
            "no_show_count": no_show_count,
            "late_cancel_count": late_cancel_count,
            "total_spent": total_spent,
        },
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


@router.patch("/clients/{client_id}")
def patch_client(
    client_id: UUID,
    body: ClientPatchBody,
    db: Session = Depends(get_db),
    business: Business = Depends(get_active_business),
):
    """Owner-edit fields the client doesn't surface themselves yet —
    currently birthday only. Restricted to clients who've actually
    booked with this business so an owner can't enumerate the global
    Client table."""
    c = _client_in_business_or_404(db, business.id, client_id)
    if body.birthday is not None:
        c.birthday = body.birthday
    db.commit()
    db.refresh(c)
    return {
        "id": str(c.id),
        "birthday": c.birthday.isoformat() if c.birthday else None,
    }


@router.post("/clients/{client_id}/block", status_code=201)
def block_client(
    client_id: UUID,
    body: BlockBody,
    db: Session = Depends(get_db),
    business: Business = Depends(get_active_business),
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
    business: Business = Depends(get_active_business),
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
    business: Business = Depends(get_active_business),
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


class BroadcastBody(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)


@router.post("/broadcast")
async def broadcast_to_clients(
    body: BroadcastBody,
    db: Session = Depends(get_db),
    business: Business = Depends(get_active_business),
):
    """Owner sends one Telegram message to all of their own clients (distinct
    telegram_ids that have booked here). Blocked clients are excluded; the
    text is HTML-escaped since notification_service sends parse_mode=HTML."""
    blocked = {
        row[0]
        for row in db.query(ClientBlock.client_id).filter(
            ClientBlock.business_id == business.id
        )
    }
    rows = (
        db.query(Client.id, Client.telegram_id)
        .join(Booking, Booking.client_id == Client.id)
        .filter(
            Booking.business_id == business.id,
            Client.telegram_id.isnot(None),
        )
        .distinct()
        .all()
    )
    targets: list[int] = []
    seen: set[int] = set()
    for cid, tg in rows:
        if cid in blocked or not tg:
            continue
        tg_int = int(tg)
        if tg_int in seen:
            continue
        seen.add(tg_int)
        targets.append(tg_int)

    text = f"<b>{h(business.name)}</b>\n\n{h(body.text.strip())}"

    import asyncio

    sem = asyncio.Semaphore(20)
    sent = 0
    failed = 0
    async with httpx.AsyncClient() as client:

        async def _one(tg: int) -> bool:
            async with sem:
                try:
                    await send_telegram_message_async(tg, text, client=client)
                    return True
                except Exception:
                    return False

        results = await asyncio.gather(*[_one(t) for t in targets])
    for ok in results:
        if ok:
            sent += 1
        else:
            failed += 1

    return {"recipients": len(targets), "sent": sent, "failed": failed}
