from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.auth import CurrentUser, DbSession
from app.models import Activity, ActivityType, User
from app.ownership import assert_deal_matches_contact, get_owned_contact, get_owned_deal
from app.schemas import ActivityCreate, ActivityOut

router = APIRouter(prefix="/activities", tags=["activities"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _get_owned_activity(db: Session, activity_id: int, user: User) -> Activity:
    activity = db.scalar(
        select(Activity)
        .options(selectinload(Activity.contact))
        .where(Activity.id == activity_id, Activity.owner_id == user.id)
    )
    if activity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found")
    return activity


@router.post("", response_model=ActivityOut, status_code=status.HTTP_201_CREATED)
def create_activity(payload: ActivityCreate, db: DbSession, current_user: CurrentUser) -> Activity:
    get_owned_contact(db, payload.contact_id, current_user)

    if payload.deal_id is not None:
        deal = get_owned_deal(db, payload.deal_id, current_user)
        assert_deal_matches_contact(deal, payload.contact_id)

    activity = Activity(
        **payload.model_dump(exclude={"occurred_at"}),
        occurred_at=payload.occurred_at or _utcnow(),
        owner_id=current_user.id,
    )
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return activity


@router.get("", response_model=list[ActivityOut])
def list_activities(
    db: DbSession,
    current_user: CurrentUser,
    contact_id: int | None = Query(default=None),
    deal_id: int | None = Query(default=None),
    type: ActivityType | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
) -> list[Activity]:
    stmt = (
        select(Activity)
        .options(selectinload(Activity.contact))
        .where(Activity.owner_id == current_user.id)
    )
    if contact_id is not None:
        stmt = stmt.where(Activity.contact_id == contact_id)
    if deal_id is not None:
        stmt = stmt.where(Activity.deal_id == deal_id)
    if type is not None:
        stmt = stmt.where(Activity.type == type)
    # Most recent first. id breaks ties between entries sharing a timestamp so
    # the order is stable across identical requests.
    stmt = (
        stmt.order_by(Activity.occurred_at.desc(), Activity.id.desc()).offset(skip).limit(limit)
    )
    return list(db.scalars(stmt))


@router.get("/{activity_id}", response_model=ActivityOut)
def get_activity(activity_id: int, db: DbSession, current_user: CurrentUser) -> Activity:
    return _get_owned_activity(db, activity_id, current_user)


@router.delete("/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_activity(activity_id: int, db: DbSession, current_user: CurrentUser) -> None:
    """Hard delete. Activities are immutable, but a mislogged one can be removed."""
    activity = _get_owned_activity(db, activity_id, current_user)
    db.delete(activity)
    db.commit()


# There is deliberately no PUT or PATCH here: an activity is an append-only
# record of something that happened. Correcting one means deleting and re-logging.
