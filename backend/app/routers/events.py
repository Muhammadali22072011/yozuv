"""First-party funnel event sink.

The frontend's `track()` always sends funnel events here (via sendBeacon),
in addition to forwarding to any third-party provider that happens to be
installed (GA4 / PostHog / Plausible). That makes the conversion funnel
measurable from server logs even before a vendor is wired up — which the
audit flagged as a blind spot ("o'sishni o'lchab bo'lmaydi").

The body is read raw and JSON-parsed leniently (not via a Pydantic model) so
the client can send it as `text/plain` — a CORS-safelisted content type that
sendBeacon can deliver cross-origin without a preflight. Intentionally cheap:
a structured log line, no DB write, no auth. Aggregate from the logs, or swap
the body for a DB insert later without touching the client.
"""
import json
import logging

from fastapi import APIRouter, Request

router = APIRouter(tags=["events"])
logger = logging.getLogger("app.events")


@router.post("/events", status_code=204)
async def record_event(request: Request) -> None:
    """Record one funnel event. Returns 204 (no content)."""
    try:
        raw = await request.body()
        data = json.loads(raw or b"{}")
        if not isinstance(data, dict):
            data = {}
    except Exception:
        data = {}
    logger.info(
        "funnel_event event=%s path=%s props=%s",
        data.get("event"),
        data.get("path", ""),
        data.get("props", {}),
    )
