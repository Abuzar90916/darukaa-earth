"""Shared Pydantic schemas."""

from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class ProjectType(str, Enum):
    carbon = "carbon"
    biodiversity = "biodiversity"
    carbon_and_biodiversity = "carbon_and_biodiversity"


class ProjectStatus(str, Enum):
    planning = "planning"
    active = "active"
    completed = "completed"
    archived = "archived"


class SiteStatus(str, Enum):
    planning = "planning"
    active = "active"
    monitoring = "monitoring"
    completed = "completed"
    archived = "archived"


class TimeRange(str, Enum):
    d7 = "7D"
    d30 = "30D"
    m3 = "3M"
    m6 = "6M"
    y1 = "1Y"
    all = "ALL"


TIME_RANGE_DAYS: dict[TimeRange, int | None] = {
    TimeRange.d7: 7,
    TimeRange.d30: 30,
    TimeRange.m3: 90,
    TimeRange.m6: 180,
    TimeRange.y1: 365,
    TimeRange.all: None,
}


class PolygonGeometry(BaseModel):
    """GeoJSON Polygon in EPSG:4326 (WGS84 lon/lat), validated before it ever
    reaches PostGIS."""

    type: Literal["Polygon"] = "Polygon"
    coordinates: list[list[list[float]]] = Field(min_length=1)

    @field_validator("coordinates")
    @classmethod
    def _check_rings(cls, rings: list[list[list[float]]]) -> list[list[list[float]]]:
        for index, ring in enumerate(rings):
            if len(ring) < 4:
                raise ValueError(
                    f"ring {index} needs at least 4 positions (3 corners plus a closing point)"
                )
            for position in ring:
                if len(position) < 2:
                    raise ValueError("each position needs a longitude and a latitude")
                lng, lat = position[0], position[1]
                if not -180 <= lng <= 180:
                    raise ValueError(f"longitude {lng} is outside -180..180")
                if not -90 <= lat <= 90:
                    raise ValueError(f"latitude {lat} is outside -90..90")
            if ring[0][:2] != ring[-1][:2]:
                raise ValueError(f"ring {index} is not closed")
        return rings


class Message(BaseModel):
    detail: str
