"""Nightly DB snapshot to an S3-compatible bucket.

Why this exists, on top of the manual /api/admin/backup/export
endpoint and the auto-snapshot taken before /backup/import:

* Manual export = "I remembered to click the button". Doesn't help
  when nobody clicked for two weeks before a corruption event.
* Pre-import snapshot = "I'm about to do something destructive". Only
  fires when an admin runs an import.

This task runs every night via Celery beat — no admin action needed
— and uploads a JSON dump to a bucket of your choice (AWS S3,
Backblaze B2, Cloudflare R2, MinIO). After upload, objects older
than ``BACKUP_S3_RETENTION_DAYS`` are deleted so storage cost stays
bounded.

Disabled by default: leave ``BACKUP_S3_BUCKET`` blank and the task
short-circuits to a no-op so dev environments don't try to talk to
a non-existent bucket.
"""

from __future__ import annotations

import io
import json
import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select

from app.celery_app import celery_app
from app.config import get_settings
from app.database import Base, SessionLocal

logger = logging.getLogger(__name__)

BACKUP_VERSION = 1


def _json_default(o):
    if isinstance(o, UUID):
        return str(o)
    if isinstance(o, (datetime,)):
        return o.isoformat()
    if hasattr(o, "isoformat"):
        return o.isoformat()
    if isinstance(o, Decimal):
        return str(o)
    if isinstance(o, bytes):
        return o.decode("utf-8", errors="replace")
    raise TypeError(f"Not serializable: {type(o).__name__}")


def _build_dump() -> bytes:
    """Walk every table in the metadata-graph order and serialise to a
    single JSON document. Identical shape to admin.backup_export so the
    same /backup/import endpoint can restore from any of these
    snapshots."""
    db = SessionLocal()
    try:
        # Read every table from ONE consistent snapshot. Under the default
        # READ COMMITTED each statement sees a fresh snapshot, so a concurrent
        # write between two table reads could produce a referentially-broken
        # dump. REPEATABLE READ freezes the snapshot for the whole transaction
        # (Postgres only — no-op/skip elsewhere, e.g. SQLite in tests).
        bind = db.get_bind()
        if bind.dialect.name == "postgresql":
            conn = db.connection(
                execution_options={"isolation_level": "REPEATABLE READ"}
            )
        else:
            conn = db.connection()
        dump: dict = {
            "version": BACKUP_VERSION,
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "tables": {
                table.name: [dict(r) for r in conn.execute(select(table)).mappings().all()]
                for table in Base.metadata.sorted_tables
            },
        }
    finally:
        db.close()
    return json.dumps(dump, default=_json_default, ensure_ascii=False).encode("utf-8")


def _s3_client(settings):
    """Build a boto3 client for S3 / B2 / R2 / MinIO. Endpoint is
    optional — when blank we fall through to AWS S3 defaults."""
    import boto3

    kwargs = {
        "service_name": "s3",
        "region_name": settings.backup_s3_region or "us-east-1",
        "aws_access_key_id": settings.backup_s3_access_key_id or None,
        "aws_secret_access_key": settings.backup_s3_secret_access_key or None,
    }
    if settings.backup_s3_endpoint_url:
        kwargs["endpoint_url"] = settings.backup_s3_endpoint_url
    return boto3.client(**kwargs)


@celery_app.task(name="app.tasks.backup.snapshot_to_s3")
def snapshot_to_s3() -> dict:
    """Dump current DB state and upload to the configured bucket.
    Returns a small status payload so an admin running the task on
    demand sees what happened."""
    settings = get_settings()
    if not settings.backup_s3_bucket:
        logger.info("backup_s3_bucket blank — skipping nightly backup")
        return {"skipped": True, "reason": "bucket not configured"}

    try:
        client = _s3_client(settings)
    except Exception:
        logger.exception("failed to build S3 client")
        return {"skipped": True, "reason": "s3 client init failed"}

    body = _build_dump()
    ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    prefix = (settings.backup_s3_prefix or "").lstrip("/")
    key = f"{prefix}auto-{ts}.json"
    try:
        client.upload_fileobj(
            io.BytesIO(body),
            settings.backup_s3_bucket,
            key,
            ExtraArgs={"ContentType": "application/json"},
        )
    except Exception:
        logger.exception("failed to upload backup to s3 (%s/%s)", settings.backup_s3_bucket, key)
        return {"skipped": True, "reason": "upload failed"}

    pruned = _prune(client, settings)

    logger.info(
        "uploaded backup %s/%s (%.1f KB), pruned %d old objects",
        settings.backup_s3_bucket,
        key,
        len(body) / 1024.0,
        pruned,
    )
    return {
        "ok": True,
        "key": key,
        "size_bytes": len(body),
        "pruned": pruned,
    }


def _prune(client, settings) -> int:
    """Delete objects older than retention_days inside our prefix.
    Listed and deleted in pages of 1000 (S3 hard limit)."""
    days = int(settings.backup_s3_retention_days or 0)
    if days <= 0:
        return 0
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    prefix = (settings.backup_s3_prefix or "").lstrip("/")
    paginator = client.get_paginator("list_objects_v2")
    to_delete: list[dict] = []
    for page in paginator.paginate(
        Bucket=settings.backup_s3_bucket, Prefix=prefix
    ):
        for obj in page.get("Contents", []) or []:
            last_modified = obj.get("LastModified")
            if last_modified is None:
                continue
            if last_modified.tzinfo is None:
                last_modified = last_modified.replace(tzinfo=timezone.utc)
            if last_modified < cutoff:
                to_delete.append({"Key": obj["Key"]})
    if not to_delete:
        return 0
    total = 0
    for i in range(0, len(to_delete), 1000):
        batch = to_delete[i : i + 1000]
        try:
            client.delete_objects(
                Bucket=settings.backup_s3_bucket,
                Delete={"Objects": batch, "Quiet": True},
            )
            total += len(batch)
        except Exception:
            logger.exception("failed to delete %d backup objects", len(batch))
    return total
