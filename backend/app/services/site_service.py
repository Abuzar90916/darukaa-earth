"""Site persistence, including all PostGIS geometry handling.

Geometry never round-trips as plain JSON in the database: incoming GeoJSON is
converted with `ST_GeomFromGeoJSON` into the existing
`sites.geom geometry(Polygon, 4326)` column, and read back with `ST_AsGeoJSON`.
Centroid and spheroidal hectare area are derived by the database triggers that
already ship with the schema.
"""

from __future__ import annotations

import json

from sqlalchemy import text
from sqlalchemy.exc import DataError, InternalError, ProgrammingError
from sqlalchemy.orm import Session

from app.schemas.common import PolygonGeometry
from app.schemas.site import SiteCreate, SiteUpdate
from app.services.geometry import InvalidGeometry, validate_polygon
from app.services.project_service import ProjectNotFound

SITE_SELECT = """
select
  s.id::text                                        as id,
  s.project_id::text                                as project_id,
  s.name, s.description,
  s.area_hectares::float8                           as area_hectares,
  s.status::text                                    as status,
  s.created_at, s.updated_at,
  extensions.st_asgeojson(s.geom)::json             as geometry,
  extensions.st_x(s.centroid)::float8               as centroid_lng,
  extensions.st_y(s.centroid)::float8               as centroid_lat,
  p.name                                            as project_name,
  p.project_type::text                              as project_type,
  p.status::text                                    as project_status,
  p.country, p.region
from public.sites s
join public.projects p on p.id = s.project_id
where p.created_by = :uid
"""

SRID = 4326


class SiteNotFound(LookupError):
    pass


def _to_srid_geom_param(geometry: PolygonGeometry) -> str:
    validate_polygon(geometry)
    return json.dumps(geometry.model_dump())


def _assert_project_owned(db: Session, user_id: str, project_id: str) -> None:
    exists = db.execute(
        text("select 1 from public.projects where id = :id and created_by = :uid"),
        {"id": project_id, "uid": user_id},
    ).first()
    if exists is None:
        raise ProjectNotFound(project_id)


def list_sites(db: Session, user_id: str, project_id: str | None = None) -> list[dict]:
    sql = SITE_SELECT + (" and s.project_id = :pid" if project_id else "")
    sql += " order by s.created_at desc"
    params: dict[str, object] = {"uid": user_id}
    if project_id:
        params["pid"] = project_id
    return [dict(row) for row in db.execute(text(sql), params).mappings()]


def get_site(db: Session, user_id: str, site_id: str) -> dict:
    row = (
        db.execute(text(SITE_SELECT + " and s.id = :sid"), {"uid": user_id, "sid": site_id})
        .mappings()
        .first()
    )
    if row is None:
        raise SiteNotFound(site_id)
    return dict(row)


def _reraise_unless_geometry(exc: Exception) -> None:
    """Turns a PostGIS complaint into a 422, but never hides other SQL faults.

    A geometry problem is the user's boundary and must be reported as such.
    Anything else (missing privilege, undefined column, connection fault) is a
    server-side problem: it is re-raised so it surfaces as a 500 and is logged,
    instead of being mislabelled as an invalid drawing.
    """
    message = str(getattr(exc, "orig", exc)).lower()
    geometry_markers = (
        "geojson",
        "geometry",
        "geom",
        "postgis",
        "srid",
        "lwgeom",
        "invalid",
    )
    if any(marker in message for marker in geometry_markers):
        raise InvalidGeometry("PostGIS rejected the drawn boundary.") from exc
    raise exc


def create_site(db: Session, user_id: str, project_id: str, payload: SiteCreate) -> dict:
    _assert_project_owned(db, user_id, project_id)
    geojson = _to_srid_geom_param(payload.geometry)
    try:
        row = (
            db.execute(
                text(
                    "insert into public.sites (project_id, name, description, status, geom) "
                    "values (:pid, :name, :description, cast(:status as public.site_status), "
                    "extensions.st_setsrid("
                    "  extensions.st_makevalid(extensions.st_geomfromgeojson(:geojson)), :srid)) "
                    "returning id::text as id"
                ),
                {
                    "pid": project_id,
                    "name": payload.name,
                    "description": payload.description,
                    "status": payload.status.value,
                    "geojson": geojson,
                    "srid": SRID,
                },
            )
            .mappings()
            .first()
        )
    except (DataError, InternalError, ProgrammingError) as exc:
        _reraise_unless_geometry(exc)

    assert row is not None
    db.flush()
    return get_site(db, user_id, row["id"])


def update_site(db: Session, user_id: str, site_id: str, payload: SiteUpdate) -> dict:
    get_site(db, user_id, site_id)  # ownership check, raises SiteNotFound

    values = payload.model_dump(exclude_unset=True)
    assignments: list[str] = []
    params: dict[str, object] = {"sid": site_id, "srid": SRID}

    if "name" in values and values["name"] is not None:
        assignments.append("name = :name")
        params["name"] = values["name"]
    if "description" in values:
        assignments.append("description = :description")
        params["description"] = values["description"]
    if "status" in values and values["status"] is not None:
        assignments.append("status = cast(:status as public.site_status)")
        params["status"] = payload.status.value if payload.status else None
    if values.get("geometry") is not None and payload.geometry is not None:
        assignments.append(
            "geom = extensions.st_setsrid("
            "extensions.st_makevalid(extensions.st_geomfromgeojson(:geojson)), :srid)"
        )
        params["geojson"] = _to_srid_geom_param(payload.geometry)

    if assignments:
        try:
            db.execute(
                text(
                    f"update public.sites set {', '.join(assignments)}, updated_at = now() "
                    "where id = :sid"
                ),
                params,
            )
        except (DataError, InternalError, ProgrammingError) as exc:
            _reraise_unless_geometry(exc)
        db.flush()

    return get_site(db, user_id, site_id)


def delete_site(db: Session, user_id: str, site_id: str) -> None:
    result = db.execute(
        text(
            "delete from public.sites s using public.projects p "
            "where s.project_id = p.id and s.id = :sid and p.created_by = :uid"
        ),
        {"sid": site_id, "uid": user_id},
    )
    if result.rowcount == 0:
        raise SiteNotFound(site_id)
