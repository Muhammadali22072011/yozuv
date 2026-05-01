"""Tiny in-memory per-IP rate limiter.

Good enough for a single-process uvicorn deployment. If we later scale to
multiple workers or replicas, swap the storage for Redis with the same API.
"""

from __future__ import annotations

import time
from collections import deque
from threading import Lock
from typing import Deque

from fastapi import HTTPException, Request


class _Bucket:
    __slots__ = ("hits", "lock")

    def __init__(self) -> None:
        self.hits: Deque[float] = deque()
        self.lock = Lock()


_BUCKETS: dict[str, _Bucket] = {}
_BUCKETS_LOCK = Lock()


def _bucket_for(key: str) -> _Bucket:
    with _BUCKETS_LOCK:
        b = _BUCKETS.get(key)
        if b is None:
            b = _Bucket()
            _BUCKETS[key] = b
        return b


def _client_ip(request: Request) -> str:
    # Honour proxy chain headers; fall back to peer.
    xff = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    if xff:
        return xff
    if request.client and request.client.host:
        return request.client.host
    return "anon"


def rate_limit(scope: str, limit: int, window_seconds: int):
    """Dependency factory: enforce up to `limit` requests per `window_seconds` per IP."""

    def _dep(request: Request) -> None:
        key = f"{scope}:{_client_ip(request)}"
        bucket = _bucket_for(key)
        now = time.monotonic()
        cutoff = now - window_seconds
        with bucket.lock:
            while bucket.hits and bucket.hits[0] < cutoff:
                bucket.hits.popleft()
            if len(bucket.hits) >= limit:
                retry_in = int(bucket.hits[0] + window_seconds - now) + 1
                raise HTTPException(
                    status_code=429,
                    detail=f"Too many requests. Retry in {retry_in}s.",
                    headers={"Retry-After": str(retry_in)},
                )
            bucket.hits.append(now)

    return _dep
