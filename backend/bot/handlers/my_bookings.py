from uuid import UUID

from aiogram import F, Router
from aiogram.filters import Command
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message

from app.database import SessionLocal
from app.models import Booking, BookingStatus, Business, Client, Service
from bot.keyboards.inline import back_to_menu_kb
from bot.utils import safe_edit_text

router = Router()


@router.message(Command("mybookings"))
async def cmd_mybookings(message: Message):
    db = SessionLocal()
    try:
        client = db.query(Client).filter(Client.telegram_id == message.from_user.id).first()
        if not client:
            await message.answer("Hozircha yozilishlar yo'q.")
            return
        bookings = (
            db.query(Booking)
            .filter(
                Booking.client_id == client.id,
                Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED]),
            )
            .order_by(Booking.date.asc(), Booking.start_time.asc())
            .limit(20)
            .all()
        )
        if not bookings:
            await message.answer("Faol yozilishlar yo'q.")
            return
        for b in bookings:
            biz = db.query(Business).filter(Business.id == b.business_id).first()
            svc = db.query(Service).filter(Service.id == b.service_id).first()
            text = (
                f"📍 {biz.name if biz else ''}\n"
                f"📋 {svc.name if svc else ''}\n"
                f"📅 {b.date.isoformat()} {b.start_time.strftime('%H:%M')}\n"
                f"Holat: {b.status}"
            )
            kb = InlineKeyboardMarkup(
                inline_keyboard=[
                    [InlineKeyboardButton(text="Bekor qilish", callback_data=f"cxl:{b.id}")],
                ]
            )
            await message.answer(text, reply_markup=kb)
    finally:
        db.close()


@router.callback_query(F.data.startswith("my:"))
async def my_from_menu(cb: CallbackQuery):
    slug = cb.data.split(":", 1)[1]
    db = SessionLocal()
    try:
        client = db.query(Client).filter(Client.telegram_id == cb.from_user.id).first()
        b = db.query(Business).filter(Business.slug == slug).first()
        if not client or not b:
            await cb.answer("Ma'lumot yo'q", show_alert=True)
            return
        bookings = (
            db.query(Booking)
            .filter(
                Booking.client_id == client.id,
                Booking.business_id == b.id,
                Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED]),
            )
            .order_by(Booking.date.asc())
            .limit(10)
            .all()
        )
        if not bookings:
            await safe_edit_text(
                cb,
                "Bu joyda faol yozilish yo'q.",
                reply_markup=back_to_menu_kb(slug),
            )
            await cb.answer()
            return
        lines = ["📋 <b>Mening yozilishlarim</b>", ""]
        for bk in bookings:
            svc = db.query(Service).filter(Service.id == bk.service_id).first()
            lines.append(f"• {bk.date} {bk.start_time.strftime('%H:%M')} — {svc.name if svc else ''}")
        await safe_edit_text(cb, "\n".join(lines), reply_markup=back_to_menu_kb(slug))
    finally:
        db.close()
    await cb.answer()


@router.callback_query(F.data.startswith("cxl:"))
async def cancel_booking(cb: CallbackQuery):
    bid = cb.data.split(":", 1)[1]
    db = SessionLocal()
    try:
        b = db.query(Booking).filter(Booking.id == UUID(bid)).first()
        client = db.query(Client).filter(Client.telegram_id == cb.from_user.id).first()
        if not b or not client or b.client_id != client.id:
            await cb.answer("Topilmadi", show_alert=True)
            return
        b.status = BookingStatus.CANCELLED
        db.commit()
        await cb.message.edit_text("Yozilish bekor qilindi.")
    finally:
        db.close()
    await cb.answer()
