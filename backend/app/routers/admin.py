import asyncio
import csv
import io
import json
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from app.database import Base, get_db
from app.deps import get_admin_user, get_superadmin_user
from app.models import (
    AdminAuditLog,
    AdminUser,
    Booking,
    BroadcastMessage,
    Business,
    BusinessCategory,
    BookingStatus,
    Client,
    PaymentRecordStatus,
    PaymentStatus,
    PaymentTransaction,
    PromoCode,
    Referral,
    ReferralStatus,
    Review,
    Subscription,
    SubscriptionPlan,
    SubscriptionStatus,
    User,
    WaitlistEntry,
)
import httpx

from app.services.audit_service import log_admin_action
from app.services.notification_service import (
    send_telegram_message,
    send_telegram_message_async,
)

router = APIRouter(prefix="/admin", tags=["admin"])

BACKUP_VERSION = 1
MAX_BACKUP_BYTES = 50 * 1024 * 1024  # 50 MB


def _json_default(o):
    if isinstance(o, UUID):
        return str(o)
    if isinstance(o, (datetime, date)):
        return o.isoformat()
    if isinstance(o, Decimal):
        return str(o)
    if isinstance(o, bytes):
        return o.decode("utf-8", errors="replace")
    raise TypeError(f"Not serializable: {type(o).__name__}")


def _coerce_row(table, row: dict) -> dict:
    out: dict = {}
    for col in table.columns:
        if col.name not in row:
            continue
        val = row[col.name]
        if val is None:
            out[col.name] = None
            continue
        try:
            ptype = col.type.python_type
        except NotImplementedError:
            ptype = None
        if ptype is UUID and isinstance(val, str):
            out[col.name] = UUID(val)
        elif ptype is datetime and isinstance(val, str):
            out[col.name] = datetime.fromisoformat(val)
        elif ptype is date and isinstance(val, str):
            out[col.name] = date.fromisoformat(val)
        elif ptype is Decimal and isinstance(val, str):
            out[col.name] = Decimal(val)
        else:
            out[col.name] = val
    return out


@router.get("/summary")
def admin_summary(db: Session = Depends(get_db), _=Depends(get_admin_user)):
    now = datetime.now(timezone.utc)
    seven_ago = now - timedelta(days=7)

    businesses_total = db.query(func.count(Business.id)).scalar() or 0
    businesses_active = (
        db.query(func.count(Business.id)).filter(Business.is_active.is_(True)).scalar() or 0
    )
    businesses_new_7d = (
        db.query(func.count(Business.id)).filter(Business.created_at >= seven_ago).scalar() or 0
    )

    active_subs = (
        db.query(Subscription)
        .filter(Subscription.status == SubscriptionStatus.ACTIVE, Subscription.expires_at > now)
        .all()
    )
    trials = sum(1 for s in active_subs if s.plan == SubscriptionPlan.TRIAL)
    paid = len(active_subs) - trials

    # MRR approx: sum of monthly-equivalent amounts for paid active subs
    mrr = 0
    for s in active_subs:
        if s.plan == SubscriptionPlan.MONTHLY:
            mrr += int(s.amount_paid or 0)
        elif s.plan == SubscriptionPlan.YEARLY:
            mrr += int((s.amount_paid or 0) / 12)

    revenue_7d = (
        db.query(func.coalesce(func.sum(PaymentTransaction.amount), 0))
        .filter(
            PaymentTransaction.status == PaymentRecordStatus.COMPLETED,
            PaymentTransaction.created_at >= seven_ago,
        )
        .scalar()
        or 0
    )
    pending_card = (
        db.query(func.count(PaymentTransaction.id))
        .filter(PaymentTransaction.status == PaymentRecordStatus.AWAITING_APPROVAL)
        .scalar()
        or 0
    )

    return {
        "businesses_total": int(businesses_total),
        "businesses_active": int(businesses_active),
        "businesses_new_7d": int(businesses_new_7d),
        "active_subscriptions": len(active_subs),
        "trial_subscriptions": trials,
        "paid_subscriptions": paid,
        "mrr_uzs": int(mrr),
        "revenue_7d_uzs": int(revenue_7d),
        "pending_card_payments": int(pending_card),
    }


@router.get("/businesses")
def list_businesses(
    db: Session = Depends(get_db),
    _=Depends(get_admin_user),
    limit: int = 100,
    include_deleted: bool = False,
    q: str | None = None,
    category: str | None = None,
    sub: str | None = None,
):
    """List businesses with optional search/filters.

    ``q``        — case-insensitive match on name or slug (and numeric
                   owner Telegram id).
    ``category`` — exact business category.
    ``sub``      — subscription state computed per business:
                   ``active`` / ``trial`` / ``paid`` / ``none``.
                   Applied in Python since "active sub" is a derived value.
    """
    now = datetime.now(timezone.utc)
    query = db.query(Business)
    if not include_deleted:
        query = query.filter(Business.deleted_at.is_(None))
    if q and q.strip():
        term = q.strip()
        like = f"%{term.lower()}%"
        conds = [
            func.lower(Business.name).like(like),
            func.lower(Business.slug).like(like),
        ]
        if term.isdigit():
            owner_ids = [
                u.id
                for u in db.query(User.id).filter(User.telegram_id == int(term)).all()
            ]
            if owner_ids:
                conds.append(Business.owner_id.in_(owner_ids))
        query = query.filter(or_(*conds))
    if category:
        query = query.filter(Business.category == _validate_category(category))
    rows = (
        query.order_by(Business.created_at.desc())
        .limit(min(max(1, limit), 500))
        .all()
    )
    biz_ids = [b.id for b in rows]
    owner_ids = [b.owner_id for b in rows if b.owner_id]
    subs_by_biz: dict = {}
    if biz_ids:
        sub_rows = (
            db.query(Subscription)
            .filter(
                Subscription.business_id.in_(biz_ids),
                Subscription.status == SubscriptionStatus.ACTIVE,
                Subscription.expires_at > now,
            )
            .order_by(Subscription.expires_at.desc())
            .all()
        )
        # First match per business wins (already ordered by expires_at desc).
        for s in sub_rows:
            subs_by_biz.setdefault(s.business_id, s)
    owners_by_id: dict = {}
    if owner_ids:
        owners_by_id = {
            u.id: u for u in db.query(User).filter(User.id.in_(owner_ids)).all()
        }
    out = []
    for b in rows:
        active_sub = subs_by_biz.get(b.id)
        # `sub` filter — derived state, applied after the active-sub lookup.
        if sub in ("active", "trial", "paid") and active_sub is None:
            continue
        if sub == "none" and active_sub is not None:
            continue
        if active_sub is not None:
            is_trial = active_sub.plan == SubscriptionPlan.TRIAL
            if sub == "trial" and not is_trial:
                continue
            if sub == "paid" and is_trial:
                continue
        owner = owners_by_id.get(b.owner_id) if b.owner_id else None
        out.append(
            {
                "id": str(b.id),
                "name": b.name,
                "slug": b.slug,
                "category": str(getattr(b.category, "value", b.category)),
                "is_active": b.is_active,
                "created_at": b.created_at.isoformat() if b.created_at else "",
                "deleted_at": b.deleted_at.isoformat() if b.deleted_at else None,
                "owner": {
                    "telegram_id": owner.telegram_id if owner else None,
                    "name": f"{owner.first_name or ''} {owner.last_name or ''}".strip() if owner else "",
                },
                "subscription": {
                    "plan": getattr(active_sub.plan, "value", str(active_sub.plan)),
                    "expires_at": active_sub.expires_at.isoformat() if active_sub.expires_at else None,
                }
                if active_sub is not None
                else None,
            }
        )
    return out


def _serialize_business_detail(b: Business, owner: User | None, sub: Subscription | None) -> dict:
    return {
        "id": str(b.id),
        "name": b.name,
        "slug": b.slug,
        "category": str(getattr(b.category, "value", b.category)),
        "description": b.description or "",
        "address": b.address or "",
        "viloyat": b.viloyat or "",
        "tuman": b.tuman or "",
        "phone": b.phone or "",
        "is_active": b.is_active,
        "created_at": b.created_at.isoformat() if b.created_at else "",
        "deleted_at": b.deleted_at.isoformat() if b.deleted_at else None,
        "owner": {
            "telegram_id": owner.telegram_id if owner else None,
            "name": f"{owner.first_name or ''} {owner.last_name or ''}".strip() if owner else "",
            "phone": owner.phone if owner else "",
        },
        "subscription": (
            {
                "id": str(sub.id),
                "plan": getattr(sub.plan, "value", str(sub.plan)),
                "status": getattr(sub.status, "value", str(sub.status)),
                "expires_at": sub.expires_at.isoformat() if sub.expires_at else None,
            }
            if sub
            else None
        ),
    }


@router.get("/businesses/{business_id}")
def business_detail(
    business_id: UUID, db: Session = Depends(get_db), _=Depends(get_admin_user)
):
    b = db.query(Business).filter(Business.id == business_id).first()
    if not b:
        raise HTTPException(404, "Business not found")
    owner = db.query(User).filter(User.id == b.owner_id).first() if b.owner_id else None
    sub = (
        db.query(Subscription)
        .filter(Subscription.business_id == b.id)
        .order_by(Subscription.expires_at.desc())
        .first()
    )
    return _serialize_business_detail(b, owner, sub)


def _validate_category(value: str | None) -> BusinessCategory:
    if not value:
        return BusinessCategory.OTHER
    try:
        return BusinessCategory(value)
    except ValueError as exc:
        valid = ", ".join(c.value for c in BusinessCategory)
        raise HTTPException(400, f"Invalid category. Allowed: {valid}") from exc


class BusinessCreateBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=2, max_length=128, pattern=r"^[a-z0-9][a-z0-9-]*$")
    category: str | None = None
    owner_telegram_id: int = Field(..., gt=0)
    owner_first_name: str | None = None
    owner_phone: str | None = None
    description: str | None = None
    address: str | None = None
    phone: str | None = None


@router.post("/businesses", status_code=201)
def create_business(
    body: BusinessCreateBody,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    if db.query(Business).filter(Business.slug == body.slug).first():
        raise HTTPException(409, "Slug already in use")
    category = _validate_category(body.category)

    owner = db.query(User).filter(User.telegram_id == body.owner_telegram_id).first()
    if owner is None:
        owner = User(
            telegram_id=body.owner_telegram_id,
            first_name=body.owner_first_name or "",
            phone=body.owner_phone or "",
        )
        db.add(owner)
        db.flush()
    # Multi-business: an owner may now hold several businesses, so we no
    # longer reject when they already have one — the admin can spin up an
    # additional branch the same way the self-serve flow does.

    b = Business(
        owner_id=owner.id,
        name=body.name,
        slug=body.slug,
        category=category,
        description=body.description or "",
        address=body.address or "",
        phone=body.phone or "",
    )
    db.add(b)
    db.flush()

    # Wire the new business into the membership graph + give it a trial,
    # mirroring the self-serve create flow so it's visible/usable to the
    # owner and gated by billing the same way.
    from datetime import datetime, timedelta, timezone

    from app.models import (
        Membership,
        MembershipRole,
        Subscription,
        SubscriptionPlan,
        SubscriptionStatus,
    )

    db.add(Membership(user_id=owner.id, business_id=b.id, role=MembershipRole.OWNER))
    now = datetime.now(timezone.utc)
    db.add(
        Subscription(
            business_id=b.id,
            plan=SubscriptionPlan.TRIAL,
            status=SubscriptionStatus.ACTIVE,
            starts_at=now,
            expires_at=now + timedelta(days=14),
            amount_paid=0,
        )
    )

    log_admin_action(
        db,
        admin,
        "business.create",
        "Business",
        b.id,
        {"name": b.name, "slug": b.slug, "owner_telegram_id": int(owner.telegram_id)},
    )
    db.commit()
    db.refresh(b)
    return _serialize_business_detail(b, owner, None)


class BusinessUpdateBody(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    category: str | None = None
    description: str | None = None
    address: str | None = None
    phone: str | None = None


@router.put("/businesses/{business_id}")
def update_business(
    business_id: UUID,
    body: BusinessUpdateBody,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    b = db.query(Business).filter(Business.id == business_id).first()
    if not b:
        raise HTTPException(404, "Business not found")
    if b.deleted_at is not None:
        raise HTTPException(409, "Business is deleted; restore it first")
    changed: dict[str, object] = {}
    if body.name is not None and body.name != b.name:
        changed["name"] = body.name
        b.name = body.name
    if body.category is not None:
        new_cat = _validate_category(body.category)
        if new_cat != b.category:
            changed["category"] = new_cat.value
            b.category = new_cat
    if body.description is not None and body.description != b.description:
        changed["description"] = "<changed>"
        b.description = body.description
    if body.address is not None and body.address != b.address:
        changed["address"] = body.address
        b.address = body.address
    if body.phone is not None and body.phone != b.phone:
        changed["phone"] = body.phone
        b.phone = body.phone
    if changed:
        log_admin_action(db, admin, "business.update", "Business", b.id, changed)
    db.commit()
    db.refresh(b)
    owner = db.query(User).filter(User.id == b.owner_id).first() if b.owner_id else None
    sub = (
        db.query(Subscription)
        .filter(Subscription.business_id == b.id)
        .order_by(Subscription.expires_at.desc())
        .first()
    )
    return _serialize_business_detail(b, owner, sub)


@router.delete("/businesses/{business_id}")
def delete_business(
    business_id: UUID,
    hard: bool = False,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    b = db.query(Business).filter(Business.id == business_id).first()
    if not b:
        raise HTTPException(404, "Business not found")
    if hard:
        active_bookings = (
            db.query(func.count(Booking.id))
            .filter(
                Booking.business_id == b.id,
                Booking.status.in_(
                    [BookingStatus.PENDING, BookingStatus.CONFIRMED]
                ),
            )
            .scalar()
            or 0
        )
        if active_bookings:
            raise HTTPException(
                409,
                f"Cannot hard-delete: {active_bookings} active booking(s) exist",
            )
        log_admin_action(
            db, admin, "business.hard_delete", "Business", b.id, {"name": b.name}
        )
        db.delete(b)
        db.commit()
        return {"ok": True, "hard": True, "id": str(business_id)}
    if b.deleted_at is not None:
        return {"ok": True, "hard": False, "id": str(business_id), "already": True}
    b.deleted_at = datetime.now(timezone.utc)
    b.is_active = False
    log_admin_action(
        db, admin, "business.soft_delete", "Business", b.id, {"name": b.name}
    )
    db.commit()
    return {"ok": True, "hard": False, "id": str(business_id)}


class ExtendBody(BaseModel):
    business_id: UUID
    days: int = Field(..., ge=1, le=365)


@router.post("/subscription/extend")
def extend_subscription(
    body: ExtendBody,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    b = db.query(Business).filter(Business.id == body.business_id).first()
    if not b:
        raise HTTPException(404, "Business not found")
    now = datetime.now(timezone.utc)
    sub = (
        db.query(Subscription)
        .filter(
            Subscription.business_id == b.id,
            Subscription.status == SubscriptionStatus.ACTIVE,
        )
        .order_by(Subscription.expires_at.desc())
        .first()
    )
    if sub and sub.expires_at > now:
        sub.expires_at = sub.expires_at + timedelta(days=body.days)
    else:
        # Create new active sub from now
        sub = Subscription(
            business_id=b.id,
            plan=SubscriptionPlan.TRIAL,
            status=SubscriptionStatus.ACTIVE,
            starts_at=now,
            expires_at=now + timedelta(days=body.days),
            amount_paid=0,
        )
        db.add(sub)
    log_admin_action(
        db,
        admin,
        "subscription.extend",
        "Business",
        b.id,
        {"days": body.days},
    )
    db.commit()
    # Notify owner
    owner = db.query(User).filter(User.id == b.owner_id).first()
    if owner and owner.telegram_id:
        try:
            send_telegram_message(
                int(owner.telegram_id),
                f"🎁 Obunangiz <b>{body.days} kun</b>ga uzaytirildi.\nYaxshi ishlar tilaymiz!",
            )
        except Exception:
            pass
    return {
        "ok": True,
        "business_id": str(b.id),
        "expires_at": sub.expires_at.isoformat() if sub else None,
    }


class SubscriptionPatchBody(BaseModel):
    plan: str | None = None
    status: str | None = None
    expires_at: datetime | None = None


def _validate_plan(value: str) -> SubscriptionPlan:
    try:
        return SubscriptionPlan(value)
    except ValueError as exc:
        valid = ", ".join(p.value for p in SubscriptionPlan)
        raise HTTPException(400, f"Invalid plan. Allowed: {valid}") from exc


def _validate_sub_status(value: str) -> SubscriptionStatus:
    try:
        return SubscriptionStatus(value)
    except ValueError as exc:
        valid = ", ".join(s.value for s in SubscriptionStatus)
        raise HTTPException(400, f"Invalid status. Allowed: {valid}") from exc


@router.patch("/subscriptions/{subscription_id}")
def patch_subscription(
    subscription_id: UUID,
    body: SubscriptionPatchBody,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    sub = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not sub:
        raise HTTPException(404, "Subscription not found")
    changes: list[str] = []
    if body.plan is not None:
        new_plan = _validate_plan(body.plan)
        if new_plan != sub.plan:
            sub.plan = new_plan
            changes.append(f"plan→{new_plan.value}")
    if body.status is not None:
        new_status = _validate_sub_status(body.status)
        if new_status != sub.status:
            sub.status = new_status
            changes.append(f"status→{new_status.value}")
    if body.expires_at is not None:
        ts = body.expires_at
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        if ts != sub.expires_at:
            sub.expires_at = ts
            changes.append(f"expires_at→{ts.date().isoformat()}")
    if changes:
        log_admin_action(
            db,
            admin,
            "subscription.patch",
            "Subscription",
            sub.id,
            {"changes": changes, "business_id": str(sub.business_id)},
        )
    db.commit()
    db.refresh(sub)
    if changes:
        biz = db.query(Business).filter(Business.id == sub.business_id).first()
        owner = (
            db.query(User).filter(User.id == biz.owner_id).first() if biz else None
        )
        if owner and owner.telegram_id:
            try:
                send_telegram_message(
                    int(owner.telegram_id),
                    "ℹ️ Obunangiz yangilandi: " + ", ".join(changes),
                )
            except Exception:
                pass
    return {
        "id": str(sub.id),
        "plan": getattr(sub.plan, "value", str(sub.plan)),
        "status": getattr(sub.status, "value", str(sub.status)),
        "expires_at": sub.expires_at.isoformat() if sub.expires_at else None,
        "changes": changes,
    }


class ToggleBody(BaseModel):
    business_id: UUID
    is_active: bool


@router.post("/business/toggle")
def toggle_business(
    body: ToggleBody,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    b = db.query(Business).filter(Business.id == body.business_id).first()
    if not b:
        raise HTTPException(404, "Business not found")
    b.is_active = body.is_active
    log_admin_action(
        db,
        admin,
        "business.toggle",
        "Business",
        b.id,
        {"is_active": body.is_active, "name": b.name},
    )
    db.commit()
    return {"ok": True, "is_active": b.is_active}


class BroadcastFilters(BaseModel):
    category: str | None = None
    plan: str | None = None
    subscription_status: str | None = None
    is_active: bool | None = None


class BroadcastBody(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)
    only_active: bool = True
    filters: BroadcastFilters | None = None


def _select_broadcast_recipients(
    db: Session, only_active: bool, filters: BroadcastFilters | None
) -> list[tuple[Business, User]]:
    q = db.query(Business, User).join(User, User.id == Business.owner_id)
    if only_active:
        q = q.filter(Business.is_active.is_(True))
    if filters:
        if filters.is_active is not None:
            q = q.filter(Business.is_active.is_(filters.is_active))
        if filters.category:
            try:
                cat = BusinessCategory(filters.category)
            except ValueError as exc:
                raise HTTPException(400, f"Invalid category: {filters.category}") from exc
            q = q.filter(Business.category == cat)
        if filters.plan or filters.subscription_status:
            q = q.join(Subscription, Subscription.business_id == Business.id)
            if filters.plan:
                try:
                    plan = SubscriptionPlan(filters.plan)
                except ValueError as exc:
                    raise HTTPException(400, f"Invalid plan: {filters.plan}") from exc
                q = q.filter(Subscription.plan == plan)
            if filters.subscription_status:
                try:
                    st = SubscriptionStatus(filters.subscription_status)
                except ValueError as exc:
                    raise HTTPException(
                        400, f"Invalid status: {filters.subscription_status}"
                    ) from exc
                q = q.filter(Subscription.status == st)
    # Filter out soft-deleted businesses unconditionally.
    q = q.filter(Business.deleted_at.is_(None))
    # DISTINCT: the optional Subscription join can fan a business out into
    # multiple rows (renewals leave several rows per business), which would
    # otherwise send the owner the broadcast N times and inflate the counts.
    return q.distinct().all()


async def _send_broadcast_to(
    rows: list[tuple[Business, User]], text: str
) -> tuple[int, int, list[int]]:
    """Fan out a broadcast over a shared AsyncClient.

    The previous implementation looped sequentially with sync httpx, which
    blocked the FastAPI worker for tens of seconds on a 1k-recipient
    broadcast. We now run with bounded concurrency (Telegram's per-bot
    rate limit is ~30 msg/s, so we cap concurrent sends at 20 to stay
    polite).
    """
    import asyncio

    sem = asyncio.Semaphore(20)
    sent = 0
    failed = 0
    failed_ids: list[int] = []

    async with httpx.AsyncClient() as client:
        async def _one(owner_tg: int) -> bool:
            async with sem:
                try:
                    await send_telegram_message_async(owner_tg, text, client=client)
                    return True
                except Exception:
                    return False

        targets: list[int] = []
        seen: set[int] = set()
        for _b, owner in rows:
            if not owner or not owner.telegram_id:
                failed += 1
                continue
            tg = int(owner.telegram_id)
            # One owner may hold several businesses — never message them twice.
            if tg in seen:
                continue
            seen.add(tg)
            targets.append(tg)

        results = await asyncio.gather(*[_one(t) for t in targets])
        for tg, ok in zip(targets, results):
            if ok:
                sent += 1
            else:
                failed += 1
                failed_ids.append(tg)
    return sent, failed, failed_ids


@router.post("/broadcast")
async def broadcast(
    body: BroadcastBody,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    rows = _select_broadcast_recipients(db, body.only_active, body.filters)
    sent, failed, failed_ids = await _send_broadcast_to(rows, body.text)

    msg = BroadcastMessage(
        sent_by_telegram_id=int(admin.telegram_id),
        sent_by_name=f"{admin.first_name or ''} {admin.last_name or ''}".strip()
        or (admin.username or ""),
        text=body.text,
        filters={
            "only_active": body.only_active,
            **(body.filters.model_dump(exclude_none=True) if body.filters else {}),
        },
        sent_count=sent,
        failed_count=failed,
        failed_recipients=failed_ids,
    )
    db.add(msg)
    log_admin_action(
        db,
        admin,
        "broadcast.send",
        "BroadcastMessage",
        msg.id,
        {
            "sent": sent,
            "failed": failed,
            "total": len(rows),
            "preview": body.text[:120],
        },
    )
    db.commit()
    db.refresh(msg)
    return {
        "id": str(msg.id),
        "sent": sent,
        "failed": failed,
        "total": len(rows),
    }


@router.get("/broadcasts")
def list_broadcasts(
    db: Session = Depends(get_db), _=Depends(get_admin_user), limit: int = 50
):
    rows = (
        db.query(BroadcastMessage)
        .order_by(BroadcastMessage.created_at.desc())
        .limit(min(max(1, limit), 200))
        .all()
    )
    return [
        {
            "id": str(r.id),
            "sent_by_telegram_id": int(r.sent_by_telegram_id),
            "sent_by_name": r.sent_by_name,
            "text": r.text,
            "filters": r.filters or {},
            "sent_count": int(r.sent_count),
            "failed_count": int(r.failed_count),
            "failed_recipients": r.failed_recipients or [],
            "status": getattr(r, "status", "sent") or "sent",
            "scheduled_at": r.scheduled_at.isoformat() if r.scheduled_at else None,
            "created_at": r.created_at.isoformat() if r.created_at else "",
        }
        for r in rows
    ]


def recipients_from_filter_dict(
    db: Session, filters: dict
) -> list[tuple[Business, User]]:
    """Rebuild a broadcast recipient list from a stored filters dict.

    Used by the scheduled-broadcast Celery task, which only has the
    persisted filters (not the original request body).
    """
    only_active = bool(filters.get("only_active", True))
    bf = BroadcastFilters(
        category=filters.get("category"),
        plan=filters.get("plan"),
        subscription_status=filters.get("subscription_status"),
        is_active=filters.get("is_active"),
    )
    return _select_broadcast_recipients(db, only_active, bf)


class BroadcastScheduleBody(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)
    only_active: bool = True
    filters: BroadcastFilters | None = None
    scheduled_at: datetime


@router.post("/broadcast/schedule", status_code=201)
def schedule_broadcast(
    body: BroadcastScheduleBody,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Queue a broadcast for a future time (sent by the beat task)."""
    when = body.scheduled_at
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    if when <= datetime.now(timezone.utc):
        raise HTTPException(400, "scheduled_at must be in the future")
    # Validate filters now so the admin gets immediate feedback rather
    # than a silent failure when the task runs.
    recipients_from_filter_dict(
        db,
        {
            "only_active": body.only_active,
            **(body.filters.model_dump(exclude_none=True) if body.filters else {}),
        },
    )
    msg = BroadcastMessage(
        sent_by_telegram_id=int(admin.telegram_id),
        sent_by_name=f"{admin.first_name or ''} {admin.last_name or ''}".strip()
        or (admin.username or ""),
        text=body.text,
        filters={
            "only_active": body.only_active,
            **(body.filters.model_dump(exclude_none=True) if body.filters else {}),
        },
        sent_count=0,
        failed_count=0,
        failed_recipients=[],
        status="scheduled",
        scheduled_at=when,
    )
    db.add(msg)
    log_admin_action(
        db,
        admin,
        "broadcast.schedule",
        "BroadcastMessage",
        msg.id,
        {"scheduled_at": when.isoformat(), "preview": body.text[:120]},
    )
    db.commit()
    db.refresh(msg)
    return {
        "id": str(msg.id),
        "status": msg.status,
        "scheduled_at": msg.scheduled_at.isoformat() if msg.scheduled_at else None,
    }


@router.post("/broadcasts/{broadcast_id}/cancel")
def cancel_scheduled_broadcast(
    broadcast_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    msg = db.query(BroadcastMessage).filter(BroadcastMessage.id == broadcast_id).first()
    if not msg:
        raise HTTPException(404, "Broadcast not found")
    if getattr(msg, "status", "sent") != "scheduled":
        raise HTTPException(409, "Only scheduled broadcasts can be cancelled")
    msg.status = "cancelled"
    log_admin_action(
        db, admin, "broadcast.cancel", "BroadcastMessage", msg.id, {}
    )
    db.commit()
    return {"id": str(msg.id), "status": msg.status}


@router.post("/broadcasts/{broadcast_id}/retry")
async def retry_broadcast(
    broadcast_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    import asyncio

    msg = db.query(BroadcastMessage).filter(BroadcastMessage.id == broadcast_id).first()
    if not msg:
        raise HTTPException(404, "Broadcast not found")
    if not msg.failed_recipients:
        return {"id": str(msg.id), "sent": 0, "failed": 0, "no_failed": True}
    targets = list(msg.failed_recipients)
    sem = asyncio.Semaphore(20)
    still_failed: list[int] = []
    sent = 0

    async with httpx.AsyncClient() as client:
        async def _one(tg: int) -> bool:
            async with sem:
                try:
                    await send_telegram_message_async(int(tg), msg.text, client=client)
                    return True
                except Exception:
                    return False
        results = await asyncio.gather(*[_one(t) for t in targets])
        for tg, ok in zip(targets, results):
            if ok:
                sent += 1
            else:
                still_failed.append(int(tg))
    msg.sent_count = int(msg.sent_count) + sent
    msg.failed_count = len(still_failed)
    msg.failed_recipients = still_failed
    log_admin_action(
        db,
        admin,
        "broadcast.retry",
        "BroadcastMessage",
        msg.id,
        {"retried": len(targets), "sent": sent, "still_failed": len(still_failed)},
    )
    db.commit()
    return {
        "id": str(msg.id),
        "sent": sent,
        "failed": len(still_failed),
        "retried": len(targets),
    }


@router.get("/backup/export")
def backup_export(db: Session = Depends(get_db), _=Depends(get_admin_user)):
    dump: dict = {
        "version": BACKUP_VERSION,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "tables": {},
    }
    for table in Base.metadata.sorted_tables:
        rows = db.execute(select(table)).mappings().all()
        dump["tables"][table.name] = [dict(r) for r in rows]

    data = json.dumps(dump, default=_json_default, ensure_ascii=False, indent=2).encode("utf-8")
    filename = f"yozuv-backup-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.json"
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/json",
        headers={
            "Cache-Control": "no-store",
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


CONFIRM_PHRASE = "REPLACE-ALL-DATA"


@router.post("/backup/import")
async def backup_import(
    file: UploadFile = File(...),
    confirm: str = Form(""),
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Restore the database from a backup JSON.

    DESTRUCTIVE: every existing row in every table is deleted before the
    backup is loaded. Requires `confirm=REPLACE-ALL-DATA` in the
    multipart form so a misclick (or a leaked admin token) can't wipe
    production. Before the wipe runs we also write an automatic
    snapshot of the current state to UPLOADS_DIR/backups/auto-<ts>.json
    so an admin who realises mid-deploy can recover.
    """
    if confirm != CONFIRM_PHRASE:
        raise HTTPException(
            400,
            f"This endpoint replaces ALL data. Set confirm={CONFIRM_PHRASE} to proceed.",
        )

    contents = await file.read()
    if len(contents) > MAX_BACKUP_BYTES:
        raise HTTPException(400, "File too large (max 50 MB)")
    try:
        dump = json.loads(contents.decode("utf-8"))
    except Exception as e:
        raise HTTPException(400, f"Invalid JSON file: {e}")

    if not isinstance(dump, dict) or "tables" not in dump or not isinstance(dump["tables"], dict):
        raise HTTPException(400, "Invalid backup format: missing 'tables' object")
    if int(dump.get("version", 0)) != BACKUP_VERSION:
        raise HTTPException(
            400,
            f"Unsupported backup version: {dump.get('version')} (expected {BACKUP_VERSION})",
        )

    tables_in: dict = dump["tables"]
    known = {t.name for t in Base.metadata.sorted_tables}
    unknown = [name for name in tables_in.keys() if name not in known]
    if unknown:
        raise HTTPException(400, f"Unknown tables in backup: {', '.join(unknown)}")

    # Snapshot current state before destruction so the admin has an
    # undo path. Best-effort — if it fails, the import still proceeds
    # (the audit log will reflect that no auto-backup was written).
    snapshot_path: str | None = None
    try:
        from app.config import get_settings as _get_settings

        backups_dir = Path(_get_settings().uploads_dir) / "backups"
        backups_dir.mkdir(parents=True, exist_ok=True)
        snapshot: dict = {
            "version": BACKUP_VERSION,
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "tables": {
                table.name: [dict(r) for r in db.execute(select(table)).mappings().all()]
                for table in Base.metadata.sorted_tables
            },
        }
        snap_name = f"auto-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.json"
        (backups_dir / snap_name).write_text(
            json.dumps(snapshot, default=_json_default, ensure_ascii=False),
            encoding="utf-8",
        )
        snapshot_path = str(backups_dir / snap_name)
    except Exception:
        snapshot_path = None

    try:
        for table in reversed(Base.metadata.sorted_tables):
            db.execute(delete(table))

        inserted = 0
        for table in Base.metadata.sorted_tables:
            rows = tables_in.get(table.name) or []
            if not rows:
                continue
            coerced = [_coerce_row(table, r) for r in rows]
            db.execute(table.insert(), coerced)
            inserted += len(coerced)

        log_admin_action(
            db,
            admin,
            "backup.import",
            "",
            None,
            {
                "inserted_rows": inserted,
                "tables": len(tables_in),
                "auto_snapshot": snapshot_path,
            },
        )
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Import failed: {e}")

    return {
        "ok": True,
        "inserted_rows": inserted,
        "tables": len(tables_in),
        "auto_snapshot": snapshot_path,
    }


@router.get("/audit-log")
def list_audit_log(
    db: Session = Depends(get_db),
    _=Depends(get_admin_user),
    limit: int = 100,
    action: str | None = None,
    target_type: str | None = None,
    admin_telegram_id: int | None = None,
):
    q = db.query(AdminAuditLog)
    if action:
        q = q.filter(AdminAuditLog.action == action)
    if target_type:
        q = q.filter(AdminAuditLog.target_type == target_type)
    if admin_telegram_id:
        q = q.filter(AdminAuditLog.admin_telegram_id == admin_telegram_id)
    rows = (
        q.order_by(AdminAuditLog.created_at.desc())
        .limit(min(max(1, limit), 500))
        .all()
    )
    return [
        {
            "id": str(r.id),
            "admin_telegram_id": int(r.admin_telegram_id),
            "admin_name": r.admin_name,
            "action": r.action,
            "target_type": r.target_type,
            "target_id": r.target_id,
            "payload": r.payload,
            "created_at": r.created_at.isoformat() if r.created_at else "",
        }
        for r in rows
    ]


@router.get("/payments")
def list_payments(
    db: Session = Depends(get_db), _=Depends(get_admin_user), limit: int = 100
):
    rows = (
        db.query(PaymentTransaction)
        .order_by(PaymentTransaction.created_at.desc())
        .limit(min(max(1, limit), 500))
        .all()
    )
    biz_ids = {tx.business_id for tx in rows if tx.business_id}
    biz_by_id: dict = {}
    if biz_ids:
        biz_by_id = {
            b.id: b for b in db.query(Business).filter(Business.id.in_(biz_ids)).all()
        }
    out = []
    for tx in rows:
        biz = biz_by_id.get(tx.business_id)
        out.append(
            {
                "id": str(tx.id),
                "business_name": biz.name if biz else "—",
                "business_id": str(tx.business_id),
                "provider": str(tx.provider),
                "amount": int(tx.amount),
                "plan": tx.plan,
                "status": str(tx.status),
                "created_at": tx.created_at.isoformat() if tx.created_at else "",
            }
        )
    return out


@router.get("/payments/export")
def export_payments_csv(
    db: Session = Depends(get_db),
    _=Depends(get_admin_user),
    limit: int = 5000,
):
    """Stream all (most recent first) payments as a CSV for accounting."""
    rows = (
        db.query(PaymentTransaction)
        .order_by(PaymentTransaction.created_at.desc())
        .limit(min(max(1, limit), 50000))
        .all()
    )
    biz_ids = {tx.business_id for tx in rows if tx.business_id}
    biz_by_id: dict = {}
    if biz_ids:
        biz_by_id = {
            b.id: b for b in db.query(Business).filter(Business.id.in_(biz_ids)).all()
        }
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        ["created_at", "business", "business_id", "provider", "plan", "amount_uzs", "status"]
    )
    for tx in rows:
        biz = biz_by_id.get(tx.business_id)
        writer.writerow(
            [
                tx.created_at.isoformat() if tx.created_at else "",
                biz.name if biz else "",
                str(tx.business_id),
                str(getattr(tx.provider, "value", tx.provider)),
                tx.plan,
                int(tx.amount),
                str(getattr(tx.status, "value", tx.status)),
            ]
        )
    data = buf.getvalue().encode("utf-8-sig")  # BOM so Excel reads UTF-8
    filename = f"yozuv-payments-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.csv"
    return StreamingResponse(
        io.BytesIO(data),
        media_type="text/csv",
        headers={
            "Cache-Control": "no-store",
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.get("/metrics")
def admin_metrics(
    db: Session = Depends(get_db), _=Depends(get_admin_user), days: int = 30
):
    """Growth + retention metrics for the dashboard charts.

    Returns daily series (new businesses, completed revenue) plus
    headline retention numbers: trial→paid conversion, churn over the
    window, and ARPU across paying businesses.
    """
    days = min(max(7, days), 90)
    now = datetime.now(timezone.utc)
    start = (now - timedelta(days=days - 1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    # --- daily series -----------------------------------------------------
    biz_rows = (
        db.query(Business.created_at)
        .filter(Business.created_at >= start, Business.deleted_at.is_(None))
        .all()
    )
    pay_rows = (
        db.query(PaymentTransaction.created_at, PaymentTransaction.amount)
        .filter(
            PaymentTransaction.status == PaymentRecordStatus.COMPLETED,
            PaymentTransaction.created_at >= start,
        )
        .all()
    )
    by_day_biz: dict[str, int] = {}
    by_day_rev: dict[str, int] = {}
    for i in range(days):
        key = (start + timedelta(days=i)).date().isoformat()
        by_day_biz[key] = 0
        by_day_rev[key] = 0
    for (created,) in biz_rows:
        if created:
            key = created.date().isoformat()
            if key in by_day_biz:
                by_day_biz[key] += 1
    for created, amount in pay_rows:
        if created:
            key = created.date().isoformat()
            if key in by_day_rev:
                by_day_rev[key] += int(amount or 0)
    growth = [{"day": k, "value": v} for k, v in by_day_biz.items()]
    revenue = [{"day": k, "value": v} for k, v in by_day_rev.items()]

    # --- retention --------------------------------------------------------
    active_subs = (
        db.query(Subscription)
        .filter(
            Subscription.status == SubscriptionStatus.ACTIVE,
            Subscription.expires_at > now,
        )
        .all()
    )
    paying = [s for s in active_subs if s.plan != SubscriptionPlan.TRIAL]
    arpu = int(sum(int(s.amount_paid or 0) for s in paying) / len(paying)) if paying else 0

    # Subscriptions that ever reached a paid plan, of those that started as trial.
    total_business_ids = {
        bid for (bid,) in db.query(Subscription.business_id).distinct().all()
    }
    paid_business_ids = {
        bid
        for (bid,) in db.query(Subscription.business_id)
        .filter(Subscription.plan != SubscriptionPlan.TRIAL)
        .distinct()
        .all()
    }
    conversion_pct = (
        round(100 * len(paid_business_ids) / len(total_business_ids))
        if total_business_ids
        else 0
    )

    # Churn: subs that expired or were cancelled within the window.
    churned = (
        db.query(func.count(Subscription.id))
        .filter(
            or_(
                Subscription.status == SubscriptionStatus.CANCELLED,
                Subscription.expires_at.between(start, now),
            )
        )
        .scalar()
        or 0
    )
    expiring_7d = (
        db.query(func.count(Subscription.id))
        .filter(
            Subscription.status == SubscriptionStatus.ACTIVE,
            Subscription.expires_at > now,
            Subscription.expires_at <= now + timedelta(days=7),
        )
        .scalar()
        or 0
    )

    return {
        "days": days,
        "growth": growth,
        "revenue": revenue,
        "arpu_uzs": arpu,
        "paying_businesses": len(paid_business_ids),
        "conversion_pct": conversion_pct,
        "churned_subscriptions": int(churned),
        "expiring_7d": int(expiring_7d),
    }


@router.get("/subscriptions/expiring")
def list_expiring(
    db: Session = Depends(get_db), _=Depends(get_admin_user), days: int = 7
):
    """Active subscriptions expiring within ``days`` — for proactive renewal."""
    days = min(max(1, days), 60)
    now = datetime.now(timezone.utc)
    cutoff = now + timedelta(days=days)
    subs = (
        db.query(Subscription)
        .filter(
            Subscription.status == SubscriptionStatus.ACTIVE,
            Subscription.expires_at > now,
            Subscription.expires_at <= cutoff,
        )
        .order_by(Subscription.expires_at.asc())
        .all()
    )
    biz_ids = {s.business_id for s in subs}
    biz_by_id = {
        b.id: b
        for b in db.query(Business).filter(Business.id.in_(biz_ids)).all()
    } if biz_ids else {}
    owner_ids = {b.owner_id for b in biz_by_id.values() if b.owner_id}
    owners_by_id = {
        u.id: u for u in db.query(User).filter(User.id.in_(owner_ids)).all()
    } if owner_ids else {}
    out = []
    for s in subs:
        b = biz_by_id.get(s.business_id)
        if not b or b.deleted_at is not None:
            continue
        owner = owners_by_id.get(b.owner_id) if b and b.owner_id else None
        days_left = max(0, (s.expires_at - now).days)
        out.append(
            {
                "business_id": str(b.id),
                "business_name": b.name,
                "plan": getattr(s.plan, "value", str(s.plan)),
                "expires_at": s.expires_at.isoformat(),
                "days_left": days_left,
                "owner": {
                    "telegram_id": owner.telegram_id if owner else None,
                    "name": f"{owner.first_name or ''} {owner.last_name or ''}".strip()
                    if owner
                    else "",
                },
            }
        )
    return out


@router.get("/reviews")
def list_reviews(
    db: Session = Depends(get_db),
    _=Depends(get_admin_user),
    limit: int = 100,
    max_rating: int | None = None,
    business_id: UUID | None = None,
):
    """Platform-wide review feed for moderation.

    ``max_rating`` surfaces the low-star reviews first worth checking
    (e.g. ``max_rating=2`` for 1–2★ complaints).
    """
    q = db.query(Review)
    if max_rating is not None:
        q = q.filter(Review.rating <= max_rating)
    if business_id is not None:
        q = q.filter(Review.business_id == business_id)
    rows = (
        q.order_by(Review.created_at.desc())
        .limit(min(max(1, limit), 500))
        .all()
    )
    biz_ids = {r.business_id for r in rows}
    biz_by_id = {
        b.id: b for b in db.query(Business).filter(Business.id.in_(biz_ids)).all()
    } if biz_ids else {}
    client_ids = {r.client_id for r in rows if r.client_id}
    clients_by_id = {
        c.id: c for c in db.query(Client).filter(Client.id.in_(client_ids)).all()
    } if client_ids else {}
    out = []
    for r in rows:
        biz = biz_by_id.get(r.business_id)
        client = clients_by_id.get(r.client_id) if r.client_id else None
        out.append(
            {
                "id": str(r.id),
                "business_id": str(r.business_id),
                "business_name": biz.name if biz else "—",
                "rating": int(r.rating),
                "comment": r.comment or "",
                "owner_reply": r.owner_reply or "",
                "client_name": f"{client.first_name or ''} {client.last_name or ''}".strip()
                if client
                else "",
                "created_at": r.created_at.isoformat() if r.created_at else "",
            }
        )
    return out


@router.delete("/reviews/{review_id}")
def delete_review(
    review_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Hard-delete a review (spam / abuse moderation)."""
    r = db.query(Review).filter(Review.id == review_id).first()
    if not r:
        raise HTTPException(404, "Review not found")
    log_admin_action(
        db,
        admin,
        "review.delete",
        "Review",
        r.id,
        {"business_id": str(r.business_id), "rating": int(r.rating)},
    )
    db.delete(r)
    db.commit()
    return {"ok": True, "id": str(review_id)}


@router.get("/businesses/{business_id}/activity")
def business_activity(
    business_id: UUID, db: Session = Depends(get_db), _=Depends(get_admin_user)
):
    """Per-business activity snapshot for the admin detail view."""
    b = db.query(Business).filter(Business.id == business_id).first()
    if not b:
        raise HTTPException(404, "Business not found")
    now = datetime.now(timezone.utc)
    thirty_ago = now - timedelta(days=30)

    bookings_total = (
        db.query(func.count(Booking.id))
        .filter(Booking.business_id == b.id)
        .scalar()
        or 0
    )
    bookings_30d = (
        db.query(func.count(Booking.id))
        .filter(Booking.business_id == b.id, Booking.created_at >= thirty_ago)
        .scalar()
        or 0
    )
    by_status: dict[str, int] = {}
    for status, count in (
        db.query(Booking.status, func.count(Booking.id))
        .filter(Booking.business_id == b.id)
        .group_by(Booking.status)
        .all()
    ):
        by_status[str(getattr(status, "value", status))] = int(count)

    clients_total = (
        db.query(func.count(func.distinct(Booking.client_id)))
        .filter(Booking.business_id == b.id, Booking.client_id.isnot(None))
        .scalar()
        or 0
    )
    revenue_total = (
        db.query(func.coalesce(func.sum(Booking.payment_amount), 0))
        .filter(
            Booking.business_id == b.id,
            Booking.payment_status == PaymentStatus.PAID,
        )
        .scalar()
        or 0
    )
    reviews_count = (
        db.query(func.count(Review.id)).filter(Review.business_id == b.id).scalar() or 0
    )
    reviews_avg = (
        db.query(func.avg(Review.rating)).filter(Review.business_id == b.id).scalar()
    )

    return {
        "business_id": str(b.id),
        "bookings_total": int(bookings_total),
        "bookings_30d": int(bookings_30d),
        "bookings_by_status": by_status,
        "clients_total": int(clients_total),
        "revenue_total_uzs": int(revenue_total),
        "reviews_count": int(reviews_count),
        "reviews_avg": round(float(reviews_avg), 1) if reviews_avg is not None else None,
    }


@router.get("/platform-stats")
def platform_stats(db: Session = Depends(get_db), _=Depends(get_admin_user)):
    """Platform-wide engagement + system health for the admin overview.

    Aggregates the growth-loop features (referrals, waitlist, promo
    codes) that otherwise have no admin surface, plus the latest
    auto-backup snapshot written before the last destructive import.
    """
    referrals_total = db.query(func.count(Referral.id)).scalar() or 0
    referrals_completed = (
        db.query(func.count(Referral.id))
        .filter(Referral.status == ReferralStatus.COMPLETED)
        .scalar()
        or 0
    )
    referral_conv = (
        round(100 * referrals_completed / referrals_total) if referrals_total else 0
    )

    waitlist_total = db.query(func.count(WaitlistEntry.id)).scalar() or 0
    waitlist_waiting = (
        db.query(func.count(WaitlistEntry.id))
        .filter(WaitlistEntry.notified_at.is_(None))
        .scalar()
        or 0
    )

    promo_total = db.query(func.count(PromoCode.id)).scalar() or 0
    promo_active = (
        db.query(func.count(PromoCode.id))
        .filter(PromoCode.is_active.is_(True))
        .scalar()
        or 0
    )
    promo_uses = db.query(func.coalesce(func.sum(PromoCode.uses_count), 0)).scalar() or 0

    bookings_total = db.query(func.count(Booking.id)).scalar() or 0
    clients_total = db.query(func.count(Client.id)).scalar() or 0
    reviews_total = db.query(func.count(Review.id)).scalar() or 0
    reviews_avg = db.query(func.avg(Review.rating)).scalar()

    # Latest auto-snapshot written by backup_import (best-effort).
    last_backup: dict | None = None
    try:
        from app.config import get_settings as _get_settings

        backups_dir = Path(_get_settings().uploads_dir) / "backups"
        if backups_dir.is_dir():
            snaps = sorted(backups_dir.glob("auto-*.json"), reverse=True)
            if snaps:
                st = snaps[0].stat()
                last_backup = {
                    "name": snaps[0].name,
                    "size_kb": round(st.st_size / 1024, 1),
                    "modified_at": datetime.fromtimestamp(
                        st.st_mtime, tz=timezone.utc
                    ).isoformat(),
                }
    except Exception:
        last_backup = None

    return {
        "referrals_total": int(referrals_total),
        "referrals_completed": int(referrals_completed),
        "referral_conversion_pct": referral_conv,
        "waitlist_total": int(waitlist_total),
        "waitlist_waiting": int(waitlist_waiting),
        "promo_total": int(promo_total),
        "promo_active": int(promo_active),
        "promo_uses": int(promo_uses),
        "bookings_total": int(bookings_total),
        "clients_total": int(clients_total),
        "reviews_total": int(reviews_total),
        "reviews_avg": round(float(reviews_avg), 1) if reviews_avg is not None else None,
        "last_backup": last_backup,
    }


def _get_or_create_platform_settings(db: Session) -> "PlatformSettings":
    from app.models import PlatformSettings

    ps = db.query(PlatformSettings).filter(PlatformSettings.id == 1).first()
    if ps is None:
        ps = PlatformSettings(id=1)
        db.add(ps)
        db.flush()
    return ps


@router.get("/plan-prices")
def get_plan_prices(db: Session = Depends(get_db), _=Depends(get_admin_user)):
    """Current subscription prices (resolved) plus the raw overrides.

    ``monthly``/``yearly`` are the effective prices used at checkout;
    ``monthly_override``/``yearly_override`` are the stored values where
    0 means "use the code default".
    """
    from app.models import PlatformSettings
    from app.services.payment_service import MONTHLY_AMOUNT_UZS, YEARLY_AMOUNT_UZS

    ps = db.query(PlatformSettings).filter(PlatformSettings.id == 1).first()
    monthly_override = int(ps.monthly_price) if ps else 0
    yearly_override = int(ps.yearly_price) if ps else 0
    return {
        "monthly": monthly_override or MONTHLY_AMOUNT_UZS,
        "yearly": yearly_override or YEARLY_AMOUNT_UZS,
        "monthly_override": monthly_override,
        "yearly_override": yearly_override,
        "default_monthly": MONTHLY_AMOUNT_UZS,
        "default_yearly": YEARLY_AMOUNT_UZS,
    }


class PlanPricesBody(BaseModel):
    # 0 (or null) resets to the code default.
    monthly_price: int = Field(0, ge=0, le=1_000_000_000)
    yearly_price: int = Field(0, ge=0, le=1_000_000_000)


@router.put("/plan-prices")
def set_plan_prices(
    body: PlanPricesBody,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    from app.services.payment_service import MONTHLY_AMOUNT_UZS, YEARLY_AMOUNT_UZS

    ps = _get_or_create_platform_settings(db)
    ps.monthly_price = int(body.monthly_price)
    ps.yearly_price = int(body.yearly_price)
    log_admin_action(
        db,
        admin,
        "settings.prices",
        "PlatformSettings",
        None,
        {"monthly_price": ps.monthly_price, "yearly_price": ps.yearly_price},
    )
    db.commit()
    return {
        "monthly": ps.monthly_price or MONTHLY_AMOUNT_UZS,
        "yearly": ps.yearly_price or YEARLY_AMOUNT_UZS,
        "monthly_override": ps.monthly_price,
        "yearly_override": ps.yearly_price,
    }


@router.get("/admins")
def list_admins(db: Session = Depends(get_db), _=Depends(get_admin_user)):
    """All platform admins: immutable env superadmins + panel-managed rows."""
    from app.deps import _admin_telegram_ids

    env_ids = _admin_telegram_ids()
    out = []
    for tg in sorted(env_ids):
        out.append(
            {
                "telegram_id": int(tg),
                "name": "",
                "source": "env",
                "role": "superadmin",
                "removable": False,
                "created_at": None,
            }
        )
    db_rows = db.query(AdminUser).order_by(AdminUser.created_at.desc()).all()
    for a in db_rows:
        if int(a.telegram_id) in env_ids:
            continue  # env wins; don't list twice
        out.append(
            {
                "telegram_id": int(a.telegram_id),
                "name": a.name or "",
                "source": "db",
                "role": a.role or "admin",
                "removable": True,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
        )
    return out


class AdminCreateBody(BaseModel):
    # Identify the new admin by numeric Telegram ID OR by @username.
    # At least one is required; username is resolved to an id via the
    # users table (the person must have logged in at least once).
    telegram_id: int | None = Field(None, gt=0)
    username: str | None = None
    name: str | None = None
    # "admin" or "superadmin". Only superadmins can manage other admins.
    role: str = "admin"


@router.post("/admins", status_code=201)
def add_admin(
    body: AdminCreateBody,
    db: Session = Depends(get_db),
    admin: User = Depends(get_superadmin_user),
):
    from app.deps import _admin_telegram_ids

    role = (body.role or "admin").strip().lower()
    if role not in ("admin", "superadmin"):
        raise HTTPException(400, "role must be 'admin' or 'superadmin'")
    telegram_id = body.telegram_id
    name = (body.name or "").strip()

    # Resolve a @username to a Telegram id. Telegram usernames are
    # case-insensitive and we store them lowercased-unique, so match on
    # lower(). The user must already exist (have logged in) — we can't
    # mint an id from a username we've never seen.
    if telegram_id is None:
        uname = (body.username or "").strip().lstrip("@")
        if not uname:
            raise HTTPException(400, "Telegram ID yoki username kerak")
        u = (
            db.query(User)
            .filter(func.lower(User.username) == uname.lower())
            .first()
        )
        if not u:
            raise HTTPException(
                404,
                f"@{uname} topilmadi. Foydalanuvchi avval tizimga kirishi kerak.",
            )
        if not u.telegram_id:
            raise HTTPException(400, f"@{uname} ning Telegram ID si yo‘q")
        telegram_id = int(u.telegram_id)
        if not name:
            name = (
                f"{u.first_name or ''} {u.last_name or ''}".strip()
                or (u.username or "")
            )

    if telegram_id in _admin_telegram_ids():
        raise HTTPException(409, "Already a superadmin (env)")
    existing = (
        db.query(AdminUser).filter(AdminUser.telegram_id == telegram_id).first()
    )
    if existing:
        raise HTTPException(409, "Already an admin")
    row = AdminUser(
        telegram_id=telegram_id,
        name=name,
        role=role,
        added_by_telegram_id=int(admin.telegram_id) if admin.telegram_id else None,
    )
    db.add(row)
    log_admin_action(
        db,
        admin,
        "admin.add",
        "AdminUser",
        None,
        {"telegram_id": telegram_id, "name": row.name, "role": role},
    )
    db.commit()
    db.refresh(row)
    return {
        "telegram_id": int(row.telegram_id),
        "name": row.name,
        "source": "db",
        "role": row.role,
        "removable": True,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


@router.delete("/admins/{telegram_id}")
def remove_admin(
    telegram_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_superadmin_user),
):
    from app.deps import _admin_telegram_ids

    if admin.telegram_id and telegram_id == int(admin.telegram_id):
        raise HTTPException(400, "O‘zingizni o‘chira olmaysiz")
    if telegram_id in _admin_telegram_ids():
        raise HTTPException(400, "Cannot remove a superadmin (set via env)")
    row = db.query(AdminUser).filter(AdminUser.telegram_id == telegram_id).first()
    if not row:
        raise HTTPException(404, "Admin not found")
    log_admin_action(
        db, admin, "admin.remove", "AdminUser", None, {"telegram_id": telegram_id}
    )
    db.delete(row)
    db.commit()
    return {"ok": True, "telegram_id": telegram_id}
