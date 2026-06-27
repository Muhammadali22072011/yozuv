"""Shared bot+dispatcher factory used by both webhook (app.main) and polling (bot.main)."""

from __future__ import annotations

import logging

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.types import BotCommand, MenuButtonWebApp, WebAppInfo

from app.config import get_settings
from bot import fun
from bot.handlers import booking, my_bookings, owner, start
from bot.middlewares.throttling import ThrottlingMiddleware

logger = logging.getLogger(__name__)


def build_bot_and_dispatcher() -> tuple[Bot, Dispatcher]:
    settings = get_settings()
    if not settings.bot_token:
        raise RuntimeError("BOT_TOKEN is not set")
    bot = Bot(
        token=settings.bot_token,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    dp = Dispatcher()
    dp.update.middleware(ThrottlingMiddleware())
    dp.include_router(start.router)
    dp.include_router(booking.router)
    dp.include_router(my_bookings.router)
    dp.include_router(owner.router)
    return bot, dp


async def set_menu_button(bot: Bot) -> None:
    # Tell Telegram about the commands the bot actually handles so the "/" hint
    # menu isn't empty. Independent of the WebApp URL, so do it first.
    try:
        await bot.set_my_commands(
            [BotCommand(command=c, description=d) for c, d in fun.BOT_COMMANDS]
        )
    except Exception:
        logger.exception("Failed to set bot commands")

    app_url = (get_settings().public_app_url or "").rstrip("/")
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
        logger.exception("Failed to set chat menu button")
