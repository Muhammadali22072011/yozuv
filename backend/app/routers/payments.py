import asyncio
import hashlib
import hmac
import json
import os
import re
import uuid
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.deps import get_admin_user, get_current_user, get_owned_business, is_admin_user
from app.models import (
    Business,
    PaymentProvider,
    PaymentRecordStatus,
    PaymentTransaction,
    PlatformSettings,
    SubscriptionPlan,
    User,
)
from app.services.audit_service import log_admin_action
from app.services.notification_service import send_telegram_photo
from app.services.payment_service import (
    approve_card_payment,
    complete_transaction_and_notify,
    create_card_payment,
    create_click_payment,
    create_payme_payment,
    refund_transaction,
    reject_card_payment,
)

router = APIRouter(prefix="/payments", tags=["payments"])
settings = get_settings()


ALLOWED_RECEIPT_MIME = {"image/jpeg", "image/png", "image/webp"}
MAX_RECEIPT_BYTES = 8 * 1024 * 1024


def _uploads_dir() -> Path:
    p = Path(settings.uploads_dir)
    p.mkdir(parents=True, exist_ok=True)
    return p


def _get_or_create_platform_settings(db: Session) -> PlatformSettings:
    ps = db.query(PlatformSettings).filter(PlatformSettings.id == 1).first()
    if not ps:
        ps = PlatformSettings(id=1, card_number="", card_holder="", payment_comment="")
        db.add(ps)
        db.flush()
    return ps


class CreatePaymentBody(BaseModel):
    plan: SubscriptionPlan = Field(..., description="MONTHLY or YEARLY")


@router.post("/payme/create")
def payme_create(
    body: CreatePaymentBody,
    db: Session = Depends(get_db),
    business: Business = Depends(get_owned_business),
):
    if body.plan not in (SubscriptionPlan.MONTHLY, SubscriptionPlan.YEARLY):
        raise HTTPException(400, "Invalid plan")
    tx, url = create_payme_payment(db, business.id, body.plan)
    db.commit()
    if not url:
        raise HTTPException(500, "Payment URL not generated (check Payme credentials)")
    return {"payment_url": url, "transaction_id": str(tx.id)}


@router.post("/click/create")
def click_create(
    body: CreatePaymentBody,
    db: Session = Depends(get_db),
    business: Business = Depends(get_owned_business),
):
    if body.plan not in (SubscriptionPlan.MONTHLY, SubscriptionPlan.YEARLY):
        raise HTTPException(400, "Invalid plan")
    tx, url = create_click_payment(db, business.id, body.plan)
    db.commit()
    if not url:
        raise HTTPException(500, "Payment URL not generated (check Click credentials)")
    return {"payment_url": url, "transaction_id": str(tx.id)}


# ---------- Card (manual) flow ----------


class PlatformSettingsOut(BaseModel):
    card_number: str
    card_holder: str
    payment_comment: str


class PlatformSettingsUpdate(BaseModel):
    card_number: str = Field(default="", max_length=32)
    card_holder: str = Field(default="", max_length=128)
    payment_comment: str = Field(default="", max_length=2000)


@router.get("/card/info", response_model=PlatformSettingsOut)
def card_info(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    ps = _get_or_create_platform_settings(db)
    return PlatformSettingsOut(
        card_number=ps.card_number,
        card_holder=ps.card_holder,
        payment_comment=ps.payment_comment,
    )


@router.put("/card/info", response_model=PlatformSettingsOut)
def update_card_info(
    body: PlatformSettingsUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    ps = _get_or_create_platform_settings(db)
    ps.card_number = body.card_number
    ps.card_holder = body.card_holder
    ps.payment_comment = body.payment_comment
    db.commit()
    return PlatformSettingsOut(
        card_number=ps.card_number,
        card_holder=ps.card_holder,
        payment_comment=ps.payment_comment,
    )


class CardCreateOut(BaseModel):
    transaction_id: str
    amount: int
    card_number: str
    card_holder: str
    payment_comment: str


@router.post("/card/create", response_model=CardCreateOut)
def card_create(
    body: CreatePaymentBody,
    db: Session = Depends(get_db),
    business: Business = Depends(get_owned_business),
):
    if body.plan not in (SubscriptionPlan.MONTHLY, SubscriptionPlan.YEARLY):
        raise HTTPException(400, "Invalid plan")
    ps = _get_or_create_platform_settings(db)
    if not ps.card_number:
        raise HTTPException(503, "Admin has not configured a payment card yet")
    tx = create_card_payment(db, business.id, body.plan)
    db.commit()
    return CardCreateOut(
        transaction_id=str(tx.id),
        amount=tx.amount,
        card_number=ps.card_number,
        card_holder=ps.card_holder,
        payment_comment=ps.payment_comment,
    )


@router.post("/card/upload-receipt")
async def upload_receipt(
    transaction_id: UUID = Form(...),
    comment: str = Form(""),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    business: Business = Depends(get_owned_business),
):
    tx = db.query(PaymentTransaction).filter(PaymentTransaction.id == transaction_id).first()
    if not tx or tx.business_id != business.id:
        raise HTTPException(404, "Transaction not found")
    if tx.provider != PaymentProvider.CARD:
        raise HTTPException(400, "Wrong provider")
    if tx.status == PaymentRecordStatus.COMPLETED:
        raise HTTPException(400, "Transaction already completed")

    if file.content_type not in ALLOWED_RECEIPT_MIME:
        raise HTTPException(400, "Only JPG/PNG/WEBP images are allowed")

    contents = await file.read()
    if len(contents) > MAX_RECEIPT_BYTES:
        raise HTTPException(400, "File too large (max 8 MB)")

    ext = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }[file.content_type]
    fname = f"{uuid.uuid4().hex}{ext}"
    path = _uploads_dir() / fname
    path.write_bytes(contents)

    tx.screenshot_url = f"/api/payments/receipts/{fname}"
    tx.user_comment = comment.strip()[:2000]
    tx.status = PaymentRecordStatus.AWAITING_APPROVAL
    db.commit()

    # Notify admin(s) via Telegram with the screenshot
    admin_ids_raw = settings.admin_telegram_ids or ""
    for raw in admin_ids_raw.split(","):
        raw = raw.strip()
        if not raw:
            continue
        try:
            chat_id = int(raw)
        except ValueError:
            continue
        caption = (
            f"💳 Yangi to'lov tasdiqlash uchun\n"
            f"Biznes: <b>{business.name}</b>\n"
            f"Reja: {tx.plan}\n"
            f"Summa: {tx.amount:,} so'm\n"
            f"Izoh: {tx.user_comment or '—'}\n"
            f"ID: <code>{tx.id}</code>"
        )
        try:
            await asyncio.to_thread(send_telegram_photo, chat_id, str(path), caption)
        except Exception:
            pass

    return {"transaction_id": str(tx.id), "status": str(tx.status)}


@router.get("/receipts/{filename}")
def get_receipt(
    filename: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    safe = os.path.basename(filename)
    if safe != filename:
        raise HTTPException(400, "Invalid filename")
    path = _uploads_dir() / safe
    if not path.exists():
        raise HTTPException(404, "Not found")
    # Allow admin, or the owner of the business that created the tx
    if is_admin_user(user):
        return FileResponse(str(path))
    url = f"/api/payments/receipts/{safe}"
    tx = db.query(PaymentTransaction).filter(PaymentTransaction.screenshot_url == url).first()
    if tx:
        biz = db.query(Business).filter(Business.id == tx.business_id).first()
        if biz and biz.owner_id == user.id:
            return FileResponse(str(path))
    raise HTTPException(403, "Forbidden")


class PendingPaymentOut(BaseModel):
    transaction_id: str
    business_id: str
    business_name: str
    amount: int
    plan: str
    status: str
    user_comment: str
    screenshot_url: str
    created_at: str


@router.get("/pending", response_model=list[PendingPaymentOut])
def list_pending(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    rows = (
        db.query(PaymentTransaction, Business)
        .join(Business, Business.id == PaymentTransaction.business_id)
        .filter(
            PaymentTransaction.provider == PaymentProvider.CARD,
            PaymentTransaction.status == PaymentRecordStatus.AWAITING_APPROVAL,
        )
        .order_by(PaymentTransaction.created_at.desc())
        .all()
    )
    return [
        PendingPaymentOut(
            transaction_id=str(tx.id),
            business_id=str(tx.business_id),
            business_name=biz.name,
            amount=tx.amount,
            plan=tx.plan,
            status=str(tx.status),
            user_comment=tx.user_comment,
            screenshot_url=tx.screenshot_url,
            created_at=tx.created_at.isoformat() if tx.created_at else "",
        )
        for tx, biz in rows
    ]


@router.get("/status/{transaction_id}")
def get_status(
    transaction_id: UUID,
    db: Session = Depends(get_db),
    business: Business = Depends(get_owned_business),
):
    tx = db.query(PaymentTransaction).filter(PaymentTransaction.id == transaction_id).first()
    if not tx or tx.business_id != business.id:
        raise HTTPException(404, "Transaction not found")
    return {
        "transaction_id": str(tx.id),
        "status": str(tx.status),
        "amount": tx.amount,
        "plan": tx.plan,
    }


class ApproveBody(BaseModel):
    transaction_id: UUID


class RejectBody(BaseModel):
    transaction_id: UUID
    reason: str = ""


@router.post("/approve")
def approve(
    body: ApproveBody,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    try:
        tx = approve_card_payment(db, body.transaction_id, str(admin.telegram_id))
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    log_admin_action(
        db,
        admin,
        "payment.approve",
        "PaymentTransaction",
        tx.id,
        {"amount": int(tx.amount), "business_id": str(tx.business_id)},
    )
    db.commit()
    return {"transaction_id": str(tx.id), "status": str(tx.status)}


@router.post("/reject")
def reject(
    body: RejectBody,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    try:
        tx = reject_card_payment(db, body.transaction_id, str(admin.telegram_id), body.reason)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    log_admin_action(
        db,
        admin,
        "payment.reject",
        "PaymentTransaction",
        tx.id,
        {"reason": body.reason, "business_id": str(tx.business_id)},
    )
    db.commit()
    return {"transaction_id": str(tx.id), "status": str(tx.status)}


# ---------- Existing Payme / Click webhook handlers ----------


def _find_tx_id(obj) -> UUID | None:
    s = json.dumps(obj)
    for m in re.finditer(
        r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}",
        s,
    ):
        try:
            return UUID(m.group(0))
        except ValueError:
            continue
    return None


def _verify_payme_auth(request: Request) -> bool:
    if not settings.payme_secret_key:
        # Fail closed: an unconfigured secret must reject all callbacks,
        # otherwise an attacker can bypass auth by hitting the webhook directly.
        return False
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Basic "):
        return False
    import base64
    try:
        decoded = base64.b64decode(auth_header[6:]).decode()
        _, provided_key = decoded.split(":", 1)
    except Exception:
        return False
    return hmac.compare_digest(provided_key, settings.payme_secret_key)


def _verify_click_signature(body: dict) -> bool:
    if not settings.click_secret_key:
        # Fail closed: an unconfigured secret must reject all callbacks.
        return False
    sign_time = str(body.get("sign_time", ""))
    click_trans_id = str(body.get("click_trans_id", ""))
    service_id = str(body.get("service_id", ""))
    merchant_trans_id = str(body.get("merchant_trans_id", ""))
    amount = str(body.get("amount", ""))
    action = str(body.get("action", ""))
    sign_string = (
        click_trans_id + service_id + settings.click_secret_key +
        merchant_trans_id + amount + action + sign_time
    )
    expected = hashlib.md5(sign_string.encode()).hexdigest()
    provided = str(body.get("sign_string", ""))
    return hmac.compare_digest(expected, provided)


@router.post("/payme/webhook")
async def payme_webhook(request: Request, db: Session = Depends(get_db)):
    if not _verify_payme_auth(request):
        raise HTTPException(401, "Unauthorized")

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON") from None

    tx_id = _find_tx_id(body)
    if not tx_id:
        return {"ok": True}

    tx = db.query(PaymentTransaction).filter(PaymentTransaction.id == tx_id).first()
    if not tx or tx.status == PaymentRecordStatus.COMPLETED:
        return {"ok": True}

    method = body.get("method", "")
    if method != "PerformTransaction":
        return {"ok": True}

    complete_transaction_and_notify(db, tx)
    db.commit()
    return {"ok": True}


@router.post("/click/webhook")
async def click_webhook(request: Request, db: Session = Depends(get_db)):
    try:
        body = await request.json()
    except Exception:
        try:
            form = await request.form()
            body = dict(form)
        except Exception:
            raise HTTPException(400, "Invalid body") from None

    if not _verify_click_signature(body):
        raise HTTPException(401, "Invalid signature")

    tx_id = _find_tx_id(body)
    if not tx_id:
        return {"ok": True}

    if str(body.get("action", "")) != "1":
        return {"ok": True}

    tx = db.query(PaymentTransaction).filter(PaymentTransaction.id == tx_id).first()
    if not tx or tx.status == PaymentRecordStatus.COMPLETED:
        return {"ok": True}

    complete_transaction_and_notify(db, tx)
    db.commit()
    return {"ok": True}


class RefundBody(BaseModel):
    transaction_id: UUID


@router.post("/refund")
def refund(
    body: RefundBody,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    # Refunds are admin-only: a business owner refunding their own
    # subscription payment would be a free-money exploit. The service
    # layer cancels the active subscription as part of the refund.
    tx = db.query(PaymentTransaction).filter(PaymentTransaction.id == body.transaction_id).first()
    if not tx:
        raise HTTPException(404, "Transaction not found")
    try:
        tx = refund_transaction(db, body.transaction_id, tx.business_id)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    log_admin_action(
        db,
        admin,
        "payment.refund",
        "PaymentTransaction",
        tx.id,
        {"amount": int(tx.amount), "business_id": str(tx.business_id)},
    )
    db.commit()
    return {
        "transaction_id": str(tx.id),
        "status": str(tx.status),
        "amount": tx.amount,
        "message": "Refund processed successfully",
    }
