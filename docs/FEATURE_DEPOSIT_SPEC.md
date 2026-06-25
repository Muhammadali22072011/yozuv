I have full grounding. Migration head is `022`, so the new one is `023`. Now I'll produce the complete implementation-ready spec. This is режим B output — the spec itself is the deliverable returned verbatim to the calling script.

I'll skip the memory-save step (Шаг 4) since I'm a subagent returning a string, not an interactive session — and the CLAUDE.md instruction is to not write report .md files. I'll return the spec directly.

---

# Spec: Deposit / Prepayment on Booking — wiring the dead `ConfirmationMode.PREPAYMENT`

**Status:** implementation-ready · **Effort:** L · **Impact:** high
**Goal in one line:** When a business is in `PREPAYMENT` mode, a new booking is held `PENDING` and the client gets a Payme/Click pay-link for a deposit (% of service price); the booking flips to `CONFIRMED` only when the paytechuz webhook confirms the deposit. Unpaid holds expire and free the slot.

---

## 1. User story

**Owner (salon/clinic):** "I lose money to no-shows. I want clients to prepay a deposit (say 30%) before their slot is locked. If they no-show, I keep the deposit; if they cancel in time, it's refunded."

**Client (bot):** picks service → staff → date → time → (promo) → confirm → instead of "Yozildingiz!" sees **"To'lov qiling — 15 000 so'm (30% oldindan to'lov)"** with two buttons **💳 Payme** / **💳 Click**. Pays in the gateway, returns, sees **"✅ To'lov qabul qilindi — yozilishingiz tasdiqlandi"** (pushed by webhook). If they don't pay within the hold window, the slot is released and they get **"⏳ To'lov amalga oshmadi — vaqt bo'shatildi"**.

**Acceptance:**
- [ ] Business in `AUTO` → unchanged (instant `CONFIRMED`, no deposit).
- [ ] Business in `MANUAL` → unchanged (`PENDING`, owner approves, no deposit).
- [ ] Business in `PREPAYMENT` → booking `PENDING` + `payment_status=UNPAID` until webhook; pay-link returned to bot; webhook flips to `CONFIRMED` + `payment_status=PARTIAL`.
- [ ] Deposit amount = `round(final_price * deposit_percent / 100)` computed off the **post-promo, post-loyalty** price.
- [ ] Webhook for a booking-deposit tx does **not** activate a subscription.
- [ ] Webhook is idempotent (replays don't double-confirm or double-credit).
- [ ] Unpaid `PREPAYMENT` holds older than `deposit_hold_minutes` are auto-cancelled and the slot is freed.
- [ ] Owner can refund the deposit on cancel from the dashboard.

---

## 2. Real-code grounding (what already exists)

| Concern | Where it lives today | Reuse / change |
|---|---|---|
| Mode enum stub | `backend/app/models/enums.py:16` `ConfirmationMode.PREPAYMENT` | wired here |
| Non-AUTO → PENDING | `backend/app/services/booking_service.py:222-225` | extend: PREPAYMENT also PENDING, but compute deposit + signal pay-needed |
| Gateway links | `backend/app/services/payment_service.py:60-134` `create_payme_payment` / `create_click_payment` | clone shape into deposit variant (account_field_name="id", same paytechuz call) |
| Webhook | `backend/app/routers/payments.py:426-480` `payme_webhook` / `click_webhook`, `_find_tx_id`, `complete_transaction_and_notify` | **branch on tx type** — subscription vs booking-deposit |
| Tx model | `backend/app/models/payment.py` `PaymentTransaction` | add `kind` + `booking_id` (or new table — see §3 decision) |
| Bot confirm step | `backend/bot/handlers/booking.py:721-779` `confirm_booking`, `_success_text`, `_notify_owner_of_booking` | insert pay-link branch when `status==PENDING && deposit_required` |
| Profile mode card | `frontend/src/app/dashboard/profile/page.tsx:379-388` (PREPAYMENT card already rendered, currently dead) | add deposit % input shown only when PREPAYMENT selected |
| Business update API | `backend/app/schemas/business.py:36-56` `BusinessUpdate`, `:78-101` `BusinessMe` | add `deposit_percent`, `deposit_hold_minutes` |
| No-show flip | `backend/app/tasks/reminders.py:74-103` `flag_no_shows` (2h grace) | add sibling task `expire_unpaid_holds` (short window) |
| Cancel + late_cancel | `booking_service.py:357-389` `cancel_booking` | hook deposit refund decision off `late_cancel` |

**Two landmines confirmed by reading the code:**

1. **`_find_tx_id` + `complete_transaction_and_notify` are subscription-only.** `complete_transaction_and_notify` (`payment_service.py:204`) unconditionally calls `activate_subscription`. The webhook (`payments.py:448`/`478`) just finds *any* UUID in the payload and completes it. A booking-deposit tx flowing through this path would wrongly grant a free subscription. The webhook **must** discriminate tx kind before choosing the completion handler.

2. **`flag_no_shows` would mis-handle unpaid holds.** It flips `PENDING`→`NO_SHOW` only 2h after `end_time`. An unpaid deposit hold for next week would squat the slot until then. We need a **separate, fast** expiry task, and `flag_no_shows` must **skip** unpaid-deposit `PENDING` rows (they're cancelled by the expiry task, not flagged as no-show).

---

## 3. Data-model changes

### Decision: extend `PaymentTransaction`, do **not** create a new table.
Rationale: the webhook, `_find_tx_id`, and refund plumbing all key off `PaymentTransaction`. Adding a `kind` discriminator + nullable `booking_id` keeps one webhook path and one refund path. The existing `business_id` FK still applies (a deposit belongs to the business too).

### 3a. `PaymentTransaction` (`backend/app/models/payment.py`)
```python
# NEW
kind: Mapped[str] = mapped_column(String(16), default="subscription", nullable=False)  # "subscription" | "deposit"
booking_id: Mapped[uuid.UUID | None] = mapped_column(
    UUID(as_uuid=True), ForeignKey("bookings.id", ondelete="SET NULL"), nullable=True, index=True
)
```
- Existing rows backfill `kind="subscription"`. `plan` stays NULL/ignored for deposits.

### 3b. `Booking` (`backend/app/models/booking.py`)
```python
# NEW
deposit_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
deposit_amount: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
deposit_paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
deposit_refunded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
```
- Reuse existing `payment_status` enum but **add** a `PARTIAL` member to `PaymentStatus` (`enums.py:38`): `UNPAID / PARTIAL / PAID / REFUNDED`. Deposit paid → `PARTIAL`; owner marks fully paid at visit → `PAID`; refund → `REFUNDED`.

### 3c. `Business` (`backend/app/models/business.py`)
```python
# NEW
deposit_percent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)      # 0–100
deposit_hold_minutes: Mapped[int] = mapped_column(Integer, default=30, nullable=False) # unpaid-hold TTL
```

### 3d. Migration sketch — `023_booking_deposits.py` (down_revision `"022"`)
```python
revision = "023"; down_revision = "022"

def upgrade():
    # payment_transactions
    op.add_column("payment_transactions",
        sa.Column("kind", sa.String(16), nullable=False, server_default="subscription"))
    op.add_column("payment_transactions",
        sa.Column("booking_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("bookings.id", ondelete="SET NULL"), nullable=True))
    op.create_index("ix_payment_transactions_booking_id", "payment_transactions", ["booking_id"])

    # bookings
    op.add_column("bookings", sa.Column("deposit_required", sa.Boolean, nullable=False, server_default=sa.text("false")))
    op.add_column("bookings", sa.Column("deposit_amount", sa.Integer, nullable=False, server_default="0"))
    op.add_column("bookings", sa.Column("deposit_paid_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("bookings", sa.Column("deposit_refunded_at", sa.DateTime(timezone=True), nullable=True))

    # businesses
    op.add_column("businesses", sa.Column("deposit_percent", sa.Integer, nullable=False, server_default="0"))
    op.add_column("businesses", sa.Column("deposit_hold_minutes", sa.Integer, nullable=False, server_default="30"))

def downgrade():
    op.drop_column("businesses", "deposit_hold_minutes")
    op.drop_column("businesses", "deposit_percent")
    op.drop_column("bookings", "deposit_refunded_at")
    op.drop_column("bookings", "deposit_paid_at")
    op.drop_column("bookings", "deposit_amount")
    op.drop_column("bookings", "deposit_required")
    op.drop_index("ix_payment_transactions_booking_id", table_name="payment_transactions")
    op.drop_column("payment_transactions", "booking_id")
    op.drop_column("payment_transactions", "kind")
```
> `PaymentStatus.PARTIAL` is a Python enum value stored in an existing `String(32)` column — **no DB enum migration needed** (the column is already a varchar; see `booking.py:49`). Drop `server_default` in a follow-up only if you want strictness; leaving it is harmless.

---

## 4. Backend flow

### 4a. Service: `booking_service.create_booking` (`booking_service.py:222`)
Replace the mode branch:
```python
deposit_required = False
deposit_amount = 0
if mode == ConfirmationMode.AUTO:
    status = BookingStatus.CONFIRMED
elif mode == ConfirmationMode.PREPAYMENT:
    status = BookingStatus.PENDING
    pct = int(getattr(business, "deposit_percent", 0) or 0)
    if pct > 0:
        deposit_required = True
        # final_price is AFTER promo + loyalty (computed just below today —
        # MOVE the deposit calc to after _apply_promo / _maybe_apply_loyalty).
else:  # MANUAL
    status = BookingStatus.PENDING
```
Compute `deposit_amount = round(final_price * pct / 100)` **after** `final_price` is finalized (current lines 227–237). Persist `deposit_required`, `deposit_amount` on the `Booking`. Leave `payment_status=UNPAID`, `payment_amount=final_price` (the full price; deposit is a separate field).

**Edge:** if `final_price == 0` (loyalty free stamp / 100% promo), force `deposit_required=False`, `status` stays `PENDING` → owner-approve fallback, or auto-`CONFIRMED` per business preference. Spec default: `final_price==0` ⇒ treat as `MANUAL` (`PENDING`, no deposit).

The service **must not** build the gateway link itself (it has no `db.commit` boundary control and the bot calls it in a worker thread). It only sets the deposit fields and returns the booking. The **caller** (bot handler / public router) builds the link after commit.

### 4b. New service: `payment_service.create_booking_deposit_payment`
Clone `create_payme_payment` / `create_click_payment` shape, but:
- `amount = booking.deposit_amount`
- `kind="deposit"`, `booking_id=booking.id`, `plan=""`
- `return_url = settings.public_app_url + "/dashboard"` (owner) — but for the **bot** client flow the return_url is cosmetic; the webhook is the source of truth. Use `public_app_url + "/paid"` or the bot deep-link.
- Same `account_field_name="id"`, `id=str(tx.id)` so `_find_tx_id` still resolves it.

```python
def create_booking_deposit_payment(db, booking, provider) -> tuple[PaymentTransaction, str]:
    tx = PaymentTransaction(
        business_id=booking.business_id, provider=provider,
        amount=booking.deposit_amount, status=PaymentRecordStatus.PENDING,
        kind="deposit", booking_id=booking.id, plan="",
    )
    db.add(tx); db.flush()
    # ... identical paytechuz PaymeGateway/ClickGateway.create_payment(id=str(tx.id), amount=..., return_url=...)
    return tx, link
```

### 4c. New completion handler: `payment_service.complete_booking_deposit`
Mirror of `complete_transaction_and_notify` but for deposits — **never touches subscriptions**:
```python
def complete_booking_deposit(db, tx) -> None:
    if tx.status == PaymentRecordStatus.COMPLETED:
        return  # idempotent
    tx.status = PaymentRecordStatus.COMPLETED
    booking = db.query(Booking).filter(Booking.id == tx.booking_id).with_for_update().first()
    if not booking:
        return
    if booking.status == BookingStatus.PENDING:
        booking.status = BookingStatus.CONFIRMED
    booking.payment_status = PaymentStatus.PARTIAL
    booking.deposit_paid_at = datetime.now(timezone.utc)
    # notify client + owner (send_telegram_message to client telegram_id + owner)
```

### 4d. Webhook discriminator (`payments.py:440-450` and `474-480`)
Both `payme_webhook` and `click_webhook`, after resolving `tx`:
```python
tx = db.query(PaymentTransaction).filter(PaymentTransaction.id == tx_id).first()
if not tx or tx.status == PaymentRecordStatus.COMPLETED:
    return {"ok": True}                       # idempotency: already done
# method/action gating unchanged (PerformTransaction / action=="1")
if tx.kind == "deposit":
    complete_booking_deposit(db, tx)
else:
    complete_transaction_and_notify(db, tx)   # existing subscription path
db.commit()
return {"ok": True}
```
This is the **single most important change** — without the `kind` branch a deposit grants a subscription.

### 4e. Public HTTP booking path (`backend/app/routers/bookings.py`)
The web-app `POST /api/bookings` returns the created booking. When `booking.deposit_required`, the response must also include `{deposit_amount, payme_url, click_url}` so the mini-app can render pay buttons. Build links after `db.commit()` via `create_booking_deposit_payment` (two txs, one per provider — or one, deferring provider choice to a follow-up `POST /api/bookings/{id}/deposit/{provider}` endpoint; **preferred** to avoid two dangling txs). Spec choice: add `POST /api/bookings/{id}/pay/{provider}` that lazily creates the deposit tx + link for the chosen provider, guarded by `booking.deposit_required and booking.payment_status==UNPAID`.

### 4f. Expiry task (`backend/app/tasks/reminders.py`)
New `@celery_app.task expire_unpaid_holds` (beat: every 5 min):
- Select `Booking` where `status==PENDING and deposit_required and payment_status==UNPAID and created_at < now - business.deposit_hold_minutes`.
- For each: `cancel_booking(...)` (status→`CANCELLED`, `cancel_reason="deposit_not_paid"`), notify client (slot freed) and head-of-waitlist (`notify_first_for_slot` already exists per feature #1).
- **`flag_no_shows` change:** add `and not (Booking.deposit_required and Booking.payment_status==UNPAID)` to its candidate filter so unpaid holds are never flipped to `NO_SHOW` — they're `CANCELLED` by this task instead.

---

## 5. Bot pay-link step (`backend/bot/handlers/booking.py`)

`_create_booking_sync` already returns a dict with `status` and `payment_amount`. Extend the returned dict with `deposit_required`, `deposit_amount`, `booking_id` (already present). Then in `confirm_booking` (and the phone-gated twin `receive_phone_for_booking`):

```python
if info.get("deposit_required"):
    # Build pay links in a worker thread (paytechuz call is sync)
    links = await asyncio.to_thread(_make_deposit_links, info["booking_id"])
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="💳 Payme", url=links["payme"])],
        [InlineKeyboardButton(text="💳 Click", url=links["click"])],
        [InlineKeyboardButton(text="◀️ Bekor qilish", callback_data=f"depcancel:{info['booking_id']}")],
    ])
    dep = f"{info['deposit_amount']:,}".replace(",", " ")
    await safe_edit_text(cb,
        f"💳 Oldindan to‘lov kerak: <b>{dep} so‘m</b>\n"
        f"To‘lovdan so‘ng yozilishingiz tasdiqlanadi.\n"
        f"⏳ {hold_minutes} daqiqa ichida to‘lang, aks holda vaqt bo‘shatiladi.",
        reply_markup=kb)
    return   # do NOT show _success_text yet
```
- `_make_deposit_links(booking_id)` opens a `SessionLocal`, loads the booking, calls `create_booking_deposit_payment` for both providers (or one each), commits, returns `{payme, click}`. Skip a provider whose creds are unset (link == "").
- Owner notification: keep `_notify_owner_of_booking` but suffix should read **"to‘lov kutilmoqda"** (awaiting deposit) when `deposit_required and not confirmed`. Do **not** show the owner approve/decline keyboard for PREPAYMENT holds — confirmation is automatic on payment.
- **Webhook → client confirmation message** is pushed from `complete_booking_deposit` (4c) via `send_telegram_message(client.telegram_id, "✅ To‘lov qabul qilindi — yozilishingiz tasdiqlandi")`. The bot doesn't poll.

---

## 6. Dashboard toggle (`frontend/src/app/dashboard/profile/page.tsx`)

The PREPAYMENT mode card is **already rendered** (`page.tsx:380`) and currently does nothing useful. Changes:
1. Add `deposit_percent` and `deposit_hold_minutes` to the form state (`page.tsx:55` area) and to the load/save mapping (`page.tsx:100`).
2. When `form.confirmation_mode === "PREPAYMENT"`, reveal a number input:
   - **"Oldindan to‘lov ulushi (%)"** → `deposit_percent`, `min=1 max=100 step=5`, default 30. Validate 1–100; 0 disables deposits (mode acts like MANUAL).
   - Optional advanced: **"To‘lovni kutish (daqiqa)"** → `deposit_hold_minutes`, default 30, `min=10 max=120`.
3. Show a live preview: "Masalan, 50 000 so‘mlik xizmat uchun mijoz 15 000 so‘m to‘laydi."
4. On save, PUT `/business/me` with the two new fields.

**Backend API (`schemas/business.py`):**
- `BusinessUpdate` (`:36`): add `deposit_percent: int | None = Field(default=None, ge=0, le=100)` and `deposit_hold_minutes: int | None = Field(default=None, ge=10, le=120)`.
- `BusinessMe` (`:78`): add `deposit_percent: int = 0`, `deposit_hold_minutes: int = 30`.
- `frontend/src/types/index.ts`: extend the `BusinessMe`/business type with the two fields.

---

## 7. Edge cases (must handle)

| Case | Behavior |
|---|---|
| **Webhook idempotency** | First line of both completion handlers: `if tx.status == COMPLETED: return`. Booking flip guarded by `if booking.status == PENDING`. Webhook replays / double-callbacks are no-ops. The `with_for_update()` on the booking row serializes concurrent callbacks (same pattern as `activate_subscription` row-lock at `payment_service.py:35`). |
| **Amount reconciliation** | paytechuz sends the amount it charged. In the webhook, before completing, assert `int(callback_amount) == tx.amount`; on mismatch, log + **do not confirm** (return `{"ok": True}` to stop retries but leave booking PENDING, alert admin). Deposit `tx.amount` is frozen at link-creation time, so a later promo/price edit can't desync it. |
| **Refund on cancel** | Owner cancels a `CONFIRMED` PREPAYMENT booking with a paid deposit (`payment_status==PARTIAL`, `deposit_paid_at` set): dashboard shows **"Depozitni qaytarish"**. Policy: if `late_cancel` is **False** (cancelled outside `cancel_window_hours`) → refund (set `deposit_refunded_at`, `payment_status=REFUNDED`, mark tx `REFUNDED`, gateway refund call if paytechuz supports it else manual). If `late_cancel` is **True** or `NO_SHOW` → owner keeps deposit (no refund). The owner can always override. Reuse the `late_cancel` signal already computed in `cancel_booking` (`booking_service.py:380-386`). |
| **No-show with paid deposit** | `flag_no_shows` flips to `NO_SHOW`; deposit stays (forfeited). This is the whole point of the feature. No refund. |
| **Unpaid hold expiry** | `expire_unpaid_holds` (§4f) cancels after `deposit_hold_minutes`; slot freed; waitlist head pinged. `flag_no_shows` skips these rows. |
| **Slot stolen during hold** | The slot is reserved the moment the `PENDING` booking is inserted (`_check_slot_available` already counts `PENDING` rows, `booking_service.py:117`). So a held slot is **not** double-booked. Good — no change needed, but it means an unpaid hold blocks others, which is why the hold TTL must be short (default 30 min). |
| **Provider creds missing** | If both Payme and Click creds are unset, `create_booking_deposit_payment` returns `link==""`. Bot must detect empty links and fall back to **MANUAL** behavior (`PENDING`, owner approves) with a logged warning — never strand the client with no pay button. |
| **Promo / loyalty → 0 price** | Deposit on 0 is meaningless → `deposit_required=False`, route as MANUAL/AUTO per §4a. |
| **Double-pay (both Payme and Click)** | Each provider has its own tx; the first webhook confirms the booking. The second `complete_booking_deposit` sees `booking.status != PENDING` → does not re-confirm, but the second tx is still `COMPLETED` (client overpaid). Mitigation: lazily create only the chosen provider's tx (§4e `POST .../pay/{provider}`), and in the bot give one provider's link at a time, or refund the surplus tx. Spec default: lazy single-provider tx eliminates this. |
| **Subscription expired mid-flow** | `create_booking` already calls `_check_active_subscription` (`:159`) and raises before any deposit logic. Unchanged. |

---

## 8. File-by-file task list

**Backend — models / migration**
1. `backend/app/models/enums.py` — add `PaymentStatus.PARTIAL`.
2. `backend/app/models/payment.py` — add `kind`, `booking_id` to `PaymentTransaction`.
3. `backend/app/models/booking.py` — add `deposit_required`, `deposit_amount`, `deposit_paid_at`, `deposit_refunded_at`.
4. `backend/app/models/business.py` — add `deposit_percent`, `deposit_hold_minutes`.
5. `backend/alembic/versions/023_booking_deposits.py` — new migration (§3d), `down_revision="022"`.

**Backend — services**
6. `backend/app/services/booking_service.py` — PREPAYMENT branch in `create_booking` (compute deposit after promo/loyalty; set deposit fields); guard `final_price==0`.
7. `backend/app/services/payment_service.py` — add `create_booking_deposit_payment(db, booking, provider)` and `complete_booking_deposit(db, tx)` (no subscription side-effects).

**Backend — routers / webhook**
8. `backend/app/routers/payments.py` — in `payme_webhook` + `click_webhook`, branch on `tx.kind` ("deposit"→`complete_booking_deposit`, else existing); add amount-reconciliation guard.
9. `backend/app/routers/bookings.py` — `POST /api/bookings/{id}/pay/{provider}` (lazy deposit tx + link); include `deposit_required`/`deposit_amount` in booking-create response.
10. `backend/app/schemas/booking.py` — surface `deposit_required`, `deposit_amount` in `BookingRead`/create response.

**Backend — schemas / API**
11. `backend/app/schemas/business.py` — add `deposit_percent`, `deposit_hold_minutes` to `BusinessUpdate` (validated) and `BusinessMe`.

**Backend — tasks**
12. `backend/app/tasks/reminders.py` — new `expire_unpaid_holds` task + beat schedule entry; amend `flag_no_shows` candidate filter to skip unpaid deposit holds.

**Bot**
13. `backend/bot/handlers/booking.py` — pay-link step in `confirm_booking` + `receive_phone_for_booking`; `_make_deposit_links` helper; extend `_create_booking_sync` return dict; adjust `_notify_owner_of_booking` suffix + suppress owner approve kb for PREPAYMENT.
14. `backend/bot/keyboards/inline.py` — deposit pay keyboard (Payme/Click url buttons + cancel) and any `depcancel:` handler wiring.

**Frontend**
15. `frontend/src/app/dashboard/profile/page.tsx` — deposit % + hold-minutes inputs shown when PREPAYMENT; load/save mapping; live preview.
16. `frontend/src/types/index.ts` — add `deposit_percent`, `deposit_hold_minutes` to business type.
17. `frontend/src/app/dashboard/bookings/page.tsx` — show deposit status (paid/awaiting/refunded) per booking; "Depozitni qaytarish" action on cancel of a paid PREPAYMENT booking (calls a refund endpoint scoped by `get_owned_business`).

**Tests (recommended)**
18. `backend/tests/` — unit: deposit amount = round(price*pct/100) post-promo; webhook with `kind="deposit"` confirms booking and does **not** create a subscription; webhook replay is idempotent; `expire_unpaid_holds` cancels stale holds and `flag_no_shows` skips them; amount-mismatch leaves booking PENDING.

---

## 9. Out of scope (this version)
- Gateway-initiated automatic refunds if paytechuz lacks a refund API — mark `REFUNDED` in-app + manual transfer (mirrors subscription refund at `payment_service.py:223`).
- Variable deposit per service or per client reliability score (feature #7 feeds this later — note the natural hook: low-reliability clients could be forced into PREPAYMENT even when business is AUTO).
- Partial-to-full payment capture at the visit (owner just marks `payment_status=PAID` manually for now).

---

Relevant files (absolute):
- `D:/yozuv/backend/app/models/enums.py`, `payment.py`, `booking.py`, `business.py`, `service.py`
- `D:/yozuv/backend/app/services/booking_service.py`, `payment_service.py`
- `D:/yozuv/backend/app/routers/payments.py`, `bookings.py`
- `D:/yozuv/backend/app/schemas/business.py`, `booking.py`
- `D:/yozuv/backend/app/tasks/reminders.py`
- `D:/yozuv/backend/bot/handlers/booking.py`, `D:/yozuv/backend/bot/keyboards/inline.py`
- `D:/yozuv/frontend/src/app/dashboard/profile/page.tsx`, `D:/yozuv/frontend/src/app/dashboard/bookings/page.tsx`, `D:/yozuv/frontend/src/types/index.ts`
- New: `D:/yozuv/backend/alembic/versions/023_booking_deposits.py` (down_revision `022`)