# Yozuv bot — "Fun & Alive" roadmap

> Goal: the bot is correct today but DRY and robotic — same flat strings every time,
> zero reward, zero reason to come back. This plan makes it feel **warm, human, and
> alive**: variety in copy, micro-celebrations, light honest gamification, and a few
> real reasons to return. All copy stays in warm Uzbek (Latin). Quick wins are
> **additive** (new `bot/fun.py`, new handlers/callbacks, copy swaps) and do **not**
> touch the 75 green tests.

---

## Vision

Booking at a small Uzbek barbershop / salon / clinic should feel like talking to a
friendly receptionist who knows you — not filling in a form. Every high-emotion
moment (booking confirmed, review left, free loyalty visit earned, a friend you
referred showing up) gets a small, genuine flourish: a warmer sentence that's never
quite the same twice, a Telegram-native dice or reaction, a stamp card filling up
toward a real free visit. Owners — the paying side — get the same warmth: each new
booking reads like a tiny win, and a quiet evening recap gives them a daily reason to
open the app. Nothing is loud, nothing is fake, nothing nags. The reward is always
real (a stamp they earned, a friend they brought), so it reads as warmth, not a trap.

---

## The foundation: `bot/fun.py`

Everything below leans on one new pure module — **no aiogram, no DB imports** — so
copy lives in one place and can be unit-tested in isolation.

```python
# backend/bot/fun.py
import random

def pick(pool, seed=None):
    """Choose a variant. Seed (e.g. booking_id) keeps a re-render stable so the
    same screen never flips text between cb.answer() and edit."""
    if not pool:
        return ""
    if seed is None:
        return random.choice(pool)
    return pool[hash(str(seed)) % len(pool)]

SUCCESS_CONFIRMED = [
    "✅ Zo'r! Joyingiz band — sizni kutamiz 🙌",
    "✅ Bo'ldi, yozib qo'ydik! Ko'rishguncha 👋",
    "✅ Ajoyib — kutib qolamiz!",
    "✅ Yozildingiz! Sizni intiqlik bilan kutamiz 😊",
]
SUCCESS_PENDING = [
    "⏳ So'rovingiz yuborildi — egasi tasdiqlashi bilan xabar beramiz.",
    "⏳ Qabul qilindi! Biznes egasi tez orada tasdiqlaydi.",
]
REVIEW_THANKS_HIGH = [
    "🌟 Besh yulduz — rahmat! Mehringiz uchun katta rahmat 🙌",
    "🎉 Ana shu-da! Fikringiz uchun katta rahmat ⭐",
]
REVIEW_THANKS_MID = [
    "Rahmat, fikringiz biz uchun muhim! 🙏",
    "Bahoyingiz uchun katta rahmat! ✅",
]
REVIEW_THANKS_LOW = [
    "Fikringiz uchun rahmat. Yaxshilanishga harakat qilamiz 🙏",
    "Bahoyingiz uchun rahmat. Ustaga albatta yetkazamiz, yaxshilanamiz 🤝",
]
OWNER_NEW = [
    "🎉 Yangi mijoz keldi!",
    "🆕 Yana bitta yozilish!",
    "✨ Mijoz sizni tanladi!",
    "☕ Yangi yozilish tushdi:",
]
WELCOME_FALLBACK = [
    "Xush kelibsiz! ✨ <b>{name}</b> sizni kutmoqda.",
    "Mana yetib keldingiz! 🎉 <b>{name}</b>'ga xush kelibsiz.",
    "Yaxshi tanlov! 👍 <b>{name}</b> — quyidagilardan boshlang:",
]
```

Plus tiny helpers used by several features:

```python
async def celebrate(message, emoji="🎯"):
    """Fire a Telegram-native dice; never let a hiccup break the flow."""
    try:
        await message.answer_dice(emoji=emoji)
    except Exception:
        pass

def stamp_bar(collected: int, required: int) -> str:
    filled = "🟢" * collected
    empty = "⚪" * max(required - collected, 0)
    return f"{filled}{empty} ({collected}/{required})"
```

Why it's safe: brand-new file, imported only by handlers (which no test imports).
Always expose the **seeded** `pick()` and seed it with `info['booking_id']` so no
future snapshot test can flake on `random.choice`.

---

## Quick wins (additive, ship now)

Ordered roughly by impact × ease. Each is copy/keyboard/new-callback only and leaves
the funnel FSM and the 75 tests untouched.

### 1. Loyalty stamp-card line on the success screen
**Where:** `bot/handlers/booking.py:_success_text` (line ~845), fed by a new optional
`loyalty_done`/`loyalty_total` pair computed inside `_create_booking_sync` (line ~667,
already has `service` + `db`) via the existing-but-dead `booking_service.loyalty_progress`
(`booking_service.py:338`). Render through `fun.stamp_bar`.
**Copy:**
- `🎟 Sovg'a kartangiz: 🟢🟢🟢⚪⚪ (3/5)\nYana 2 ta tashrif — keyingisi BEPUL! 🎉`
- `🎟 Sodiqlik kartangiz: 🟢⚪⚪⚪⚪ (1/5) — to'plang, 5-tashrif sovg'a!`
**Why:** every booker passes through here; turns a flat "Yozildingiz!" into visible
progress toward a real free visit. Reuses dead code. Guard `loyalty_progress` in
try/except → when loyalty is off it returns None and nothing changes.

### 2. Warm, varied booking-success + free-visit celebration
**Where:** `_success_text` opener via `fun.pick(SUCCESS_CONFIRMED/PENDING, seed=info['booking_id'])`;
in `confirm_booking` (~910) and `receive_phone_for_booking` (~985), detect the loyalty
free visit (`info['payment_amount']==0 and info['service_price']>0 and not info['promo_code']`)
and fire `fun.celebrate(msg, '🎰')` + a "BEPUL tashrif" banner.
**Copy:**
- `🎰 Jackpot! Bu tashrif — BEPUL 🎉 Sadoqatingiz uchun rahmat!`
- `🎯 TABRIKLAYMIZ! Sodiqlik kartangiz to'ldi — bu safar bizdan 🎁`
**Why:** the single highest-emotion moment, today identical every time; the free
visit is currently silent (price just happens to be 0). Reads only existing `info`
fields — no new query. Guard `service_price>0` so a genuinely free service can't
false-trigger the jackpot.

### 3. Rating-aware, varied review thank-you
**Where:** `my_bookings.py:skip_comment` (~265) and `receive_comment` (~277). Read
`rating` from `state.get_data()` **before** `state.clear()`, then pick from
`REVIEW_THANKS_HIGH/MID/LOW`. On `rating==5` also `await fun.celebrate(msg, '🎯')`.
**Copy:** 5★ → "Besh yulduz — rahmat! 🙌"; 1-2★ → "Fikringiz uchun rahmat.
Yaxshilanamiz 🙏". A chirpy ✅ on a 1-star complaint is the current tone-deaf bug.
**Why:** shows the bot actually read the rating; recovery moment on low scores,
celebration on high ones — cheap empathy. Only care: capture rating before clear.

### 4. `🎲 Istalgan mutaxassis` becomes a real dice roll
**Where:** `booking.py:pick_staff` (`stfok:` callback, ~269). Today `choice=='any'`
silently sets `staff_id=""` — the dice emoji on the button is a lie. New: pull one
concrete master from `_staff_for_service` via `fun.roll_master(staff_list)`, send
`cb.message.answer_dice('🎲')`, then reveal "🎲 Sizga {name} tushdi!" and store that
real `staff_id` in FSM exactly like a manual pick. Fallback: zero mappable staff →
behave exactly as today.
**Copy:** `🎲 Sizga <b>{name}</b> tushdi! Zo'r tanlov.` / `🎲 Omad! Bugun sizni {name} qabul qiladi.`
**Why:** turns a dead, dishonest UI affordance into the most playful moment in the
funnel — the dice now decides something real. Wrap `answer_dice` in try/except;
a concrete staff UUID is as valid as `""`.

### 5. Livelier owner "new booking" notification
**Where:** `booking.py:_notify_owner_of_booking` (~790). Swap the fixed
`🆕 Yangi yozilish` header for `fun.pick(OWNER_NEW)`; tag a brand-new client's
first-ever booking ("✨ Yangi mijoz!") using a cheap COUNT done inside the already-open
`_create_booking_sync` session and passed via `info['is_new_client']` (default False).
**Copy:** `🎉 Yangi mijoz keldi!` / `✨ Yangi mijoz! Birinchi marta keldi.`
**Why:** owners get these all day; a warm, varied "cha-ching" makes each booking feel
like a win and keeps notifications on. `_notify_owner_of_booking` is try/except-wrapped
and untested for copy.

### 6. Warmer owner confirm → client message + occasional sticker
**Where:** `owner.py:owner_confirm` client block (~71). Replace the flat
"Yozilishingiz tasdiqlandi" with a varied warm line; occasionally (e.g. client's
first confirmed booking) `await cb.bot.send_dice(client_tg_id, emoji='🎉')`.
**Copy:** `✅ Yozilishingiz tasdiqlandi! Sizni kutamiz 🙌` / `Hammasi tayyor — joyingiz sizni kutyapti ✨`
**Why:** confirmation is when the client's plan becomes real. Gate the dice so it
stays tasteful; wrap in try/except so a blocked-bot 403 never breaks the owner's
confirm.

### 7. Emoji reactions on the user's own messages
**Where:** `bot.set_message_reaction([ReactionTypeEmoji(emoji='❤')])` on: the 5★ review
comment message (`my_bookings.py` receive_comment / skip_comment), a valid promo
message (`booking.py:promo_received`, 🎉), and the shared contact in
`receive_phone_for_booking` (👍).
**Copy:** reaction-only, no text.
**Why:** reacting to what the user just sent is the most "alive" Telegram gesture —
the bot smiling back. Needs `message_id`+`chat_id` (both present). try/except: reacting
to a >48h-old or deleted message raises `TelegramBadRequest`.

### 8. Personalized, time-aware greeting (fallbacks only)
**Where:** `start.py:cmd_start` owner branch (~143) → `fun.pick(GREET_OWNER, seed=tg_id)`;
the welcome **fallback** (used at ~109, ~428, ~482 only when `welcome_text` is empty) →
`fun.pick(WELCOME_FALLBACK)`. Add "Xayrli tong/kun/kech" via the existing
`Asia/Tashkent` clock (`app.utils.clock`).
**Copy:** `Xayrli tong, <b>{name}</b>! ☀️` / `Salom, usta! Bugun ishlar zo'rmi? 💪`
**Why:** first impression + the owners who open daily. **Never** randomize
owner-supplied `welcome_text` — only the empty-text fallback.

### 9. Loyalty progress hint on the service-detail screen
**Where:** `booking.py:show_service_detail` (`svc:`, ~176). After `_service_detail_text`,
append the caller's stamp status for *that* service (`loyalty_progress(db, service,
client.id)` where client = lookup by `cb.from_user.id`; db already open). Empty/disabled
→ append nothing.
**Copy:** `\n🎟 Sizning kartangiz: 🟢🟢🟢🟢⚪ (4/5) — keyingisi bepul!`
**Why:** puts the carrot exactly where the decision is made, using the client's own
earned progress. Personal, not pushy.

### 10. Warmer reschedule / cancel / waitlist last words
**Where:** `my_bookings.py:reschedule_apply` (~471) & `cancel_booking` (~375);
`booking.py:join_waitlist` (~427). Swap terse log-lines for warm `pick()`'d variants.
**Copy:** `Vaqtni o'zgartirdik — hammasi joyida 👍` / `Bekor qilindi. Boshqa vaqt
qulay bo'lsa — doim shu yerdamiz 🤍` / `🔔 Navbatdasiz! Joy bo'shasa — birinchi bo'lib
sizga aytamiz.`
**Why:** these dead-end screens are where the user leaves the conversation; a warm
last word beats a terse one. Pure copy → zero risk.

---

## Bigger bets (heavier, real reasons to come back)

### B1. Post-visit thank-you + one-tap rebook (the missing lifecycle hook)
COMPLETED today fires **zero** client message. In `app/routers/bookings.py:complete`
(~433) — **after** `db.commit()`, fire-and-forget in try/except like the existing
waitlist ping — send the client: warm thanks + a `rev:<booking_id>` "Baho berish"
button (handler already exists) + a `?start=<slug>` "Yana yozilish" deep link, plus
the refreshed stamp bar via `loyalty_progress`. `send_telegram_message` no-ops when
`bot_token` is empty (the test case), so the suite stays inert/green; never change the
`response_model`. **Highest-affection moment in the whole product.**

### B2. Owner daily evening recap ("Bugungi natija")
New Celery task `send_owner_daily_recap` next to `send_birthday_greetings`
(`reminders.py`); beat entry `crontab(hour=20, minute=30)`. Per active business: total
/ completed / no-show counts + a warm closing line; **skip zero-booking days** (no sad
recaps). Optional busy-day streak line ("🔥 3 kun ketma-ket gavjum!") from distinct
booking dates over the last ~10 days. **The single biggest retention lever for the
paying side** — a daily ritual + sense of momentum. `test_reminders.py` only imports
`REMINDER_LEAD_MAX` + `_render_reminder`, so a new task + beat key is safe.

### B3. Birthday gift (real promo, not just words)
Enrich `send_birthday_greetings` (`reminders.py:152`): mint a one-time `PromoCode`
(20% off, max_uses=1, ~7-day window) for the client's last business using the exact
`_gen_code('RW')` + `PromoCode(...)` pattern from `referral_service.complete_referral`,
embed the code + a `?start=<slug>` rebook button, and vary the greeting line. Keep
`_under_cooldown` + `last_outreach_at` and the single end-of-loop `db.commit()`
untouched; wrap the mint in the per-client try so one bad row can't abort the batch.
**A birthday wish with a real gift drives a return visit, not just goodwill.**

### B4. "Sog'indik" win-back upgrade + loyalty-streak-at-risk nudge
(a) Rework `send_reengagement_nudges` copy to rotating warm "sog'indik" lines + a
one-tap `?start=<slug>` button (keep the 30–60-day window, cooldown, COMPLETED query
exactly). (b) New task `send_loyalty_streak_nudges`: clients at `required-1` stamps on
a loyalty service whose last visit was 20–40 days ago get ONE gentle "oz qoldi — yana
bitta tashrif, keyingisi bepul" nudge. Reuse `loyalty_progress` (never a fresh count)
and gate hard on `last_outreach_at`. **"You're one visit from a free one" is the most
motivating, least manipulative hook there is — the reward is already half-earned.**

### B5. First-review thank-you reward (one-time discount)
On a client's first-ever review in a business (count = 0), mint a one-time `PromoCode`
(e.g. -10%) and reveal the code in the thank-you. New `app/services/review_service.py:
mint_first_review_reward` modeled on `complete_referral`; redemption already handled by
`booking_service._apply_promo`. **Not a dark pattern: given AFTER they rate, never
dangled to coerce a 5★.** Reviews currently give the client nothing back.

### B6. Optional photo review
After the rating step the comment handler (`receive_comment`,
`ReviewStates.waiting_for_comment`) also accepts `message.photo[-1].file_id` (caption =
comment). New nullable `reviews.photo_file_id` column + migration; prompt invites a
photo. **A fresh-cut selfie / nail photo is the most natural review in this market —
and the social proof owners crave.** Photo is always optional.

### B7. "Tasodifiy joy" + "Menga mos joyni top" discovery
(a) `🎲 Tasodifiy joy` button on the category / empty screens → new `disc:rnd:<v>:<t>:<c>`
callback reusing the `filter_results` query with `order_by(func.random()).limit(1)`,
optionally preceded by `answer_dice('🎲')`. (b) A 3-tap "find my place" quiz launched
from `role_choice_kb`: friendly need → `BusinessCategory` → existing viloyat picker →
`filter_results`. **Speaks the first-timer's language ("I need a haircut", not
"kategoriya") and kills choice paralysis.** New callback prefixes only; existing
`flt:*` handlers untouched.

### B8. Lifecycle opt-out ("Jim rejim")
A `🔕 Bunday xabarlarni o'chirish` footer button on birthday / reengage / streak /
thank-you messages → new `mute:lifecycle` callback in a new `bot/handlers/lifecycle.py`
(wired in `setup.py`) setting a new nullable `Client.notifications_opt_out`; each of
the 4 lifecycle tasks adds one `.filter`. Transactional 1h reminders unaffected.
**Trust is the foundation of warmth — a frictionless mute makes the whole lifecycle
suite safe to ship in a conservative market.** Ship this alongside B2–B5.

### B9. Telegram polish: command menu + inline share
(a) `bot.set_my_commands` at startup in `setup.py` next to `set_menu_button`: `/start`,
`/mybookings` with warm UZ descriptions (only list commands that have handlers).
(b) Inline mode (`@router.inline_query`, new `bot/handlers/inline_search.py`) so
`@yozuvbot barber` surfaces bookable businesses with ⭐ + a `?start=<slug>` deep link in
any chat — **every client becomes a distributor.** Inline mode needs a one-time
BotFather toggle (ops note).

---

## Cut (gimmicks / spam / overlap)

- **Coin / points wallet ("Tanga to'plash").** Heaviest possible build (new model +
  migration + redemption + owner config) for the least incremental delight, and it
  collides head-on with the existing per-service loyalty stamp card and referral
  reward codes — two parallel earn-currencies confuse a small-market user and risk
  double-discounts in `booking_service`. Ship the dice spin + stamp card instead.
- **Per-slot / near-full "scarcity" hints on every day.** Real `<=2 joy qoldi` on a
  genuinely near-full day is fine and honest, but blanket scarcity labeling drifts into
  manufactured FOMO and costs a `get_available_slots` call per day × 7. Keep *only* the
  honest near-full case if built at all; cut the always-on version.
- **Daily check-in streak with milestone reward.** Only worth it if owners actually
  fund the 7-day reward; otherwise it's empty points and a new table/router for flair
  alone. Defer — the loyalty stamp card already delivers the "earn a reward" loop.
- **"Omad gildiragi" random post-booking discount wheel.** Fun, but it gives away
  margin on *every* booking for no loyalty signal and needs an owner cap column +
  double-roll guards. The birthday / first-review / referral promos already cover
  "earn a code" with a real reason attached. Cut unless an owner explicitly opts in.
- **Visit-milestone badges via daily Celery ("50-tashrif VIP").** Nice-to-have, but
  redundant once B2 (recap) + the stamp card exist, and milestone-dedup without a
  schema column is fiddly. Park it.

---

## Build order

1. `bot/fun.py` (foundation — `pick`, copy pools, `celebrate`, `stamp_bar`, `roll_master`).
2. QW2 + QW1 — varied success text + loyalty stamp line + free-visit jackpot (one edit to `_success_text` / `_create_booking_sync`).
3. QW3 + QW7 — rating-aware review thanks + 5★ dice + emoji reactions.
4. QW4 — real dice roll for "Istalgan mutaxassis".
5. QW5 + QW6 — livelier owner notify + warmer owner-confirm message/sticker.
6. QW8 + QW9 + QW10 — greeting variety, service-detail loyalty hint, warm terminal screens.
7. B1 — post-visit thank-you + rebook (the missing lifecycle hook).
8. B8 — lifecycle opt-out column/router (land before the outbound lifecycle features).
9. B2 — owner daily recap (+ busy-day streak).
10. B3 + B4 + B5 — birthday gift, win-back/streak nudges, first-review reward.
11. B6 + B7 + B9 — photo review, discovery (random/quiz), Telegram polish (commands + inline).

After each step: run the 75 backend tests (`pytest` in `backend/`) — every quick win is
additive and should keep them green.
