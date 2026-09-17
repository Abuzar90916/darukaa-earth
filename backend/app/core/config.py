"""Runtime configuration, loaded from environment variables only.

No secret is ever hard-coded: the service refuses to touch the database or
verify a token unless the corresponding variable is present.
"""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- database -----------------------------------------------------------
    # Full PostgreSQL connection string of the existing PostGIS instance.
    database_url: str = Field(default="", alias="DATABASE_URL")
    db_pool_size: int = Field(default=5, alias="DB_POOL_SIZE")

    # --- auth ---------------------------------------------------------------
    # The service verifies the JWTs the existing auth system already issues.
    # Symmetric projects expose a shared secret; projects on asymmetric signing
    # keys expose a JWKS endpoint. Either is enough.
    jwt_secret: str = Field(default="", alias="JWT_SECRET")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    jwt_audience: str = Field(default="authenticated", alias="JWT_AUDIENCE")
    jwks_url: str = Field(default="", alias="JWT_JWKS_URL")

    # Upstream auth server (GoTrue) used by /api/auth/login and /register so the
    # frontend has a single coherent login flow through this API.
    auth_base_url: str = Field(default="", alias="AUTH_BASE_URL")
    auth_anon_key: str = Field(default="", alias="AUTH_ANON_KEY")

    # --- http ---------------------------------------------------------------
    cors_origins: str = Field(default="http://localhost:8080", alias="CORS_ORIGINS")
    environment: str = Field(default="development", alias="ENVIRONMENT")

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() in {"production", "prod"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
