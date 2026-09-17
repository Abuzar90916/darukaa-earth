"""Site request/response schemas (GeoJSON in, GeoJSON out)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import PolygonGeometry, ProjectStatus, ProjectType, SiteStatus


class SiteCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    status: SiteStatus = SiteStatus.active
    geometry: PolygonGeometry


class SiteUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    status: SiteStatus | None = None
    geometry: PolygonGeometry | None = None


class SiteRead(BaseModel):
    """Mirrors the `sites_geo` view the frontend already consumes."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    name: str
    description: str | None
    area_hectares: float
    status: SiteStatus
    created_at: datetime
    updated_at: datetime
    geometry: PolygonGeometry
    centroid_lng: float
    centroid_lat: float
    project_name: str
    project_type: ProjectType
    project_status: ProjectStatus
    country: str | None
    region: str | None
