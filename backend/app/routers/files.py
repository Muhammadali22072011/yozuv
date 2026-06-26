import os
import uuid
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.deps import get_owned_business, get_owned_business_download
from app.models import Business, BusinessPhoto, Service
from app.services import blob_store
from app.services.pdf_service import build_brochure_pdf
from app.services.qr_service import generate_qr

router = APIRouter(prefix="/business/me", tags=["files"])
public_router = APIRouter(prefix="/business", tags=["files"])
settings = get_settings()


ALLOWED_LOGO_MIME = {"image/jpeg", "image/png", "image/webp"}
MAX_LOGO_BYTES = 4 * 1024 * 1024
LOGO_EXT = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}

# Gallery shares the same MIME allow-list as logos. Per-photo cap is a
# little higher (clients want to upload phone photos, often >4MB).
ALLOWED_PHOTO_MIME = ALLOWED_LOGO_MIME
MAX_PHOTO_BYTES = 6 * 1024 * 1024
MAX_PHOTOS_PER_BUSINESS = 10
PHOTO_EXT = LOGO_EXT


# Public URL prefixes — the stored logo_url / photo url shape. The trailing
# segment is the MediaBlob key. Kept identical to the old on-disk scheme so
# nothing downstream changes.
LOGO_URL_PREFIX = "/api/business/logos/"
PHOTO_URL_PREFIX = "/api/business/photos/"


@router.get("/qr")
def qr_png(
    db: Session = Depends(get_db),
    business: Business = Depends(get_owned_business),
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
    business: Business = Depends(get_owned_business),
):
    if file.content_type not in ALLOWED_LOGO_MIME:
        raise HTTPException(400, "Faqat JPG, PNG yoki WEBP rasm yuklash mumkin")
    contents = await file.read()
    if len(contents) > MAX_LOGO_BYTES:
        raise HTTPException(400, "Rasm hajmi 4 MB dan oshmasin")
    if not contents:
        raise HTTPException(400, "Bo'sh fayl")

    fname = f"{uuid.uuid4().hex}{LOGO_EXT[file.content_type]}"
    old_key = blob_store.key_from_url(business.logo_url, LOGO_URL_PREFIX)
    blob_store.save_blob(db, fname, contents, file.content_type)
    business.logo_url = f"{LOGO_URL_PREFIX}{fname}"
    if old_key and old_key != fname:
        blob_store.delete_blob(db, old_key)
    db.commit()

    return {"logo_url": business.logo_url}


@router.delete("/logo")
def delete_logo(
    db: Session = Depends(get_db),
    business: Business = Depends(get_owned_business),
):
    old_key = blob_store.key_from_url(business.logo_url, LOGO_URL_PREFIX)
    business.logo_url = ""
    blob_store.delete_blob(db, old_key)
    db.commit()
    return {"logo_url": ""}


@public_router.get("/logos/{filename}")
def get_logo(filename: str, db: Session = Depends(get_db)):
    safe = os.path.basename(filename)
    if safe != filename or "/" in safe or "\\" in safe:
        raise HTTPException(400, "Invalid filename")
    blob = blob_store.get_blob(db, safe)
    if blob is None:
        raise HTTPException(404, "Not found")
    return Response(
        content=blob.data,
        media_type=blob.content_type,
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


# ---- Photo gallery -------------------------------------------------------


@router.get("/photos")
def list_photos(
    db: Session = Depends(get_db),
    business: Business = Depends(get_owned_business),
):
    rows = (
        db.query(BusinessPhoto)
        .filter(BusinessPhoto.business_id == business.id)
        .order_by(BusinessPhoto.order.asc(), BusinessPhoto.created_at.asc())
        .all()
    )
    return [
        {
            "id": str(p.id),
            "url": p.url,
            "order": int(p.order or 0),
        }
        for p in rows
    ]


@router.post("/photos")
async def upload_photo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    business: Business = Depends(get_owned_business),
):
    if file.content_type not in ALLOWED_PHOTO_MIME:
        raise HTTPException(400, "Faqat JPG, PNG yoki WEBP rasm yuklash mumkin")
    contents = await file.read()
    if len(contents) > MAX_PHOTO_BYTES:
        raise HTTPException(400, "Rasm hajmi 6 MB dan oshmasin")
    if not contents:
        raise HTTPException(400, "Bo'sh fayl")

    count = (
        db.query(BusinessPhoto)
        .filter(BusinessPhoto.business_id == business.id)
        .count()
    )
    if count >= MAX_PHOTOS_PER_BUSINESS:
        raise HTTPException(
            400,
            f"Galereyada eng ko'p {MAX_PHOTOS_PER_BUSINESS} ta rasm bo'lishi mumkin",
        )

    fname = f"{uuid.uuid4().hex}{PHOTO_EXT[file.content_type]}"
    blob_store.save_blob(db, fname, contents, file.content_type)

    photo = BusinessPhoto(
        business_id=business.id,
        url=f"{PHOTO_URL_PREFIX}{fname}",
        order=count,  # append at the end
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return {"id": str(photo.id), "url": photo.url, "order": int(photo.order)}


@router.delete("/photos/{photo_id}")
def delete_photo(
    photo_id: UUID,
    db: Session = Depends(get_db),
    business: Business = Depends(get_owned_business),
):
    p = (
        db.query(BusinessPhoto)
        .filter(
            BusinessPhoto.id == photo_id,
            BusinessPhoto.business_id == business.id,
        )
        .first()
    )
    if not p:
        raise HTTPException(404, "Not found")
    fkey = blob_store.key_from_url(p.url, PHOTO_URL_PREFIX)
    db.delete(p)
    blob_store.delete_blob(db, fkey)
    db.commit()
    return {"ok": True}


@public_router.get("/photos/{filename}")
def get_photo(filename: str, db: Session = Depends(get_db)):
    safe = os.path.basename(filename)
    if safe != filename or "/" in safe or "\\" in safe:
        raise HTTPException(400, "Invalid filename")
    blob = blob_store.get_blob(db, safe)
    if blob is None:
        raise HTTPException(404, "Not found")
    return Response(
        content=blob.data,
        media_type=blob.content_type,
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


@public_router.get("/{slug}/photos")
def public_photos(slug: str, db: Session = Depends(get_db)):
    """Used by the bot and the public landing page to render the gallery."""
    b = (
        db.query(Business)
        .filter(Business.slug == slug, Business.is_active.is_(True))
        .first()
    )
    if not b:
        raise HTTPException(404, "Not found")
    rows = (
        db.query(BusinessPhoto)
        .filter(BusinessPhoto.business_id == b.id)
        .order_by(BusinessPhoto.order.asc(), BusinessPhoto.created_at.asc())
        .all()
    )
    return [{"id": str(p.id), "url": p.url, "order": int(p.order or 0)} for p in rows]
