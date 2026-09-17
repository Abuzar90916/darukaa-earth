from fastapi.testclient import TestClient


def test_health_is_public(anon_client: TestClient) -> None:
    response = anon_client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"detail": "ok"}


def test_openapi_documents_the_major_endpoints(anon_client: TestClient) -> None:
    paths = anon_client.get("/openapi.json").json()["paths"]
    for path in (
        "/api/auth/login",
        "/api/auth/register",
        "/api/auth/me",
        "/api/projects",
        "/api/projects/{project_id}",
        "/api/projects/{project_id}/sites",
        "/api/sites/{site_id}",
        "/api/sites/{site_id}/analytics",
        "/api/sites/{site_id}/metrics",
        "/health",
    ):
        assert path in paths, f"{path} is missing from the OpenAPI document"
