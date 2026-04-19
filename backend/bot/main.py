import asyncio
import logging
import os

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.types import MenuButtonWebApp, WebAppInfo

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


async def _set_menu_button(bot: Bot) -> None:
    app_url = settings.public_app_url or ""
    if not app_url.startswith("https://"):
        return
    try:
        await bot.set_chat_menu_button(
            menu_button=MenuButtonWebApp(
                text="Kabinet",
                web_app=WebAppInfo(url=f"{app_url}/dashboard"),
            )
        )
    except Exception:
        logging.exception("Failed to set chat menu button")


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

    await _set_menu_button(bot)
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
