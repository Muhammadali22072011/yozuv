# Yozuv Backend — Fresh Security Pass (NEW findings only)

Read `docs/AUDIT_FINDINGS.md` (all 45 entries) first. Everything below is **net-new** and not a restatement of existing findings. Where a finding is adjacent to an existing one, I call out the distinction explicitly.

---

## HIGH

### N1. [HIGH/security] Password login resolves ambiguously — `users.username` has no uniqueness, and `set-password` performs no collision check
- **Where:** `backend/app/models/user.py:20`, `backend/app/routers/auth.py:91-105` (login), `backend/app/routers/auth.py:114-129` (set_password), `backend/alembic/versions/004_user_username.py:23`
- **Risk:** This is the in-progress password-auth work and it is broken at the identity layer. `username` is `String(64)` with **no unique constraint** (migration 004 adds a plain column; only `telegram_id` is unique). `set_password` assigns `user.username = ident` from an arbitrary client-supplied `login` with **no check that another account already holds that username/phone** and **no case normalization** (`John` vs `john` are distinct rows, but Telegram usernames are case-insensitive). The `login` endpoint then matches `or_(User.username == ident, User.phone == ident)` filtered by `password_hash IS NOT NULL` and calls `.first()`. Once two password-enabled accounts share a username (or differ only by case), `.first()` returns a **non-deterministic** row — an authenticated user can be logged into the wrong account. This is an account-confusion / potential takeover primitive that the stateless JWT then issues a full-privilege session for.
- **Why NEW:** No existing finding touches username/phone uniqueness or the `set-password` flow; the audit's auth findings are all about token-in-URL (#5), XFF rate-limit bypass (#45), and proxy header forwarding (#44).
- **Fix:** Add a case-insensitive partial unique index (Postgres `lower(username)` where `username <> ''`) via Alembic; normalize `ident` to lowercase in both `login` and `set_password`; in `set_password`, reject with 409 if another user already holds that username/phone. (Spawned as a background task.)

---

## MEDIUM

### N2. [MEDIUM/security] Changing a password does not invalidate outstanding sessions — stolen refresh tokens survive a reset
- **Where:** `backend/app/routers/auth.py:114-129` (set_password), `132-154` (refresh), `backend/app/utils/auth.py:40-47`
- **Risk:** JWTs are fully stateless: `create_refresh_token` mints `{exp, sub, type}` with no `jti`/version, the `refresh` endpoint only checks `type == "refresh"` and `user.is_active`, and the `User` model has no `token_version`/`password_changed_at`. Refresh TTL is **30 days** (`config.py:21`). Consequently, `set-password` (which is the very mechanism a user would use after suspecting compromise) **cannot revoke an already-issued refresh token** — an attacker who captured one (e.g. via the token-in-URL leak the audit already flags in #5, or a logged Authorization header per #44) keeps a valid 30-day session even after the victim changes their password. There is no logout/revocation path anywhere.
- **Why NEW:** #5/#44 describe *how* tokens leak; none of the 45 findings address the *absence of revocation* once a token is out, which is what makes those leaks long-lived and un-remediable by the user.
- **Fix:** Add a `token_version` (int) column to `User`, embed it in both access and refresh tokens, bump it in `set_password` (and on any future "log out everywhere"), and reject tokens whose version is stale in `get_user_from_token` / `refresh`. At minimum lower the refresh TTL and add a server-side revocation list.

### N3. [MEDIUM/security] Password-login lacks per-account lockout; a shared-across-IP attacker has effectively unbounded guesses
- **Where:** `backend/app/routers/auth.py:35` (`_login_rate = rate_limit("auth_login", limit=10, window_seconds=60)`), `backend/app/utils/ratelimit.py:38-45`
- **Risk:** The only throttle on `/api/auth/login` is the in-process, **IP-keyed** rate limiter. The audit already established (#45) that this limiter trusts client-supplied `X-Forwarded-For` and is bypassable by rotating the header. That bypass is benign for Telegram auth (HMAC-protected), but for the **new password endpoint it directly translates to unlimited password guessing** against a known username: there is no per-account failure counter, no exponential backoff, and no lockout. With a 6-char minimum password (`schemas/auth.py:13`) and XFF rotation, brute-force is practical.
- **Why NEW:** #45 frames the XFF bypass as defense-in-depth precisely because "primary login auth is still protected by Telegram init-data HMAC." That mitigation does **not** exist for the new password path, so the same limiter weakness is now a first-order brute-force exposure rather than defense-in-depth. The interaction with password login is unaddressed in the audit.
- **Fix:** Add a per-account (and per-account+IP) failed-attempt counter with lockout/backoff in a shared store; do not rely on the IP limiter alone for password auth. Raise the minimum password length/complexity.

### N4. [MEDIUM/security] Telegram WebApp initData validation accepts `auth_date` arbitrarily far in the future and does not constrain the user JSON
- **Where:** `backend/app/utils/telegram_webapp.py:34-44`
- **Risk:** The TTL check is one-sided: `if time.time() - auth_date > INIT_DATA_TTL_SECONDS`. A future `auth_date` produces a negative delta and always passes, so the "1-hour replay window" the comment promises is unbounded on the forward side. This is not exploitable on its own because `auth_date` is inside the signed `data_check_string` — **but only if the signing key (`bot_token`) is uncompromised**. There is also no validation that the parsed `user` field is a JSON object with a sane `id` before `int(u["id"])` is taken downstream (`auth.py:53`, `bookings.py:63`, `reviews.py:43`); a signed-but-malformed `user` payload raises an unhandled type error rather than a clean 401 in some call paths.
- **Why NEW:** No existing finding examines `telegram_webapp.py`. The audit treats initData HMAC as a black-box mitigation; the one-sided clock check and missing payload shape validation are unreviewed.
- **Fix:** Reject `auth_date` more than a small skew (e.g. 5 min) in the future as well as past the TTL; validate `user` is a dict with an integer `id` before use; keep the existing past-TTL bound.

### N5. [MEDIUM/security] Payme webhook is not a state-machine and completes any transaction whose UUID appears anywhere in the body, with no `account.id` binding and no per-tx Payme transaction record
- **Where:** `backend/app/routers/payments.py:426-450` (payme_webhook), `377-387` (`_find_tx_id`)
- **Risk:** Distinct from existing finding #3 (which is specifically about *amount* reconciliation). The Payme handler does not implement the documented Payme JSON-RPC protocol (`CheckPerformTransaction`/`CreateTransaction`/`PerformTransaction` with the `params.account.id` field and a Payme-side transaction id). Instead it (a) authenticates with static Basic auth using `payme_secret_key`, then (b) regex-scans the **entire JSON body** for the first UUID via `_find_tx_id` and completes that transaction if `method == "PerformTransaction"`. Because the UUID is taken from anywhere in the payload rather than the bound `account` field, a single valid Payme callback can be steered to complete a **different business's** PENDING transaction (cross-tenant subscription grant) by placing that UUID anywhere in the JSON. It also returns `{"ok": True}` instead of the required JSON-RPC result/error envelope, so Payme's own reconciliation cannot detect a mismatch.
- **Why NEW:** #3 covers amount reconciliation and *mentions in passing* the lack of `account.id` binding, but the concrete cross-tenant-completion-via-blind-UUID-scan and the absence of the JSON-RPC state machine (CreateTransaction/Cancel, idempotent transaction ids) are not findings in their own right and the fix differs.
- **Fix:** Extract the transaction id only from the documented `params.account.id`; implement the Payme JSON-RPC method handlers with proper success/error responses; persist Payme's `transaction` id and enforce idempotency on it rather than on a body-wide regex.

### N6. [MEDIUM/security] Click webhook accepts a form-encoded body, but the signed identity fields are then read from attacker-shaped data without strict typing — and the failure path leaks the verifier internals
- **Where:** `backend/app/routers/payments.py:453-480`, `407-423` (`_verify_click_signature`)
- **Risk:** `click_webhook` falls back to `dict(await request.form())` when JSON parsing fails. The MD5 signature is recomputed from `str(body.get(...))` for each field, so the integrity check itself is sound — **but** `_find_tx_id` again blind-scans the whole (now form-derived) body for a UUID and `action` is compared as a string. The combination means: the signature binds the *Click* identifiers (`click_trans_id`, `merchant_trans_id`, `amount`), yet the transaction actually completed is whatever UUID the regex finds first, which is not one of the signed fields the signature protects against substitution within the merchant's own namespace. As with N5 this allows a correctly-signed callback to be aimed at an unrelated transaction id embedded elsewhere in the payload.
- **Why NEW:** #3 is about ignoring the signed `amount`; this is about the **target-transaction id not being one of the signature-bound fields**, which is a separate integrity gap on the Click path.
- **Fix:** Resolve the transaction strictly from the signed `merchant_trans_id` (which the gateway is supposed to set to your `tx.id`), and reject if it isn't a valid owned PENDING transaction; do not regex-scan the body.

---

## LOW

### N7. [LOW/security] `webhook_secret` defaults to a random per-process value that silently passes production validation
- **Where:** `backend/app/config.py:41`, `93-94`, `backend/app/main.py:69-74,172-174`
- **Risk:** `webhook_secret` defaults to `secrets.token_hex(16)` (32 chars). The production validator only checks `len >= 16`, so the random default **passes** even when the operator never sets `WEBHOOK_SECRET`. The bot then registers its Telegram webhook with that random secret at boot, which works until any restart/scale event regenerates it — at which point inbound Telegram updates start failing the `X-Telegram-Bot-Api-Secret-Token` check (`main.py:173`) with no config error to point at. This is an availability/correctness footgun masquerading as a satisfied security control.
- **Why NEW:** Not in the audit; the config validator is unreviewed there.
- **Fix:** In `validate_production`, require `WEBHOOK_SECRET` to be explicitly provided (e.g. compare against the per-process default sentinel, or use a separate env-presence check) rather than only validating length.

### N8. [LOW/security] Card receipt images are world-readable-by-any-authenticated-owner via predictable lookup, and the path filter is weaker than its siblings
- **Where:** `backend/app/routers/payments.py:237-258` (`get_receipt`)
- **Risk:** `get_receipt` is gated by `get_current_user` (any logged-in owner), then authorizes by looking up the tx via `screenshot_url == "/api/payments/receipts/{safe}"` and checking business ownership. The authorization is correct, but unlike `files.py:get_logo`/`get_photo` (which reject `"/" in safe or "\\" in safe`), `get_receipt` only does `os.path.basename(filename) != filename`. On its own `basename` neutralizes traversal, but the inconsistency means receipts (which contain customer payment card screenshots / PII) rely on a single narrower check than the public image endpoints. Worth hardening to match.
- **Why NEW:** Not in the audit; the receipt-serving authz/path handling is unreviewed.
- **Fix:** Mirror the `files.py` filename guard exactly (reject any path separators and non-basename input) on the receipt route.

---

## Notes on things that are NOT new findings (checked, already covered or clean)

- **Booking write paths** (`me_router` confirm/complete/cancel/update/delete) are all correctly scoped by `business.id` — only the create/recurring client-lookup gap remains, which is existing #6.
- **`get_active_business` / `require_role` / Membership** authz (deps.py:91-163) is sound: X-Business-Id is validated against a Membership row before use.
- **Reverse proxy** Authorization forwarding is existing #44; **rate-limiter XFF** is existing #45 (I cite their *interaction* with new surfaces in N2/N3 but do not re-file them).
- **Public booking** (`create_public_booking`) correctly overrides `client_telegram_id` from validated initData — well-handled, no IDOR.
- **Admin router**: every endpoint is `get_admin_user`-gated; `backup/import` and `broadcast` are powerful but properly restricted.
- **geo.py**: static in-memory lists, no SSRF.
- **`User.phone` login branch** is currently dead (phone is never written to `users`), so it's a latent collision vector folded into N1's fix rather than a separate finding today.

If you want, the username-uniqueness fix (N1) is already queued as a background task.