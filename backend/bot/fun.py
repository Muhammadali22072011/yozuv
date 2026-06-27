"""Yozuv bot — the "fun" layer.

Everything that makes the bot feel alive instead of robotic lives here: warm,
*varied* Uzbek copy (so no two confirmations read the same), loyalty stamp-card
rendering, milestone celebrations and Telegram-native delight helpers (dice
reveals, message reactions, the command menu).

Design rules:
* The copy pools + renderers are pure (no aiogram / DB imports at module load),
  so a Celery task can ``from bot import fun`` and reuse ``stamp_bar`` safely.
* ``pick(pool, seed=None)`` rotates the voice. With ``seed`` the choice is stable
  for that seed (e.g. a booking id) so re-rendering the same screen never
  flickers and a future snapshot test can't flake on ``random.choice``.
* The two async helpers that need Telegram (``celebrate``/``react``) import
  aiogram lazily and swallow every error — a flourish must NEVER break a flow.
* HTML parse mode is on globally — keep tags balanced.
"""

from __future__ import annotations

import random
from datetime import datetime
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Asia/Tashkent")


def pick(options: list[str], *, seed=None) -> str:
    """Pick one line. With ``seed`` the choice is deterministic for that seed
    *within a process* (builtin hash is PYTHONHASHSEED-salted), so re-rendering
    the same screen in one run never flickers; without it, a fresh random pick.
    We only re-render within a single callback lifecycle, so this is enough."""
    if not options:
        return ""
    if seed is not None:
        return options[abs(hash(seed)) % len(options)]
    return random.choice(options)


def maybe(p: float = 0.25) -> bool:
    """True with probability ``p`` — for *occasional* flourishes (a sticker now
    and then) so delight stays a surprise, not a guarantee."""
    return random.random() < p


# --------------------------------------------------------------------------
# Time-of-day aware greeting. Saying "good morning" at 9am and "good evening"
# at 8pm reads human, not scripted. Uses the business's Asia/Tashkent clock.
# --------------------------------------------------------------------------

def greeting_word(now: datetime | None = None) -> str:
    h = (now or datetime.now(TZ)).hour
    if 5 <= h < 12:
        return "Xayrli tong"
    if 12 <= h < 18:
        return "Xayrli kun"
    if 18 <= h < 23:
        return "Xayrli kech"
    return "Assalomu alaykum"


# --------------------------------------------------------------------------
# Copy pools. Each is a small set of warm UZ (Latin) variants. Keep HTML tags
# balanced; {placeholders} are filled by the caller with .format().
# --------------------------------------------------------------------------

GREET_OWNER = [
    "👋 Salom, <b>{name}</b>! Bugun ishlar zo'rmi? 💪",
    "{greet}, <b>{name}</b>! ☀️",
    "👋 Xush kelibsiz, <b>{name}</b>! Yangi mijozlar kutmoqda 🙌",
]

WELCOME_FALLBACK = [
    "Xush kelibsiz! <b>{name}</b> ✨\nQuyidagidan tanlang:",
    "<b>{name}</b> ga xush kelibsiz! 😊\nNima qilamiz?",
    "Assalomu alaykum! <b>{name}</b> sizni kutmoqda 🌟\nTanlang:",
]

SUCCESS_CONFIRMED = [
    "✅ Zo'r! Joyingiz band — sizni kutamiz 🙌",
    "✅ Bo'ldi, yozib qo'ydik! Ko'rishguncha 👋",
    "🥳 Tayyor! Sizni kutib qolamiz.",
]

SUCCESS_PENDING = [
    "⏳ So'rovingiz yuborildi — egasi tasdiqlashini kuting.",
    "📨 Qabul qildik! Biznes egasi tez orada tasdiqlaydi.",
    "🤞 So'rov ketdi — tasdiqlansa, darhol xabar beramiz.",
]

REMINDER_LINE = [
    "🔔 1 soat oldin eslatib qo'yamiz.",
    "🔔 Esdan chiqmasin — 1 soat qoldida eslatma yuboramiz.",
    "🔔 Vaqti kelganda signal beramiz (1 soat oldin).",
]

JACKPOT_BANNER = [
    "🎰 Jackpot! Bu tashrif — <b>BEPUL</b> 🎉 Sadoqatingiz uchun rahmat!",
    "🎯 TABRIKLAYMIZ! Sodiqlik kartangiz to'ldi — bu safar bizdan 🎁",
    "🎁 Bu tashrif <b>BEPUL</b>! Doimiy mijoz bo'lganingiz uchun rahmat 🥳",
]

RANDOM_MASTER_REVEAL = [
    "🎲 Sizga <b>{name}</b> tushdi! Zo'r tanlov.",
    "🎲 Omad! Bugun sizni <b>{name}</b> qabul qiladi.",
    "🎲 Tavakkal natijasi: <b>{name}</b> 👏",
]

REVIEW_THANKS_HIGH = [
    "🌟 Rahmat! Bunday baho — biz uchun katta quvonch 🙌",
    "Besh baland! Mehringiz uchun rahmat ❤️ Yana kutamiz.",
    "Rahmat! Fikringiz boshqalarga ham yordam beradi 😊",
]

REVIEW_THANKS_MID = [
    "Fikringiz uchun rahmat 🙏 Yanada yaxshi bo'lamiz.",
    "Rahmat! Maslahatlaringizni inobatga olamiz 🤝",
]

REVIEW_THANKS_LOW = [
    "Fikringiz uchun rahmat. Yaxshilanishga harakat qilamiz 🙏",
    "Uzr so'raymiz 🤝 Fikringizni ustaga albatta yetkazamiz.",
]

OWNER_NEW = [
    "🎉 Yangi mijoz keldi!",
    "🎯 Yangi yozilish!",
    "💰 Yana bir buyurtma!",
    "🔔 Yangi yozilish — tabriklaymiz!",
]

CLIENT_CONFIRMED = [
    "✅ Yozilishingiz tasdiqlandi! Sizni kutamiz 🙌",
    "Hammasi tayyor — joyingiz sizni kutyapti ✨",
    "✅ Tasdiqlandi! Ko'rishguncha 👋",
]

NO_SLOTS = [
    "Bu kuni hammasi band bo'lib qoldi 😕",
    "Voy, bu kunga joy qolmadi 🙈",
    "Bu sana to'lib ketibdi — mashhur joy ekan! 🔥",
]

RESCHEDULE_DONE = [
    "🔄 Ko'chirildi: <b>{when}</b> — hammasi joyida 👍",
    "Vaqtni o'zgartirdik: <b>{when}</b> ✅ Sizni o'sha vaqtda kutamiz.",
]

CANCEL_DONE = [
    "Bekor qilindi. Boshqa vaqt qulay bo'lsa — doim shu yerdamiz 🤍",
    "Yozilish bekor qilindi. Yana kutamiz 👋",
]

WAITLIST_JOINED = [
    "🔔 Navbatdasiz! Joy bo'shasa — birinchi bo'lib sizga aytamiz.",
    "🔔 Qo'shildingiz! Bo'sh joy chiqsa, darhol xabar beramiz.",
]


def review_thanks(rating: int) -> str:
    """Rating-aware thank-you: celebrate a high score, own a low one. A chirpy
    ✅ under a 1-star complaint reads tone-deaf; this shows the bot read it."""
    r = int(rating or 0)
    if r >= 4:
        return pick(REVIEW_THANKS_HIGH)
    if r == 3:
        return pick(REVIEW_THANKS_MID)
    return pick(REVIEW_THANKS_LOW)


# --------------------------------------------------------------------------
# Loyalty stamp card. booking_service.loyalty_progress already computes
# (collected, required); we just render it delightfully.
# --------------------------------------------------------------------------

def stamp_bar(collected: int, required: int, *, max_width: int = 10) -> str:
    """🟢🟢🟢⚪⚪ — one cell per stamp, capped so a big card doesn't wrap."""
    required = max(1, int(required))
    collected = max(0, min(int(collected), required))
    width = min(required, max_width)
    on = round(collected / required * width)
    return "🟢" * on + "⚪" * (width - on)


def loyalty_success_block(collected: int, required: int) -> str:
    """Multi-line card for the booking-success screen."""
    if required <= 0:
        return ""
    bar = stamp_bar(collected, required)
    left = required - collected
    if left <= 1:
        return f"🎟 Sovg'a kartangiz: {bar} ({collected}/{required})\n🎁 Keyingisi <b>BEPUL</b>!"
    return (
        f"🎟 Sovg'a kartangiz: {bar} ({collected}/{required})\n"
        f"Yana <b>{left}</b> ta tashrif — keyingisi sovg'a! 🎉"
    )


def loyalty_service_hint(collected: int, required: int) -> str:
    """One-liner for the service-detail screen — the carrot at the decision."""
    if required <= 0:
        return ""
    bar = stamp_bar(collected, required)
    if collected <= 0:
        return f"🎁 Bu xizmatda har <b>{required}</b>-tashrif BEPUL. Hozir: {bar} (0/{required})"
    left = required - collected
    if left <= 1:
        return f"🎟 Kartangiz: {bar} ({collected}/{required}) — keyingisi bepul! 🎉"
    return f"🎟 Kartangiz: {bar} ({collected}/{required}) — yana {left} ta va sovg'a!"


# --------------------------------------------------------------------------
# Milestones — celebrate round-number visits. None for ordinary ones.
# --------------------------------------------------------------------------

_MILESTONES = {
    1: "🎊 Bu yerdagi <b>birinchi</b> yozilishingiz! Xush kelibsiz 🤗",
    5: "🖐 <b>5-chi</b> tashrifingiz — doimiy mijozimizsiz! Rahmat ❤️",
    10: "🔟 <b>10 marta</b> keldingiz! Siz afsona bo'lyapsiz 🌟",
    25: "🏅 <b>25-chi</b> yozilish! Bunday sodiqlik kamdan-kam 👑",
    50: "🏆 <b>50 ta</b> tashrif! Siz haqiqiy VIP mijozimizsiz 💎",
    100: "💯 <b>100-chi</b> tashrif!! So'z ortiqcha — siz zo'rsiz 🚀",
}


def client_milestone(visit_no: int) -> str | None:
    """``visit_no`` = how many bookings (incl. the new one) the client now has
    at this business. Returns a banner only on round numbers."""
    return _MILESTONES.get(int(visit_no or 0))


# --------------------------------------------------------------------------
# Random-master "roll".
# --------------------------------------------------------------------------

def roll_master(staff_list):
    """Pick one master at random for the '🎲 Istalgan mutaxassis' option, so the
    dice on that button actually *decides* something. None when no staff."""
    return random.choice(staff_list) if staff_list else None


# --------------------------------------------------------------------------
# Telegram-native delight. Both swallow every error — a flourish must never
# break the underlying flow (blocked bot / stale message / API hiccup).
# --------------------------------------------------------------------------

# answer_dice emoji the Bot API supports: 🎲 🎯 🏀 ⚽ 🎳 🎰
async def celebrate(message, emoji: str = "🎲") -> None:
    try:
        await message.answer_dice(emoji=emoji)
    except Exception:
        pass


async def react(bot, chat_id: int, message_id: int, emoji: str = "🎉") -> None:
    """React to the user's own message — the most 'alive' Telegram gesture."""
    try:
        from aiogram.types import ReactionTypeEmoji

        await bot.set_message_reaction(
            chat_id=chat_id,
            message_id=message_id,
            reaction=[ReactionTypeEmoji(emoji=emoji)],
        )
    except Exception:
        pass


# Command menu (setMyCommands). The bot has /start and /mybookings handlers but
# never told Telegram, so the "/" hint menu was empty. Only list real commands.
BOT_COMMANDS = [
    ("start", "🏠 Boshlash / biznes tanlash"),
    ("mybookings", "📋 Mening yozilishlarim"),
]
