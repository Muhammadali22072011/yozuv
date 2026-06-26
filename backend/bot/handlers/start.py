import logging

from aiogram import F, Router
from aiogram.filters import Command, CommandObject
from aiogram.types import (
    BufferedInputFile,
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
    WebAppInfo,
)
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import SessionLocal
from app.services import blob_store
from app.models import Booking, BookingStatus, Business, Client, Review, Service, User
from app.models.enums import BusinessCategory
from app.services import referral_service
from app.utils.clock import local_today
from app.utils.htmlsafe import h
from app.utils.uz_geo import list_tumans, list_viloyats
from bot.keyboards.inline import back_to_menu_kb, business_menu_kb, role_choice_kb
from bot.utils import safe_edit_text

logger = logging.getLogger("bot.start")


def _logo_blob(db: Session, logo_url: str):
    """Fetch the logo bytes for this business from the DB blob store, so we can
    send them via BufferedInputFile (no internal URL exposed to Telegram, works
    even before the API is publicly reachable). None if there's no logo."""
    key = blob_store.key_from_url(logo_url, "/api/business/logos/")
    if not key:
        return None
    return blob_store.get_blob(db, key)

router = Router()
settings = get_settings()


def _referral_on(b: Business) -> bool:
    """Show the 'invite a friend' button only when the program is live."""
    return bool(getattr(b, "referral_enabled", False) and int(getattr(b, "referral_friend_percent", 0) or 0) > 0)


def _get_or_create_client(db: Session, tg_id: int, first_name: str, last_name: str) -> Client:
    c = db.query(Client).filter(Client.telegram_id == tg_id).first()
    if c:
        return c
    c = Client(telegram_id=tg_id, first_name=first_name or "", last_name=last_name or "")
    db.add(c)
    db.flush()
    return c


def _user_can_review(db: Session, business_id, telegram_id: int | None) -> bool:
    """True if this user has any past COMPLETED booking in the business."""
    if not telegram_id:
        return False
    client = db.query(Client).filter(Client.telegram_id == telegram_id).first()
    if not client:
        return False
    exists = (
        db.query(Booking.id)
        .filter(
            Booking.client_id == client.id,
            Booking.business_id == business_id,
            Booking.status == BookingStatus.COMPLETED,
            Booking.date <= local_today(),
        )
        .first()
    )
    return exists is not None


def _owner_kb() -> InlineKeyboardMarkup:
    app_url = settings.public_app_url
    rows: list[list[InlineKeyboardButton]] = []
    if app_url.startswith("https://"):
        rows.append(
            [InlineKeyboardButton(text="🚀 Kabinetni ochish", web_app=WebAppInfo(url=f"{app_url}/dashboard"))]
        )
    rows.append(
        [InlineKeyboardButton(text="🔎 Biznes qidirish", callback_data="role:client")]
    )
    return InlineKeyboardMarkup(inline_keyboard=rows)


@router.message(Command("start"))
async def cmd_start(message: Message, command: CommandObject | None = None):
    db = SessionLocal()
    try:
        arg = (command.args or "").strip() if command else ""
        if arg.startswith("ref_"):
            await _open_via_referral(message, db, arg[len("ref_"):])
            return
        if arg:
            b = db.query(Business).filter(Business.slug == arg, Business.is_active.is_(True)).first()
            if not b:
                await message.answer("Biznes topilmadi.")
                return
            # welcome_text is owner-supplied free text. Anything we drop
            # straight into HTML mode lets the owner inject <a href="..."> and
            # phish their own clients, so escape it before using.
            welcome = h(b.welcome_text).strip() if b.welcome_text else ""
            text = welcome or f"Xush kelibsiz! <b>{h(b.name)}</b>\n\nQuyidagilardan tanlang:"
            tg_id = message.from_user.id if message.from_user else None
            is_owner = False
            if tg_id:
                owner = db.query(User).filter(User.id == b.owner_id).first()
                is_owner = bool(owner and owner.telegram_id == tg_id)
            # Send the business logo first (if any) as a separate photo so the
            # text+menu below stays editable for subsequent navigation steps.
            logo = _logo_blob(db, b.logo_url)
            if logo is not None:
                try:
                    await message.answer_photo(
                        BufferedInputFile(logo.data, filename=logo.key)
                    )
                except Exception:
                    logger.exception("send logo failed for biz=%s", b.slug)
            await message.answer(
                text,
                reply_markup=business_menu_kb(
                    b.slug,
                    owner_view=is_owner,
                    app_url=settings.public_app_url,
                    can_review=True,
                    referral_on=_referral_on(b),
                ),
            )
            return

        tg_id = message.from_user.id if message.from_user else None
        if tg_id:
            user = db.query(User).filter(User.telegram_id == tg_id).first()
            if user:
                biz = db.query(Business).filter(Business.owner_id == user.id).first()
                if biz:
                    await message.answer(
                        f"👋 Salom, <b>{h(user.first_name or 'usta')}</b>!\n"
                        f"Biznesingiz: <b>{h(biz.name)}</b>\n"
                        f"Mijozlar havolasi: <code>t.me/{(await message.bot.me()).username}?start={biz.slug}</code>",
                        reply_markup=_owner_kb(),
                    )
                    return

        await message.answer(
            "Siz biznes egasimi yoki mijozmi?",
            reply_markup=role_choice_kb(),
        )
    finally:
        db.close()


@router.callback_query(F.data == "role:owner")
async def role_owner(cb: CallbackQuery):
    app_url = settings.public_app_url
    if app_url.startswith("https://"):
        await cb.message.edit_text(
            "Kabinetga kiring va biznesingizni 2 daqiqada sozlang.",
            reply_markup=_owner_kb(),
        )
    else:
        await cb.message.edit_text(
            "Kabinet hozircha mavjud emas. Admin bilan bog'laning."
        )
    await cb.answer()


_CAT_ICON = {
    "barbershop": "💈",
    "salon": "💇",
    "dentist": "🦷",
    "tutor": "📚",
    "photo": "📸",
    "massage": "💆",
    "fitness": "🏋",
    "clinic": "⚕️",
    "other": "📦",
}
_CAT_LABEL = {
    "barbershop": "Barbershop",
    "salon": "Salon",
    "dentist": "Stomatologiya",
    "tutor": "Repetitor",
    "photo": "Fotograf",
    "massage": "Massaj",
    "fitness": "Fitness",
    "clinic": "Klinika",
    "other": "Boshqa",
}
_CATEGORY_VALUES = [c.value for c in BusinessCategory]


def _two_col(buttons: list[InlineKeyboardButton]) -> list[list[InlineKeyboardButton]]:
    rows: list[list[InlineKeyboardButton]] = []
    for i in range(0, len(buttons), 2):
        rows.append(buttons[i : i + 2])
    return rows


@router.callback_query(F.data == "role:client")
async def role_client(cb: CallbackQuery):
    viloyats = list_viloyats()
    btns = [
        InlineKeyboardButton(text=v, callback_data=f"flt:t:{i}")
        for i, v in enumerate(viloyats)
    ]
    rows = _two_col(btns)
    rows.append(
        [InlineKeyboardButton(text="🌍 Hammasi (viloyat tanlamasdan)", callback_data="flt:t:any")]
    )
    await safe_edit_text(
        cb,
        "Qaysi viloyatda izlaysiz?",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=rows),
    )
    await cb.answer()


@router.callback_query(F.data.startswith("flt:t:"))
async def filter_pick_tuman(cb: CallbackQuery):
    v = cb.data.split(":", 2)[2]
    if v == "any":
        # Skip tuman, go straight to category with v=any, t=any
        await _show_categories(cb, "any", "any")
        await cb.answer()
        return
    try:
        vidx = int(v)
        viloyat = list_viloyats()[vidx]
    except (ValueError, IndexError):
        await cb.answer("Xato", show_alert=True)
        return
    tumans = list_tumans(viloyat)
    btns = [
        InlineKeyboardButton(text=t, callback_data=f"flt:c:{vidx}:{i}")
        for i, t in enumerate(tumans)
    ]
    rows = _two_col(btns)
    rows.append(
        [InlineKeyboardButton(text="🌍 Tumanni tanlamasdan", callback_data=f"flt:c:{vidx}:any")]
    )
    rows.append([InlineKeyboardButton(text="◀️ Orqaga", callback_data="role:client")])
    await safe_edit_text(
        cb,
        f"<b>{viloyat}</b>\nQaysi tuman/shaharda?",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=rows),
    )
    await cb.answer()


async def _show_categories(cb: CallbackQuery, v: str, t: str):
    btns = [
        InlineKeyboardButton(
            text=f"{_CAT_ICON.get(c, '📦')} {_CAT_LABEL.get(c, c)}",
            callback_data=f"flt:r:{v}:{t}:{i}",
        )
        for i, c in enumerate(_CATEGORY_VALUES)
    ]
    rows = _two_col(btns)
    rows.append(
        [InlineKeyboardButton(text="🌍 Barcha kategoriyalar", callback_data=f"flt:r:{v}:{t}:any")]
    )
    back_data = f"flt:t:{v}" if v != "any" else "role:client"
    rows.append([InlineKeyboardButton(text="◀️ Orqaga", callback_data=back_data)])
    await safe_edit_text(
        cb,
        "Kategoriya tanlang:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=rows),
    )


@router.callback_query(F.data.startswith("flt:c:"))
async def filter_pick_category(cb: CallbackQuery):
    parts = cb.data.split(":")
    if len(parts) != 4:
        await cb.answer()
        return
    v, t = parts[2], parts[3]
    await _show_categories(cb, v, t)
    await cb.answer()


@router.callback_query(F.data.startswith("flt:r:"))
async def filter_results(cb: CallbackQuery):
    parts = cb.data.split(":")
    if len(parts) != 5:
        await cb.answer()
        return
    v, t, c = parts[2], parts[3], parts[4]

    viloyat: str | None = None
    tuman: str | None = None
    category_value: str | None = None
    if v != "any":
        try:
            viloyat = list_viloyats()[int(v)]
        except (ValueError, IndexError):
            viloyat = None
    if t != "any" and viloyat:
        try:
            tuman = list_tumans(viloyat)[int(t)]
        except (ValueError, IndexError):
            tuman = None
    if c != "any":
        try:
            category_value = _CATEGORY_VALUES[int(c)]
        except (ValueError, IndexError):
            category_value = None

    db = SessionLocal()
    try:
        q = db.query(Business).filter(Business.is_active.is_(True))
        if viloyat:
            q = q.filter(Business.viloyat == viloyat)
        if tuman:
            q = q.filter(Business.tuman == tuman)
        if category_value:
            q = q.filter(Business.category == category_value)
        items = q.order_by(Business.name.asc()).limit(30).all()

        if not items:
            await safe_edit_text(
                cb,
                "Bunday filtr bo'yicha biznes topilmadi.",
                reply_markup=InlineKeyboardMarkup(
                    inline_keyboard=[
                        [InlineKeyboardButton(text="◀️ Filtrni o'zgartirish", callback_data="role:client")],
                    ]
                ),
            )
            await cb.answer()
            return

        biz_ids = [b.id for b in items]
        rating_rows = (
            db.query(
                Review.business_id,
                func.coalesce(func.avg(Review.rating), 0).label("avg"),
                func.count(Review.id).label("cnt"),
            )
            .filter(Review.business_id.in_(biz_ids))
            .group_by(Review.business_id)
            .all()
        )
        ratings = {r.business_id: (float(r.avg or 0), int(r.cnt or 0)) for r in rating_rows}

        # Sort by rating desc when category is picked, otherwise alphabetical
        if category_value:
            items.sort(
                key=lambda b: (-ratings.get(b.id, (0.0, 0))[0], b.name.lower())
            )

        bot_username = (await cb.bot.me()).username
        rows: list[list[InlineKeyboardButton]] = []
        for b in items:
            avg, cnt = ratings.get(b.id, (0.0, 0))
            star = f" ⭐{avg:.1f}" if cnt else ""
            cat_icon = _CAT_ICON.get(str(b.category), "📦")
            label = f"{cat_icon} {b.name}{star}"
            if len(label) > 60:
                label = label[:57] + "…"
            rows.append(
                [
                    InlineKeyboardButton(
                        text=label,
                        url=f"https://t.me/{bot_username}?start={b.slug}",
                    )
                ]
            )
        rows.append([InlineKeyboardButton(text="◀️ Filtrni o'zgartirish", callback_data="role:client")])

        header_parts = []
        if viloyat:
            header_parts.append(viloyat)
        if tuman:
            header_parts.append(tuman)
        if category_value:
            header_parts.append(_CAT_LABEL.get(category_value, category_value))
        header = " · ".join(header_parts) if header_parts else "Hammasi"
        await safe_edit_text(
            cb,
            f"<b>{header}</b>\nTopildi: {len(items)} ta",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=rows),
        )
    finally:
        db.close()
    await cb.answer()


@router.callback_query(F.data.startswith("contacts:"))
async def contacts(cb: CallbackQuery):
    slug = cb.data.split(":", 1)[1]
    db = SessionLocal()
    try:
        b = db.query(Business).filter(Business.slug == slug).first()
        if not b:
            await cb.answer("Topilmadi", show_alert=True)
            return
        phone = h(b.phone) or "—"
        address = h(b.address) or "—"
        await safe_edit_text(
            cb,
            f"📞 {phone}\n📍 {address}",
            reply_markup=back_to_menu_kb(slug),
        )
    finally:
        db.close()
    await cb.answer()


@router.callback_query(F.data.startswith("menu:"))
async def back_to_menu(cb: CallbackQuery):
    """Return user to the business main menu from any terminal screen."""
    slug = cb.data.split(":", 1)[1]
    db = SessionLocal()
    try:
        b = db.query(Business).filter(Business.slug == slug, Business.is_active.is_(True)).first()
        if not b:
            await cb.answer("Biznes topilmadi", show_alert=True)
            return
        welcome = h(b.welcome_text).strip() if b.welcome_text else ""
        text = welcome or f"Xush kelibsiz! <b>{h(b.name)}</b>\n\nQuyidagilardan tanlang:"
        tg_id = cb.from_user.id if cb.from_user else None
        is_owner = False
        if tg_id:
            owner = db.query(User).filter(User.id == b.owner_id).first()
            is_owner = bool(owner and owner.telegram_id == tg_id)
        await safe_edit_text(
            cb,
            text,
            reply_markup=business_menu_kb(
                b.slug,
                owner_view=is_owner,
                app_url=settings.public_app_url,
                can_review=True,
                referral_on=_referral_on(b),
            ),
        )
    finally:
        db.close()
    await cb.answer()


async def _open_via_referral(message: Message, db: Session, code: str) -> None:
    """A friend tapped a t.me/<bot>?start=ref_<CODE> link. Register the
    pending referral (so their first booking is discounted) and drop them on
    the business menu with a banner about the welcome discount."""
    rc = referral_service.resolve_referral_code(db, code)
    if not rc:
        await message.answer("Havola eskirgan yoki noto'g'ri.")
        return
    b = db.query(Business).filter(Business.id == rc.business_id, Business.is_active.is_(True)).first()
    if not b:
        await message.answer("Biznes topilmadi.")
        return

    banner = ""
    tg_id = message.from_user.id if message.from_user else None
    if tg_id and b.referral_enabled:
        friend = _get_or_create_client(
            db,
            tg_id,
            message.from_user.first_name if message.from_user else "",
            message.from_user.last_name if message.from_user else "",
        )
        ref = referral_service.register_pending_referral(db, rc, friend)
        db.commit()
        fp = int(b.referral_friend_percent or 0)
        if ref is not None and ref.status.value == "PENDING" and fp > 0:
            banner = (
                f"🎁 <b>Do'st taklifi!</b> Birinchi yozilishingizga "
                f"<b>-{fp}%</b> chegirma.\n\n"
            )

    welcome = h(b.welcome_text).strip() if b.welcome_text else ""
    text = banner + (welcome or f"Xush kelibsiz! <b>{h(b.name)}</b>\n\nQuyidagilardan tanlang:")
    logo_path = _logo_local_path(b.logo_url)
    if logo_path is not None:
        try:
            await message.answer_photo(FSInputFile(str(logo_path)))
        except Exception:
            logger.exception("send logo failed for biz=%s", b.slug)
    await message.answer(
        text,
        reply_markup=business_menu_kb(
            b.slug,
            owner_view=False,
            app_url=settings.public_app_url,
            can_review=True,
            referral_on=_referral_on(b),
        ),
    )


@router.callback_query(F.data.startswith("ref:"))
async def show_referral(cb: CallbackQuery):
    """Client tapped 'invite a friend' — show their personal link, stats and
    any reward codes they've earned."""
    slug = cb.data.split(":", 1)[1]
    db = SessionLocal()
    try:
        b = db.query(Business).filter(Business.slug == slug, Business.is_active.is_(True)).first()
        if not b or not _referral_on(b):
            await cb.answer("Bu xizmat hozircha faol emas.", show_alert=True)
            return
        tg_id = cb.from_user.id if cb.from_user else None
        if not tg_id:
            await cb.answer()
            return
        client = _get_or_create_client(
            db, tg_id, cb.from_user.first_name or "", cb.from_user.last_name or ""
        )
        summary = referral_service.referral_summary_for_client(db, b.id, client.id)
        db.commit()

        bot_username = (await cb.bot.me()).username
        link = f"https://t.me/{bot_username}?start=ref_{summary['code']}"
        fp = int(b.referral_friend_percent or 0)
        rp = int(b.referral_reward_percent or 0)

        lines = [
            "🎁 <b>Do'stni taklif qiling!</b>\n",
            f"Do'stingiz birinchi yozilishga <b>-{fp}%</b> oladi.",
        ]
        if rp > 0:
            lines.append(f"U kelganda — siz keyingi tashrifga <b>-{rp}%</b> sovg'a olasiz.")
        lines.append(f"\n🔗 Havolangiz:\n{link}\n")
        lines.append(
            f"👥 Takliflar: <b>{summary['invited']}</b> · "
            f"✅ Kelganlar: <b>{summary['completed']}</b>"
        )
        if summary["rewards"]:
            codes = ", ".join(
                f"<code>{r['code']}</code> (-{r['discount_percent']}%)" for r in summary["rewards"]
            )
            lines.append(f"\n🏆 Sovg'a kodlaringiz: {codes}\n(yozilishda kiriting)")

        await safe_edit_text(cb, "\n".join(lines), reply_markup=back_to_menu_kb(slug))
    finally:
        db.close()
    await cb.answer()


@router.callback_query(F.data.startswith("qrev:"))
async def qr_review_pick_booking(cb: CallbackQuery):
    """Show COMPLETED bookings of this user in this business plus a
    ``standalone`` option so a client can rate even without a visit."""
    slug = cb.data.split(":", 1)[1]
    db = SessionLocal()
    try:
        b = db.query(Business).filter(Business.slug == slug, Business.is_active.is_(True)).first()
        if not b:
            await cb.answer("Biznes topilmadi", show_alert=True)
            return
        tg_id = cb.from_user.id if cb.from_user else None
        client = (
            db.query(Client).filter(Client.telegram_id == tg_id).first()
            if tg_id
            else None
        )
        bookings = []
        if client:
            bookings = (
                db.query(Booking)
                .filter(
                    Booking.client_id == client.id,
                    Booking.business_id == b.id,
                    Booking.status == BookingStatus.COMPLETED,
                    Booking.date <= local_today(),
                )
                .order_by(Booking.date.desc(), Booking.start_time.desc())
                .limit(10)
                .all()
            )

        rows: list[list[InlineKeyboardButton]] = []
        for bk in bookings:
            svc = db.query(Service).filter(Service.id == bk.service_id).first()
            existing = db.query(Review).filter(Review.booking_id == bk.id).first()
            star = f" ({'⭐' * existing.rating})" if existing else ""
            label = f"{bk.date.isoformat()} · {svc.name if svc else 'Xizmat'}{star}"
            if len(label) > 60:
                label = label[:57] + "…"
            rows.append(
                [InlineKeyboardButton(text=label, callback_data=f"rev:{bk.id}")]
            )

        # Standalone review: the client rates the business without tying it
        # to a specific past visit. One per (business, client).
        existing_standalone = None
        if client:
            existing_standalone = (
                db.query(Review)
                .filter(
                    Review.business_id == b.id,
                    Review.client_id == client.id,
                    Review.booking_id.is_(None),
                )
                .first()
            )
        sa_label = (
            f"💬 Umumiy baho ({'⭐' * existing_standalone.rating})"
            if existing_standalone
            else "💬 Umumiy baho berish"
        )
        rows.append(
            [InlineKeyboardButton(text=sa_label, callback_data=f"qrevs:{slug}")]
        )
        rows.append([InlineKeyboardButton(text="🏠 Bosh menyu", callback_data=f"menu:{slug}")])

        prompt = (
            f"<b>{h(b.name)}</b>\nQaysi tashrifga baho berasiz?"
            if bookings
            else f"<b>{h(b.name)}</b>\nXohlasangiz biznesga umumiy baho qoldiring:"
        )
        await safe_edit_text(
            cb,
            prompt,
            reply_markup=InlineKeyboardMarkup(inline_keyboard=rows),
        )
    finally:
        db.close()
    await cb.answer()
