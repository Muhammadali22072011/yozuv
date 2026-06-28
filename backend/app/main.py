import asyncio
import logging
import os
from contextlib import asynccontextmanager

import httpx
from aiogram import Bot, Dispatcher
from aiogram.types import Update
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.responses import Response

from app.config import get_settings
from app.observability import init_sentry
from app.routers import (
    admin,
    analytics,
    auth,
    bookings,
    business,
    clients,
    events,
    files,
    geo,
    payments,
    promo,
    referral,
    reviews,
    schedule,
    services,
    staff,
    subscription,
)

logger = logging.getLogger("app.main")
settings = get_settings()

# Wire up error reporting before the app starts so any boot-time crash
# (failed migrations, bad config) is captured.
init_sentry(component="api")

# Module-level refs so the /webhook/{token} endpoint can reach them.
_bot: Bot | None = None
_dp: Dispatcher | None = None
# In-process periodic job runner (reminders, birthday, no-shows, …).
_scheduler_task: "asyncio.Task | None" = None
_scheduler_stop: "asyncio.Event | None" = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Start/stop the bot alongside FastAPI in webhook mode."""
    global _bot, _dp, _scheduler_task, _scheduler_stop

    if not settings.bot_token:
        logger.warning("BOT_TOKEN is empty — bot will not be started.")
        yield
        return

    # Import here to avoid pulling bot code when BOT_TOKEN is unset.
    from bot.setup import build_bot_and_dispatcher, set_menu_button

    try:
        _bot, _dp = build_bot_and_dispatcher()
    except Exception:
        logger.exception("Failed to initialise bot — API will run without it.")
        yield
        return

    api_url = (settings.public_api_url or "").rstrip("/")
    if api_url.startswith("https://"):
        webhook_url = f"{api_url}/webhook"
        try:
            await _bot.set_webhook(
                url=webhook_url,
                secret_token=settings.webhook_secret,
                drop_pending_updates=True,
                allowed_updates=["message", "callback_query"],
            )
            logger.info("Telegram webhook set to %s/webhook (secret-token header)", api_url)
        except Exception:
            logger.exception("Failed to set Telegram webhook")
    else:
        logger.warning(
            "PUBLIC_API_URL is not https — skipping set_webhook. Bot will not receive updates."
        )

    try:
        await set_menu_button(_bot)
    except Exception:
        logger.exception("Failed to set chat menu button")

    # Periodic jobs (reminders, birthday greetings, no-show flagging,
    # re-engagement, scheduled broadcasts). Runs here unless a dedicated
    # Celery worker is deployed (INPROCESS_SCHEDULER=false).
    if settings.inprocess_scheduler:
        from app.scheduler import run_scheduler

        _scheduler_stop = asyncio.Event()
        _scheduler_task = asyncio.create_task(run_scheduler(_scheduler_stop))
        logger.info("in-process scheduler enabled")

    try:
        yield
    finally:
        if _scheduler_task is not None and _scheduler_stop is not None:
            _scheduler_stop.set()
            _scheduler_task.cancel()
            try:
                await _scheduler_task
            except (asyncio.CancelledError, Exception):
                pass
            _scheduler_task = None
            _scheduler_stop = None
        global _frontend_client
        if _frontend_client is not None:
            try:
                await _frontend_client.aclose()
            except Exception:
                logger.exception("frontend proxy client close failed")
            _frontend_client = None
        if _bot is not None:
            try:
                await _bot.delete_webhook()
            except Exception:
                logger.exception("delete_webhook on shutdown failed")
            try:
                await _bot.session.close()
            except Exception:
                logger.exception("bot.session.close failed")


app = FastAPI(title="Yozuv API", version="0.1.0", lifespan=lifespan)

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
if not origins:
    raise RuntimeError(
        "CORS_ORIGINS must be set. Example: CORS_ORIGINS=https://yourdomain.com"
    )
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Catch-all so unexpected errors don't leak stack traces and ARE logged."""
    # Let HTTPException pass through with its own status (FastAPI normally handles
    # them before this, but we re-raise just in case it ever reaches us).
    if isinstance(exc, HTTPException):
        raise exc
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Server xatosi. Iltimos, keyinroq urinib ko'ring."},
    )


app.include_router(auth.router, prefix="/api/auth")
# Specific /business/me/* routers must be registered BEFORE business.router,
# otherwise /business/{slug}/services catches /business/me/services with slug="me".
app.include_router(services.router, prefix="/api")
app.include_router(schedule.router, prefix="/api")
app.include_router(staff.owner_router, prefix="/api")
app.include_router(staff.public_router, prefix="/api")
app.include_router(bookings.me_router, prefix="/api")
app.include_router(clients.router, prefix="/api")
app.include_router(events.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(files.router, prefix="/api")
app.include_router(files.public_router, prefix="/api")
app.include_router(payments.router, prefix="/api")
app.include_router(subscription.router, prefix="/api")
app.include_router(promo.router, prefix="/api")
app.include_router(promo.public_router, prefix="/api")
app.include_router(referral.router, prefix="/api")
app.include_router(reviews.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(geo.router, prefix="/api")
app.include_router(business.router, prefix="/api")
app.include_router(bookings.router, prefix="/api")
app.include_router(bookings.public_router, prefix="/api")


@app.get("/api/health")
@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/webhook")
async def telegram_webhook(request: Request):
    """Telegram → here. Secret comes via X-Telegram-Bot-Api-Secret-Token header
    so the bot token never appears in URLs or proxy/CDN logs."""
    secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
    if not settings.webhook_secret or secret != settings.webhook_secret:
        raise HTTPException(status_code=403, detail="Forbidden")
    if _bot is None or _dp is None:
        raise HTTPException(status_code=503, detail="Bot not initialised")
    try:
        data = await request.json()
        update = Update.model_validate(data, context={"bot": _bot})
        await _dp.feed_update(_bot, update)
    except Exception:
        logger.exception("Failed to process Telegram update")
        # Return 200 anyway so Telegram doesn't spam retries for a malformed update.
    return {"ok": True}


FRONTEND_UPSTREAM = os.getenv("FRONTEND_UPSTREAM_URL", "http://localhost:3000").rstrip("/")
_HOP_BY_HOP = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "content-encoding",
    "content-length",
    "host",
}
_frontend_client: httpx.AsyncClient | None = None


def _get_frontend_client() -> httpx.AsyncClient:
    global _frontend_client
    if _frontend_client is None:
        _frontend_client = httpx.AsyncClient(
            base_url=FRONTEND_UPSTREAM,
            timeout=httpx.Timeout(30.0, connect=5.0),
        )
    return _frontend_client


@app.api_route(
    "/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    include_in_schema=False,
)
async def frontend_proxy(path: str, request: Request):
    """Catch-all: forward non-API requests to the Next.js frontend."""
    # Strip Authorization too: the Next.js frontend never needs the API
    # bearer token, and forwarding it leaks the owner's credential into the
    # frontend server's request handlers / logs.
    _drop_req = _HOP_BY_HOP | {"authorization"}
    headers = {
        k: v for k, v in request.headers.items() if k.lower() not in _drop_req
    }
    upstream_path = request.url.path
    if request.url.query:
        upstream_path = f"{upstream_path}?{request.url.query}"

    client = _get_frontend_client()
    try:
        upstream = await client.request(
            request.method,
            upstream_path,
            headers=headers,
            content=await request.body(),
        )
    except httpx.RequestError as exc:
        logger.warning("Frontend proxy failed for %s: %s", upstream_path, exc)
        raise HTTPException(status_code=502, detail="Frontend unreachable") from exc

    response_headers = {
        k: v for k, v in upstream.headers.items() if k.lower() not in _HOP_BY_HOP
    }
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=response_headers,
        media_type=upstream.headers.get("content-type"),
    )
