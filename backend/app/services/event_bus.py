"""Tiny in-process pub/sub for Server-Sent Events.

Used by the dashboard to switch from "poll /notifications every 60s"
to "open one SSE stream and react when something actually changes".

Single-process by design. With multiple uvicorn workers each worker
has its own bus, which means a notification published in worker A
won't reach a stream open on worker B. That's OK for v1: the
frontend re-fetches the notifications endpoint on event signal, so
the worst case is a delayed nudge — and the SSE stream auto-pings a
heartbeat every 30s so a missed publish gets picked up the next
time the page is reloaded. Swap in Redis pub/sub when we scale to
multiple workers.

The events themselves are intentionally tiny: just a string `kind`
that tells the frontend "go re-fetch". Carrying the actual
notification payload over SSE would force every publisher to know
the response shape.
"""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from typing import AsyncIterator
from uuid import UUID

logger = logging.getLogger(__name__)

# business_id -> set of queues. Each queue is owned by one open SSE
# stream; we add on subscribe and remove on disconnect.
_subs: dict[UUID, set[asyncio.Queue]] = defaultdict(set)
_lock = asyncio.Lock()


def publish(business_id: UUID, kind: str) -> None:
    """Best-effort fire-and-forget. We try to put_nowait into every
    queue; full queues drop the event (the next heartbeat will catch
    the frontend up). Doesn't raise — a bus problem must never break
    the booking write."""
    queues = _subs.get(business_id)
    if not queues:
        return
    for q in tuple(queues):
        try:
            q.put_nowait(kind)
        except asyncio.QueueFull:
            # Slow consumer — skip rather than block the publisher.
            logger.debug("event_bus: queue full for business=%s, dropping %s", business_id, kind)
        except Exception:
            logger.exception("event_bus: unexpected publish error")


async def subscribe(business_id: UUID) -> AsyncIterator[str]:
    """Async generator yielding event kinds for a business. Caller is
    responsible for honouring ``async for`` cancellation; we clean up
    on the way out."""
    q: asyncio.Queue = asyncio.Queue(maxsize=64)
    async with _lock:
        _subs[business_id].add(q)
    try:
        while True:
            try:
                # 30s heartbeat — bounds the frontend's worst-case
                # staleness even if a publish is dropped or the
                # producer lives on a different worker.
                kind = await asyncio.wait_for(q.get(), timeout=30.0)
                yield kind
            except asyncio.TimeoutError:
                yield "ping"
    finally:
        async with _lock:
            bucket = _subs.get(business_id)
            if bucket is not None:
                bucket.discard(q)
                if not bucket:
                    _subs.pop(business_id, None)
