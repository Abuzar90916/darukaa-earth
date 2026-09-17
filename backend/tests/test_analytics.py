"""Analytics endpoints and roll-up maths."""

from __future__ import annotations

from typing import Any

import pytest
from app.services.site_service import SiteNotFound
from fastapi.testclient import TestClient
from tests.factories import SITE_ID, metric_row


def test_metrics_endpoint_returns_the_historical_series(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        "app.services.analytics_service.list_site_metrics",
        lambda *_args, **_kwargs: [metric_row(i) for i in range(3)],
    )
    response = client.get(f"/api/sites/{SITE_ID}/metrics?range=30D")
    assert response.status_code == 200
    series = response.json()
    assert len(series) == 3
    assert series[0]["carbon_sequestered"] == 100.0
    assert series[-1]["carbon_sequestered"] == 120.0


def test_analytics_endpoint_reports_latest_values_and_change(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        "app.services.analytics_service.list_site_metrics",
        lambda *_args, **_kwargs: [metric_row(i) for i in range(4)],
    )
    response = client.get(f"/api/sites/{SITE_ID}/analytics?range=1Y")
    assert response.status_code == 200
    body = response.json()
    assert body["point_count"] == 4
    assert body["range"] == "1Y"
    assert body["latest"]["carbon_sequestered"] == 130.0
    assert body["change"]["carbon_sequestered"] == 30.0
    assert body["change"]["species_count"] == 3
    assert len(body["series"]) == 4


def test_analytics_endpoint_handles_a_site_with_no_measurements(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        "app.services.analytics_service.list_site_metrics", lambda *_args, **_kwargs: []
    )
    body = client.get(f"/api/sites/{SITE_ID}/analytics").json()
    assert body["point_count"] == 0
    assert body["latest"] is None
    assert body["change"] is None
    assert body["series"] == []


def test_analytics_rejects_an_unknown_range(client: TestClient) -> None:
    assert client.get(f"/api/sites/{SITE_ID}/analytics?range=99Y").status_code == 422


def test_analytics_returns_404_for_a_foreign_site(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def raise_missing(*_args: Any, **_kwargs: Any) -> list[dict[str, Any]]:
        raise SiteNotFound(SITE_ID)

    monkeypatch.setattr("app.services.analytics_service.list_site_metrics", raise_missing)
    assert client.get(f"/api/sites/{SITE_ID}/metrics").status_code == 404


def test_portfolio_metrics_endpoint_is_limited(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        "app.services.analytics_service.list_portfolio_metrics",
        lambda *_args, **_kwargs: [metric_row(0)],
    )
    assert client.get("/api/metrics?limit=10").status_code == 200
    assert client.get("/api/metrics?limit=0").status_code == 422
