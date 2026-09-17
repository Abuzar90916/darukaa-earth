"""Authentication schemas."""

from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=200)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"
    expires_in: int | None = None
    user_id: str | None = None
    email: str | None = None


class RegisterResponse(BaseModel):
    user_id: str | None = None
    email: str | None = None
    confirmation_required: bool = False
    access_token: str | None = None
    refresh_token: str | None = None


class UserProfile(BaseModel):
    id: str
    email: str | None = None
    role: str | None = None
