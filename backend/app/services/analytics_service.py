"""Historical measurement reads for the Chart.js views."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.schemas.analytics import MetricSummary, SiteAnalytics, SiteMetricRead
from app.schemas.common import TIME_RANGE_DAYS, TimeRange
from app.services.site_service import get_site

METRIC_COLUMNS = """
  m.id::text as id, m.site_id::text as site_id, m.recorded_at,
  m.carbon_sequestered::float8      as carbon_sequestered,
  m.biodiversity_index::float8      as biodiversity_index,
  m.forest_cover_percentage::float8 as forest_cover_percentage,
  m.species_count,
  m.water_quality_index::float8     as water_quality_index,
  m.project_health_score::float8    as project_health_score
"""

PORTFOLIO_LIMIT = 4000


def list_site_metrics(
    db: Session, user_id: str, site_id: str, range_: TimeRange = TimeRange.all
) -> list[dict]:
    get_site(db, user_id, site_id)  # ownership check
    days = TIME_RANGE_DAYS[range_]
    window = " and m.recorded_at >= now() - make_interval(days => :days)" if days else ""
    params: dict[str, object] = {"sid": site_id}
    if days:
        params["days"] = days
    rows = db.execute(
        text(
            f"select {METRIC_COLUMNS} from public.site_metrics m "
            f"where m.site_id = :sid{window} order by m.recorded_at asc"
        ),
        params,
    ).mappings()
    return [dict(row) for row in rows]


def list_portfolio_metrics(db: Session, user_id: str, limit: int = PORTFOLIO_LIMIT) -> list[dict]:
    rows = db.execute(
        text(
            f"select {METRIC_COLUMNS} from public.site_metrics m "
            "join public.sites s on s.id = m.site_id "
            "join public.projects p on p.id = s.project_id "
            "where p.created_by = :uid order by m.recorded_at desc limit :lim"
        ),
        {"uid": user_id, "lim": limit},
    ).mappings()
    return [dict(row) for row in rows]


_SUMMARY_FIELDS = (
    "carbon_sequestered",
    "biodiversity_index",
    "forest_cover_percentage",
    "species_count",
    "water_quality_index",
    "project_health_score",
)


def _summary(row: dict) -> MetricSummary:
    return MetricSummary(**{field: row[field] for field in _SUMMARY_FIELDS})


def build_site_analytics(
    db: Session, user_id: str, site_id: str, range_: TimeRange = TimeRange.all
) -> SiteAnalytics:
    """Series plus latest values and change over the window, so the existing
    charts and stat cards get everything in one request."""
    rows = list_site_metrics(db, user_id, site_id, range_)
    latest = _summary(rows[-1]) if rows else None
    change = None
    if len(rows) >= 2:
        first, last = rows[0], rows[-1]
        change = MetricSummary(
            **{
                field: (
                    int(last[field] - first[field])
                    if field == "species_count"
                    else round(last[field] - first[field], 4)
                )
                for field in _SUMMARY_FIELDS
            }
        )
    return SiteAnalytics(
        site_id=site_id,
        range=range_,
        point_count=len(rows),
        first_recorded_at=rows[0]["recorded_at"] if rows else None,
        last_recorded_at=rows[-1]["recorded_at"] if rows else None,
        latest=latest,
        change=change,
        series=[SiteMetricRead(**row) for row in rows],
    )
