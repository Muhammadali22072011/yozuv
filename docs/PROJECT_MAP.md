All paths confirmed against ground truth. Here is the PROJECT MAP.

---

# Yozuv — Project Map

> Onboarding guide for developers. All paths are absolute-from-repo-root unless noted. The codebase is a Telegram-first booking SaaS for Uzbek service businesses (barbershops, salons, clinics, etc.).

## 1. What the product is

**Yozuv** is a multi-tenant booking SaaS delivered almost entirely through Telegram:

- **Clients** discover a business and book appointments inside a **Telegram bot** (aiogram) — pick viloyat/tuman/category → service → master → date/time → optional promo → confirm.
- **Business owners** manage everything (bookings, services, staff, schedule, clients, promos, reviews, analytics, QR/brochure, billing) from a **Next.js dashboard rendered as a Telegram Mini App (WebApp)**.
- **Platform admins** run the business through an in-dashboard admin console (MRR, businesses, payments, broadcasts, DB backup/restore, audit log).

Monetization is a subscription (14-day TRIAL → MONTHLY 187,500 UZS / YEARLY 1,875,000 UZS) paid via Payme/Click gateways or a manual card-receipt flow approved by an admin. UI is Uzbek (Latin); the language is part of the product identity.

There is **no email/password auth anywhere** — all owner authentication is Telegram WebApp `initData` validated server-side.

## 2. Top-level architecture

```
Telegram client ──┐
                  ├─► FastAPI process (backend/app/main.py) ── single deployment unit ──┐
Telegram bot   ───┘     • /api/*      → REST routers                                    │
                        • /webhook    → aiogram dispatcher (bot updates)                │
                        • /{path}     → reverse-proxy to Next.js frontend               │
                                                                                        │
Owner (Mini App) ──► Next.js 14 dashboard (frontend/) ──► /api/* through apiFetch ──────┘

Celery worker + beat (Asia/Tashkent) ──► scheduled side-effects (reminders, no-shows, backup)
PostgreSQL  •  Redis (Celery broker)  •  S3-compatible bucket (nightly backup)  •  Payme/Click
```

**Unusual deployment shape (key mental model):** one FastAPI process is simultaneously the API server, the Telegram webhook consumer (it feeds updates into an in-process aiogram `Dispatcher`), and a full reverse proxy to the Next.js frontend. See `backend/app/main.py` — router registration order matters (the comment notes `/business/me/*` routers must precede `business.router` so `/business/{slug}` doesn't swallow `me`), and the catch-all `/{path:path}` buffers entire upstream bodies (can't stream large frontend responses; single point of failure).

The frontend and backend share **no code** — the only contract is the `/api/*` REST surface plus Telegram deep-links (`t.me/<bot>?start=<slug>`).

---

## 3. Frontend (Next.js 14 App Router — `frontend/`)

Client-rendered SPA-style dashboard. No SSR data fetching on dashboard pages, **no shared client store / no React-Query / no SWR** — every page does its own `useEffect` + `fetch` + `useState`.

### 3.1 Subsystems

| Area | Entry / key files | Responsibility |
|---|---|---|
| **Public + landing + auth** | `frontend/src/app/page.tsx`, `frontend/src/app/auth/login/page.tsx`, `frontend/src/app/biz/[slug]/page.tsx`, `frontend/src/app/catalog/map/page.tsx` | Marketing landing (fully static), Telegram-only login (writes JWT to localStorage), SSR per-business profile with OG/Twitter metadata, Leaflet discovery map. `/auth/register` is a static explainer — registration is really Telegram login + dashboard onboarding. |
| **Dashboard shell + pages** | `frontend/src/app/dashboard/layout.tsx` → `AuthBootstrap.tsx` → `DashboardShell.tsx` | 15 owner pages (`bookings`, `clients`, `services`, `staff`, `schedule`, `analytics`, `reviews`, `promo`, `qr`, `profile`, `settings`, `onboarding`, home `page.tsx`) + the `admin` console. |
| **Shared design system (`yz`)** | `frontend/src/components/yz/index.ts` (barrel), `frontend/src/components/yz/Sheet.tsx`, `NewBookingSheet.tsx`, `BookingSheet.tsx`, `ClientSheet.tsx`, `TabBar.tsx`, `MapPicker.tsx`, `Tour.tsx` | Mobile-first Radix-based bottom sheets, booking/client flows, nav, map picker, tour engine. |
| **Onboarding + tours** | `frontend/src/lib/onboarding.ts`, `tour-state.ts`, `use-page-tour.ts`, `frontend/src/components/yz/TourFloat.tsx`, `WelcomeModal.tsx` | localStorage-only guided onboarding chain across 7 pages + per-page spotlight tours. |
| **Infrastructure (`lib`)** | `frontend/src/lib/api.ts`, `lib/leaflet.ts`, `lib/utils.ts` | The `apiFetch` wrapper (the only HTTP entry point), Leaflet loader, `cn()`. |

### 3.2 Auth & data flow

- `AuthBootstrap.tsx` reads `window.Telegram.WebApp.initData` → `POST /api/auth/telegram` → stores `yozuv_access` / `yozuv_refresh` in **localStorage** (the single source of session truth; XSS-exposed by design, `credentials:'omit'`). It gates rendering of all dashboard children with `checking/ready/failed` states.
- Every request goes through `lib/api.ts#apiFetch`: injects `Authorization: Bearer`, on `401` does a **single coalesced** `/api/auth/refresh` (module-level `refreshInFlight` promise) and retries once; persistent 401 clears tokens and hard-redirects to `/auth/login`.
- **Binary downloads bypass apiFetch** and hand-roll their own `Authorization` header (QR/brochure in `qr/page.tsx`, admin backup/screenshots in `admin/page.tsx`, receipt upload in `settings/page.tsx`) — so the transparent 401-refresh does **not** apply to them.
- Cross-page invalidation is a single global `window` CustomEvent `'yz:bookings-changed'`, dispatched by `NewBookingSheet`/`DashboardShell` and listened to only by the home + bookings pages.
- The home page (`dashboard/page.tsx`) opens an **SSE** `EventSource` to `/api/business/me/notifications/stream` (token passed as `?token=` query because EventSource can't set headers) with a 5-min fallback poll.

### 3.3 Notable concentrations

- `admin/page.tsx` is a **1843-line god-component** (7 tabs, ~30 `useState`, two inline modals, ~20 endpoints) — the largest file in the repo; prime decomposition target.
- `NewBookingSheet.tsx` is the heaviest shared component (4-step wizard that fetches clients/services/busy-slots and POSTs the booking itself).

---

## 4. Backend API (`backend/app/routers/` + `backend/app/schemas/`)

~16 routers mounted under `/api`. Routers query `app.models` **directly — there is no repository layer**. Three audiences from one app:

| Router | Path | Responsibility |
|---|---|---|
| `auth.py` | `/api/auth/*` | Validate Telegram initData → upsert `User` → issue JWT access+refresh; `/refresh`, `/me`. Rate-limited per IP. |
| `bookings.py` | `/api/bookings`, `/business/me/bookings`, `/business/{slug}/slots` | Largest router (3 sub-routers). Public booking (initData-verified), owner CRUD with advisory-lock + `SELECT FOR UPDATE`, confirm/complete/cancel, recurring series, waitlist, public slots. |
| `business.py` | `/business/*` | Business CRUD; **`/me/dashboard`** one-shot aggregate (replaces ~10 calls), `/me/notifications/stream` (SSE), public `/catalog` (in-Python haversine), `/{slug}`. On create: seeds `Membership(OWNER)` + 14-day TRIAL `Subscription` + default Mon–Sat schedule. |
| `payments.py` | `/payments/*` | Payme/Click checkout URLs, manual card flow (create→upload receipt→admin approve/reject), provider webhooks (signature-verified, fail-closed), refund, receipt serving. Delegates to `payment_service`. |
| `subscription.py` | `/subscription/*` | Status + `/upgrade`. Thin wrapper that **overlaps** `payments.py` create endpoints. |
| `admin.py` | `/admin/*` | Summary/MRR, business CRUD, subscription extend, broadcasts (bounded async fan-out), full-DB JSON backup export + **destructive import** (`REPLACE-ALL-DATA` confirm phrase), audit log. Every mutation logs `log_admin_action`. |
| `services/staff/schedule/clients/reviews/promo/analytics/files/geo.py` | various | Owner CRUD + read endpoints. `analytics.py` is read-only dashboards (some endpoints loop one SQL query per day). `files.py` does QR/brochure/logo with path-traversal guards. `geo.py` is static lookups, no DB/auth. |

**Schemas live in only 4 files** (`auth`, `booking`, `business`, `analytics` under `backend/app/schemas/`); `services`, `staff`, `schedule`, `promo`, `payments`, `admin` and several booking bodies define their Pydantic models **inline in the router** — inconsistent placement.

**Shared deps** (`backend/app/deps.py`): `get_current_user` (JWT), `get_owned_business` (legacy single-business via `Business.owner_id`), `get_owned_business_download` (accepts `?token=` for browser downloads/SSE/PDF), `get_admin_user` (checks `telegram_id` against env). `get_active_business` + `require_role` (membership/RBAC) exist but **no router uses them yet** (see Risks).

**Config** (`backend/app/config.py`): pydantic-settings with a `model_validator` that **hard-fails boot in production** if `BOT_TOKEN`/`DATABASE_URL`/`CORS_ORIGINS`/`PUBLIC_API_URL`/`WEBHOOK_SECRET` are missing or localhost.

---

## 5. Backend domain core (`backend/app/models/`, `services/`, `tasks/`, `utils/`)

### 5.1 Models (`backend/app/models/`)

The data graph: `business` (tenant root, `owner_id` unique FK — one business per owner, legacy), `booking` (central fact table), `service`, `staff`, `schedule`, `client`, `subscription`, `payment`, `review`, `promo_code`, `waitlist_entry`, `client_block`, `membership` (dormant — see Risks), `admin_audit_log`, `broadcast_message`, `platform_settings`, `user`. Enums in `enums.py` are stored as **plain `String` columns, not DB enums** — the DB does not constrain values.

### 5.2 Services (`backend/app/services/`) — **commit-free pure functions**; the caller owns the transaction and the Telegram I/O

- `booking_service.py` — the most logic-dense file. `create_booking`: load business → validate active service → optional staff → `_check_active_subscription` → block-list → `pg_advisory_xact_lock(md5(business:date:start))` → idempotency short-circuit → `_check_slot_available` overlap query with `.with_for_update()` (per-business when `staff_id` is None, per-staff when set) → `get_or_create_client` → confirmation mode (AUTO→CONFIRMED else PENDING) → `_apply_promo` (FOR UPDATE + usage cap) → `_maybe_apply_loyalty` (every Nth COMPLETED visit free) → insert + flush. **Only flushes** — the router commits then fires notifications + `event_bus.publish`.
- `payment_service.py` — subscription/payment lifecycle. The **exception** to commit-free: it mutates AND sends Telegram messages inline (`complete_transaction_and_notify`, `reject_card_payment`, `refund_transaction`). `activate_subscription` locks Business + current ACTIVE Subscription FOR UPDATE.
- `waitlist_service.py`, `notification_service.py` (Telegram HTTP API, sync+async, failures swallowed), `event_bus.py` (in-memory asyncio pub/sub for SSE — single-process), `pdf_service.py` (ReportLab A5 brochure, WinAnsi transliteration), `qr_service.py` (hand-rolled PIL QR, `lru_cache(512)`), `audit_service.py` (best-effort, add-only, swallows all exceptions).

### 5.3 Tasks (`backend/app/tasks/`) — Celery beat, Asia/Tashkent

`reminders.py`: `send_hourly_reminders` (per-minute beat, window + `reminder_sent_at` dedup), `flag_no_shows`, `send_birthday_greetings`, `send_reengagement_nudges` (cooldown via `last_outreach_at`), `trial_expiry_warnings`. `backup.py`: `snapshot_to_s3` (nightly full-DB JSON dump). Wired in `backend/app/celery_app.py`.

### 5.4 Utils (`backend/app/utils/`)

`auth.py` (JWT HS256 + bcrypt), `telegram_webapp.py` (HMAC-SHA256 initData validation, 1h TTL anti-replay), `slots.py` (30-min granularity slot generation), `clock.py` (**Asia/Tashkent helpers — docstring mandates using them everywhere**), `ratelimit.py` (single-process in-memory), `uz_geo.py` (static viloyat→tuman map), `htmlsafe.py` (`h()` HTML-escape for Telegram messages).

---

## 6. Telegram bot (`backend/bot/`)

The primary client-facing surface. aiogram, synchronous SQLAlchemy sessions opened per-handler.

- `setup.py` — `build_bot_and_dispatcher()` factory (shared by webhook + polling), registers `ThrottlingMiddleware` (0.5s/user, in-memory), includes routers in order `start, booking, my_bookings, owner`, sets the WebApp "Kabinet" menu button.
- `main.py` — **local-dev polling only** (docstring warns not to run alongside the API in prod → `TelegramConflictError`).
- **Production wiring is in `backend/app/main.py`**: lifespan builds bot+dispatcher and `set_webhook`; `POST /webhook` validates the secret-token header then `dp.feed_update`.
- Handlers: `start.py` (discovery funnel `flt:*`, `/start <slug>` deep-link), `booking.py` (the full booking FSM `book:→svc:→svcok:→stfok:→day:→time:→prom_*→confirm:`, offloads DB work via `asyncio.to_thread`), `my_bookings.py` (`/mybookings` + reviews + client cancel), `owner.py` (inline confirm/reject on the new-booking notification).
- **Protocol:** keyboards (`keyboards/inline.py`) and handlers communicate via an **untyped colon-delimited `callback_data` string scheme** — drift between them fails at runtime, not import.
- `locales.py` (UZ/RU `t()`) is **dead within the bot** — only `app/tasks/reminders.py` and `app/routers/bookings.py` import it. All bot handler copy is hardcoded Uzbek.

---

## 7. Main data flows

### 7.1 Booking lifecycle

```
Client (bot OR Mini App)
  → booking_service.create_booking(db, payload)        [advisory lock + FOR UPDATE conflict check]
  → status = CONFIRMED (AUTO) or PENDING (MANUAL)
  → caller commits, then notify_owner via send_telegram_message + event_bus.publish (SSE → dashboard bell)
PENDING → owner taps inline button (owner.py own_confirm:/own_reject:) → CONFIRMED / CANCELLED(reason) → client notified
CONFIRMED → completed (owner) → loyalty stamp may apply
Cancel (client, within cancel_window_hours) → late_cancel flagged → waitlist_service.notify_first_for_slot pulls oldest waitlist entry
Celery: flag_no_shows nightly (PENDING/CONFIRMED past end_time+2h → NO_SHOW); send_hourly_reminders 1h before
```

Two write entry points (`backend/app/routers/bookings.py` and `backend/bot/handlers/booking.py`) **converge on the same `booking_service`**.

### 7.2 Payment / subscription

```
Owner picks plan (settings page OR bot)
  → payment_service.create_{payme|click|card}_payment → inserts PENDING PaymentTransaction
  Payme/Click: paytechuz gateway link → client pays → provider webhook (payments.py, signature-verified, fail-closed)
  Card: owner uploads receipt image → admin approve_card_payment (admin/page.tsx → /payments/approve)
  → complete_transaction_and_notify → COMPLETED → activate_subscription (locks Business + active Subscription FOR UPDATE,
     expires old, inserts new 30/365/14-day window) → owner Telegram message
Refund: admin → refund_transaction → REFUNDED + CANCELLED
Gate: booking_service._check_active_subscription rejects new bookings without an ACTIVE non-expired Subscription
Celery: trial_expiry_warnings
```

### 7.3 Telegram bot booking flow

```
/start <slug>  OR  discovery (viloyat → tuman → category → results)
  → business menu → book: (service) → svc: → svcok: (optional staff) → stfok: → day: → time:
  → prom_y/prom_n (FSM: BookingPromoStates) → confirm:
  → first-time booker: phone-contact request (FSM: BookingPhoneStates)
  → _create_booking_sync (asyncio.to_thread) → booking_service.create_booking
  → owner notified via send_telegram_message (separate httpx path, NOT the aiogram Bot)
```

FSM state (`staff_id`, promo, slot params) lives in aiogram's default **in-memory `MemoryStorage`**.

---

## 8. Key risk areas

**Security (high):**
- **JWT in URL query strings** — SSE stream, brochure download, settings flows pass the primary access token as `?token=` (`frontend/src/app/dashboard/page.tsx`, `qr/page.tsx`). Leaks into logs/Telegram link handlers.
- **Cross-tenant data leaks** — `client_detail` in `backend/app/routers/clients.py` loads a `Client` by UUID with no business scoping (PII leak); owner booking-create in `bookings.py` doesn't scope the client lookup to the business.
- **Payme/Click webhooks complete subscriptions without reconciling the paid amount** (`backend/app/routers/payments.py`).
- **HTML injection** in birthday/re-engagement Telegram messages — unescaped client name (`backend/app/tasks/reminders.py`); `send_hourly_reminders` escapes but these don't.
- **Standalone bot reviews** let any user post fake ratings for businesses they never visited (`backend/bot/handlers/my_bookings.py`).
- Leaflet loaded from **unpkg CDN with no SRI** (`frontend/src/lib/leaflet.ts`); login page leaks raw backend error bodies to users (`frontend/src/app/auth/login/page.tsx`); reverse proxy forwards the `Authorization` header to Next.js (`backend/app/main.py`).

**Correctness / concurrency:**
- **Recurring-series create double-books** — conflict checks run without the advisory lock that single bookings use (`backend/app/routers/bookings.py`).
- **Busy-slot grid is wrong** — treats CANCELLED bookings as busy and ignores multi-slot duration (`frontend/src/components/yz/NewBookingSheet.tsx`); public `/slots` ignores `staff_id` and `is_active`.
- **Owner bot "confirm" resurrects CANCELLED/NO_SHOW bookings** — mutates `booking.status` inline instead of routing through `booking_service.confirm_booking` (`backend/bot/handlers/owner.py`).
- **Timezone skew (latent 5h bug)** — `booking_service.cancel_booking` computes the late-cancel window against **server** local time via `.astimezone()` instead of Asia/Tashkent, contradicting `clock.py`'s mandate. Bookings store naive Tashkent-local datetimes; mixing naive/aware is load-bearing throughout.
- Onboarding wizard finish is **non-atomic** (business + N services + schedule, no rollback); same partial-state risk in `StaffSheet` save (two HTTP calls).

**Architecture / scaling debt:**
- **Membership/RBAC is half-built and dead** — `deps.py` defines `get_active_business`/`require_role`, `business.create` writes a `Membership(OWNER)` row, but **no router consumes them**; every owner endpoint still uses legacy `get_owned_business` (single business via `owner_id`, which is `unique=True`). Multi-business is plumbing without consumers.
- **In-process state that breaks under multiple workers** — `event_bus.py` (SSE notifications lost across workers), `ratelimit.py` (per-worker limits multiply; trusts client `X-Forwarded-For`), bot `ThrottlingMiddleware` (per-process, unbounded map), and aiogram `MemoryStorage` (FSM state lost between workers — the booking handler already re-stashes `staff_id` defensively, signaling known fragility). All require Redis to scale.
- **One process does everything** (`backend/app/main.py`: API + webhook + frontend proxy) — single point of failure, unusual to operate.
- **N+1 / per-day query patterns** in `analytics.py` (one aggregate per day, up to ~400 iterations), `business.catalog` (loads ALL active businesses then filters/paginates in Python), `send_hourly_reminders` (commits inside per-booking loop).
- **No frontend data layer** — duplicate fetches, `'yz:bookings-changed'` is the only cross-page invalidation (and only home + bookings subscribe); three independent `/api/auth/me` calls per page load.

**Data / privacy:**
- `snapshot_to_s3` (`backend/app/tasks/backup.py`) dumps **every table including `users` (telegram_id, phone) and `payment_transactions` (raw_payload, screenshot_url) as plaintext JSON** to the bucket, no encryption.

**Tour/onboarding fragility:**
- Tours bind to `data-tour` DOM anchors by string selector with no validation — a renamed/removed anchor silently skips (`Tour.tsx`). X-ing out of the dashboard tour force-starts the full 7-page chain (`dashboard/page.tsx`). `startOnboarding` wipes ALL tour-seen flags (`onboarding.ts`). Stale FAQ entry references the Calendar page removed in PR #60 (`HelpDrawer.tsx`).

---

### Where to start reading
1. `backend/app/main.py` — understand the one-process API+webhook+proxy shape and router ordering.
2. `backend/app/services/booking_service.py` — the domain heart; everything booking-related converges here.
3. `frontend/src/lib/api.ts` + `frontend/src/components/dashboard/AuthBootstrap.tsx` — how the frontend authenticates and talks to the backend.
4. `backend/app/deps.py` — the auth/tenancy guards (and the dead RBAC path).
5. `backend/bot/handlers/booking.py` — the primary client booking funnel.