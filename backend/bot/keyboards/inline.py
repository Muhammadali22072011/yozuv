from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo

from app.config import get_settings


def role_choice_kb() -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = []
    app_url = get_settings().public_app_url
    if app_url.startswith("https://"):
        rows.append(
            [InlineKeyboardButton(text="🚀 Kabinetni ochish", web_app=WebAppInfo(url=f"{app_url}/auth/login"))]
        )
    rows.append([InlineKeyboardButton(text="🏢 Men biznes egasiman", callback_data="role:owner")])
    rows.append([InlineKeyboardButton(text="👤 Biznes qidiryapman", callback_data="role:client")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def business_menu_kb(slug: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="📅 Yozilish", callback_data=f"book:{slug}"),
                InlineKeyboardButton(text="📋 Mening yozilishlarim", callback_data=f"my:{slug}"),
            ],
            [InlineKeyboardButton(text="📞 Kontaktlar", callback_data=f"contacts:{slug}")],
        ]
    )


def services_kb(slug: str, items: list[tuple[str, str]]) -> InlineKeyboardMarkup:
    rows = []
    for sid, label in items:
        rows.append([InlineKeyboardButton(text=label, callback_data=f"svc:{sid}")])
    rows.append([InlineKeyboardButton(text="◀️ Orqaga", callback_data=f"book:{slug}")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def dates_kb(slug: str, sid: str, items: list[tuple[str, str]]) -> InlineKeyboardMarkup:
    rows = []
    for d_iso, label in items:
        rows.append([InlineKeyboardButton(text=label, callback_data=f"day:{sid}:{d_iso}")])
    rows.append([InlineKeyboardButton(text="◀️ Orqaga", callback_data=f"book:{slug}")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def times_kb(slug: str, sid: str, d_iso: str, times: list[str]) -> InlineKeyboardMarkup:
    row = []
    rows = []
    for t in times:
        row.append(InlineKeyboardButton(text=t, callback_data=f"time:{sid}:{d_iso}:{t}"))
        if len(row) == 3:
            rows.append(row)
            row = []
    if row:
        rows.append(row)
    rows.append([InlineKeyboardButton(text="◀️ Orqaga", callback_data=f"svc:{sid}")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def confirm_kb(slug: str, sid: str, d_iso: str, t: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="✅ Tasdiqlash",
                    callback_data=f"confirm:{sid}:{d_iso}:{t}",
                )
            ],
            [InlineKeyboardButton(text="◀️ Orqaga", callback_data=f"day:{sid}:{d_iso}")],
        ]
    )


def owner_decision_kb(booking_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="✅ Tasdiqlash", callback_data=f"own_confirm:{booking_id}"),
                InlineKeyboardButton(text="❌ Rad etish", callback_data=f"own_reject:{booking_id}"),
            ],
        ]
    )


def reject_reasons_kb(booking_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="😷 Usta kasal", callback_data=f"rej:{booking_id}:sick")],
            [InlineKeyboardButton(text="🕐 Vaqt band", callback_data=f"rej:{booking_id}:busy")],
            [InlineKeyboardButton(text="🏖 Dam olish kuni", callback_data=f"rej:{booking_id}:holiday")],
            [InlineKeyboardButton(text="✏️ Boshqa sabab", callback_data=f"rej:{booking_id}:other")],
        ]
    )
