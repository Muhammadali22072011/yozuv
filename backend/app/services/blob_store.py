"""Read/write business media bytes in the database.

Thin helpers over MediaBlob so routers and the bot don't repeat the
get/insert/delete dance. Callers manage the surrounding transaction
(commit) — these only stage changes on the session.
"""

import os

from sqlalchemy.orm import Session

from app.models.media_blob import MediaBlob


def key_from_url(url: str, prefix: str) -> str | None:
    """Map a stored public URL back to its blob key, or None if it isn't one
    of ours (external/empty)."""
    if not url or not url.startswith(prefix):
        return None
    fname = os.path.basename(url[len(prefix):])
    return fname or None


def save_blob(db: Session, key: str, data: bytes, content_type: str) -> None:
    """Insert or overwrite the blob for `key`. Does not commit."""
    blob = db.get(MediaBlob, key)
    if blob is None:
        db.add(MediaBlob(key=key, data=data, content_type=content_type))
    else:
        blob.data = data
        blob.content_type = content_type


def get_blob(db: Session, key: str) -> MediaBlob | None:
    return db.get(MediaBlob, key)


def delete_blob(db: Session, key: str | None) -> None:
    """Delete the blob for `key` if present. Does not commit."""
    if not key:
        return
    blob = db.get(MediaBlob, key)
    if blob is not None:
        db.delete(blob)
