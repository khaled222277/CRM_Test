"""Shared owner-scoping lookups for the activity and task routers.

Same convention as Phase 1 and 2: a record belonging to another user is reported
as 404, never 403, so the API never confirms that an id exists.
"""

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Contact, Deal, User


def get_owned_contact(db: Session, contact_id: int, user: User) -> Contact:
    contact = db.scalar(
        select(Contact).where(Contact.id == contact_id, Contact.owner_id == user.id)
    )
    if contact is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contact {contact_id} not found",
        )
    return contact


def get_owned_deal(db: Session, deal_id: int, user: User) -> Deal:
    deal = db.scalar(select(Deal).where(Deal.id == deal_id, Deal.owner_id == user.id))
    if deal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Deal {deal_id} not found",
        )
    return deal


def assert_deal_matches_contact(deal: Deal, contact_id: int) -> None:
    """A deal and a contact referenced together must actually be related.

    The deal exists and is yours, so this is a 400 (a contradictory request),
    not a 404.
    """
    if deal.contact_id != contact_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Deal {deal.id} belongs to contact {deal.contact_id}, "
                f"not contact {contact_id}."
            ),
        )
