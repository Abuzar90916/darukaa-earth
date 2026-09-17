"""JWT verification.

This service does NOT run a second account system. It verifies the JWTs issued
by the application's existing auth server, so there is exactly one login flow:

    browser signs in -> auth server issues JWT -> browser sends
    `Authorization: Bearer <jwt>` -> FastAPI verifies signature + claims.

Passwords are never seen, stored or hashed here; the auth server owns them.
"""

from __future__ import annotations

from dataclasses import dataclass

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from app.core.config import Settings, get_settings

bearer_scheme = HTTPBearer(auto_error=False)

_jwk_clients: dict[str, PyJWKClient] = {}


@dataclass(frozen=True)
class CurrentUser:
    """The authenticated caller, derived purely from verified token claims."""

    id: str
    email: str | None
    claims: dict


def _jwk_client(url: str) -> PyJWKClient:
    if url not in _jwk_clients:
        _jwk_clients[url] = PyJWKClient(url, cache_keys=True)
    return _jwk_clients[url]


def _unauthorized(detail: str = "Not authenticated") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def decode_token(token: str, settings: Settings) -> dict:
    """Verifies signature, expiry and audience. Raises 401 on any problem."""
    options = {"verify_aud": bool(settings.jwt_audience)}
    try:
        if settings.jwks_url:
            key = _jwk_client(settings.jwks_url).get_signing_key_from_jwt(token).key
            return jwt.decode(
                token,
                key,
                algorithms=["RS256", "ES256", "RS512"],
                audience=settings.jwt_audience or None,
                options=options,
            )
        if not settings.jwt_secret:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Authentication is not configured on the server.",
            )
        return jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            audience=settings.jwt_audience or None,
            options=options,
        )
    except jwt.ExpiredSignatureError as exc:
        raise _unauthorized("Session expired") from exc
    except jwt.InvalidTokenError as exc:
        raise _unauthorized("Invalid authentication token") from exc


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    settings: Settings = Depends(get_settings),
) -> CurrentUser:
    if credentials is None or not credentials.credentials:
        raise _unauthorized()
    claims = decode_token(credentials.credentials, settings)
    subject = claims.get("sub")
    if not subject:
        raise _unauthorized("Token is missing a subject claim")
    return CurrentUser(id=str(subject), email=claims.get("email"), claims=claims)
