import asyncio
import logging
from datetime import date, time, timedelta
from uuid import UUID

from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import (
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    Message,
    ReplyKeyboardMarkup,
    ReplyKeyboardRemove,
)

from app.database import SessionLocal
from app.models import Business, Client, PromoCode, Service, Staff, User
from app.models.referral import Referral
from app.schemas.booking import BookingCreatePublic
from app.services import booking_service, waitlist_service
from app.services.notification_service import send_telegram_message
from app.utils.clock import local_today
from app.utils.slots import (
    get_available_slots,
    get_bookings_for_date,
    get_schedule_for_weekday,
    is_holiday,
    next_working_dates,
)
from bot.keyboards.inline import (
    back_to_menu_kb,
    confirm_kb,
    dates_kb,
    owner_decision_kb,
    service_detail_kb,
    services_kb,
    times_kb,
)
from bot.utils import safe_edit_text

logger = logging.getLogger("bot.booking")
router = Router()


class BookingPromoStates(StatesGroup):
    waiting_for_code = State()


class BookingPhoneStates(StatesGroup):
    waiting_for_phone = State()


def _request_contact_kb() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="📞 Telefon yuborish", request_contact=True)]],
        resize_keyboard=True,
        one_time_keyboard=True,
    )


def _client_has_phone(telegram_id: int) -> bool:
    db = SessionLocal()
    try:
        c = db.query(Client).filter(Client.telegram_id == telegram_id).first()
        return bool(c and c.phone and c.phone.strip())
    finally:
        db.close()


def _save_client_phone(telegram_id: int, phone: str, first_name: str = "", last_name: str = "") -> None:
    db = SessionLocal()
    try:
        c = db.query(Client).filter(Client.telegram_id == telegram_id).first()
        if c:
            c.phone = phone
            if first_name and not c.first_name:
                c.first_name = first_name
            if last_name and not c.last_name:
                c.last_name = last_name
        else:
            c = Client(
                telegram_id=telegram_id,
                first_name=first_name or "",
                last_name=last_name or "",
                phone=phone,
            )
            db.add(c)
        db.commit()
    finally:
        db.close()


def _format_uz_date(d: date) -> str:
    months = {
        1: "yan",
        2: "fev",
        3: "mar",
        4: "apr",
        5: "may",
        6: "iyn",
        7: "iyl",
        8: "avg",
        9: "sen",
        10: "okt",
        11: "noy",
        12: "dek",
    }
    today = local_today()
    tomorrow = today + timedelta(days=1)
    if d == today:
        prefix = "Bugun"
    elif d == tomorrow:
        prefix = "Ertaga"
    else:
        prefix = d.strftime("%d")
    return f"{prefix}, {d.day}-{months[d.month]}"


def _format_price(price: int, price_max: int | None) -> str:
    base = f"{int(price):,}".replace(",", " ")
    if price_max and int(price_max) > int(price):
        upper = f"{int(price_max):,}".replace(",", " ")
        return f"{base}–{upper} so'm"
    return f"{base} so'm"


def _service_button_label(s: Service) -> str:
    return f"{s.name} — {_format_price(s.price, s.price_max)} — {s.duration_minutes} daq"


def _service_detail_text(s: Service) -> str:
    lines = [
        f"📋 <b>{s.name}</b>",
        f"💰 {_format_price(s.price, s.price_max)}",
        f"⏱ {s.duration_minutes} daq",
    ]
    desc = (s.description or "").strip()
    if desc:
        lines.append(f"\n📝 {desc}")
    return "\n".join(lines)


@router.callback_query(F.data.startswith("book:"))
async def book_start(cb: CallbackQuery):
    slug = cb.data.split(":", 1)[1]
    db = SessionLocal()
    try:
        b = db.query(Business).filter(Business.slug == slug).first()
        if not b:
            await cb.answer("Topilmadi", show_alert=True)
            return
        services = (
            db.query(Service)
            .filter(Service.business_id == b.id, Service.is_active.is_(True))
            .order_by(Service.order.asc())
            .all()
        )
        items = [(str(s.id), _service_button_label(s)) for s in services]
        if not items:
            await safe_edit_text(
                cb,
                "Xizmatlar hali qo'shilmagan. Iltimos, biznes egasi bilan bog'laning.",
                reply_markup=back_to_menu_kb(slug),
            )
            await cb.answer()
            return
        await safe_edit_text(cb, "Xizmatni tanlang:", reply_markup=services_kb(slug, items))
    finally:
        db.close()
    await cb.answer()


@router.callback_query(F.data.startswith("svc:"))
async def show_service_detail(cb: CallbackQuery):
    _, sid = cb.data.split(":", 1)
    db = SessionLocal()
    try:
        service = db.query(Service).filter(Service.id == UUID(sid)).first()
        b = db.query(Business).filter(Business.id == service.business_id).first() if service else None
        if not b or not service:
            await cb.answer("Topilmadi", show_alert=True)
            return
        await safe_edit_text(
            cb,
            _service_detail_text(service),
            reply_markup=service_detail_kb(b.slug, sid),
        )
    finally:
        db.close()
    await cb.answer()


def _staff_for_service(db, business_id, service_id) -> list[Staff]:
    """Active staff who can perform this service. If at least one is
    explicitly mapped, only those show. Otherwise we fall back to staff
    with no service map at all so the typical case (one barber doing
    everything, owner never bothered to map) needs zero config."""
    rows = (
        db.query(Staff)
        .filter(Staff.business_id == business_id, Staff.is_active.is_(True))
        .order_by(Staff.order.asc(), Staff.name.asc())
        .all()
    )
    explicit = [
        s for s in rows
        if s.services and any(svc.id == service_id for svc in s.services)
    ]
    if explicit:
        return explicit
    return [s for s in rows if not s.services]


def _staff_picker_kb(slug: str, sid: str, staff_list: list[Staff]) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = []
    for s in staff_list:
        rows.append([InlineKeyboardButton(text=f"👤 {s.name}", callback_data=f"stfok:{sid}:{s.id}")])
    rows.append([InlineKeyboardButton(text="🎲 Istalgan mutaxassis", callback_data=f"stfok:{sid}:any")])
    rows.append([InlineKeyboardButton(text="◀️ Xizmatlar", callback_data=f"book:{slug}")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


async def _show_dates(cb: CallbackQuery, db, b: Business, sid: str) -> None:
    days = next_working_dates(db, b.id, 7)
    if not days:
        await cb.answer(
            "Bu biznes hali ish vaqtini sozlamagan. Iltimos, keyinroq urinib ko'ring yoki biznes egasiga murojaat qiling.",
            show_alert=True,
        )
        return
    items = [(d.isoformat(), _format_uz_date(d)) for d in days]
    await safe_edit_text(cb, "Sanani tanlang:", reply_markup=dates_kb(b.slug, sid, items))


@router.callback_query(F.data.startswith("svcok:"))
async def pick_service(cb: CallbackQuery, state: FSMContext):
    _, sid = cb.data.split(":", 1)
    db = SessionLocal()
    try:
        service = db.query(Service).filter(Service.id == UUID(sid)).first()
        b = db.query(Business).filter(Business.id == service.business_id).first() if service else None
        if not b or not service:
            await cb.answer("Topilmadi", show_alert=True)
            return

        # Staff picker — only when the business has staff. Single-resource
        # businesses skip the step and the flow is identical to before.
        staff_list = _staff_for_service(db, b.id, service.id)
        if staff_list:
            await safe_edit_text(
                cb,
                "Mutaxassisni tanlang:",
                reply_markup=_staff_picker_kb(b.slug, sid, staff_list),
            )
            await cb.answer()
            return

        # Legacy single-resource flow.
        await state.update_data(staff_id="")
        await _show_dates(cb, db, b, sid)
    finally:
        db.close()
    await cb.answer()


@router.callback_query(F.data.startswith("stfok:"))
async def pick_staff(cb: CallbackQuery, state: FSMContext):
    parts = cb.data.split(":")
    if len(parts) != 3:
        await cb.answer()
        return
    _, sid, choice = parts
    # staff_id carries through FSM state — every downstream callback
    # (day, time, prom_y/n, confirm) reads it from there. Empty means
    # "any master" which falls back to per-business slot conflict.
    await state.update_data(staff_id="" if choice == "any" else choice)

    db = SessionLocal()
    try:
        service = db.query(Service).filter(Service.id == UUID(sid)).first()
        b = db.query(Business).filter(Business.id == service.business_id).first() if service else None
        if not b or not service:
            await cb.answer("Topilmadi", show_alert=True)
            return
        await _show_dates(cb, db, b, sid)
    finally:
        db.close()
    await cb.answer()


@router.callback_query(F.data.startswith("day:"))
async def pick_day(cb: CallbackQuery):
    _, sid, d_iso = cb.data.split(":", 2)
    d = date.fromisoformat(d_iso)
    db = SessionLocal()
    try:
        service = db.query(Service).filter(Service.id == UUID(sid)).first()
        b = db.query(Business).filter(Business.id == service.business_id).first() if service else None
        if not b or not service:
            await cb.answer("Topilmadi", show_alert=True)
            return
        slots = get_available_slots(b.id, d, service.duration_minutes, db)
        times = [t.strftime("%H:%M") for t in slots]
        if not times:
            sched = get_schedule_for_weekday(db, b.id, d.weekday())
            holiday = is_holiday(db, b.id, d)
            if holiday:
                reason = "bu kun bayram"
            elif not sched:
                reason = "jadval saqlanmagan"
            elif not sched.is_working:
                reason = "dam olish kuni"
            elif sched.start_time >= sched.end_time:
                reason = f"jadval xato: {sched.start_time}-{sched.end_time}"
            else:
                window_min = (
                    sched.end_time.hour * 60 + sched.end_time.minute
                    - sched.start_time.hour * 60 - sched.start_time.minute
                )
                if service.duration_minutes > window_min:
                    reason = (
                        f"xizmat {service.duration_minutes} daq, "
                        f"ish vaqti {window_min} daq"
                    )
                else:
                    reason = "barcha vaqtlar band"
            logger.warning(
                "no slots biz=%s date=%s service=%s(%smin) sched=%s reason=%s",
                b.slug,
                d.isoformat(),
                service.name,
                service.duration_minutes,
                (
                    f"{sched.start_time}-{sched.end_time} working={sched.is_working}"
                    if sched
                    else "MISSING"
                ),
                reason,
            )
            # Every slot booked out (not a holiday / missing schedule): instead
            # of a dead-end alert, offer to waitlist the client. If anything
            # that day cancels, the existing notify_first_for_slot pings them.
            # Recovers demand that would otherwise just walk away.
            if reason == "barcha vaqtlar band":
                wl_kb = InlineKeyboardMarkup(
                    inline_keyboard=[
                        [
                            InlineKeyboardButton(
                                text="🔔 Bo'shaganda xabar bering",
                                callback_data=f"wl:{sid}:{d_iso}",
                            )
                        ],
                        [InlineKeyboardButton(text="🏠 Menyu", callback_data=f"menu:{b.slug}")],
                    ]
                )
                await safe_edit_text(
                    cb,
                    "Bu kuni barcha vaqtlar band 😕\n"
                    "Joy bo'shasa — birinchi bo'lib sizga xabar beraylikmi?",
                    reply_markup=wl_kb,
                )
                await cb.answer()
                return
            await cb.answer(f"Bo'sh vaqt yo'q ({reason})", show_alert=True)
            return
        await safe_edit_text(cb, "Vaqtni tanlang:", reply_markup=times_kb(b.slug, sid, d_iso, times))
    finally:
        db.close()
    await cb.answer()


def _join_waitlist_sync(
    sid: str, d_iso: str, tg_id: int, first_name: str, last_name: str
) -> tuple[int, str | None]:
    """Register the client on the waitlist for every booked slot that day.
    Whichever booking later cancels, notify_first_for_slot (in the cancel
    path) pings the queue head for that exact (service, slot). Idempotent via
    the waitlist unique constraint. Returns (slots_queued, business_slug)."""
    db = SessionLocal()
    try:
        service = db.query(Service).filter(Service.id == UUID(sid)).first()
        if not service:
            return 0, None
        b = db.query(Business).filter(Business.id == service.business_id).first()
        if not b:
            return 0, None
        d = date.fromisoformat(d_iso)
        booked = get_bookings_for_date(db, b.id, d)
        pairs = {(bk.service_id, bk.start_time) for bk in booked}
        for svc_id, start in pairs:
            waitlist_service.join(
                db,
                business_id=b.id,
                service_id=svc_id,
                slot_date=d,
                slot_start=start,
                client_telegram_id=tg_id,
                client_first_name=first_name,
                client_last_name=last_name,
            )
        db.commit()
        return len(pairs), b.slug
    finally:
        db.close()


@router.callback_query(F.data.startswith("wl:"))
async def join_waitlist(cb: CallbackQuery):
    _, sid, d_iso = cb.data.split(":", 2)
    u = cb.from_user
    count, slug = await asyncio.to_thread(
        _join_waitlist_sync,
        sid,
        d_iso,
        u.id,
        u.first_name or "",
        u.last_name or "",
    )
    if count:
        await safe_edit_text(
            cb,
            "🔔 Navbatga qo'shildingiz!\n"
            "Shu kuni biror joy bo'shasa — sizga darhol xabar beramiz.",
            reply_markup=back_to_menu_kb(slug) if slug else None,
        )
        await cb.answer("✅ Qo'shildingiz")
    else:
        await cb.answer("Hozircha kutadigan band vaqt yo'q.", show_alert=True)


def _promo_prompt_kb(slug: str, sid: str, d_iso: str, t_str: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🎟 Promokod kiritish",
                    callback_data=f"prom_y:{sid}:{d_iso}:{t_str}",
                )
            ],
            [
                InlineKeyboardButton(
                    text="➡️ O'tkazib yuborish",
                    callback_data=f"prom_n:{sid}:{d_iso}:{t_str}",
                )
            ],
            [
                InlineKeyboardButton(text="◀️ Vaqtlar", callback_data=f"day:{sid}:{d_iso}"),
                InlineKeyboardButton(text="🏠 Menyu", callback_data=f"menu:{slug}"),
            ],
        ]
    )


def _format_summary(service_name: str, d: date, t_str: str, base_price: int, promo: dict | None) -> str:
    lines = [
        "Yozilishni tasdiqlaysizmi?\n",
        f"📋 {service_name}",
        f"📅 {_format_uz_date(d)}, {t_str}",
    ]
    base_str = f"{base_price:,}".replace(",", " ")
    if promo:
        final = int(promo.get("final_price", base_price))
        final_str = f"{final:,}".replace(",", " ")
        parts = []
        if promo.get("discount_percent"):
            parts.append(f"-{promo['discount_percent']}%")
        if promo.get("discount_amount"):
            disc_str = f"{int(promo['discount_amount']):,}".replace(",", " ")
            parts.append(f"-{disc_str} so'm")
        disc_label = " ".join(parts) if parts else ""
        lines.append(f"🎟 Promokod: <code>{promo['code']}</code> ({disc_label})")
        lines.append(f"💰 <s>{base_str}</s> → <b>{final_str} so'm</b>")
    else:
        lines.append(f"💰 {base_str} so'm")
    return "\n".join(lines)


@router.callback_query(F.data.startswith("time:"))
async def pick_time(cb: CallbackQuery, state: FSMContext):
    _, sid, d_iso, t_str = cb.data.split(":", 3)
    d = date.fromisoformat(d_iso)
    h, m = t_str.split(":")
    _ = time(int(h), int(m))  # validate format
    db = SessionLocal()
    try:
        service = db.query(Service).filter(Service.id == UUID(sid)).first()
        b = db.query(Business).filter(Business.id == service.business_id).first() if service else None
        if not b or not service:
            await cb.answer("Topilmadi", show_alert=True)
            return
        # Reset any previous promo state for a fresh booking attempt, but
        # preserve staff_id (stored when the user picked a master earlier).
        prev_staff_id = str((await state.get_data()).get("staff_id") or "")
        await state.clear()
        if prev_staff_id:
            await state.update_data(staff_id=prev_staff_id)
        text = (
            f"📋 {service.name}\n"
            f"📅 {_format_uz_date(d)}, {t_str}\n"
            f"💰 {service.price:,} so'm\n\nPromokodingiz bormi?".replace(",", " ")
        )
        await safe_edit_text(
            cb,
            text,
            reply_markup=_promo_prompt_kb(b.slug, sid, d_iso, t_str),
        )
    finally:
        db.close()
    await cb.answer()


@router.callback_query(F.data.startswith("prom_n:"))
async def promo_skip(cb: CallbackQuery, state: FSMContext):
    """User chose to skip promo — show standard confirm screen."""
    _, sid, d_iso, t_str = cb.data.split(":", 3)
    d = date.fromisoformat(d_iso)
    db = SessionLocal()
    try:
        service = db.query(Service).filter(Service.id == UUID(sid)).first()
        b = db.query(Business).filter(Business.id == service.business_id).first() if service else None
        if not b or not service:
            await cb.answer("Topilmadi", show_alert=True)
            return
        # Preserve staff_id across the promo-state reset.
        prev_staff_id = str((await state.get_data()).get("staff_id") or "")
        await state.clear()
        if prev_staff_id:
            await state.update_data(staff_id=prev_staff_id)
        await safe_edit_text(
            cb,
            _format_summary(service.name, d, t_str, int(service.price), None),
            reply_markup=confirm_kb(b.slug, sid, d_iso, t_str),
        )
    finally:
        db.close()
    await cb.answer()


@router.callback_query(F.data.startswith("prom_y:"))
async def promo_ask(cb: CallbackQuery, state: FSMContext):
    """User wants to enter a promo code — enter FSM."""
    _, sid, d_iso, t_str = cb.data.split(":", 3)
    db = SessionLocal()
    try:
        service = db.query(Service).filter(Service.id == UUID(sid)).first()
        b = db.query(Business).filter(Business.id == service.business_id).first() if service else None
        if not b or not service:
            await cb.answer("Topilmadi", show_alert=True)
            return
        slug = b.slug
        biz_id = str(b.id)
        base_price = int(service.price)
    finally:
        db.close()

    await state.set_state(BookingPromoStates.waiting_for_code)
    await state.update_data(
        sid=sid,
        d_iso=d_iso,
        t_str=t_str,
        slug=slug,
        biz_id=biz_id,
        base_price=base_price,
    )
    cancel_kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="❌ Bekor qilish", callback_data=f"prom_x:{sid}:{d_iso}:{t_str}")]
        ]
    )
    await safe_edit_text(cb, "🎟 Promokodni yuboring (matn ko'rinishida):", reply_markup=cancel_kb)
    await cb.answer()


@router.callback_query(F.data.startswith("prom_x:"), BookingPromoStates.waiting_for_code)
async def promo_cancel(cb: CallbackQuery, state: FSMContext):
    """User cancelled promo entry — go back to promo prompt."""
    _, sid, d_iso, t_str = cb.data.split(":", 3)
    await state.clear()
    db = SessionLocal()
    try:
        service = db.query(Service).filter(Service.id == UUID(sid)).first()
        b = db.query(Business).filter(Business.id == service.business_id).first() if service else None
        if not b or not service:
            await cb.answer("Topilmadi", show_alert=True)
            return
        d = date.fromisoformat(d_iso)
        text = (
            f"📋 {service.name}\n"
            f"📅 {_format_uz_date(d)}, {t_str}\n"
            f"💰 {service.price:,} so'm\n\nPromokodingiz bormi?".replace(",", " ")
        )
        await safe_edit_text(
            cb,
            text,
            reply_markup=_promo_prompt_kb(b.slug, sid, d_iso, t_str),
        )
    finally:
        db.close()
    await cb.answer()


@router.message(BookingPromoStates.waiting_for_code)
async def promo_received(message: Message, state: FSMContext):
    """User typed a promo code — validate and either retry or move to confirm."""
    data = await state.get_data()
    sid = data.get("sid")
    d_iso = data.get("d_iso")
    t_str = data.get("t_str")
    biz_id = data.get("biz_id")
    base_price = int(data.get("base_price") or 0)
    if not sid or not d_iso or not t_str or not biz_id:
        await state.clear()
        return

    raw = (message.text or "").strip()

    def _validate():
        db = SessionLocal()
        try:
            return booking_service.validate_promo_for_business(db, UUID(biz_id), raw, base_price)
        finally:
            db.close()

    promo = await asyncio.to_thread(_validate)

    if not promo:
        retry_kb = InlineKeyboardMarkup(
            inline_keyboard=[
                [InlineKeyboardButton(text="❌ Bekor qilish", callback_data=f"prom_x:{sid}:{d_iso}:{t_str}")]
            ]
        )
        await message.answer(
            "❌ Promokod noto'g'ri yoki ishlatib bo'lingan. Qayta urinib ko'ring:",
            reply_markup=retry_kb,
        )
        return

    # Save validated promo so confirm: handler can apply it
    await state.update_data(promo_code=promo["code"], promo_info=promo)

    db = SessionLocal()
    try:
        service = db.query(Service).filter(Service.id == UUID(sid)).first()
        b = (
            db.query(Business).filter(Business.id == service.business_id).first()
            if service
            else None
        )
        if not service or not b:
            await message.answer("Xatolik")
            await state.clear()
            return
        d = date.fromisoformat(d_iso)
        text = _format_summary(service.name, d, t_str, base_price, promo)
        await message.answer(text, reply_markup=confirm_kb(b.slug, sid, d_iso, t_str))
    finally:
        db.close()


def _create_booking_sync(
    user_id: int,
    first_name: str,
    last_name: str,
    sid: str,
    d_iso: str,
    t_str: str,
    promo_code: str,
    phone: str,
    staff_id: str = "",
):
    """Synchronous booking creation. Runs in a worker thread."""
    d = date.fromisoformat(d_iso)
    h, m = t_str.split(":")
    t = time(int(h), int(m))
    db = SessionLocal()
    try:
        service = db.query(Service).filter(Service.id == UUID(sid)).first()
        b = db.query(Business).filter(Business.id == service.business_id).first() if service else None
        if not b or not service:
            return None, "Biznes topilmadi"
        # Empty string = "any master" — leave staff_id off the payload
        # so the per-business conflict path (legacy semantics) applies.
        staff_uuid = None
        if staff_id:
            try:
                staff_uuid = UUID(staff_id)
            except ValueError:
                staff_uuid = None
        payload = BookingCreatePublic(
            business_id=b.id,
            service_id=UUID(sid),
            staff_id=staff_uuid,
            client_telegram_id=user_id,
            client_first_name=first_name or "",
            client_last_name=last_name or "",
            client_phone=phone or "",
            date=d,
            start_time=t,
            promo_code=promo_code,
        )
        booking = booking_service.create_booking(db, payload)
        db.commit()

        owner = db.query(User).filter(User.id == b.owner_id).first()
        owner_tg = None
        if owner and owner.telegram_id:
            try:
                owner_tg = int(owner.telegram_id)
            except (TypeError, ValueError):
                owner_tg = None

        # If this booking converted a referral, surface the referrer's reward
        # so the caller can congratulate them (the booking row may have just
        # minted a one-time reward promo code for the referrer).
        referral_reward = None
        try:
            ref = (
                db.query(Referral)
                .filter(Referral.referred_booking_id == booking.id)
                .first()
            )
            if ref is not None and ref.reward_promo_id is not None:
                referrer = (
                    db.query(Client).filter(Client.id == ref.referrer_client_id).first()
                )
                reward = (
                    db.query(PromoCode).filter(PromoCode.id == ref.reward_promo_id).first()
                )
                if referrer and referrer.telegram_id and reward:
                    referral_reward = {
                        "referrer_telegram_id": int(referrer.telegram_id),
                        "reward_code": reward.code,
                        "reward_percent": int(reward.discount_percent or 0),
                    }
        except Exception:
            logger.exception("referral reward lookup failed")

        return (
            {
                "booking_id": str(booking.id),
                "service_name": service.name,
                "service_price": int(service.price),
                "payment_amount": int(booking.payment_amount or 0),
                "promo_code": promo_code,
                "business_name": b.name,
                "business_slug": b.slug,
                "status": str(booking.status),
                "owner_telegram_id": owner_tg,
                "referral_reward": referral_reward,
            },
            None,
        )
    except Exception as e:
        db.rollback()
        logger.exception("create booking failed")
        return None, str(e)
    finally:
        db.close()


def _booking_error_text(err: str | None) -> str:
    raw = str(err or "")
    low = raw.lower()
    if "subscription" in low:
        return "❌ Bu biznes obunasi tugagan. Iltimos, keyinroq urinib ko'ring."
    if "no longer available" in low or "slot" in low:
        return "⏰ Bu vaqt allaqachon band. Iltimos, boshqa vaqt tanlang."
    if "service not found" in low:
        return "❌ Xizmat topilmadi yoki o'chirilgan."
    if "business not found" in low:
        return "❌ Biznes topilmadi."
    return f"❌ Xatolik: {raw}" if raw else "❌ Kutilmagan xatolik."


def _client_display_name(from_user) -> str:
    if from_user.first_name or from_user.last_name:
        return f"{from_user.first_name or ''} {from_user.last_name or ''}".strip()
    if from_user.username:
        return f"@{from_user.username}"
    return "Mijoz"


async def _notify_owner_of_booking(info: dict, d: date, t_str: str, from_user) -> None:
    owner_tg_id = info.get("owner_telegram_id")
    if not owner_tg_id:
        return
    is_confirmed = info["status"].endswith("CONFIRMED")
    suffix = "tasdiqlangan" if is_confirmed else "kutilmoqda (tasdiqlang)"
    paid = info.get("payment_amount", info["service_price"])
    price_fmt = f"{paid:,}".replace(",", " ") + " so'm"
    if info.get("promo_code") and paid != info["service_price"]:
        base_fmt = f"{info['service_price']:,}".replace(",", " ")
        price_fmt = f"<s>{base_fmt}</s> {price_fmt} (promokod: {info['promo_code']})"
    owner_markup = None
    if not is_confirmed:
        owner_markup = owner_decision_kb(info["booking_id"]).model_dump(exclude_none=True)
    try:
        await asyncio.to_thread(
            send_telegram_message,
            owner_tg_id,
            (
                f"🆕 <b>Yangi yozilish</b>\n\n"
                f"👤 {_client_display_name(from_user)}\n"
                f"📋 {info['service_name']}\n"
                f"📅 {_format_uz_date(d)} · {t_str}\n"
                f"💰 {price_fmt}\n\n"
                f"Holati: {suffix}"
            ),
            owner_markup,
        )
    except Exception:
        logger.exception("owner notify failed")


async def _notify_referrer(info: dict) -> None:
    """Congratulate the referrer when their invited friend booked, and hand
    them the reward code to use next time."""
    rr = info.get("referral_reward")
    if not rr:
        return
    try:
        await asyncio.to_thread(
            send_telegram_message,
            rr["referrer_telegram_id"],
            (
                f"🎉 <b>Do'stingiz keldi!</b>\n\n"
                f"Taklifingiz bo'yicha do'stingiz <b>{info['business_name']}</b> ga yozildi.\n"
                f"Sizga sovg'a: keyingi tashrifingizga <b>-{rr['reward_percent']}%</b> chegirma.\n\n"
                f"🎟 Kod: <code>{rr['reward_code']}</code>\n"
                f"(yozilishda promokod sifatida kiriting)"
            ),
            None,
        )
    except Exception:
        logger.exception("referrer notify failed")


def _success_text(info: dict, d: date, t_str: str) -> str:
    is_confirmed = info["status"].endswith("CONFIRMED")
    status_line = (
        "✅ Yozildingiz!"
        if is_confirmed
        else "⏳ So'rov yuborildi — biznes egasi tasdiqlashini kuting."
    )
    return (
        f"{status_line}\n\n"
        f"📋 {info['service_name']}\n"
        f"📅 {_format_uz_date(d)} soat {t_str} da\n"
        f"📍 {info['business_name']}\n\n"
        "🔔 1 soat oldin eslatma yuboramiz"
    )


@router.callback_query(F.data.startswith("confirm:"))
async def confirm_booking(cb: CallbackQuery, state: FSMContext):
    logger.info("confirm_booking: cb.data=%s from_user=%s", cb.data, cb.from_user.id if cb.from_user else None)
    _, sid, d_iso, t_str = cb.data.split(":", 3)
    d = date.fromisoformat(d_iso)

    state_data = await state.get_data()
    promo_code = str(state_data.get("promo_code") or "")
    staff_id = str(state_data.get("staff_id") or "")

    # First booking? Ask the client to share their phone before creating
    # anything — owners need a way to call them, and Telegram-only @username
    # contact is unreliable.
    has_phone = await asyncio.to_thread(_client_has_phone, cb.from_user.id)
    if not has_phone:
        await state.set_state(BookingPhoneStates.waiting_for_phone)
        # Carry staff_id across the phone prompt — state.set_state can wipe
        # unrelated keys on some FSM backends, so we re-stash it here.
        await state.update_data(
            sid=sid, d_iso=d_iso, t_str=t_str, promo_code=promo_code, staff_id=staff_id
        )
        try:
            await cb.message.answer(
                "📱 Birinchi marta yozilyapsiz — telefon raqamingizni yuboring.\n"
                "Biznes egasi siz bilan bog'lanishi uchun kerak.",
                reply_markup=_request_contact_kb(),
            )
        except Exception:
            logger.exception("ask for phone failed")
        await cb.answer()
        return

    await state.clear()
    info, err = await asyncio.to_thread(
        _create_booking_sync,
        cb.from_user.id,
        cb.from_user.first_name or "",
        cb.from_user.last_name or "",
        sid,
        d_iso,
        t_str,
        promo_code,
        "",  # phone already on Client row
        staff_id,
    )
    if info is None:
        await cb.answer(_booking_error_text(err), show_alert=True)
        return

    await safe_edit_text(
        cb,
        _success_text(info, d, t_str),
        reply_markup=back_to_menu_kb(info["business_slug"]),
    )
    try:
        await cb.answer("✅ Yozildingiz")
    except Exception:
        pass
    await _notify_owner_of_booking(info, d, t_str, cb.from_user)
    await _notify_referrer(info)


@router.message(F.contact, BookingPhoneStates.waiting_for_phone)
async def receive_phone_for_booking(message: Message, state: FSMContext):
    contact = message.contact
    if not contact or not contact.phone_number:
        await message.answer(
            "Telefon raqamini ulashishni unutdingiz. Iltimos, tugmadan foydalaning.",
            reply_markup=_request_contact_kb(),
        )
        return
    if contact.user_id and contact.user_id != message.from_user.id:
        await message.answer(
            "❌ Faqat o'zingizning raqamingizni yuboring.",
            reply_markup=_request_contact_kb(),
        )
        return

    phone = contact.phone_number
    if not phone.startswith("+"):
        phone = f"+{phone}"

    await asyncio.to_thread(
        _save_client_phone,
        message.from_user.id,
        phone,
        message.from_user.first_name or "",
        message.from_user.last_name or "",
    )

    data = await state.get_data()
    sid = str(data.get("sid") or "")
    d_iso = str(data.get("d_iso") or "")
    t_str = str(data.get("t_str") or "")
    promo_code = str(data.get("promo_code") or "")
    staff_id = str(data.get("staff_id") or "")
    await state.clear()

    if not sid or not d_iso or not t_str:
        await message.answer(
            "✅ Raqam saqlandi. Yozilishni qaytadan boshlang.",
            reply_markup=ReplyKeyboardRemove(),
        )
        return

    await message.answer("✅ Raqam saqlandi.", reply_markup=ReplyKeyboardRemove())

    info, err = await asyncio.to_thread(
        _create_booking_sync,
        message.from_user.id,
        message.from_user.first_name or "",
        message.from_user.last_name or "",
        sid,
        d_iso,
        t_str,
        promo_code,
        phone,
        staff_id,
    )
    if info is None:
        await message.answer(_booking_error_text(err))
        return

    d = date.fromisoformat(d_iso)
    await message.answer(
        _success_text(info, d, t_str),
        reply_markup=back_to_menu_kb(info["business_slug"]),
    )
    await _notify_owner_of_booking(info, d, t_str, message.from_user)
    await _notify_referrer(info)
