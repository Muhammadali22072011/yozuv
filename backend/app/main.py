import logging
from contextlib import asynccontextmanager

from aiogram import Bot, Dispatcher
from aiogram.types import Update
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import (
    admin,
    analytics,
    auth,
    bookings,
    business,
    clients,
    files,
    payments,
    promo,
    reviews,
    schedule,
    services,
    subscription,
)

logger = logging.getLogger("app.main")
settings = get_settings()

# Module-level refs so the /webhook/{token} endpoint can reach them.
_bot: Bot | None = None
_dp: Dispatcher | None = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Start/stop the bot alongside FastAPI in webhook mode."""
    global _bot, _dp

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
        webhook_url = f"{api_url}/webhook/{settings.bot_token}"
        try:
            await _bot.set_webhook(
                url=webhook_url,
                drop_pending_updates=True,
                allowed_updates=["message", "callback_query"],
            )
            logger.info("Telegram webhook set to %s/webhook/<token>", api_url)
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

    try:
        yield
    finally:
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

app.include_router(auth.router, prefix="/api/auth")
# Specific /business/me/* routers must be registered BEFORE business.router,
# otherwise /business/{slug}/services catches /business/me/services with slug="me".
app.include_router(services.router, prefix="/api")
app.include_router(schedule.router, prefix="/api")
app.include_router(bookings.me_router, prefix="/api")
app.include_router(clients.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(files.router, prefix="/api")
app.include_router(payments.router, prefix="/api")
app.include_router(subscription.router, prefix="/api")
app.include_router(promo.router, prefix="/api")
app.include_router(reviews.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(business.router, prefix="/api")
app.include_router(bookings.router, prefix="/api")
app.include_router(bookings.public_router, prefix="/api")


@app.get("/api/health")
@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/webhook/{token:path}")
async def telegram_webhook(token: str, request: Request):
    """Telegram → here. Token in path acts as shared secret."""
    if not settings.bot_token or token != settings.bot_token:
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
