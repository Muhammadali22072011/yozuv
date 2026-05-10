"""Multi-photo gallery for a business.

Logo lives on Business.logo_url (one image, shown by the bot at /start).
The gallery is the next layer down: 0..MAX_PHOTOS images that the bot
can show before the menu so a client gets a feel for the place
(barber's previous cuts, salon interior, dentist's chair…).

Files live next to the logo, under UPLOADS_DIR/photos. The DB row
stores only a relative public URL — the same /api/business/photos/...
pattern used for logos, so the public reverse-proxy can pick it up
without the frontend having to know about the file system.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class BusinessPhoto(Base):
    __tablename__ = "business_photos"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    business_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Public URL like "/api/business/photos/<uuid>.jpg" — what the
    # frontend appends to apiBase().
    url: Mapped[str] = mapped_column(String(1024), nullable=False)
    # Hand-picked display order; 0 first. We don't enforce uniqueness so
    # reorders can avoid temporary collisions.
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )

    business = relationship("Business")
