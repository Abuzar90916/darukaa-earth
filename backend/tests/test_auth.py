"""Authentication behaviour: token verification, login proxying, protection."""

from __future__ import annotations

from typing import Any

import jwt
import pytest
from app.core.config import Settings
from app.core.security import decode_token
from fastapi import HTTPException
from fastapi.testclient import TestClient
from tests.conftest import TEST_USER_ID, FakeSession

SECRET = "test-secret-not-a-real-key"


def _settings() -> Settings:
    return Settings(
        JWT_SECRET=SECRET,
        JWT_ALGORITHM="HS256",
        JWT_AUDIENCE="authenticated",
        AUTH_BASE_URL="https://auth.example.com/auth/v1",
        AUTH_ANON_KEY="publishable-test-key",
    )


def test_decode_token_accepts_a_valid_token() -> None:
    token = jwt.encode(
        {"sub": TEST_USER_ID, "email": "a@b.test", "aud": "authenticated"}, SECRET, "HS256"
    )
    claims = decode_token(token, _settings())
    assert claims["sub"] == TEST_USER_ID


def test_decode_token_rejects_a_tampered_signature() -> None:
    token = jwt.encode({"sub": TEST_USER_ID, "aud": "authenticated"}, "other-secret", "HS256")
    with pytest.raises(HTTPException) as exc:
        decode_token(token, _settings())
    assert exc.value.status_code == 401


def test_decode_token_rejects_an_expired_token() -> None:
    token = jwt.encode(
        {"sub": TEST_USER_ID, "aud": "authenticated", "exp": 1_000_000}, SECRET, "HS256"
    )
    with pytest.raises(HTTPException) as exc:
        decode_token(token, _settings())
    assert exc.value.status_code == 401


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/api/auth/me"),
        ("get", "/api/projects"),
        ("post", "/api/projects"),
        ("get", "/api/sites"),
        ("get", "/api/sites/abc"),
        ("get", "/api/sites/abc/analytics"),
        ("get", "/api/sites/abc/metrics"),
    ],
)
def test_protected_routes_reject_anonymous_requests(
    anon_client: TestClient, method: str, path: str
) -> None:
    response = anon_client.get(path) if method == "get" else anon_client.post(path, json={})
    assert response.status_code == 401


def test_protected_route_rejects_a_garbage_bearer_token(anon_client: TestClient) -> None:
    response = anon_client.get("/api/projects", headers={"Authorization": "Bearer not-a-jwt"})
    assert response.status_code in (401, 500)


def test_me_returns_the_verified_identity_and_role(
    client: TestClient, session: FakeSession
) -> None:
    session.queue([{"role": "admin"}])
    response = client.get("/api/auth/me")
    assert response.status_code == 200
    assert response.json() == {"id": TEST_USER_ID, "email": "admin@example.com", "role": "admin"}


def test_login_returns_the_upstream_jwt(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_post(_settings_obj: Any, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        assert path.startswith("/token")
        assert payload["email"] == "admin@example.com"
        return {
            "access_token": "jwt-value",
            "refresh_token": "refresh-value",
            "expires_in": 3600,
            "user": {"id": TEST_USER_ID, "email": payload["email"]},
        }

    monkeypatch.setattr("app.api.auth._post_auth", fake_post)
    response = client.post(
        "/api/auth/login", json={"email": "admin@example.com", "password": "secret123"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["access_token"] == "jwt-value"
    assert body["token_type"] == "bearer"
    assert body["user_id"] == TEST_USER_ID


def test_login_with_invalid_credentials_returns_401(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_post(*_args: Any, **_kwargs: Any) -> dict[str, Any]:
        raise HTTPException(status_code=401, detail="Invalid login credentials")

    monkeypatch.setattr("app.api.auth._post_auth", fake_post)
    response = client.post(
        "/api/auth/login", json={"email": "admin@example.com", "password": "wrong-password"}
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid login credentials"


def test_login_validates_its_payload(client: TestClient) -> None:
    response = client.post("/api/auth/login", json={"email": "not-an-email", "password": "x"})
    assert response.status_code == 422


def test_register_reports_when_confirmation_is_required(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_post(_settings_obj: Any, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        assert path == "/signup"
        return {"id": TEST_USER_ID, "email": payload["email"]}

    monkeypatch.setattr("app.api.auth._post_auth", fake_post)
    response = client.post(
        "/api/auth/register", json={"email": "new@example.com", "password": "secret123"}
    )
    assert response.status_code == 201
    body = response.json()
    assert body["confirmation_required"] is True
    assert body["access_token"] is None
