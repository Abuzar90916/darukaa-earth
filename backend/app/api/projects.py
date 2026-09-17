"""Project CRUD endpoints. Every route requires a valid JWT."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.db.dependencies import AuthedUser, DbSession
from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate
from app.schemas.site import SiteCreate, SiteRead
from app.services import project_service, site_service
from app.services.geometry import InvalidGeometry
from app.services.project_service import ProjectNotFound

router = APIRouter(prefix="/api/projects", tags=["projects"])

NOT_FOUND = HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")


@router.get("", response_model=list[ProjectRead], summary="List the caller's projects")
def list_projects(user: AuthedUser, db: DbSession) -> list[ProjectRead]:
    return [ProjectRead(**row) for row in project_service.list_projects(db, user.id)]


@router.post(
    "",
    response_model=ProjectRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a project",
)
def create_project(payload: ProjectCreate, user: AuthedUser, db: DbSession) -> ProjectRead:
    return ProjectRead(**project_service.create_project(db, user.id, payload))


@router.get("/{project_id}", response_model=ProjectRead, summary="Read one project")
def get_project(project_id: str, user: AuthedUser, db: DbSession) -> ProjectRead:
    try:
        return ProjectRead(**project_service.get_project(db, user.id, project_id))
    except ProjectNotFound:
        raise NOT_FOUND from None


@router.put("/{project_id}", response_model=ProjectRead, summary="Update a project")
def update_project(
    project_id: str, payload: ProjectUpdate, user: AuthedUser, db: DbSession
) -> ProjectRead:
    try:
        return ProjectRead(**project_service.update_project(db, user.id, project_id, payload))
    except ProjectNotFound:
        raise NOT_FOUND from None


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a project")
def delete_project(project_id: str, user: AuthedUser, db: DbSession) -> None:
    try:
        project_service.delete_project(db, user.id, project_id)
    except ProjectNotFound:
        raise NOT_FOUND from None


# --- sites nested under their project ---------------------------------------


@router.get(
    "/{project_id}/sites",
    response_model=list[SiteRead],
    summary="List the sites of one project",
)
def list_project_sites(project_id: str, user: AuthedUser, db: DbSession) -> list[SiteRead]:
    try:
        project_service.get_project(db, user.id, project_id)
    except ProjectNotFound:
        raise NOT_FOUND from None
    return [SiteRead(**row) for row in site_service.list_sites(db, user.id, project_id)]


@router.post(
    "/{project_id}/sites",
    response_model=SiteRead,
    status_code=status.HTTP_201_CREATED,
    summary="Add a site boundary drawn on the map",
)
def create_site(project_id: str, payload: SiteCreate, user: AuthedUser, db: DbSession) -> SiteRead:
    try:
        return SiteRead(**site_service.create_site(db, user.id, project_id, payload))
    except ProjectNotFound:
        raise NOT_FOUND from None
    except InvalidGeometry as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from None
