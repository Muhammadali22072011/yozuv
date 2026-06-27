"""Throttling middleware must never silently drop user-typed messages.

Regression guard: review comments, promo codes and phone numbers arrive as
plain Messages inside an FSM flow. Dropping one leaves the user staring at a
bot that "ate" their text with no feedback. Only rapid button presses
(callback queries) get rate-limited.
"""
from datetime import datetime

import pytest
from aiogram.types import CallbackQuery, Chat, Message, Update, User

from bot.middlewares.throttling import ThrottlingMiddleware


def _user():
    return User(id=7, is_bot=False, first_name="T")


def _message_update(update_id: int) -> Update:
    chat = Chat(id=7, type="private")
    msg = Message(
        message_id=update_id,
        date=datetime.now(),
        chat=chat,
        from_user=_user(),
        text="my comment",
    )
    return Update(update_id=update_id, message=msg)


def _callback_update(update_id: int) -> Update:
    chat = Chat(id=7, type="private")
    msg = Message(message_id=update_id, date=datetime.now(), chat=chat, from_user=_user(), text="x")
    cbq = CallbackQuery(
        id=str(update_id),
        from_user=_user(),
        chat_instance="ci",
        data="srate:slug:5",
        message=msg,
    )
    return Update(update_id=update_id, callback_query=cbq)


async def _run(mw: ThrottlingMiddleware, update: Update) -> bool:
    """Return True if the handler ran (i.e. the update was not throttled)."""
    ran = False

    async def handler(event, data):
        nonlocal ran
        ran = True

    await mw(handler, update, {"event_from_user": _user()})
    return ran


@pytest.mark.asyncio
async def test_rapid_messages_are_never_throttled():
    mw = ThrottlingMiddleware(rate_limit=10.0)  # huge window: would block if it applied
    results = [await _run(mw, _message_update(i)) for i in range(1, 4)]
    assert results == [True, True, True]


@pytest.mark.asyncio
async def test_rapid_callbacks_are_throttled():
    mw = ThrottlingMiddleware(rate_limit=10.0)
    first = await _run(mw, _callback_update(1))
    second = await _run(mw, _callback_update(2))
    assert first is True
    assert second is False  # second press inside the window is dropped


@pytest.mark.asyncio
async def test_message_passes_even_right_after_a_callback():
    """The exact review bug: tap a star (callback), then immediately send the
    comment (message). The comment must still reach its handler."""
    mw = ThrottlingMiddleware(rate_limit=10.0)
    await _run(mw, _callback_update(1))
    comment_ran = await _run(mw, _message_update(2))
    assert comment_ran is True
