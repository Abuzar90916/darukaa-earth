"""FastAPI application entry point.

    uvicorn app.main:app --reload

Interactive documentation is served at /docs (Swagger UI) and /redoc.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api import analytics, auth, projects, sites
from app.core.config import get_settings
from app.db.database import get_db
from app.schemas.common import Message
from app.services.geometry import InvalidGeometry

logger = logging.getLogger("darukaa.api")

settings = get_settings()

app = FastAPI(
    title="DARUKAA.EARTH API",
    version="1.0.0",
    summary="Geospatial analytics API for carbon and biodiversity projects.",
    description=(
        "Serves the DARUKAA.EARTH React frontend. Project, site and analytics "
        "routes require a bearer JWT issued by the platform's auth server. Site "
        "boundaries are stored in PostgreSQL/PostGIS as geometry(Polygon, 4326); "
        "centroid and spheroidal hectare area are derived in the database."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    max_age=600,
)

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(sites.router)
app.include_router(analytics.router)


@app.exception_handler(InvalidGeometry)
async def invalid_geometry_handler(_: Request, exc: InvalidGeometry) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content={"detail": str(exc)}
    )


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    """Logs the cause server-side and returns a generic message, so database
    internals and connection strings never reach a client."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path, exc_info=exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Something went wrong on the server."},
    )


@app.get("/health", response_model=Message, tags=["system"], summary="Liveness probe")
def health() -> Message:
    return Message(detail="ok")


@app.get("/health/db", response_model=Message, tags=["system"], summary="Database readiness")
def health_db() -> Message:
    """Confirms both the connection and that PostGIS is present."""
    session = next(get_db())
    try:
        version = session.execute(text("select extensions.postgis_version()")).scalar()
        return Message(detail=f"postgis {version}")
    finally:
        session.close()
