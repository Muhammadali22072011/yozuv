import logging
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.models import AdminAuditLog, User

logger = logging.getLogger(__name__)


def log_admin_action(
    db: Session,
    admin: User,
    action: str,
    target_type: str = "",
    target_id: str | UUID | None = None,
    payload: dict[str, Any] | None = None,
) -> None:
    # Best-effort audit: never fail the calling write because of logging — but
    # LOG the failure instead of swallowing it silently, otherwise a broken
    # audit trail looks identical to a working one.
    try:
        entry = AdminAuditLog(
            admin_telegram_id=int(admin.telegram_id) if admin.telegram_id else 0,
            admin_name=f"{admin.first_name or ''} {admin.last_name or ''}".strip()
            or (admin.username or ""),
            action=action,
            target_type=target_type or "",
            target_id=str(target_id) if target_id is not None else "",
            payload=payload or {},
        )
        db.add(entry)
    except Exception:
        logger.exception("log_admin_action failed for action=%s", action)
