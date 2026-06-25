All four memos' code references check out against the actual source. I have everything I need to merge them into one coherent document. Here is the unified identity architecture.

---

# Yozuv Identity Architecture — One Account, Many Login Methods

## Executive summary

Today a Yozuv account *is* a Telegram account: `User.telegram_id` is `BigInteger, unique=True, nullable=False` (`backend/app/models/user.py:31`), so no row can exist without a Telegram id, and password login is bolted onto that same row via `username`/`phone`/`password_hash`. This blocks the product goal of "one account reachable by Telegram, Google, or password across three runtime envs (Telegram Mini App, Android Capacitor APK, plain browser)." The fix is structural and already half-supported by the codebase: the JWT subject is the `User.id` UUID, not the provider id (`auth.py:73,107`; `utils/auth.py:42`), so sessions are *already* identity-agnostic. We introduce an `auth_identities` child table where one row = one external login method linked to one user, enforced by `UNIQUE(provider, subject)` (one external account → one Yozuv account) and `UNIQUE(user_id, provider)` (at most one of each provider per account). We add Google via server-side OAuth 2.0 Authorization-Code-with-PKCE (one flow that works in all three envs), add `token_version` to `User` for revocation, and ship behind a strict safety rule: **an identity is attached to an account only after cryptographic proof (signed Telegram initData / verified Google ID token) AND, on any collision, proof of control of the target account — email match alone never links or merges.** Rollout is four independently-shippable, reversible phases, with the inline `User` columns kept as a dual-written shim until the very last phase. The single highest-risk coupling to retire carefully: `is_admin_user` reads `int(user.telegram_id)` (`deps.py:80`) and `UserMe.telegram_id` is a required `int` (`schemas/auth.py:35`) — both must be fixed before any Google-only account exists.

## Login method × environment

| Login method | Telegram Mini App | Android APK (Capacitor) | Plain browser |
|---|---|---|---|
| **Telegram** | Primary, automatic. Signed `initData` → `/auth/telegram` auto-login. No button (loader only). | **Not offered as a button** (no `initData`, Telegram OAuth refuses embedded WebViews). Reachable only via deep-link-out *after* sign-in, from Settings. | Escape-hatch link only: "Telegramda ochish" → `https://t.me/{BOT}` (no `initData` in a browser). |
| **Password** | Not shown (Telegram auto-login wins). Can be *set* in Settings. | **Primary** card (login = phone or username + parol). | Primary card. |
| **Google** | v2: `WebApp.openLink` → system browser → `t.me` one-time code → `/exchange`. (v1: not offered; Telegram auto-login suffices.) | Secondary: `Browser.open` (Custom Tab) → App Link return with token in URL fragment. | Secondary: server `302` to Google → `/auth/callback#access=…&refresh=…`. |
| **Future socials (Apple, …)** | same model as Google (new `provider` value, new `/auth/{provider}` route, returns the same `TokenPair`) | same | same |

Open question the memos left genuinely undecided (flagged, not silently resolved): **v1 Mini App Google support.** The google-oauth memo proposes a `t.me` one-time-code deep-link path; all memos agree the pragmatic v1 is to *skip Google in the Mini App* (Telegram auto-login already covers it) and ship the deep-link path as v2. This document adopts the v1/v2 split.

---

## 1. The data model: `auth_identities`

One row = one external login method linked to one User. The `User` row becomes the **account**; each `auth_identities` row is one **way to prove you are that account**.

### Resolved column set

The four memos proposed overlapping but slightly different schemas. Merged and deduplicated (column name → contradiction resolved):

```
auth_identities
  id              UUID PK                         default uuid.uuid4
  user_id         UUID FK -> users.id  ON DELETE CASCADE, NOT NULL, indexed
  provider        String(16)  NOT NULL            -- 'telegram'|'google'|'password'|'apple'
  subject         String(255) NOT NULL            -- stable external id (see table below)
  email           String(320) NULL                -- provider-supplied, display + takeover checks only
  email_verified  Boolean     NOT NULL DEFAULT false
  secret          String(255) NULL                -- bcrypt hash for provider='password'; NULL otherwise
  display_name    String(255) NOT NULL DEFAULT '' -- tg username / google name, for the Settings list
  created_at      DateTime(tz) NOT NULL           default _utcnow
  last_login_at   DateTime(tz) NULL

  UNIQUE (provider, subject)   name=uq_auth_identity_provider_subject
  UNIQUE (user_id, provider)   name=uq_auth_identity_user_provider
  INDEX  (user_id)             name=ix_auth_identities_user
```

**Contradictions resolved:**
- **Column name for the external id:** `subject` (3 of 4 memos) over `provider_subject`. Same meaning.
- **Column name for the password hash:** `secret` (matches the data-model memo's reuse of the 255-width `password_hash`). The security memo called it `secret_hash`; functionally identical — one name, `secret`.
- **`provider` width / type:** `String(16)` storing the enum `.value`, **not** a Postgres native `ENUM`. This is the established codebase pattern (`MembershipRole` is `str, enum.Enum` persisted as `String(16)` in `membership.py`, with `server_default` in the migration), avoids native-enum migration pain, and preserves SQLite test parity (the test DB is SQLite — see the `_JsonB` variant in `broadcast_message.py`). The google-oauth/security memos' `String(32)` is unnecessary; `'telegram'` is the longest value at 8 chars, `String(16)` matches the sibling enum column.
- **`email_verified`:** kept (from google-oauth/security/linking memos). The data-model memo omitted it; it is required for the Google trust gate (§5), so it stays.
- **`UNIQUE(user_id, provider)`:** kept as a plain two-column unique constraint (data-model memo). The linking memo proposed a *partial* unique `WHERE provider <> 'password'`; that complication is unnecessary because each user gets at most one password identity anyway, and a plain constraint is simpler and SQLite-portable. One identity per provider per user, full stop.
- **`last_login_at`:** kept (data-model + security). Seeded to `created_at` for telegram backfill, `NULL` for password.

### What `subject` holds per provider

| provider | `subject` | `secret` | `email` |
|---|---|---|---|
| `telegram` | Telegram numeric id as text (e.g. `"123456789"`) | NULL | NULL |
| `google` | Google OIDC `sub` claim (immutable, opaque — **not** the email; emails recycle) | NULL | verified email from token |
| `password` | normalized login the user types: lowercased `username` or `phone` | bcrypt hash (was `User.password_hash`) | NULL |
| `apple` | Apple OIDC `sub` (reserved; no code path yet) | NULL | relay email |

`subject` is `String(255)` for all providers so one column type serves every provider; reusing the 255-wide `secret` column means `hash_password`/`verify_password` (`utils/auth.py`) work unchanged (`verify_password` already tolerates `None`).

### The provider enum (`app/models/enums.py`)

```python
class AuthProvider(str, enum.Enum):
    """External login method backing an auth_identity row."""
    TELEGRAM = "telegram"
    GOOGLE = "google"
    PASSWORD = "password"
    APPLE = "apple"   # reserved; no code path yet
```

### SQLAlchemy model (`app/models/auth_identity.py`, new)

```python
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import AuthProvider


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AuthIdentity(Base):
    __tablename__ = "auth_identities"
    __table_args__ = (
        # One external account maps to exactly one identity row (one user).
        # Re-login is a lookup + UPDATE of last_login_at, never a 2nd INSERT.
        UniqueConstraint("provider", "subject", name="uq_auth_identity_provider_subject"),
        # A user has at most one identity per provider — you can't link two
        # Google accounts to one Yozuv account. A 2nd link hits this → 409.
        UniqueConstraint("user_id", "provider", name="uq_auth_identity_user_provider"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider: Mapped[AuthProvider] = mapped_column(String(16), nullable=False)
    # Stable external id: telegram numeric id (text), OIDC `sub`, or the
    # normalized username/phone for password login.
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Bcrypt hash for provider='password'; NULL for federated providers.
    secret: Mapped[str | None] = mapped_column(String(255), nullable=True)
    display_name: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="identities")
```

On `User`, add the back-reference and the revocation counter (keep the existing inline columns as a Phase-A shim, §6):

```python
    identities: Mapped[list["AuthIdentity"]] = relationship(
        "AuthIdentity", back_populates="user", cascade="all, delete-orphan",
    )
    token_version: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
```

Register `AuthIdentity` + `AuthProvider` in `app/models/__init__.py` (import + `__all__`, alongside `Membership`/`MembershipRole`).

---

## 2. Invariants and where each is enforced

1. **One external account → exactly one user.** DB-enforced by `UNIQUE(provider, subject)`. Login is `SELECT … WHERE provider=? AND subject=?` then follow `identity.user_id`. No TOCTOU race — a double-link is a constraint violation, not an app check.
2. **A user has at most one identity per provider.** DB-enforced by `UNIQUE(user_id, provider)`. A second Google link for the same user → catch `IntegrityError` → 409 (mirror the existing clash handling in `set_password`, `auth.py:137`).
3. **At least one identity must remain.** Not expressible as a single-table SQL constraint → enforced at the service layer: the unlink endpoint runs `SELECT count(*) … WHERE user_id=?` and refuses to delete the last one (409 "Bu yagona kirish usulingiz — uzib bo'lmaydi"). Account creation always inserts the `User` + its first identity in the **same transaction** so a user is never committed identity-less (mirrors the atomic create-then-commit already in `auth_telegram`, `auth.py:57-65`).
4. **Password identity owns its own subject.** The case-insensitive `username` uniqueness in `uq_users_username_lower` moves to `subject` under `provider='password'`, covered by `UNIQUE(provider, subject)`.
5. **Email is an attribute, never a key.** §5.

---

## 3. Google login: flow choice

Use **OAuth 2.0 Authorization Code + PKCE, with the code exchanged on the FastAPI backend** (client secret never reaches the browser/WebView). PKCE is included despite having a client secret — it binds the code to the originating client and protects the redirect/deep-link return leg (important for the APK).

Rejected alternatives: implicit flow (deprecated by Google + OAuth 2.1); Google Identity Services one-tap / in-browser ID token (works in a plain browser but fails in both the Telegram Mini App and the Capacitor WebView — no first-party Google cookies, iframe/popup restrictions — so it would split the design). One server-side code flow works in all three envs because the actual OAuth dance happens in a real system browser / Custom Tab.

**Token delivery decision (consistent across memos):** the callback returns the Yozuv `TokenPair` to the frontend via a redirect carrying tokens in the **URL fragment** (`#access=…&refresh=…`), never the query string (fragments aren't sent to servers / access logs). A dedicated `/auth/callback` page reads the fragment, writes `yozuv_access` / `yozuv_refresh` to `localStorage` (exactly what `AuthBootstrap`/`lib/api.ts` already expect), clears the hash, routes to `return`. HttpOnly cookies were rejected because the whole app is `localStorage` + `Authorization: Bearer` + `credentials:"omit"`, and the APK WebView is cross-origin to the API — staying on the fragment model means **zero changes to `get_current_user`, `apiFetch`, refresh, or CORS**.

### Per-env return mechanics

| Env | Open Google via | Return path | Token delivery | Extra infra |
|---|---|---|---|---|
| Browser | server `302` to Google | `/auth/callback` page | URL fragment | none |
| APK (Capacitor) | `Browser.open` (Custom Tab) | Android App Link `appUrlOpen` | URL fragment via deep link | `@capacitor/browser`, `assetlinks.json`, intent filter |
| Telegram Mini App (v2) | `WebApp.openLink` (system browser) | `t.me/{bot}?startapp=gauth_<code>` → `start_param` | one-time Redis code → `POST /exchange` | Redis one-time codes (TTL ~120s, single-use); bot handles `startapp` |

Why each env needs its own return: Google refuses to render consent inside a foreign iframe (Mini App) or an embedded WebView (APK — the `disallowed_useragent` 403), so both must hand off to the system browser / Custom Tab. The Mini App's external browser can't write back into the Mini App's `localStorage`, so a short-lived one-time Redis code (never the JWT) bridges via the `t.me` deep link. For the APK, prefer a verified **Android App Link** over a custom scheme (`uz.yozuv.app://…`) because custom schemes can be hijacked — and that is exactly why PKCE matters on the fallback.

### ID token verification (do not skip any check)

After `POST https://oauth2.googleapis.com/token` returns `id_token`: verify signature against Google's JWKS (`https://www.googleapis.com/oauth2/v3/certs`, cached/rotated); `iss ∈ {accounts.google.com, https://accounts.google.com}`; `aud == GOOGLE_CLIENT_ID`; `exp` future / `iat` recent; `nonce` matches the per-request nonce signed into `state` (replay protection); only trust `email` if `email_verified` is true.

**Library:** use **Authlib** + **httpx** (async) for the OAuth client + OIDC verification — it handles discovery, JWKS fetch/cache, nonce/state, and `id_token` validation, the security-critical pieces that are easy to get subtly wrong. `google-auth`'s `id_token.verify_oauth2_token` is an acceptable lighter alternative for the verify step only. Do not hand-roll JWKS rotation / PKCE. Add `authlib` and pin `httpx` in `backend/requirements.txt`.

---

## 4. Endpoints

All under the existing `auth` router (`backend/app/routers/auth.py`), prefix `/api/auth`. Reuse the existing `rate_limit(...)` helper (`auth.py:33-36`) on every Google route.

| Method & path | Purpose | Notes |
|---|---|---|
| `GET /google/start` | Begin flow. Query: `env=web\|apk\|tg`, `return=<path>`. Builds Google authorize URL with PKCE `code_challenge`, `nonce`, signed `state`. | `env=web` → `302` to Google. `env=apk\|tg` → `200 {"authorize_url": …}`. `state` is a short HS256 JWT (reuse `secret_key`) carrying `nonce`, `return`, `env`, TTL ~10min; PKCE `code_verifier` stored in **Redis keyed by state** (not round-tripped through the client). Optional `link_user_id` when an authenticated bearer is presented (link flow). |
| `GET /google/callback` | Google redirects here with `code`+`state`. Validate `state`, exchange code (+verifier+secret), verify `id_token`, run create-or-link (§5), mint `TokenPair`. | web/apk → `302` → `{public_app_url}/auth/callback#access=…&refresh=…&return=…`. tg → mint one-time Redis code → `302` → `t.me/{bot}?startapp=gauth_<code>`. Error → `302` → `/auth/login?error=…`. Callbacks are top-level navigations, so CORS doesn't apply. |
| `POST /google/exchange` | Mini-App only. Body `{ code }` (the `gauth_` code). Returns the real `TokenPair`. | Redis lookup, single-use, delete-on-read. Rate-limited like `/login`. Its origin must be in `cors_origins` (it's a `fetch`). |
| `GET /identities` | Authenticated. Lists linked methods for the Settings screen → `[{provider, label, linked, is_last}]`. | Read over `auth_identities`. |
| `POST /link/google` `{ id_token }` / `POST /link/telegram` `{ init_data }` | Authenticated. Verify the provider proof server-side, then attach to `current_user` (§5 state machine). | Telegram reuses `validate_telegram_init_data` (`telegram_webapp.py`). |
| `DELETE /identities/{provider}` | Authenticated. Unlink. **409 if it's the last identity.** Disconnecting password also nulls `User.password_hash`. Bumps `token_version`. | |

**Existing routes rewired (so the model is load-bearing):**
- `auth_telegram` (`auth.py:39`): `query(AuthIdentity).filter(provider='telegram', subject=str(tid))`. Hit → use `identity.user`, update `last_login_at`. Miss → create `User` + telegram `AuthIdentity` in one transaction. Also the link point: an authenticated user adding Telegram attaches to their existing `user_id`.
- `login` (`auth.py:80`): resolve via `query(AuthIdentity).filter(provider='password', subject=ident)` then `verify_password(body.password, identity.secret)`. Drops the `or_(username, phone)` scan and the `password_hash IS NOT NULL` filter — the identity's existence *is* the "password enabled" signal. Keep running `verify_password` on a miss to keep timing flat (anti-enumeration), as today (`auth.py:100-101`).
- `set_password` (`auth.py:114`): create-or-update the `password` identity for `current_user`; the clash check becomes `UNIQUE(provider, subject)` + `IntegrityError` → 409.

**Frontend:** new page `frontend/src/app/auth/callback/page.tsx`; `lib/platform.ts` gains `isNativeApp()` / `isWebBrowser()` (below); login page gains a "Google bilan davom etish" button branching on env; Settings (`/dashboard/security`) gains the "Kirish usullari" list. `get_current_user`, `utils/auth.py` minting, and `lib/api.ts` are unchanged — every path ends by producing the same `TokenPair` + `localStorage` keys.

### `platform.ts` — three-way env

The APK currently falls through to `isBrowser()`, which wrongly shows it a Telegram path. Add the third axis:

```ts
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  if (cap?.isNativePlatform?.()) return true;
  return /YozuvApp/i.test(navigator.userAgent); // custom UA from capacitor.config
}
export function isWebBrowser(): boolean {
  return typeof window !== "undefined" && !isTelegramMiniApp() && !isNativeApp();
}
```

Keep `isTelegramMiniApp` as-is; deprecate `isBrowser`, updating the three call sites (`AuthBootstrap.tsx:107,145`, `login/page.tsx:150`). Login screen rule: **env chooses the button set.** Mini App → loader only (auto `loginWithTelegram`). APK → password primary, Google secondary, **no Telegram button** (footnote: *"Telegram'ni kirgandan so'ng 'Kirish usullari'dan ulashingiz mumkin"*). Browser → password primary, Google secondary, Telegram escape-hatch link.

---

## 5. The merge / takeover problem (the dangerous path)

**Hard rule, encoded once on the backend:** a federated identity is attached to an account only when (a) the provider proof is verified server-side (signed initData / `email_verified==true` Google token) AND (b) the user has proven control of the target account in this session. **Email equality is a signal that prompts a verification-gated link — never an automatic join or merge.**

The attack this designs out: an attacker sets `email = victim@gmail.com` (self-asserted, unverified) on a password account; the real victim later signs in with a verified Google token for the same email; naive "link by matching email" would attach the victim's Google login to the attacker's account → full takeover. The reverse pre-hijack (attacker registers a self-asserted email matching a not-yet-onboarded victim) is blocked by the same rule.

### State machine (Google login/link)

```
verify id_token server-side  → (google sub, email, email_verified)
        │
  sub already a linked identity? ──yes──► same account? ─yes─► LOGIN ok (mint TokenPair)
        │ no                                    └─no──► CONFLICT 409
        ▼
  email matches an existing account, google not yet linked?
        │ yes ──► signed-OUT: LINK_REQUIRED  (prove control via password/Telegram,
        │         │                            then link from Settings — same sub now matches)
        │         └─ signed-IN & different acct: CONFLICT 409
        │ no
        ▼
  signed-OUT: CREATE User(telegram_id=NULL, email=…) + google identity ► LOGIN ok
  signed-IN : LINK google to current account ► ok
```

- **`LINK_REQUIRED`** (signed-out, email already registered): do **not** log in, do **not** auto-attach. Show: *"Bu e-mail allaqachon ro'yxatdan o'tgan"* → prompt to sign in with password or Telegram, then link Google from "Kirish usullari" (the prove-control-then-link flow). No new account, no merge.
- **`CONFLICT` (409)** (signed-in, this Google account belongs to a *different* account): block. Account merging (moving businesses/memberships/audit logs across `user_id`s) is out of scope and destructive. Show: *"Bu Google hisobi boshqa akkauntga ulangan. Avval o'sha joydan uzing."*
- New Google users get the same 14-day trial bootstrap that `/auth/telegram` new users get (mirror `auth.py:56-65`).

### Provider trust levels

| Provider | Proof | Trust | May do |
|---|---|---|---|
| **Telegram** | initData HMAC over bot token, TTL 3600s (`telegram_webapp.py`) | Trusted (cryptographic, replay-bounded) | Create account, authenticate, be a link target after re-auth |
| **Google** | ID token: sig/JWKS, `aud`, `iss`, `exp`, `nonce`, **`email_verified`** | Trusted **iff** `email_verified` | Same as Telegram. If `email_verified==false`: may authenticate an *already-linked* identity, never create or auto-link by email |
| **Password** | bcrypt match on self-chosen secret | Self-asserted | Authenticate only. Cannot be the ownership proof to attach a trusted provider; setting it already requires an authenticated session (`/set-password` via `get_current_user`) |

Two rules fall out: email is never a key; a self-asserted provider can never be the ownership proof for adding a trusted provider.

---

## 6. Sessions, revocation, and the migration shim

**Subject stays `User.id`** for every path (`auth.py:73,107`) — all identities of one account share one session space for free. What is missing and **required the moment linking exists** is revocation. Add `token_version` (monotonic int on `User`, `server_default "0"`):

- `create_access_token` / `create_refresh_token` embed the current `tv` (`utils/auth.py:42,50`).
- `get_user_from_token` (`utils/auth.py:58-69`) — the single funnel all bearer auth passes through (`deps.py:19`) — compares `payload["tv"] == user.token_version`; mismatch → reject. `/refresh` (`auth.py:148`) does the same check before minting.
- **Bump `token_version`** on: unlink an identity, password change/reset, "log out everywhere", admin disable, and destructive links (e.g. changing the primary email). Linking a *new* provider need not bump. This closes the known revocation gap (today a leaked 30-day refresh token is unstoppable; one increment kills every outstanding token atomically — one integer column, no session store).
- Optional later hardening: `jti` + short Redis denylist for single-token revocation. `token_version` is the floor.

**Other WIP gaps folded in:**
- **`UserMe.telegram_id: int` → `int | None = None`** (`schemas/auth.py:35`) **before** any Google-only account exists, or `/me` serialization 500s.
- **`is_admin_user` couples authorization to `int(user.telegram_id)`** (`deps.py:80`) — **the single biggest hidden coupling.** In Phase A it keeps reading the (still-populated) `telegram_id` shim. Before the inline column is dropped, re-home admin identity onto an `is_admin`/role column or a telegram-identity lookup. Do not drop `telegram_id` until this is done or admins lose access.
- **Per-account lockout** (today only 10/min/IP, `auth.py:35`): add Redis counters `login_fail:{user_id}` + `login_fail_ip:{ip}` with exponential backoff, to close distributed credential-stuffing. Keep the constant-time `verify_password`-on-miss behavior.
- **Notify on link/unlink** (out-of-band, e.g. a Telegram message to the existing identity) so a hostile silent link is visible to the owner.

**Why a shim, not a big-bang:** too much code reads the inline columns (`deps.py:80`, `UserMe` at `auth.py:178`, the `login` query). Keep `users.telegram_id` / `username` / `password_hash` as **dual-written** mirrors (the linking memo's caveat: always cache the linked Telegram subject back onto `users.telegram_id` so `is_admin_user` keeps working) until the final phase. Make `telegram_id` **nullable** (partial-unique `WHERE telegram_id IS NOT NULL`, the migration-`023` pattern) in the phase that first creates a Telegram-less user.

### Config to add (`backend/app/config.py`)

```python
google_client_id: str = ""
google_client_secret: str = ""
google_redirect_uri: str = ""          # e.g. https://yozuv.onrender.com/api/auth/google/callback
google_scopes: str = "openid email profile"
```

Keep them optional (don't gate `validate_production` on them, so the app boots without Google). `google_redirect_uri` must be registered **verbatim** in the Google Cloud Console (one per backend host: Render prod + `http://localhost:8000/api/auth/google/callback` for dev). The frontend return targets (`/auth/callback`, the `t.me` deep link, the App Link) are **not** Google-registered — only the backend `/google/callback` is. Reuse existing `secret_key` (state signing), `redis_url` (one-time codes + PKCE verifier + lockout), `public_app_url` / `public_api_url` / `next_public_bot_username` (redirect targets). On Render set `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI`; frontend needs at most a `NEXT_PUBLIC_*` feature flag to show/hide the button.

---

## 7. Phased rollout — each phase independently shippable and reversible

Aligned across all four memos. Every phase is gated by a flag and a `downgrade()`; the column drop is the only one-way door and ships last.

**Phase 0 — Introduce `auth_identities` + `token_version` + backfill (zero behavior change).**
- Migration `024` (additive only; `down_revision="023"`): create `auth_identities` (+ index + two unique constraints); add `users.token_version server_default '0'`. No drops, no new NOT-NULLs. Follow the structure of `021_memberships.py` (table create + index + Python backfill loop over `bind.execute(...).fetchall()`).
- Backfill in the same migration (idempotent): for every user insert `('telegram', str(telegram_id))` (cannot collide — `telegram_id` is already `UNIQUE`; seed `last_login_at = created_at`); for every user with `password_hash IS NOT NULL` insert `('password', lower(username or phone), secret=password_hash)` with `ON CONFLICT (provider, subject) DO NOTHING` (modern SQLite supports it; the `uq_users_username_lower` partial index already guarantees username uniqueness, so this is belt-and-suspenders for the rare username-vs-phone overlap — pre-check and log such rows rather than silently dropping a login).
- Code dual-writes the new table on signup/`set-password` but does **not** read it at the auth boundary yet. Start embedding/checking `tv` (default 0 → no-op).
- *Shippable:* invisible to users. *Reversible:* `downgrade()` drops the table + column; inline columns untouched.

**Phase 1 — Ship Google (browser + APK), read `auth_identities` for Google only.**
- Prep migration: make `users.telegram_id` nullable (partial-unique); change `UserMe.telegram_id` to `int | None`.
- Add `authlib`/`httpx`; new `utils/google_oauth.py`; `/google/start`, `/google/callback`, (browser+APK only) the §5 state machine; trial bootstrap for new Google users.
- Frontend: `isNativeApp`/`isWebBrowser` + 3 call-site updates; `/auth/callback` page; Google button on browser + APK; `@capacitor/browser` + App Link (`assetlinks.json`, intent filter). Mini App stays Telegram-auto.
- Telegram + password still read inline columns. *Shippable:* Google is purely additive. *Reversible:* feature-flag the *button* (not just the route) so no one is stranded.

**Phase 2 — Settings link/unlink + flip Telegram/password resolution to `auth_identities`.**
- Login resolution for Telegram + password now reads `(provider, subject) → user_id`; inline columns still dual-written for rollback. Phase-0 backfill guarantees every existing user already has their rows, so no one is locked out.
- `/dashboard/security` "Kirish usullari" list above the existing password form (`GET /identities`, `DELETE /identities/{provider}` with last-method 409, `POST /link/*`). Relabel the Settings row (`settings/page.tsx:375-381`). Per-account lockout + link/unlink notifications land here. Bump `token_version` on unlink.
- (v2) Mini App Google via `openLink` + `t.me` one-time code + `/google/exchange`.
- *Reversible:* a flag controls read-source; flip back to inline columns (still dual-written) and you're on the old resolver.

**Phase 3 — Retire inline columns (the one-way door, ships last).**
- **Prerequisite, do first:** re-home `is_admin_user` off `user.telegram_id` onto an `is_admin`/role column or telegram-identity lookup. Verify a reconciliation query: every inline `telegram_id` / `username+password_hash` has a matching `auth_identities` row and vice-versa.
- Stop dual-writing; drop `uq_users_username_lower` (now covered by `(provider, subject)`); drop `telegram_id` / `password_hash` (separate migration, a release after code stops reading them). `auth_identities` becomes the sole source of truth. Gate behind the confirmed-consistent checklist and a backup (`backup_s3_*` already configured).

---

## Relevant files

New: `backend/app/models/auth_identity.py`, `backend/app/utils/google_oauth.py`, `backend/alembic/versions/024_auth_identities.py` (`down_revision="023"`), `frontend/src/app/auth/callback/page.tsx`.
Edit: `backend/app/models/user.py` (add `identities`, `token_version`; nullable `telegram_id` in Phase 1; retire columns in Phase 3), `backend/app/models/enums.py` (`AuthProvider`), `backend/app/models/__init__.py` (register `AuthIdentity`+`AuthProvider`), `backend/app/routers/auth.py` (rewire `auth_telegram`/`login`/`set_password`; Google + link/unlink endpoints; lockout), `backend/app/utils/auth.py` (embed/verify `tv`), `backend/app/deps.py` (`tv` check; re-home `is_admin_user` before Phase 3), `backend/app/schemas/auth.py` (`UserMe.telegram_id: int | None`; Google schemas), `backend/app/config.py` (Google settings), `backend/requirements.txt` (`authlib`, pin `httpx`), `frontend/src/lib/platform.ts` (`isNativeApp`/`isWebBrowser`), `frontend/src/app/auth/login/page.tsx` (three-way env, Google button), `frontend/src/app/dashboard/security/page.tsx` ("Kirish usullari" list), `frontend/src/app/dashboard/settings/page.tsx` (relabel row), `frontend/src/components/dashboard/AuthBootstrap.tsx` (call-site updates), `frontend/capacitor.config.ts` + `AndroidManifest.xml` + `/.well-known/assetlinks.json` (App Link), add `@capacitor/browser`.
Unchanged by design: `get_current_user` (`deps.py`), `lib/api.ts` refresh/fetch, `utils/telegram_webapp.py` (reused as-is) — every path ends by producing the same `TokenPair` + `localStorage` keys.

**Single highest-risk coupling to flag:** `is_admin_user` reads `int(user.telegram_id)` (`deps.py:80`) and `UserMe.telegram_id` is a required `int` (`schemas/auth.py:35`). Re-home admin identity and make the schema optional **before** any Google-only account can exist, or admins lose access and `/me` 500s.