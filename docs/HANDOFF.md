# Yozuv — Handoff prompt (multi-provider auth / web version)

> Скопируй всё ниже в новую сессию Claude Code, открытую в `D:\yozuv`.

---

Ты продолжаешь работу над **Yozuv** — это booking-SaaS «запись к мастеру» для Узбекистана, Telegram-first.
Стек: **frontend** Next.js 14 (App Router, Tailwind, Radix) в `frontend/`; **backend** FastAPI + SQLAlchemy 2 + Alembic + aiogram (Telegram-бот) + Celery в `backend/`; платежи Payme/Click (paytechuz). Авторизация исторически только через Telegram initData; JWT (access+refresh) с `sub = User.id`.

## Где мы сейчас
Активная ветка: **`feat/mobile-app-password-login`** (в основном репо `D:\yozuv`).
В рабочем дереве лежит **незакоммиченная** работа — НЕ ломай её:
- (исходная WIP пользователя) парольный вход: `User.username/phone/password_hash`, миграции `022`/`023`, эндпоинты `/api/auth/login` + `/api/auth/set-password`, страница `frontend/src/app/auth/login/page.tsx`; Capacitor APK-оболочка (`frontend/capacitor.config.ts`, `frontend/mobile-shell/`, `frontend/android/`).
- (уже сделано в этой линии работ) мультипровайдерная авторизация — см. ниже.

Документы (читай их): `docs/IDENTITY_ARCHITECTURE.md` (главный план), `docs/PROJECT_MAP.md`, `docs/SECURITY_REVIEW.md`, `docs/AUDIT_FINDINGS.md`.

## Цель
Один аккаунт (`User`) — много способов входа, привязанных через таблицу `auth_identities`. Вход работает в 3 средах: **Telegram Mini App** (signed initData, авто), **APK** (Capacitor WebView, пароль), **браузер** (пароль + Google + «открыть в Telegram»). См. таблицу «login × environment» в `docs/IDENTITY_ARCHITECTURE.md`.

## Сделано и проверено (31 backend-тест зелёный; frontend `tsc` чистый)
**Этап 0 — детект сред (frontend):**
- `frontend/src/lib/platform.ts` — `isTelegramMiniApp()`, `isNativeApp()` (Capacitor), `getPlatform(): 'telegram'|'native'|'browser'`.
- `frontend/src/app/auth/login/page.tsx` — разные кнопки по средам.
- `frontend/src/components/dashboard/AuthBootstrap.tsx` — сообщения по среде.

**Этап 1 — модель данных:**
- `backend/app/models/auth_identity.py` (таблица `auth_identities`: `provider, subject, email, email_verified, secret, display_name, …`; UNIQUE(provider,subject), UNIQUE(user_id,provider)).
- `AuthProvider` enum в `backend/app/models/enums.py`; `User.identities` в `user.py`; регистрация в `models/__init__.py`.
- Миграция `backend/alembic/versions/024_auth_identities.py` — создаёт таблицу + бэкфилл существующих (telegram-identity всем; password-identity тем, у кого есть `password_hash`).

**Этап 2 — вход через Google:**
- `User.telegram_id` теперь **nullable** (миграция `025_user_telegram_id_nullable.py`), `schemas/auth.py UserMe.telegram_id` optional. (`deps.is_admin_user` уже безопасен к None.)
- `backend/app/config.py` — `google_client_id`, `google_client_secret`.
- `backend/app/utils/google_oauth.py` — PKCE, auth-url, обмен кода, разбор id_token (валидация iss/aud/exp; подпись доверяется, т.к. токен взят прямо с token-endpoint Google по TLS).
- `backend/app/routers/auth.py` — `GET /api/auth/google/start` (PKCE+state в подписанной короткоживущей cookie) и `GET /api/auth/google/callback` (обмен, find-or-create google-identity, редирект на `{public_app_url}/auth/callback#access=…&refresh=…`). Аккаунт НЕ создаётся на непроверённой почте; слияние по email НЕ делается (это Этап 3).
- `frontend/src/app/auth/callback/page.tsx` — ловит токены из фрагмента, кладёт в localStorage, ведёт в `/dashboard`.
- Кнопка «Google bilan kirish» на login (только браузер).
- `backend/tests/test_google_auth.py` — 4 смоук-теста.

## Чтобы Google заработал (нужно от владельца)
Google Cloud → OAuth client (Web). Redirect URI: `{PUBLIC_API_URL}/api/auth/google/callback`. В `.env` бэкенда: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Накатить миграции `024`, `025`. Без ключей `/google/start` отдаёт 404 (мягко выключено).

## Что дальше (TODO)
1. **Этап 3 — «Связанные аккаунты» в Настройках:** эндпоинты list/connect/disconnect identity; UI в `frontend/src/app/dashboard/settings/page.tsx`; нельзя удалить последний способ входа; привязка существующего Google/Telegram к текущему аккаунту (с доказательством владения, без авто-слияния по email).
2. **APK-Google:** Google блокирует OAuth в embedded WebView → нужен Capacitor `@capacitor/browser` (Custom Tab) + возврат по deep-link/App Link.
3. **Этап 4:** убрать inline-поля `User.telegram_id`/`password_hash` после переключения путей входа на `auth_identities`.
4. **Безопасность (из `docs/SECURITY_REVIEW.md`):** `token_version` в `User` для отзыва сессий при смене пароля/отвязке; lockout на `/login`.

## Как проверять
- Backend: `cd backend && pytest -q` (запускай в ЧИСТОМ окружении без экспортнутых APP_ENV/DATABASE_URL/… — иначе `test_config` ложно падает).
- Frontend: `cd frontend && npx tsc --noEmit`.

## Правила
- Работай на ветке `feat/mobile-app-password-login`, аддитивно; не трогай и не откатывай чужую незакоммиченную WIP.
- Каждое логически законченное изменение — отдельный PR (push в `origin`, `gh` не установлен → дай ссылку «Create PR»). Изолированные правки делай в worktree от чистой базы, НО мультипровайдер-работа зависит от незакоммиченного пароль-входа, поэтому живёт прямо в этой ветке.
