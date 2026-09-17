"""Pure geometry validation, applied before any PostGIS write.

Pydantic already enforces GeoJSON structure (closed rings, coordinate ranges);
these checks catch the degenerate cases a drawing tool can still produce.
"""

from __future__ import annotations

from itertools import pairwise

from app.schemas.common import PolygonGeometry

MIN_RING_AREA_DEG2 = 1e-12


class InvalidGeometry(ValueError):
    """Raised when a polygon cannot be stored as a meaningful site boundary."""


def shoelace_area(ring: list[list[float]]) -> float:
    """Signed planar area of a ring in square degrees (sign = winding order)."""
    total = 0.0
    for (x1, y1), (x2, y2) in pairwise(ring):
        total += x1 * y2 - x2 * y1
    return total / 2.0


def validate_polygon(geometry: PolygonGeometry) -> PolygonGeometry:
    """Rejects self-degenerate polygons; returns the geometry unchanged."""
    outer = [position[:2] for position in geometry.coordinates[0]]

    unique = {(round(x, 12), round(y, 12)) for x, y in outer}
    if len(unique) < 3:
        raise InvalidGeometry("A boundary needs at least three distinct corners.")

    if abs(shoelace_area(outer)) < MIN_RING_AREA_DEG2:
        raise InvalidGeometry("The drawn boundary encloses no area.")

    for index, ring in enumerate(geometry.coordinates[1:], start=1):
        if len({(round(p[0], 12), round(p[1], 12)) for p in ring}) < 3:
            raise InvalidGeometry(f"Hole {index} of the boundary is degenerate.")

    return geometry
