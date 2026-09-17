"""Authentication endpoints.

These proxy the application's existing auth server (GoTrue) so there is exactly
one account store and one token format. Passwords pass straight through over TLS
and are never logged, stored or hashed here.
"""

from __future__ import annotations

from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text

from app.core.config import Settings, get_settings
from app.db.dependencies import AuthedUser, DbSession
from app.schemas.auth import Credentials, RegisterResponse, TokenResponse, UserProfile

router = APIRouter(prefix="/api/auth", tags=["auth"])

TIMEOUT = httpx.Timeout(15.0)


def _auth_endpoint(settings: Settings, path: str) -> str:
    if not settings.auth_base_url or not settings.auth_anon_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Sign-in is not configured on this server.",
        )
    return f"{settings.auth_base_url.rstrip('/')}{path}"


async def _post_auth(settings: Settings, path: str, payload: dict[str, Any]) -> dict[str, Any]:
    url = _auth_endpoint(settings, path)
    headers = {
        "apikey": settings.auth_anon_key,
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        response = await client.post(url, json=payload, headers=headers)
    body: dict[str, Any]
    try:
        body = response.json()
    except ValueError:
        body = {}
    if response.status_code >= 400:
        # Surface the upstream message, never upstream internals.
        detail = body.get("msg") or body.get("error_description") or "Authentication failed."
        code = (
            status.HTTP_401_UNAUTHORIZED
            if response.status_code in (400, 401, 403)
            else status.HTTP_502_BAD_GATEWAY
        )
        raise HTTPException(status_code=code, detail=str(detail))
    return body


@router.post("/login", response_model=TokenResponse, summary="Exchange credentials for a JWT")
async def login(
    credentials: Credentials, settings: Settings = Depends(get_settings)
) -> TokenResponse:
    body = await _post_auth(
        settings,
        "/token?grant_type=password",
        {"email": credentials.email, "password": credentials.password},
    )
    user = body.get("user") or {}
    return TokenResponse(
        access_token=body.get("access_token", ""),
        refresh_token=body.get("refresh_token"),
        expires_in=body.get("expires_in"),
        user_id=user.get("id"),
        email=user.get("email"),
    )


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create an account",
)
async def register(
    credentials: Credentials, settings: Settings = Depends(get_settings)
) -> RegisterResponse:
    body = await _post_auth(
        settings, "/signup", {"email": credentials.email, "password": credentials.password}
    )
    user = body.get("user") or body
    access_token = body.get("access_token")
    return RegisterResponse(
        user_id=user.get("id"),
        email=user.get("email"),
        confirmation_required=access_token is None,
        access_token=access_token,
        refresh_token=body.get("refresh_token"),
    )


@router.get("/me", response_model=UserProfile, summary="The signed-in administrator")
def me(user: AuthedUser, db: DbSession) -> UserProfile:
    row = (
        db.execute(
            text("select role::text as role from public.user_roles where user_id = :uid limit 1"),
            {"uid": user.id},
        )
        .mappings()
        .first()
    )
    return UserProfile(id=user.id, email=user.email, role=row["role"] if row else None)
