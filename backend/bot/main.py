"""Polling entrypoint for LOCAL DEVELOPMENT only.

In production the bot runs in WEBHOOK mode inside the FastAPI process
(see app.main lifespan + /webhook/{token} endpoint). Do not start this
module alongside the API in production — it will cause TelegramConflictError.
"""

import asyncio
import logging
import os

from app.observability import init_sentry
from bot.setup import build_bot_and_dispatcher, set_menu_button

# Local polling entrypoint also benefits from Sentry so dev errors surface.
init_sentry(component="bot-polling")

_log_file = os.environ.get("BOT_LOG_FILE")
_handlers: list[logging.Handler] = [logging.StreamHandler()]
if _log_file:
    _handlers.append(logging.FileHandler(_log_file, mode="a", encoding="utf-8"))
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s [%(levelname)s] %(message)s",
    handlers=_handlers,
)


async def main() -> None:
    bot, dp = build_bot_and_dispatcher()
    # Make sure no stale webhook is set — otherwise getUpdates returns an error.
    try:
        await bot.delete_webhook(drop_pending_updates=True)
    except Exception:
        logging.exception("delete_webhook before polling failed")
    await set_menu_button(bot)
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
