from fastapi import APIRouter, HTTPException

from app.utils.uz_geo import list_tumans, list_viloyats

router = APIRouter(prefix="/geo", tags=["geo"])


@router.get("/viloyats")
def viloyats() -> list[str]:
    return list_viloyats()


@router.get("/tumans")
def tumans(viloyat: str) -> list[str]:
    items = list_tumans(viloyat)
    if not items:
        raise HTTPException(404, "Unknown viloyat")
    return items
