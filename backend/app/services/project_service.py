"""Project persistence.

Every statement is scoped to the authenticated owner (`created_by = :uid`), so a
caller can never read or mutate another administrator's portfolio even though
this service connects with a privileged database role.
"""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.schemas.project import ProjectCreate, ProjectUpdate

PROJECT_COLUMNS = """
  id::text, name, description, project_type::text, status::text, country, region,
  total_area_hectares::float8 as total_area_hectares, created_by::text,
  created_at, updated_at
"""


class ProjectNotFound(LookupError):
    pass


def list_projects(db: Session, user_id: str) -> list[dict]:
    rows = db.execute(
        text(
            f"select {PROJECT_COLUMNS} from public.projects "
            "where created_by = :uid order by created_at desc"
        ),
        {"uid": user_id},
    ).mappings()
    return [dict(row) for row in rows]


def get_project(db: Session, user_id: str, project_id: str) -> dict:
    row = (
        db.execute(
            text(
                f"select {PROJECT_COLUMNS} from public.projects "
                "where id = :id and created_by = :uid"
            ),
            {"id": project_id, "uid": user_id},
        )
        .mappings()
        .first()
    )
    if row is None:
        raise ProjectNotFound(project_id)
    return dict(row)


def create_project(db: Session, user_id: str, payload: ProjectCreate) -> dict:
    row = (
        db.execute(
            text(
                "insert into public.projects "
                "(name, description, project_type, status, country, region, created_by) values "
                "(:name, :description, cast(:project_type as public.project_type), "
                "cast(:status as public.project_status), :country, :region, :uid) "
                f"returning {PROJECT_COLUMNS}"
            ),
            {
                "name": payload.name,
                "description": payload.description,
                "project_type": payload.project_type.value,
                "status": payload.status.value,
                "country": payload.country,
                "region": payload.region,
                "uid": user_id,
            },
        )
        .mappings()
        .first()
    )
    assert row is not None
    return dict(row)


def update_project(db: Session, user_id: str, project_id: str, payload: ProjectUpdate) -> dict:
    values = payload.model_dump(exclude_unset=True)
    if not values:
        return get_project(db, user_id, project_id)

    # Enum columns need an explicit cast; `cast(... as ...)` keeps the bind
    # parameter unambiguous (`:param::type` confuses the parameter parser).
    casts = {
        "project_type": "public.project_type",
        "status": "public.project_status",
    }
    assignments = ", ".join(
        f"{key} = cast(:{key} as {casts[key]})" if key in casts else f"{key} = :{key}"
        for key in values
    )
    params: dict[str, object] = {
        key: (value.value if hasattr(value, "value") else value) for key, value in values.items()
    }
    params.update({"id": project_id, "uid": user_id})

    row = (
        db.execute(
            text(
                f"update public.projects set {assignments}, updated_at = now() "
                f"where id = :id and created_by = :uid returning {PROJECT_COLUMNS}"
            ),
            params,
        )
        .mappings()
        .first()
    )
    if row is None:
        raise ProjectNotFound(project_id)
    return dict(row)


def delete_project(db: Session, user_id: str, project_id: str) -> None:
    result = db.execute(
        text("delete from public.projects where id = :id and created_by = :uid"),
        {"id": project_id, "uid": user_id},
    )
    if result.rowcount == 0:
        raise ProjectNotFound(project_id)
