"""Owner-scoped aggregate queries shared by the deals and dashboard routers.

Everything here takes the current user and filters on `owner_id`, so a caller
cannot accidentally widen the scope. Each function is a single round trip; none
of them iterate rows in Python to produce a count or a sum.
"""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import and_, case, func, select
from sqlalchemy.orm import Session, selectinload

from app.activity_filters import exclude_auto_logged
from app.models import (
    TERMINAL_STAGES,
    Activity,
    Company,
    Contact,
    Deal,
    DealStage,
    Task,
    TaskStatus,
    User,
)
from app.schemas import DashboardTotals, PipelineStageSummary, TaskCounts

_CENTS = Decimal("0.01")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_money(value: object) -> Decimal:
    """Normalise a SUM() result to a 2dp Decimal.

    SQLite hands back a float for SUM over NUMERIC, so this goes via str rather
    than constructing a Decimal from binary floating point.
    """
    return Decimal(str(value or 0)).quantize(_CENTS)


def pipeline_summary(db: Session, user: User) -> list[PipelineStageSummary]:
    """Deal count and total value per stage, aggregated in the database.

    Every stage is reported, including empty ones, in pipeline order, so a board
    UI needs no backfilling. The GROUP BY only returns stages that have deals;
    the zero-fill below runs over the six enum members, never over the deals.
    """
    rows = db.execute(
        select(
            Deal.stage,
            func.count(Deal.id),
            func.coalesce(func.sum(Deal.value), 0),
        )
        .where(Deal.owner_id == user.id)
        .group_by(Deal.stage)
    ).all()

    aggregates: dict[DealStage, tuple[int, Decimal]] = {
        stage: (0, Decimal("0")) for stage in DealStage
    }
    for stage, count, total in rows:
        aggregates[stage] = (count, _as_money(total))

    return [
        PipelineStageSummary(stage=stage, count=count, total_value=total.quantize(_CENTS))
        for stage, (count, total) in aggregates.items()
    ]


def task_counts(db: Session, user: User, *, week_days: int = 7) -> TaskCounts:
    """Overdue and due-soon counts for pending tasks, in one pass.

    The two windows are disjoint: overdue is strictly before now, due-this-week
    starts at now, so a task is never counted twice.
    """
    now = _utcnow()
    horizon = now + timedelta(days=week_days)

    has_due_date = Task.due_date.is_not(None)
    overdue = and_(has_due_date, Task.due_date < now)
    due_this_week = and_(has_due_date, Task.due_date >= now, Task.due_date <= horizon)

    overdue_count, due_this_week_count = db.execute(
        select(
            func.coalesce(func.sum(case((overdue, 1), else_=0)), 0),
            func.coalesce(func.sum(case((due_this_week, 1), else_=0)), 0),
        ).where(Task.owner_id == user.id, Task.status == TaskStatus.PENDING)
    ).one()

    return TaskCounts(
        overdue_count=overdue_count,
        due_this_week_count=due_this_week_count,
    )


def dashboard_totals(db: Session, user: User) -> DashboardTotals:
    """Headline counters. `open_*` excludes won and lost deals."""
    contacts = db.scalar(
        select(func.count()).select_from(Contact).where(Contact.owner_id == user.id)
    )
    companies = db.scalar(
        select(func.count()).select_from(Company).where(Company.owner_id == user.id)
    )
    open_deals, open_value = db.execute(
        select(func.count(Deal.id), func.coalesce(func.sum(Deal.value), 0)).where(
            Deal.owner_id == user.id,
            Deal.stage.not_in(TERMINAL_STAGES),
        )
    ).one()

    return DashboardTotals(
        contacts=contacts,
        companies=companies,
        open_deals=open_deals,
        open_pipeline_value=_as_money(open_value),
    )


def recent_activities(
    db: Session, user: User, *, skip: int = 0, limit: int = 10
) -> list[Activity]:
    """Hand-logged activities, newest first.

    Auto-logged stage-change notes are filtered out -- see app/activity_filters.
    `selectinload` fetches every nested contact in one extra query rather than
    one per row.
    """
    stmt = (
        select(Activity)
        .options(selectinload(Activity.contact))
        .where(Activity.owner_id == user.id, exclude_auto_logged())
        .order_by(Activity.occurred_at.desc(), Activity.id.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(db.scalars(stmt))


def deals_closing_soon(
    db: Session, user: User, *, days: int = 7, limit: int = 20
) -> list[Deal]:
    """Open deals with an expected close date inside the window, soonest first.

    `expected_close_date` is a date, so the window is compared in whole days.
    Won and lost deals are excluded -- they are not closing, they have closed.
    """
    today: date = _utcnow().date()
    horizon = today + timedelta(days=days)

    stmt = (
        select(Deal)
        .options(selectinload(Deal.contact), selectinload(Deal.company))
        .where(
            Deal.owner_id == user.id,
            Deal.stage.not_in(TERMINAL_STAGES),
            Deal.expected_close_date.is_not(None),
            Deal.expected_close_date >= today,
            Deal.expected_close_date <= horizon,
        )
        .order_by(Deal.expected_close_date.asc(), Deal.id.asc())
        .limit(limit)
    )
    return list(db.scalars(stmt))
