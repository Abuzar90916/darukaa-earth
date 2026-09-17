"""Row builders matching the shapes the service layer returns."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from tests.conftest import TEST_USER_ID

NOW = datetime(2026, 1, 15, 12, 0, tzinfo=UTC)
PROJECT_ID = "22222222-2222-4222-8222-222222222222"
SITE_ID = "33333333-3333-4333-8333-333333333333"

SQUARE: dict[str, Any] = {
    "type": "Polygon",
    "coordinates": [[[75.0, 13.0], [75.1, 13.0], [75.1, 13.1], [75.0, 13.1], [75.0, 13.0]]],
}


def project_row(**overrides: Any) -> dict[str, Any]:
    row: dict[str, Any] = {
        "id": PROJECT_ID,
        "name": "Western Ghats Restoration Corridor",
        "description": "Rainforest restoration.",
        "project_type": "carbon_and_biodiversity",
        "status": "active",
        "country": "India",
        "region": "Karnataka",
        "total_area_hectares": 1234.5,
        "created_by": TEST_USER_ID,
        "created_at": NOW,
        "updated_at": NOW,
    }
    row.update(overrides)
    return row


def site_row(**overrides: Any) -> dict[str, Any]:
    row: dict[str, Any] = {
        "id": SITE_ID,
        "project_id": PROJECT_ID,
        "name": "Agumbe Ridge Block",
        "description": "Monitoring unit.",
        "area_hectares": 1187.42,
        "status": "active",
        "created_at": NOW,
        "updated_at": NOW,
        "geometry": SQUARE,
        "centroid_lng": 75.05,
        "centroid_lat": 13.05,
        "project_name": "Western Ghats Restoration Corridor",
        "project_type": "carbon_and_biodiversity",
        "project_status": "active",
        "country": "India",
        "region": "Karnataka",
    }
    row.update(overrides)
    return row


def metric_row(index: int = 0, **overrides: Any) -> dict[str, Any]:
    row: dict[str, Any] = {
        "id": f"44444444-4444-4444-8444-44444444444{index % 10}",
        "site_id": SITE_ID,
        "recorded_at": datetime(2026, 1, 1 + index, 0, 0, tzinfo=UTC),
        "carbon_sequestered": 100.0 + index * 10,
        "biodiversity_index": 50.0 + index,
        "forest_cover_percentage": 60.0 + index,
        "species_count": 80 + index,
        "water_quality_index": 70.0 + index,
        "project_health_score": 65.0 + index,
    }
    row.update(overrides)
    return row
