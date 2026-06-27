from datetime import date, time
from uuid import UUID

from aiogram import F, Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message

from app.database import SessionLocal
from app.models import Booking, BookingStatus, Business, Client, Review, Service
from app.utils.clock import local_today
from app.utils.htmlsafe import h
from app.utils.slots import get_available_slots, next_working_dates
from bot import fun
from bot.keyboards.inline import back_to_menu_kb
from bot.utils import safe_edit_text

router = Router()


class ReviewStates(StatesGroup):
    waiting_for_comment = State()


@router.message(Command("mybookings"))
async def cmd_mybookings(message: Message):
    db = SessionLocal()
    try:
        client = db.query(Client).filter(Client.telegram_id == message.from_user.id).first()
        if not client:
            await message.answer("Hozircha yozilishlar yo'q.")
            return
        active = (
            db.query(Booking)
            .filter(
                Booking.client_id == client.id,
                Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED]),
            )
            .order_by(Booking.date.asc(), Booking.start_time.asc())
            .limit(20)
            .all()
        )
        completed = (
            db.query(Booking)
            .filter(
                Booking.client_id == client.id,
                Booking.status == BookingStatus.COMPLETED,
                Booking.date <= local_today(),
            )
            .order_by(Booking.date.desc(), Booking.start_time.desc())
            .limit(20)
            .all()
        )
        if not active and not completed:
            await message.answer("Faol yozilishlar yo'q.")
            return
        for b in active:
            biz = db.query(Business).filter(Business.id == b.business_id).first()
            svc = db.query(Service).filter(Service.id == b.service_id).first()
            existing = db.query(Review).filter(Review.booking_id == b.id).first()
            text = (
                f"📍 {h(biz.name) if biz else ''}\n"
                f"📋 {h(svc.name) if svc else ''}\n"
                f"📅 {b.date.isoformat()} {b.start_time.strftime('%H:%M')}\n"
                f"Holat: {h(b.status)}"
            )
            if existing:
                text += f"\nSizning bahoyingiz: {'⭐' * existing.rating}"
            review_label = "✏️ Bahoni o'zgartirish" if existing else "⭐ Baho berish"
            kb = InlineKeyboardMarkup(
                inline_keyboard=[
                    [InlineKeyboardButton(text=review_label, callback_data=f"rev:{b.id}")],
                    [InlineKeyboardButton(text="🔄 Vaqtni o'zgartirish", callback_data=f"resc:{b.id}")],
                    [InlineKeyboardButton(text="Bekor qilish", callback_data=f"cxl:{b.id}")],
                ]
            )
            await message.answer(text, reply_markup=kb)
        for b in completed:
            biz = db.query(Business).filter(Business.id == b.business_id).first()
            svc = db.query(Service).filter(Service.id == b.service_id).first()
            existing = db.query(Review).filter(Review.booking_id == b.id).first()
            label = "✏️ Bahoni o'zgartirish" if existing else "⭐ Baho berish"
            text = (
                f"✅ <b>Tashrif yakunlandi</b>\n"
                f"📍 {h(biz.name) if biz else ''}\n"
                f"📋 {h(svc.name) if svc else ''}\n"
                f"📅 {b.date.isoformat()} {b.start_time.strftime('%H:%M')}"
            )
            if existing:
                text += f"\nSizning bahoyingiz: {'⭐' * existing.rating}"
            kb = InlineKeyboardMarkup(
                inline_keyboard=[
                    [InlineKeyboardButton(text=label, callback_data=f"rev:{b.id}")],
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
            lines.append(f"• {bk.date} {bk.start_time.strftime('%H:%M')} — {h(svc.name) if svc else ''}")
        await safe_edit_text(cb, "\n".join(lines), reply_markup=back_to_menu_kb(slug))
    finally:
        db.close()
    await cb.answer()


def _stars_kb(booking_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="⭐" * n, callback_data=f"rate:{booking_id}:{n}")]
            for n in (5, 4, 3, 2, 1)
        ]
    )


def _stars_standalone_kb(slug: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="⭐" * n, callback_data=f"srate:{slug}:{n}")]
            for n in (5, 4, 3, 2, 1)
        ]
    )


@router.callback_query(F.data.startswith("qrevs:"))
async def start_standalone_review(cb: CallbackQuery, state: FSMContext):
    """Open the stars keyboard for a review that isn't tied to a booking."""
    slug = cb.data.split(":", 1)[1]
    db = SessionLocal()
    try:
        biz = db.query(Business).filter(Business.slug == slug, Business.is_active.is_(True)).first()
        if not biz:
            await cb.answer("Biznes topilmadi", show_alert=True)
            return
    finally:
        db.close()
    await state.clear()
    await cb.message.answer(
        "Bahoyingizni tanlang:", reply_markup=_stars_standalone_kb(slug)
    )
    await cb.answer()


@router.callback_query(F.data.startswith("srate:"))
async def receive_standalone_rating(cb: CallbackQuery, state: FSMContext):
    parts = cb.data.split(":")
    if len(parts) != 3:
        await cb.answer()
        return
    slug, rating_s = parts[1], parts[2]
    try:
        rating = int(rating_s)
    except ValueError:
        await cb.answer()
        return
    if not 1 <= rating <= 5:
        await cb.answer()
        return

    await state.set_state(ReviewStates.waiting_for_comment)
    await state.update_data(business_slug=slug, rating=rating)

    skip_kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="Izohsiz yuborish", callback_data="rev_skip")]
        ]
    )
    await cb.message.edit_text(
        f"Bahoyingiz: {'⭐' * rating}\n\nIzohingizni yozib yuboring (ixtiyoriy):",
        reply_markup=skip_kb,
    )
    await cb.answer()


@router.callback_query(F.data.startswith("rev:"))
async def start_review(cb: CallbackQuery, state: FSMContext):
    bid = cb.data.split(":", 1)[1]
    db = SessionLocal()
    try:
        booking = db.query(Booking).filter(Booking.id == UUID(bid)).first()
        client = db.query(Client).filter(Client.telegram_id == cb.from_user.id).first()
        if not booking or not client or booking.client_id != client.id:
            await cb.answer("Topilmadi", show_alert=True)
            return
        if booking.status == BookingStatus.CANCELLED:
            await cb.answer("Yozilish bekor qilingan", show_alert=True)
            return
    finally:
        db.close()

    await state.clear()
    await cb.message.answer("Bahoyingizni tanlang:", reply_markup=_stars_kb(bid))
    await cb.answer()


@router.callback_query(F.data.startswith("rate:"))
async def receive_rating(cb: CallbackQuery, state: FSMContext):
    parts = cb.data.split(":")
    if len(parts) != 3:
        await cb.answer()
        return
    bid, rating_s = parts[1], parts[2]
    try:
        rating = int(rating_s)
    except ValueError:
        await cb.answer()
        return
    if not 1 <= rating <= 5:
        await cb.answer()
        return

    await state.set_state(ReviewStates.waiting_for_comment)
    await state.update_data(booking_id=bid, rating=rating)

    skip_kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="Izohsiz yuborish", callback_data="rev_skip")]
        ]
    )
    await cb.message.edit_text(
        f"Bahoyingiz: {'⭐' * rating}\n\nIzohingizni yozib yuboring (ixtiyoriy):",
        reply_markup=skip_kb,
    )
    await cb.answer()


@router.callback_query(F.data == "rev_skip", ReviewStates.waiting_for_comment)
async def skip_comment(cb: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    rating = int(data.get("rating") or 0)
    saved = _save_review_from_state(data, cb.from_user.id, "")
    await state.clear()
    if saved:
        # Rating-aware thanks: celebrate a high score, own a low one.
        await cb.message.edit_text(fun.review_thanks(rating))
        if rating >= 5:
            await fun.celebrate(cb.message, "🎯")
    else:
        await cb.message.edit_text("Bahoni saqlab bo'lmadi.")
    await cb.answer()


@router.message(ReviewStates.waiting_for_comment)
async def receive_comment(message: Message, state: FSMContext):
    data = await state.get_data()
    rating = int(data.get("rating") or 0)
    comment = (message.text or "").strip()[:2000]
    saved = _save_review_from_state(data, message.from_user.id, comment)
    await state.clear()
    if saved:
        await message.answer(fun.review_thanks(rating))
        # React on the user's own comment + a darts roll for a perfect score.
        if rating >= 4:
            # Bare U+2764 (no VS-16) — Telegram's reaction set rejects "❤️".
            await fun.react(message.bot, message.chat.id, message.message_id, "❤")
        if rating >= 5:
            await fun.celebrate(message, "🎯")
    else:
        await message.answer("Bahoni saqlab bo'lmadi.")


def _save_review_from_state(data: dict, telegram_id: int, comment: str) -> bool:
    rating = data.get("rating")
    if not rating:
        return False
    bid = data.get("booking_id")
    slug = data.get("business_slug")
    if not bid and not slug:
        return False
    db = SessionLocal()
    try:
        if bid:
            booking = db.query(Booking).filter(Booking.id == UUID(bid)).first()
            client = (
                db.query(Client).filter(Client.telegram_id == telegram_id).first()
            )
            if not booking or not client or booking.client_id != client.id:
                return False
            if booking.status == BookingStatus.CANCELLED:
                return False
            existing = (
                db.query(Review).filter(Review.booking_id == booking.id).first()
            )
            if existing:
                existing.rating = rating
                existing.comment = comment
            else:
                db.add(
                    Review(
                        business_id=booking.business_id,
                        booking_id=booking.id,
                        client_id=booking.client_id,
                        rating=rating,
                        comment=comment,
                    )
                )
            db.commit()
            return True

        # Standalone path: rating without a specific booking.
        biz = db.query(Business).filter(Business.slug == slug).first()
        if not biz:
            return False
        client = db.query(Client).filter(Client.telegram_id == telegram_id).first()
        if not client:
            # Clients usually come from a booking; for standalone reviews we
            # auto-create a minimal record so the review has an author.
            client = Client(telegram_id=telegram_id)
            db.add(client)
            db.flush()
        existing = (
            db.query(Review)
            .filter(
                Review.business_id == biz.id,
                Review.client_id == client.id,
                Review.booking_id.is_(None),
            )
            .first()
        )
        if existing:
            existing.rating = rating
            existing.comment = comment
        else:
            db.add(
                Review(
                    business_id=biz.id,
                    booking_id=None,
                    client_id=client.id,
                    rating=rating,
                    comment=comment,
                )
            )
        db.commit()
        return True
    finally:
        db.close()


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
        # Route through the service so cancel-window policy is applied
        # (flips late_cancel=True when within business.cancel_window_hours).
        from app.services.booking_service import cancel_booking as _cancel_service

        _cancel_service(db, b.id, b.business_id, reason="", by_client=True)
        db.commit()
        await cb.message.edit_text(fun.pick(fun.CANCEL_DONE))
    finally:
        db.close()
    await cb.answer()


def _own_active_booking(db, bid: str, telegram_id: int) -> Booking | None:
    b = db.query(Booking).filter(Booking.id == UUID(bid)).first()
    client = db.query(Client).filter(Client.telegram_id == telegram_id).first()
    if not b or not client or b.client_id != client.id:
        return None
    if b.status not in (BookingStatus.PENDING, BookingStatus.CONFIRMED):
        return None
    return b


@router.callback_query(F.data.startswith("resc:"))
async def reschedule_pick_day(cb: CallbackQuery):
    bid = cb.data.split(":", 1)[1]
    db = SessionLocal()
    try:
        b = _own_active_booking(db, bid, cb.from_user.id)
        if not b:
            await cb.answer("O'zgartirib bo'lmaydi", show_alert=True)
            return
        dates = next_working_dates(db, b.business_id, count=7)
        rows = [
            [InlineKeyboardButton(text=d.isoformat(), callback_data=f"rday:{bid}:{d.isoformat()}")]
            for d in dates
        ]
        if not rows:
            await cb.answer("Bo'sh kun yo'q", show_alert=True)
            return
        await safe_edit_text(
            cb, "Yangi sanani tanlang:", reply_markup=InlineKeyboardMarkup(inline_keyboard=rows)
        )
    finally:
        db.close()
    await cb.answer()


@router.callback_query(F.data.startswith("rday:"))
async def reschedule_pick_time(cb: CallbackQuery):
    _, bid, d_iso = cb.data.split(":", 2)
    db = SessionLocal()
    try:
        b = _own_active_booking(db, bid, cb.from_user.id)
        if not b:
            await cb.answer("O'zgartirib bo'lmaydi", show_alert=True)
            return
        svc = db.query(Service).filter(Service.id == b.service_id).first()
        dur = svc.duration_minutes if svc else 30
        slots = get_available_slots(b.business_id, date.fromisoformat(d_iso), dur, db)
        if not slots:
            await cb.answer("Bu kunda bo'sh vaqt yo'q", show_alert=True)
            return
        rows: list[list[InlineKeyboardButton]] = []
        row: list[InlineKeyboardButton] = []
        for t in slots:
            ts = t.strftime("%H:%M")  # slots are time objects → "HH:MM"
            row.append(InlineKeyboardButton(text=ts, callback_data=f"rtime:{bid}:{d_iso}:{ts}"))
            if len(row) == 3:
                rows.append(row)
                row = []
        if row:
            rows.append(row)
        rows.append([InlineKeyboardButton(text="◀️ Sanalar", callback_data=f"resc:{bid}")])
        await safe_edit_text(
            cb, "Yangi vaqtni tanlang:", reply_markup=InlineKeyboardMarkup(inline_keyboard=rows)
        )
    finally:
        db.close()
    await cb.answer()


@router.callback_query(F.data.startswith("rtime:"))
async def reschedule_apply(cb: CallbackQuery):
    _, bid, d_iso, t_str = cb.data.split(":", 3)
    db = SessionLocal()
    try:
        from app.services.booking_service import reschedule_booking

        hh, mm = t_str.split(":")
        try:
            reschedule_booking(
                db,
                UUID(bid),
                date.fromisoformat(d_iso),
                time(int(hh), int(mm)),
                client_telegram_id=cb.from_user.id,
            )
            db.commit()
        except ValueError:
            db.rollback()
            await cb.answer("Bu vaqt band yoki o'zgartirib bo'lmaydi", show_alert=True)
            return
        await cb.message.edit_text(
            fun.pick(fun.RESCHEDULE_DONE).format(when=f"{d_iso} {t_str}")
        )
    finally:
        db.close()
    await cb.answer()
