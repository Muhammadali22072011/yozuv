import time
from collections import defaultdict
from typing import Any, Awaitable, Callable, Dict

from aiogram import BaseMiddleware
from aiogram.types import CallbackQuery, TelegramObject

# Drop per-user timestamps older than this so the map can't grow unbounded.
_PRUNE_AFTER_SECONDS = 3600
_PRUNE_WHEN_LARGER_THAN = 10_000


class ThrottlingMiddleware(BaseMiddleware):
    def __init__(self, rate_limit: float = 0.5) -> None:
        self.rate_limit = rate_limit
        self._last: Dict[int, float] = defaultdict(float)

    async def __call__(
        self,
        handler: Callable[[TelegramObject, Dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: Dict[str, Any],
    ) -> Any:
        user = data.get("event_from_user")
        if user is None:
            return await handler(event, data)
        uid = user.id
        now = time.monotonic()
        if now - self._last[uid] < self.rate_limit:
            # Answer the callback so the client's button spinner stops —
            # silently returning None left it hanging "loading" forever.
            if isinstance(event, CallbackQuery):
                try:
                    await event.answer()
                except Exception:
                    pass
            return None
        self._last[uid] = now
        # Opportunistically prune stale entries so a stream of one-off users
        # can't grow the per-process map without bound.
        if len(self._last) > _PRUNE_WHEN_LARGER_THAN:
            cutoff = now - _PRUNE_AFTER_SECONDS
            self._last = defaultdict(
                float, {u: t for u, t in self._last.items() if t > cutoff}
            )
        return await handler(event, data)
