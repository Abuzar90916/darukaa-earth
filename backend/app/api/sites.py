"""Site read/update/delete endpoints (creation lives under the parent project)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.db.dependencies import AuthedUser, DbSession
from app.schemas.site import SiteRead, SiteUpdate
from app.services import site_service
from app.services.geometry import InvalidGeometry
from app.services.site_service import SiteNotFound

router = APIRouter(prefix="/api/sites", tags=["sites"])

NOT_FOUND = HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site not found")


@router.get("", response_model=list[SiteRead], summary="List every site the caller owns")
def list_sites(user: AuthedUser, db: DbSession) -> list[SiteRead]:
    return [SiteRead(**row) for row in site_service.list_sites(db, user.id)]


@router.get("/{site_id}", response_model=SiteRead, summary="Read one site with its boundary")
def get_site(site_id: str, user: AuthedUser, db: DbSession) -> SiteRead:
    try:
        return SiteRead(**site_service.get_site(db, user.id, site_id))
    except SiteNotFound:
        raise NOT_FOUND from None


@router.put("/{site_id}", response_model=SiteRead, summary="Update a site or its boundary")
def update_site(site_id: str, payload: SiteUpdate, user: AuthedUser, db: DbSession) -> SiteRead:
    try:
        return SiteRead(**site_service.update_site(db, user.id, site_id, payload))
    except SiteNotFound:
        raise NOT_FOUND from None
    except InvalidGeometry as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from None


@router.delete("/{site_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a site")
def delete_site(site_id: str, user: AuthedUser, db: DbSession) -> None:
    try:
        site_service.delete_site(db, user.id, site_id)
    except SiteNotFound:
        raise NOT_FOUND from None
