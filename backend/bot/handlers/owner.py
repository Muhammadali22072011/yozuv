import asyncio
from uuid import UUID

from aiogram import F, Router
from aiogram.types import CallbackQuery

from app.database import SessionLocal
from app.models import Booking, BookingStatus, Business, Client, Service, User
from app.services import booking_service
from app.services.notification_service import send_telegram_message
from bot.keyboards.inline import reject_reasons_kb

router = Router()

_REASONS = {
    "sick": "Usta kasal",
    "busy": "Vaqt band",
    "holiday": "Dam olish kuni",
    "other": "Boshqa sabab",
}


@router.callback_query(F.data.startswith("own_confirm:"))
async def owner_confirm(cb: CallbackQuery):
    bid = cb.data.split(":", 1)[1]
    db = SessionLocal()
    client_tg_id: int | None = None
    svc_name: str | None = None
    try:
        booking = db.query(Booking).filter(Booking.id == UUID(bid)).first()
        owner = db.query(User).filter(User.telegram_id == cb.from_user.id).first()
        if not booking or not owner:
            await cb.answer("Topilmadi", show_alert=True)
            return
        biz = db.query(Business).filter(Business.id == booking.business_id).first()
        if not biz or biz.owner_id != owner.id:
            await cb.answer("Ruxsat yo'q", show_alert=True)
            return
        # Only a still-pending booking may be confirmed. The original
        # notification keeps this inline keyboard forever, but the booking
        # can be cancelled (client self-cancel) or NO_SHOW-flipped meanwhile
        # — tapping the stale button must not resurrect it. Route through
        # booking_service so confirmation stays centralized, like reject does.
        if booking.status != BookingStatus.PENDING:
            await cb.answer("Allaqachon ko'rib chiqilgan", show_alert=True)
            return
        booking_service.confirm_booking(db, UUID(bid), biz.id)
        db.commit()
        client = db.query(Client).filter(Client.id == booking.client_id).first()
        svc = db.query(Service).filter(Service.id == booking.service_id).first()
        if client and client.telegram_id:
            try:
                client_tg_id = int(client.telegram_id)
            except (TypeError, ValueError):
                client_tg_id = None
        svc_name = svc.name if svc else None
        booking_date = booking.date
        booking_time = booking.start_time
    finally:
        db.close()

    try:
        await cb.message.edit_text("✅ Yozilish tasdiqlandi.")
    except Exception:
        try:
            await cb.message.edit_reply_markup(reply_markup=None)
        except Exception:
            pass

    if client_tg_id:
        text = (
            f"✅ Yozilishingiz tasdiqlandi!\n\n"
            + (f"📋 {svc_name}\n" if svc_name else "")
            + f"📅 {booking_date.isoformat()} · {booking_time.strftime('%H:%M')}"
        )
        try:
            await asyncio.to_thread(send_telegram_message, client_tg_id, text)
        except Exception:
            pass
    await cb.answer()


@router.callback_query(F.data.startswith("own_reject:"))
async def owner_reject(cb: CallbackQuery):
    bid = cb.data.split(":", 1)[1]
    await cb.message.edit_reply_markup(reply_markup=reject_reasons_kb(bid))
    await cb.answer()


@router.callback_query(F.data.startswith("rej:"))
async def owner_reject_reason(cb: CallbackQuery):
    _, bid, code = cb.data.split(":", 2)
    reason = _REASONS.get(code, "Noma'lum")
    db = SessionLocal()
    try:
        booking = db.query(Booking).filter(Booking.id == UUID(bid)).first()
        owner = db.query(User).filter(User.telegram_id == cb.from_user.id).first()
        if not booking or not owner:
            await cb.answer("Topilmadi", show_alert=True)
            return
        biz = db.query(Business).filter(Business.id == booking.business_id).first()
        if not biz or biz.owner_id != owner.id:
            await cb.answer("Ruxsat yo'q", show_alert=True)
            return
        booking_service.cancel_booking(db, UUID(bid), biz.id, reason)
        db.commit()

        client = db.query(Client).filter(Client.id == booking.client_id).first()
        svc = db.query(Service).filter(Service.id == booking.service_id).first()
        if client:
            await asyncio.to_thread(
                send_telegram_message,
                int(client.telegram_id),
                f"❌ Yozilishingiz bekor qilindi\n\nSabab: {reason}",
            )
        await cb.message.edit_text("❌ Yozilish rad etildi.")
    finally:
        db.close()
    await cb.answer()
