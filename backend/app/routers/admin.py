import asyncio
import io
import json
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.database import Base, get_db
from app.deps import get_admin_user
from app.models import (
    Business,
    PaymentRecordStatus,
    PaymentTransaction,
    Subscription,
    SubscriptionPlan,
    SubscriptionStatus,
    User,
)
from app.services.notification_service import send_telegram_message

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
    db: Session = Depends(get_db), _=Depends(get_admin_user), limit: int = 100
):
    now = datetime.now(timezone.utc)
    rows = (
        db.query(Business)
        .order_by(Business.created_at.desc())
        .limit(min(max(1, limit), 500))
        .all()
    )
    out = []
    for b in rows:
        sub = (
            db.query(Subscription)
            .filter(
                Subscription.business_id == b.id,
                Subscription.status == SubscriptionStatus.ACTIVE,
                Subscription.expires_at > now,
            )
            .order_by(Subscription.expires_at.desc())
            .first()
        )
        owner = db.query(User).filter(User.id == b.owner_id).first()
        out.append(
            {
                "id": str(b.id),
                "name": b.name,
                "slug": b.slug,
                "category": str(getattr(b.category, "value", b.category)),
                "is_active": b.is_active,
                "created_at": b.created_at.isoformat() if b.created_at else "",
                "owner": {
                    "telegram_id": owner.telegram_id if owner else None,
                    "name": f"{owner.first_name or ''} {owner.last_name or ''}".strip() if owner else "",
                },
                "subscription": {
                    "plan": getattr(sub.plan, "value", str(sub.plan)) if sub else None,
                    "expires_at": sub.expires_at.isoformat() if sub and sub.expires_at else None,
                }
                if sub
                else None,
            }
        )
    return out


class ExtendBody(BaseModel):
    business_id: UUID
    days: int = Field(..., ge=1, le=365)


@router.post("/subscription/extend")
def extend_subscription(
    body: ExtendBody, db: Session = Depends(get_db), _=Depends(get_admin_user)
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


class ToggleBody(BaseModel):
    business_id: UUID
    is_active: bool


@router.post("/business/toggle")
def toggle_business(
    body: ToggleBody, db: Session = Depends(get_db), _=Depends(get_admin_user)
):
    b = db.query(Business).filter(Business.id == body.business_id).first()
    if not b:
        raise HTTPException(404, "Business not found")
    b.is_active = body.is_active
    db.commit()
    return {"ok": True, "is_active": b.is_active}


class BroadcastBody(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)
    only_active: bool = True


@router.post("/broadcast")
def broadcast(
    body: BroadcastBody, db: Session = Depends(get_db), _=Depends(get_admin_user)
):
    q = db.query(Business, User).join(User, User.id == Business.owner_id)
    if body.only_active:
        q = q.filter(Business.is_active.is_(True))
    rows = q.all()
    sent = 0
    failed = 0
    text = body.text
    for _b, owner in rows:
        if not owner or not owner.telegram_id:
            failed += 1
            continue
        try:
            send_telegram_message(int(owner.telegram_id), text)
            sent += 1
        except Exception:
            failed += 1
    return {"sent": sent, "failed": failed, "total": len(rows)}


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


@router.post("/backup/import")
async def backup_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=Depends(get_admin_user),
):
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

        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Import failed: {e}")

    return {"ok": True, "inserted_rows": inserted, "tables": len(tables_in)}


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
    out = []
    for tx in rows:
        biz = db.query(Business).filter(Business.id == tx.business_id).first()
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
