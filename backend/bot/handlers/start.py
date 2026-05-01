from aiogram import F, Router
from aiogram.filters import Command, CommandObject
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message, WebAppInfo

from app.config import get_settings
from app.database import SessionLocal
from app.models import Business, User
from bot.keyboards.inline import back_to_menu_kb, business_menu_kb, role_choice_kb
from bot.utils import safe_edit_text

router = Router()
settings = get_settings()


def _owner_kb() -> InlineKeyboardMarkup:
    app_url = settings.public_app_url
    rows: list[list[InlineKeyboardButton]] = []
    if app_url.startswith("https://"):
        rows.append(
            [InlineKeyboardButton(text="🚀 Kabinetni ochish", web_app=WebAppInfo(url=f"{app_url}/dashboard"))]
        )
    return InlineKeyboardMarkup(inline_keyboard=rows)


@router.message(Command("start"))
async def cmd_start(message: Message, command: CommandObject | None = None):
    db = SessionLocal()
    try:
        arg = (command.args or "").strip() if command else ""
        if arg:
            b = db.query(Business).filter(Business.slug == arg, Business.is_active.is_(True)).first()
            if not b:
                await message.answer("Biznes topilmadi.")
                return
            welcome = b.welcome_text.strip() if b.welcome_text else ""
            text = welcome or f"Xush kelibsiz! <b>{b.name}</b>\n\nQuyidagilardan tanlang:"
            tg_id = message.from_user.id if message.from_user else None
            is_owner = False
            if tg_id:
                owner = db.query(User).filter(User.id == b.owner_id).first()
                is_owner = bool(owner and owner.telegram_id == tg_id)
            await message.answer(
                text,
                reply_markup=business_menu_kb(b.slug, owner_view=is_owner, app_url=settings.public_app_url),
            )
            return

        tg_id = message.from_user.id if message.from_user else None
        if tg_id:
            user = db.query(User).filter(User.telegram_id == tg_id).first()
            if user:
                biz = db.query(Business).filter(Business.owner_id == user.id).first()
                if biz:
                    await message.answer(
                        f"👋 Salom, <b>{user.first_name or 'usta'}</b>!\n"
                        f"Biznesingiz: <b>{biz.name}</b>\n"
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


@router.callback_query(F.data == "role:client")
async def role_client(cb: CallbackQuery):
    db = SessionLocal()
    try:
        items = (
            db.query(Business)
            .filter(Business.is_active.is_(True))
            .order_by(Business.name.asc())
            .limit(20)
            .all()
        )
        if not items:
            await cb.message.edit_text(
                "Hozircha platformada biznes yo'q. Biznes havolasi yoki QR-kodidan foydalaning."
            )
            await cb.answer()
            return

        bot_username = (await cb.bot.me()).username
        rows: list[list[InlineKeyboardButton]] = []
        for b in items:
            cat_icon = {
                "barbershop": "💈",
                "salon": "💇",
                "dentist": "🦷",
                "tutor": "📚",
                "photo": "📸",
                "massage": "💆",
                "fitness": "🏋",
                "clinic": "⚕️",
            }.get(str(b.category), "📦")
            rows.append(
                [
                    InlineKeyboardButton(
                        text=f"{cat_icon} {b.name}",
                        url=f"https://t.me/{bot_username}?start={b.slug}",
                    )
                ]
            )

        await cb.message.edit_text(
            "Biznesni tanlang:",
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
        phone = b.phone or "—"
        address = b.address or "—"
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
        welcome = b.welcome_text.strip() if b.welcome_text else ""
        text = welcome or f"Xush kelibsiz! <b>{b.name}</b>\n\nQuyidagilardan tanlang:"
        tg_id = cb.from_user.id if cb.from_user else None
        is_owner = False
        if tg_id:
            owner = db.query(User).filter(User.id == b.owner_id).first()
            is_owner = bool(owner and owner.telegram_id == tg_id)
        await safe_edit_text(
            cb,
            text,
            reply_markup=business_menu_kb(b.slug, owner_view=is_owner, app_url=settings.public_app_url),
        )
    finally:
        db.close()
    await cb.answer()
