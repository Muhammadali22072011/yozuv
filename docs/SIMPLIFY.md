I have all the evidence I need. Let me compile the prioritized findings.

The task is an audit returning a prioritized markdown list — not applying fixes. Here is the deliverable.

---

# Yozuv Simplification Audit — Prioritized Opportunities

Ranked by payoff-to-effort. Each item is concrete: files, what to extract/merge, effort (S/M/L), and the win.

## P1 — Analytics N+1: one SQL query per day (Efficiency)

**Files:** `backend/app/routers/analytics.py:76-121`
- `revenue_chart` loops `for i in range(days-1, -1, -1)` and runs **one `SUM` query per day** — up to **400 round-trips** for `days=400`.
- `bookings_by_day` does the identical thing — up to **365 `COUNT` queries** for one chart.

**Fix:** Replace each loop with a single grouped query, then zero-fill missing dates in Python:
```python
rows = (db.query(Booking.date, func.coalesce(func.sum(Booking.payment_amount), 0))
        .filter(Booking.business_id == business.id, Booking.date >= start,
                Booking.date <= today, Booking.status != BookingStatus.CANCELLED)
        .group_by(Booking.date).all())
by_date = {d: amt for d, amt in rows}
out = [RevenuePoint(date=(today - timedelta(days=i)).isoformat(),
                    amount=int(by_date.get(today - timedelta(days=i), 0)))
       for i in range(days - 1, -1, -1)]
```
**Effort:** S. **Payoff:** Largest single perf win in the codebase — collapses ~765 DB queries to 2 across the two endpoints. The frontend (`analytics/page.tsx:30-42`) already calls both in `Promise.all`, so no client change needed.

## P2 — Centralize `API_URL` / `BOT_USERNAME` literals (Reuse / Altitude)

**Files (re-declaring `"https://yozuv.onrender.com"` and/or `"Yozuv_cl_bot"`):**
- `frontend/src/app/biz/[slug]/page.tsx:6-7` (`const API`, `const BOT`)
- `frontend/src/app/dashboard/page.tsx:225,264` (inline `process.env... || "..."`)
- `frontend/src/app/catalog/map/page.tsx:39-40`
- `frontend/src/app/dashboard/qr/page.tsx:80`
- `frontend/src/app/dashboard/onboarding/page.tsx:421` — **hardcodes `t.me/Yozuv_cl_bot` directly in JSX**, ignoring `NEXT_PUBLIC_BOT_USERNAME` entirely → preview shows the wrong deep-link if the env var differs.

**Fix:** `lib/api.ts` already exports `apiBase()`. Add a sibling `botUsername()` (and optionally a `telegramDeepLink(slug)` helper that builds `https://t.me/${botUsername()}?start=${encodeURIComponent(slug)}` — that exact template is duplicated in 5 files). Import everywhere; delete the local `const API`/`const BOT` declarations.
**Effort:** S. **Payoff:** Kills 5 copies of two magic strings + 5 copies of the deep-link template; fixes the onboarding preview bug-in-waiting; one place to change the bot.

## P3 — Dedupe Leaflet loader (Reuse)

**Files:** `frontend/src/components/yz/MapPicker.tsx:15-49` re-implements `loadLeaflet` + the `LEAFLET_CSS`/`LEAFLET_JS` constants **byte-for-byte identical** to `frontend/src/lib/leaflet.ts`. `catalog/map/page.tsx` already imports the shared one; `MapPicker` does not.

**Fix:** Delete the local copy in `MapPicker.tsx`; `import { loadLeaflet, TASHKENT } from "@/lib/leaflet"`.
**Effort:** S. **Payoff:** Removes ~35 duplicated lines and the two-loaders-racing risk; single source for the Leaflet version pin.

## P4 — Single shared `useIsAdmin` / lift auth/me into context (Reuse / Efficiency)

**Files:** The exact `apiFetch<{is_admin?}>("/api/auth/me").then(u => setIsAdmin(!!u?.is_admin))` block is copy-pasted in:
- `frontend/src/components/dashboard/Sidebar.tsx:53`
- `frontend/src/components/yz/TabBar.tsx:76`
- `frontend/src/app/dashboard/admin/page.tsx:211`

Meanwhile `components/dashboard/AuthBootstrap.tsx:68` **already fetches `/api/auth/me`** at the dashboard root to validate the token — then throws the body away. So every dashboard render hits `/api/auth/me` **4 times**.

**Fix:** Have `AuthBootstrap` keep the `me` payload and expose it via a `MeContext` (`{ isAdmin, firstName, ... }`). Replace the three duplicated fetches with `useMe()`. `settings/page.tsx:57` and `security/page.tsx:22` also fetch `/api/auth/me` and can read from context too.
**Effort:** M. **Payoff:** 3 copies → 1 hook; ~4 redundant network calls per dashboard load → 0; admin flag becomes consistent across nav and page.

## P5 — Move 37 inline Pydantic schemas out of routers (Altitude / Simplification)

**Files:** 37 `class …(BaseModel)` bodies live inside router modules instead of `app/schemas/`:
- `payments.py` (8), `admin.py` (7), `staff.py` (4), `schedule.py` (4), `services.py` (3), `subscription.py` (3), `reviews.py` (2), `promo.py` (2), `clients.py` (2), `bookings.py` (2).

Only 4 schema files exist (`analytics, auth, booking, business`), so routers are doing double duty as schema modules. Four `*Out` classes also repeat the `class Config: from_attributes = True` boilerplate.

**Fix:** Move request/response bodies into per-domain files under `app/schemas/` (e.g. `schemas/staff.py`, `schemas/payments.py`). Define one `ORMModel(BaseModel)` base with `model_config = ConfigDict(from_attributes=True)` and inherit it for the `*Out` classes.
**Effort:** M (mechanical, mostly cut/paste + imports). **Payoff:** Routers shrink to routing logic; schemas become reusable/testable in isolation; removes the from_attributes boilerplate repetition.

## P6 — Break up the `admin/page.tsx` god-component (Simplification / Altitude)

**File:** `frontend/src/app/dashboard/admin/page.tsx` — **1865 lines, 25 `useState`, 7 inline tab panels** (`{tab === "summary" && …}` … through `"audit"`), each with its own loaders, forms, and JSX inlined in one function.

**Fix:** Extract one component per tab into `dashboard/admin/_tabs/` — `SummaryTab`, `BusinessesTab`, `PaymentsTab`, `BroadcastTab`, `CardSettingsTab`, `BackupTab`, `AuditTab`. Each owns its own state + loader; the page keeps only `tab`, `isAdmin`, and the tab switcher. The `BizFormState`/`SubFormState`/`BroadcastFiltersState` types and `EMPTY_*` constants move with their tabs.
**Effort:** L. **Payoff:** Turns one 1865-line file into ~7 focused ~150-line files; per-tab state stops re-rendering the whole page; far easier to navigate/diff/test. Highest maintenance win but the most work, hence below the cheaper structural fixes.

## P7 — Shared toast-error helper (Simplification)

**Files:** `(e as Error).message?.slice(0, 80) || "xatolik"` and `(e as Error).message || "…"` appear **39 times** across 12 files (`admin` alone has 15; also `profile, promo, qr, schedule, services, settings, staff, onboarding, BookingSheet, NewBookingSheet`).

**Fix:** Add `errMsg(e: unknown, fallback: string)` to `lib/utils.ts` (or a `toastError(toast, e, fallback)` wrapper) and call `toast(\`Bizneslar yuklanmadi: ${errMsg(e, "xatolik")}\`)`.
**Effort:** S. **Payoff:** One definition of the truncate-and-fallback rule instead of 39 hand-rolled copies; consistent error UX.

## P8 — Extract shared analytics date-range filter (Altitude)

**File:** `backend/app/routers/analytics.py` — the `(business_id == … AND date BETWEEN start..today AND status != CANCELLED)` filter triple is hand-written **8 times**, and `func.coalesce(func.sum(Booking.payment_amount), 0)` **4 times**.

**Fix:** Add a small module helper, e.g. `def _scoped(q, business, start, today): return q.filter(Booking.business_id==business.id, Booking.date>=start, Booking.date<=today, Booking.status != BookingStatus.CANCELLED)` and a `REVENUE = func.coalesce(func.sum(Booking.payment_amount), 0)` expression constant.
**Effort:** S. **Payoff:** Removes 8 copies of the same filter clause; one place to change "what counts as revenue" / "which statuses count".

---

**Suggested order:** P1 → P2 → P3 → P7 (all S, high signal) → P4 → P5 → P8 → P6 (L). P1 is the standout: a ~2-line-per-endpoint change that eliminates hundreds of DB round-trips.