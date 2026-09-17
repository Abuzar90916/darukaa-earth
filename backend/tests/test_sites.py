"""Site endpoints: multiple sites per project, geometry handling, area, errors."""

from __future__ import annotations

from typing import Any

import pytest
from app.services.geometry import InvalidGeometry
from app.services.project_service import ProjectNotFound
from app.services.site_service import SiteNotFound
from fastapi.testclient import TestClient
from tests.factories import PROJECT_ID, SITE_ID, SQUARE, project_row, site_row


def test_a_project_can_hold_multiple_sites(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("app.services.project_service.get_project", lambda *_: project_row())
    monkeypatch.setattr(
        "app.services.site_service.list_sites",
        lambda *_args, **_kwargs: [
            site_row(id=SITE_ID, name="Agumbe Ridge Block"),
            site_row(id="55555555-5555-4555-8555-555555555555", name="Kudremukh Shola Patch"),
        ],
    )
    response = client.get(f"/api/projects/{PROJECT_ID}/sites")
    assert response.status_code == 200
    names = [site["name"] for site in response.json()]
    assert names == ["Agumbe Ridge Block", "Kudremukh Shola Patch"]


def test_create_site_stores_the_polygon_and_returns_the_derived_area(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    captured: dict[str, Any] = {}

    def fake_create(_db: Any, _uid: str, project_id: str, payload: Any) -> dict[str, Any]:
        captured["project_id"] = project_id
        captured["geometry"] = payload.geometry.model_dump()
        return site_row(name=payload.name)

    monkeypatch.setattr("app.services.site_service.create_site", fake_create)
    response = client.post(
        f"/api/projects/{PROJECT_ID}/sites",
        json={"name": "Agumbe Ridge Block", "status": "active", "geometry": SQUARE},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["area_hectares"] == 1187.42  # derived by PostGIS, echoed back
    assert body["geometry"]["type"] == "Polygon"
    assert body["centroid_lng"] == 75.05
    assert captured["geometry"]["coordinates"] == SQUARE["coordinates"]
    assert captured["project_id"] == PROJECT_ID


def test_create_site_rejects_an_unclosed_polygon(client: TestClient) -> None:
    response = client.post(
        f"/api/projects/{PROJECT_ID}/sites",
        json={
            "name": "Broken",
            "geometry": {"type": "Polygon", "coordinates": [SQUARE["coordinates"][0][:-1]]},
        },
    )
    assert response.status_code == 422


def test_create_site_rejects_a_zero_area_polygon(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def raise_invalid(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
        raise InvalidGeometry("The drawn boundary encloses no area.")

    monkeypatch.setattr("app.services.site_service.create_site", raise_invalid)
    response = client.post(
        f"/api/projects/{PROJECT_ID}/sites",
        json={"name": "Flat", "geometry": SQUARE},
    )
    assert response.status_code == 422
    assert "encloses no area" in response.json()["detail"]


def test_create_site_rejects_a_non_polygon_geometry(client: TestClient) -> None:
    response = client.post(
        f"/api/projects/{PROJECT_ID}/sites",
        json={"name": "Point site", "geometry": {"type": "Point", "coordinates": [75.0, 13.0]}},
    )
    assert response.status_code == 422


def test_create_site_under_a_foreign_project_returns_404(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def raise_missing(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
        raise ProjectNotFound(PROJECT_ID)

    monkeypatch.setattr("app.services.site_service.create_site", raise_missing)
    response = client.post(
        f"/api/projects/{PROJECT_ID}/sites", json={"name": "X", "geometry": SQUARE}
    )
    assert response.status_code == 404


def test_get_site_returns_geojson_geometry(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("app.services.site_service.get_site", lambda *_: site_row())
    response = client.get(f"/api/sites/{SITE_ID}")
    assert response.status_code == 200
    assert response.json()["geometry"] == SQUARE


def test_update_site_can_replace_the_boundary(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    seen: dict[str, Any] = {}

    def fake_update(_db: Any, _uid: str, site_id: str, payload: Any) -> dict[str, Any]:
        seen["site_id"] = site_id
        seen["fields"] = set(payload.model_dump(exclude_unset=True))
        return site_row(area_hectares=999.5)

    monkeypatch.setattr("app.services.site_service.update_site", fake_update)
    response = client.put(f"/api/sites/{SITE_ID}", json={"geometry": SQUARE})
    assert response.status_code == 200
    assert response.json()["area_hectares"] == 999.5
    assert seen["fields"] == {"geometry"}


def test_update_site_returns_404_when_missing(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def raise_missing(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
        raise SiteNotFound(SITE_ID)

    monkeypatch.setattr("app.services.site_service.update_site", raise_missing)
    assert client.put(f"/api/sites/{SITE_ID}", json={"name": "New"}).status_code == 404


def test_delete_site_returns_204(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.site_service.delete_site", lambda *_: None)
    assert client.delete(f"/api/sites/{SITE_ID}").status_code == 204


def test_site_sql_uses_postgis_functions_and_srid_4326() -> None:
    from app.services import site_service

    assert "st_asgeojson" in site_service.SITE_SELECT
    assert site_service.SRID == 4326
