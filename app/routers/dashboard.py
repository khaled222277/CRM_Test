from fastapi import APIRouter, Query

from app.aggregates import (
    dashboard_totals,
    deals_closing_soon,
    pipeline_summary,
    recent_activities,
    task_counts,
)
from app.auth import CurrentUser, DbSession
from app.models import Activity, Deal
from app.schemas import ActivityOut, DashboardSummary, DealOut

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

RECENT_ACTIVITY_LIMIT = 10
CLOSING_SOON_LIMIT = 20


@router.get("/summary", response_model=DashboardSummary)
def summary(db: DbSession, current_user: CurrentUser) -> DashboardSummary:
    """Everything a landing page needs, in one request.

    A brand-new account with no data gets the same shape back with zeroes and
    empty lists -- never an error, and never a missing key.
    """
    return DashboardSummary(
        pipeline=pipeline_summary(db, current_user),
        tasks=task_counts(db, current_user),
        recent_activity=[
            ActivityOut.model_validate(activity)
            for activity in recent_activities(db, current_user, limit=RECENT_ACTIVITY_LIMIT)
        ],
        totals=dashboard_totals(db, current_user),
        deals_closing_soon=[
            DealOut.model_validate(deal)
            for deal in deals_closing_soon(db, current_user, limit=CLOSING_SOON_LIMIT)
        ],
    )


@router.get("/activity-feed", response_model=list[ActivityOut])
def activity_feed(
    db: DbSession,
    current_user: CurrentUser,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[Activity]:
    """Paginated version of the summary's recent_activity section."""
    return recent_activities(db, current_user, skip=skip, limit=limit)


@router.get("/deals-closing-soon", response_model=list[DealOut])
def closing_soon(
    db: DbSession,
    current_user: CurrentUser,
    days: int = Query(default=7, ge=1, le=90, description="Size of the window, in days"),
    limit: int = Query(default=CLOSING_SOON_LIMIT, ge=1, le=100),
) -> list[Deal]:
    """Standalone version of the summary's deals_closing_soon section."""
    return deals_closing_soon(db, current_user, days=days, limit=limit)
