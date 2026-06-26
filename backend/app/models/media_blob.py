"""Binary store for business media (logos, gallery photos).

Render's filesystem is ephemeral — anything written under UPLOADS_DIR is
wiped on every deploy/restart, so logos and photos saved to disk turned into
404s within a day. We keep the bytes in Postgres instead: a logo is small
(<=4 MB) and survives deploys with zero extra infra.

The row key is the public filename (e.g. "<uuid>.jpg") — the `{filename}`
segment of /api/business/logos/<filename> and /api/business/photos/<filename>.
So `logo_url` / `BusinessPhoto.url` keep the exact same shape they had on disk
and nothing downstream (frontend, bot, public page) has to change.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, LargeBinary, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class MediaBlob(Base):
    __tablename__ = "media_blobs"

    # Public filename, unique per upload (uuid hex + extension).
    key: Mapped[str] = mapped_column(String(128), primary_key=True)
    content_type: Mapped[str] = mapped_column(String(64), nullable=False)
    data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )
