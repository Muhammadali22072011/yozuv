import asyncio
import logging
import os

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode

from app.config import get_settings
from bot.handlers import booking, my_bookings, owner, start
from bot.middlewares.throttling import ThrottlingMiddleware

_log_file = os.environ.get("BOT_LOG_FILE")
_handlers: list[logging.Handler] = [logging.StreamHandler()]
if _log_file:
    _handlers.append(logging.FileHandler(_log_file, mode="a", encoding="utf-8"))
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s [%(levelname)s] %(message)s",
    handlers=_handlers,
)
settings = get_settings()


async def main() -> None:
    if not settings.bot_token:
        raise RuntimeError("BOT_TOKEN is not set")

    bot = Bot(token=settings.bot_token, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dp = Dispatcher()
    dp.update.middleware(ThrottlingMiddleware())

    dp.include_router(start.router)
    dp.include_router(booking.router)
    dp.include_router(my_bookings.router)
    dp.include_router(owner.router)

    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
