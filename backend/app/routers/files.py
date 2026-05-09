import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.deps import get_active_business, get_owned_business_download
from app.models import Business, Service
from app.services.pdf_service import build_brochure_pdf
from app.services.qr_service import generate_qr

router = APIRouter(prefix="/business/me", tags=["files"])
public_router = APIRouter(prefix="/business", tags=["files"])
settings = get_settings()


ALLOWED_LOGO_MIME = {"image/jpeg", "image/png", "image/webp"}
MAX_LOGO_BYTES = 4 * 1024 * 1024
LOGO_EXT = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


def _logos_dir() -> Path:
    p = Path(settings.uploads_dir) / "logos"
    p.mkdir(parents=True, exist_ok=True)
    return p


def _logo_path_from_url(logo_url: str) -> Path | None:
    """Map a stored logo_url back to a file path, or None if it's external/empty."""
    if not logo_url:
        return None
    prefix = "/api/business/logos/"
    if not logo_url.startswith(prefix):
        return None
    fname = os.path.basename(logo_url[len(prefix):])
    if not fname:
        return None
    return _logos_dir() / fname


@router.get("/qr")
def qr_png(
    db: Session = Depends(get_db),
    business: Business = Depends(get_active_business),
):
    data = generate_qr(business.slug, settings.next_public_bot_username)
    filename = f"yozuv-{business.slug}-qr.png"
    return Response(
        content=data,
        media_type="image/png",
        headers={
            "Cache-Control": "no-store",
            "Content-Disposition": f'inline; filename="{filename}"',
        },
    )


@router.get("/brochure")
def brochure_pdf(
    db: Session = Depends(get_db),
    business: Business = Depends(get_owned_business_download),
):
    services = (
        db.query(Service)
        .filter(Service.business_id == business.id)
        .order_by(Service.order.asc(), Service.name.asc())
        .all()
    )
    bot_username = settings.next_public_bot_username or "Yozuv_cl_bot"
    qr_bytes = generate_qr(business.slug, bot_username)
    pdf = build_brochure_pdf(business, services, qr_bytes, bot_username=bot_username)

    filename = f"{business.slug}-broshyura.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Cache-Control": "no-store",
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.post("/logo")
async def upload_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    business: Business = Depends(get_active_business),
):
    if file.content_type not in ALLOWED_LOGO_MIME:
        raise HTTPException(400, "Faqat JPG, PNG yoki WEBP rasm yuklash mumkin")
    contents = await file.read()
    if len(contents) > MAX_LOGO_BYTES:
        raise HTTPException(400, "Rasm hajmi 4 MB dan oshmasin")
    if not contents:
        raise HTTPException(400, "Bo'sh fayl")

    fname = f"{uuid.uuid4().hex}{LOGO_EXT[file.content_type]}"
    path = _logos_dir() / fname
    path.write_bytes(contents)

    old_path = _logo_path_from_url(business.logo_url)
    business.logo_url = f"/api/business/logos/{fname}"
    db.commit()

    if old_path is not None and old_path.exists() and old_path != path:
        try:
            old_path.unlink()
        except OSError:
            pass

    return {"logo_url": business.logo_url}


@router.delete("/logo")
def delete_logo(
    db: Session = Depends(get_db),
    business: Business = Depends(get_active_business),
):
    old_path = _logo_path_from_url(business.logo_url)
    business.logo_url = ""
    db.commit()
    if old_path is not None and old_path.exists():
        try:
            old_path.unlink()
        except OSError:
            pass
    return {"logo_url": ""}


@public_router.get("/logos/{filename}")
def get_logo(filename: str):
    safe = os.path.basename(filename)
    if safe != filename or "/" in safe or "\\" in safe:
        raise HTTPException(400, "Invalid filename")
    path = _logos_dir() / safe
    if not path.exists() or not path.is_file():
        raise HTTPException(404, "Not found")
    media = "image/jpeg"
    low = safe.lower()
    if low.endswith(".png"):
        media = "image/png"
    elif low.endswith(".webp"):
        media = "image/webp"
    return FileResponse(
        path,
        media_type=media,
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )
