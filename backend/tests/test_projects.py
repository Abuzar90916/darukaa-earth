"""Project CRUD endpoints."""

from __future__ import annotations

from typing import Any

import pytest
from app.services.project_service import ProjectNotFound
from fastapi.testclient import TestClient
from tests.factories import PROJECT_ID, project_row


def test_list_projects_returns_the_callers_portfolio(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("app.services.project_service.list_projects", lambda *_: [project_row()])
    response = client.get("/api/projects")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["id"] == PROJECT_ID
    assert body[0]["total_area_hectares"] == 1234.5


def test_create_project_returns_201_and_the_stored_row(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    captured: dict[str, Any] = {}

    def fake_create(_db: Any, user_id: str, payload: Any) -> dict[str, Any]:
        captured["user_id"] = user_id
        captured["name"] = payload.name
        return project_row(name=payload.name)

    monkeypatch.setattr("app.services.project_service.create_project", fake_create)
    response = client.post(
        "/api/projects",
        json={"name": "Sundarbans Blue Carbon", "project_type": "carbon", "status": "planning"},
    )
    assert response.status_code == 201
    assert response.json()["name"] == "Sundarbans Blue Carbon"
    assert captured["name"] == "Sundarbans Blue Carbon"


def test_create_project_rejects_an_empty_name(client: TestClient) -> None:
    response = client.post("/api/projects", json={"name": ""})
    assert response.status_code == 422


def test_create_project_rejects_an_unknown_project_type(client: TestClient) -> None:
    response = client.post("/api/projects", json={"name": "X", "project_type": "unicorns"})
    assert response.status_code == 422


def test_get_project_returns_404_for_someone_elses_project(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def raise_missing(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
        raise ProjectNotFound(PROJECT_ID)

    monkeypatch.setattr("app.services.project_service.get_project", raise_missing)
    response = client.get(f"/api/projects/{PROJECT_ID}")
    assert response.status_code == 404
    assert response.json()["detail"] == "Project not found"


def test_update_project_applies_only_the_supplied_fields(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    seen: dict[str, Any] = {}

    def fake_update(_db: Any, _uid: str, project_id: str, payload: Any) -> dict[str, Any]:
        seen["id"] = project_id
        seen["fields"] = payload.model_dump(exclude_unset=True)
        return project_row(status="completed")

    monkeypatch.setattr("app.services.project_service.update_project", fake_update)
    response = client.put(f"/api/projects/{PROJECT_ID}", json={"status": "completed"})
    assert response.status_code == 200
    assert response.json()["status"] == "completed"
    assert seen["fields"] == {"status": "completed"}


def test_delete_project_returns_204(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.project_service.delete_project", lambda *_: None)
    response = client.delete(f"/api/projects/{PROJECT_ID}")
    assert response.status_code == 204


def test_delete_project_returns_404_when_missing(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def raise_missing(*_args: Any) -> None:
        raise ProjectNotFound(PROJECT_ID)

    monkeypatch.setattr("app.services.project_service.delete_project", raise_missing)
    assert client.delete(f"/api/projects/{PROJECT_ID}").status_code == 404
