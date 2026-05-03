from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.models import AdminAuditLog, User


def log_admin_action(
    db: Session,
    admin: User,
    action: str,
    target_type: str = "",
    target_id: str | UUID | None = None,
    payload: dict[str, Any] | None = None,
) -> None:
    # Best-effort audit: never fail the calling write because of logging.
    try:
        entry = AdminAuditLog(
            admin_telegram_id=int(admin.telegram_id),
            admin_name=f"{admin.first_name or ''} {admin.last_name or ''}".strip()
            or (admin.username or ""),
            action=action,
            target_type=target_type or "",
            target_id=str(target_id) if target_id is not None else "",
            payload=payload or {},
        )
        db.add(entry)
    except Exception:
        pass
