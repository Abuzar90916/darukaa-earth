"""Analytics endpoints feeding the existing Chart.js charts."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status

from app.db.dependencies import AuthedUser, DbSession
from app.schemas.analytics import SiteAnalytics, SiteMetricRead
from app.schemas.common import TimeRange
from app.services import analytics_service
from app.services.site_service import SiteNotFound

router = APIRouter(prefix="/api", tags=["analytics"])

NOT_FOUND = HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site not found")


@router.get(
    "/sites/{site_id}/analytics",
    response_model=SiteAnalytics,
    summary="Series plus latest values and change over the window",
)
def site_analytics(
    site_id: str,
    user: AuthedUser,
    db: DbSession,
    range: TimeRange = Query(default=TimeRange.all, description="Time window"),
) -> SiteAnalytics:
    try:
        return analytics_service.build_site_analytics(db, user.id, site_id, range)
    except SiteNotFound:
        raise NOT_FOUND from None


@router.get(
    "/sites/{site_id}/metrics",
    response_model=list[SiteMetricRead],
    summary="Raw historical measurements for one site",
)
def site_metrics(
    site_id: str,
    user: AuthedUser,
    db: DbSession,
    range: TimeRange = Query(default=TimeRange.all),
) -> list[SiteMetricRead]:
    try:
        rows = analytics_service.list_site_metrics(db, user.id, site_id, range)
    except SiteNotFound:
        raise NOT_FOUND from None
    return [SiteMetricRead(**row) for row in rows]


@router.get(
    "/metrics",
    response_model=list[SiteMetricRead],
    summary="Recent measurements across the whole portfolio",
)
def portfolio_metrics(
    user: AuthedUser,
    db: DbSession,
    limit: int = Query(default=4000, ge=1, le=20000),
) -> list[SiteMetricRead]:
    rows = analytics_service.list_portfolio_metrics(db, user.id, limit)
    return [SiteMetricRead(**row) for row in rows]
