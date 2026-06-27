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

# business_id -> {queue: event_loop}. Each queue is owned by one open SSE
# stream living on a specific event loop; we add on subscribe and remove on
# disconnect. We remember the loop because publish() is called from sync route
# handlers running in an anyio worker THREAD, while the queue is bound to the
# event-loop thread — asyncio.Queue is not thread-safe, so cross-thread writes
# must go through loop.call_soon_threadsafe.
_subs: dict[UUID, dict[asyncio.Queue, asyncio.AbstractEventLoop]] = defaultdict(dict)


def _safe_put(q: asyncio.Queue, kind: str, business_id: UUID) -> None:
    try:
        q.put_nowait(kind)
    except asyncio.QueueFull:
        logger.debug("event_bus: queue full for business=%s, dropping %s", business_id, kind)
    except Exception:
        logger.exception("event_bus: unexpected publish error")


def publish(business_id: UUID, kind: str) -> None:
    """Best-effort fire-and-forget, safe to call from any thread. Schedules
    the queue write on each subscriber's own event loop. Full queues drop the
    event (the next heartbeat catches the frontend up). Doesn't raise — a bus
    problem must never break the booking write."""
    subs = _subs.get(business_id)
    if not subs:
        return
    for q, loop in tuple(subs.items()):
        try:
            loop.call_soon_threadsafe(_safe_put, q, kind, business_id)
        except RuntimeError:
            # Loop already closed — its stream is gone; ignore.
            pass
        except Exception:
            logger.exception("event_bus: unexpected schedule error")


async def subscribe(business_id: UUID) -> AsyncIterator[str]:
    """Async generator yielding event kinds for a business. Caller is
    responsible for honouring ``async for`` cancellation; we clean up
    on the way out."""
    q: asyncio.Queue = asyncio.Queue(maxsize=64)
    _subs[business_id][q] = asyncio.get_running_loop()
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
        bucket = _subs.get(business_id)
        if bucket is not None:
            bucket.pop(q, None)
            if not bucket:
                _subs.pop(business_id, None)
