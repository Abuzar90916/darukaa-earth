"""SQLAlchemy Core table definitions mirroring the existing PostGIS schema.

Declared with `extend_existing` semantics in mind: these are read/write mappings
onto tables created by `drizzle/migrations/0000_darukaa_core_schema.sql`.
`sites.geom` is a real `geometry(Polygon, 4326)` column — it is only ever read
and written through PostGIS functions (`ST_GeomFromGeoJSON`, `ST_AsGeoJSON`),
never as JSON text.
"""

from __future__ import annotations

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    MetaData,
    Numeric,
    String,
    Table,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID

metadata = MetaData()

projects = Table(
    "projects",
    metadata,
    Column("id", UUID(as_uuid=False), primary_key=True, server_default=func.gen_random_uuid()),
    Column("name", Text, nullable=False),
    Column("description", Text),
    Column("project_type", String, nullable=False, server_default="carbon"),
    Column("status", String, nullable=False, server_default="planning"),
    Column("country", Text),
    Column("region", Text),
    Column("total_area_hectares", Numeric, nullable=False, server_default="0"),
    Column("created_by", UUID(as_uuid=False), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("updated_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
)

sites = Table(
    "sites",
    metadata,
    Column("id", UUID(as_uuid=False), primary_key=True, server_default=func.gen_random_uuid()),
    Column("project_id", UUID(as_uuid=False), ForeignKey("projects.id"), nullable=False),
    Column("name", Text, nullable=False),
    Column("description", Text),
    Column("area_hectares", Numeric, nullable=False, server_default="0"),
    Column("status", String, nullable=False, server_default="active"),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("updated_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    # geom geometry(Polygon, 4326) and centroid geometry(Point, 4326) are handled
    # in SQL via PostGIS functions rather than mapped as opaque columns.
)

site_metrics = Table(
    "site_metrics",
    metadata,
    Column("id", UUID(as_uuid=False), primary_key=True, server_default=func.gen_random_uuid()),
    Column("site_id", UUID(as_uuid=False), ForeignKey("sites.id"), nullable=False),
    Column("recorded_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column("carbon_sequestered", Numeric, nullable=False, server_default="0"),
    Column("biodiversity_index", Numeric, nullable=False, server_default="0"),
    Column("forest_cover_percentage", Numeric, nullable=False, server_default="0"),
    Column("species_count", Integer, nullable=False, server_default="0"),
    Column("water_quality_index", Numeric, nullable=False, server_default="0"),
    Column("project_health_score", Numeric, nullable=False, server_default="0"),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
)
