"""Analytics schemas feeding the existing Chart.js views."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.common import TimeRange


class SiteMetricRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    site_id: str
    recorded_at: datetime
    carbon_sequestered: float
    biodiversity_index: float
    forest_cover_percentage: float
    species_count: int
    water_quality_index: float
    project_health_score: float


class MetricSummary(BaseModel):
    """Roll-up served alongside the raw series so cards need no client maths."""

    carbon_sequestered: float
    biodiversity_index: float
    forest_cover_percentage: float
    species_count: int
    water_quality_index: float
    project_health_score: float


class SiteAnalytics(BaseModel):
    site_id: str
    range: TimeRange
    point_count: int
    first_recorded_at: datetime | None
    last_recorded_at: datetime | None
    latest: MetricSummary | None
    change: MetricSummary | None
    series: list[SiteMetricRead]
