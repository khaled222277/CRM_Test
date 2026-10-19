from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.activity_filters import AUTO_LOG_CONTENT_PREFIX
from app.aggregates import pipeline_summary
from app.auth import CurrentUser, DbSession
from app.models import Activity, ActivityType, Company, Contact, Deal, DealStage, User
from app.schemas import (
    DealCreate,
    DealOut,
    DealStageUpdate,
    DealUpdate,
    PipelineStageSummary,
)

router = APIRouter(prefix="/deals", tags=["deals"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _get_owned_deal(db: Session, deal_id: int, user: User) -> Deal:
    deal = db.scalar(
        select(Deal)
        .options(selectinload(Deal.contact), selectinload(Deal.company))
        .where(Deal.id == deal_id, Deal.owner_id == user.id)
    )
    if deal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")
    return deal


def _get_owned_contact(db: Session, contact_id: int, user: User) -> Contact:
    """A deal may only point at a contact the same user owns."""
    contact = db.scalar(
        select(Contact).where(Contact.id == contact_id, Contact.owner_id == user.id)
    )
    if contact is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contact {contact_id} not found",
        )
    return contact


def _assert_company_is_owned(db: Session, company_id: int, user: User) -> None:
    exists = db.scalar(
        select(Company.id).where(Company.id == company_id, Company.owner_id == user.id)
    )
    if exists is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company {company_id} not found",
        )


@router.post("", response_model=DealOut, status_code=status.HTTP_201_CREATED)
def create_deal(payload: DealCreate, db: DbSession, current_user: CurrentUser) -> Deal:
    contact = _get_owned_contact(db, payload.contact_id, current_user)

    company_id = payload.company_id
    if "company_id" not in payload.model_fields_set:
        # Omitted entirely -> inherit the contact's company. An explicit
        # "company_id": null means "no company" and is left alone.
        company_id = contact.company_id
    elif company_id is not None:
        _assert_company_is_owned(db, company_id, current_user)

    deal = Deal(
        **payload.model_dump(exclude={"company_id"}),
        company_id=company_id,
        owner_id=current_user.id,
    )
    if deal.stage is DealStage.WON:
        deal.won_at = _utcnow()
    elif deal.stage is DealStage.LOST:
        deal.lost_at = _utcnow()

    db.add(deal)
    db.commit()
    db.refresh(deal)
    return deal


@router.get("", response_model=list[DealOut])
def list_deals(
    db: DbSession,
    current_user: CurrentUser,
    stage: DealStage | None = Query(default=None),
    contact_id: int | None = Query(default=None),
    company_id: int | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
) -> list[Deal]:
    stmt = (
        select(Deal)
        .options(selectinload(Deal.contact), selectinload(Deal.company))
        .where(Deal.owner_id == current_user.id)
    )
    if stage is not None:
        stmt = stmt.where(Deal.stage == stage)
    if contact_id is not None:
        stmt = stmt.where(Deal.contact_id == contact_id)
    if company_id is not None:
        stmt = stmt.where(Deal.company_id == company_id)
    stmt = stmt.order_by(Deal.created_at.desc(), Deal.id.desc()).offset(skip).limit(limit)
    return list(db.scalars(stmt))


# Declared before /{deal_id} so the literal path wins the route match.
@router.get("/pipeline-summary", response_model=list[PipelineStageSummary])
def get_pipeline_summary(
    db: DbSession, current_user: CurrentUser
) -> list[PipelineStageSummary]:
    """Deal count and total value per stage, aggregated in the database.

    The query lives in app/aggregates so GET /dashboard/summary reports exactly
    the same numbers from exactly the same code.
    """
    return pipeline_summary(db, current_user)


@router.get("/{deal_id}", response_model=DealOut)
def get_deal(deal_id: int, db: DbSession, current_user: CurrentUser) -> Deal:
    return _get_owned_deal(db, deal_id, current_user)


@router.put("/{deal_id}", response_model=DealOut)
def update_deal(
    deal_id: int, payload: DealUpdate, db: DbSession, current_user: CurrentUser
) -> Deal:
    """Edit a deal's details. Allowed on closed deals; never changes the stage."""
    deal = _get_owned_deal(db, deal_id, current_user)

    updates = payload.model_dump(exclude_unset=True)
    if updates.get("contact_id") is not None:
        _get_owned_contact(db, updates["contact_id"], current_user)
    if updates.get("company_id") is not None:
        _assert_company_is_owned(db, updates["company_id"], current_user)

    for field, value in updates.items():
        setattr(deal, field, value)
    db.commit()
    db.refresh(deal)
    return deal


@router.patch("/{deal_id}/stage", response_model=DealOut)
def change_stage(
    deal_id: int, payload: DealStageUpdate, db: DbSession, current_user: CurrentUser
) -> Deal:
    """Move a deal to another stage. The only way stage ever changes."""
    deal = _get_owned_deal(db, deal_id, current_user)

    if deal.stage.is_terminal:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Deal is already closed as {deal.stage.value}. "
                f"Use /deals/{deal.id}/reopen to change this."
            ),
        )

    old_stage = deal.stage
    deal.stage = payload.stage
    now = _utcnow()
    if payload.stage is DealStage.WON:
        deal.won_at = now
    elif payload.stage is DealStage.LOST:
        deal.lost_at = now

    # Auto-log the move. Added to the same session as the stage change, so a
    # single commit covers both -- if the activity insert fails, the stage
    # change rolls back with it and the deal is never silently moved unlogged.
    #
    # The prefix is shared with app/activity_filters, which recognises these
    # rows by it so the dashboard can leave them out of the human activity feed.
    # Do not inline the string here -- see that module's coupling warning.
    db.add(
        Activity(
            type=ActivityType.NOTE,
            content=(
                f"{AUTO_LOG_CONTENT_PREFIX}{old_stage.value} to {payload.stage.value}"
            ),
            occurred_at=now,
            contact_id=deal.contact_id,
            deal_id=deal.id,
            owner_id=current_user.id,
        )
    )

    db.commit()
    db.refresh(deal)
    return deal


@router.post("/{deal_id}/reopen", response_model=DealOut)
def reopen_deal(deal_id: int, db: DbSession, current_user: CurrentUser) -> Deal:
    """Pull a won/lost deal back into the pipeline at the negotiation stage."""
    deal = _get_owned_deal(db, deal_id, current_user)

    if not deal.stage.is_terminal:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Deal is not closed (current stage: {deal.stage.value}). "
                "Only won or lost deals can be reopened."
            ),
        )

    deal.stage = DealStage.NEGOTIATION
    deal.won_at = None
    deal.lost_at = None

    db.commit()
    db.refresh(deal)
    return deal


@router.delete("/{deal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_deal(deal_id: int, db: DbSession, current_user: CurrentUser) -> None:
    deal = _get_owned_deal(db, deal_id, current_user)
    db.delete(deal)
    db.commit()
