"""Server-side geometry validation (pure, no database)."""

from __future__ import annotations

import pytest
from app.schemas.common import PolygonGeometry
from app.services.geometry import InvalidGeometry, shoelace_area, validate_polygon
from pydantic import ValidationError

SQUARE = [[[75.0, 13.0], [75.1, 13.0], [75.1, 13.1], [75.0, 13.1], [75.0, 13.0]]]


def test_accepts_a_closed_square() -> None:
    geometry = validate_polygon(PolygonGeometry(coordinates=SQUARE))
    assert geometry.type == "Polygon"


def test_rejects_an_unclosed_ring() -> None:
    with pytest.raises(ValidationError, match="not closed"):
        PolygonGeometry(coordinates=[SQUARE[0][:-1]])


def test_rejects_a_ring_with_too_few_positions() -> None:
    with pytest.raises(ValidationError, match="at least 4 positions"):
        PolygonGeometry(coordinates=[[[75.0, 13.0], [75.1, 13.0], [75.0, 13.0]]])


def test_rejects_longitude_out_of_range() -> None:
    with pytest.raises(ValidationError, match="longitude"):
        PolygonGeometry(coordinates=[[[181.0, 13.0], [75.1, 13.0], [75.1, 13.1], [181.0, 13.0]]])


def test_rejects_latitude_out_of_range() -> None:
    with pytest.raises(ValidationError, match="latitude"):
        PolygonGeometry(coordinates=[[[75.0, 91.0], [75.1, 13.0], [75.1, 13.1], [75.0, 91.0]]])


def test_rejects_a_zero_area_polygon() -> None:
    collapsed = [[[75.0, 13.0], [75.1, 13.0], [75.0, 13.0], [75.0, 13.0]]]
    with pytest.raises(InvalidGeometry):
        validate_polygon(PolygonGeometry(coordinates=collapsed))


def test_rejects_a_polygon_with_fewer_than_three_distinct_corners() -> None:
    degenerate = [[[75.0, 13.0], [75.1, 13.0], [75.1, 13.0], [75.0, 13.0]]]
    with pytest.raises(InvalidGeometry, match="three distinct corners"):
        validate_polygon(PolygonGeometry(coordinates=degenerate))


def test_shoelace_area_is_orientation_signed() -> None:
    ring = [position[:2] for position in SQUARE[0]]
    reversed_ring = list(reversed(ring))
    assert shoelace_area(ring) == pytest.approx(-shoelace_area(reversed_ring))
    assert abs(shoelace_area(ring)) == pytest.approx(0.01, rel=1e-6)
