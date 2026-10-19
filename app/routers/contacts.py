from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.auth import CurrentUser, DbSession
from app.models import Activity, Company, Contact, Task, User
from app.schemas import ContactCreate, ContactOut, ContactUpdate

router = APIRouter(prefix="/contacts", tags=["contacts"])


def _get_owned_contact(db: Session, contact_id: int, user: User) -> Contact:
    contact = db.scalar(
        select(Contact)
        .options(selectinload(Contact.company))
        .where(Contact.id == contact_id, Contact.owner_id == user.id)
    )
    if contact is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")
    return contact


def _assert_company_is_owned(db: Session, company_id: int, user: User) -> None:
    """A contact may only be linked to a company the same user owns."""
    exists = db.scalar(
        select(Company.id).where(Company.id == company_id, Company.owner_id == user.id)
    )
    if exists is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company {company_id} not found",
        )


@router.post("", response_model=ContactOut, status_code=status.HTTP_201_CREATED)
def create_contact(payload: ContactCreate, db: DbSession, current_user: CurrentUser) -> Contact:
    if payload.company_id is not None:
        _assert_company_is_owned(db, payload.company_id, current_user)

    data = payload.model_dump()
    if data.get("email") is not None:
        data["email"] = str(data["email"])

    contact = Contact(**data, owner_id=current_user.id)
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


@router.get("", response_model=list[ContactOut])
def list_contacts(
    db: DbSession,
    current_user: CurrentUser,
    search: str | None = Query(default=None, description="Case-insensitive match on name or email"),
    company_id: int | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
) -> list[Contact]:
    stmt = (
        select(Contact)
        .options(selectinload(Contact.company))
        .where(Contact.owner_id == current_user.id)
    )
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(or_(Contact.name.ilike(pattern), Contact.email.ilike(pattern)))
    if company_id is not None:
        stmt = stmt.where(Contact.company_id == company_id)
    stmt = stmt.order_by(Contact.created_at.desc(), Contact.id.desc()).offset(skip).limit(limit)
    return list(db.scalars(stmt))


@router.get("/{contact_id}", response_model=ContactOut)
def get_contact(contact_id: int, db: DbSession, current_user: CurrentUser) -> Contact:
    return _get_owned_contact(db, contact_id, current_user)


@router.put("/{contact_id}", response_model=ContactOut)
def update_contact(
    contact_id: int, payload: ContactUpdate, db: DbSession, current_user: CurrentUser
) -> Contact:
    contact = _get_owned_contact(db, contact_id, current_user)

    updates = payload.model_dump(exclude_unset=True)
    if updates.get("company_id") is not None:
        _assert_company_is_owned(db, updates["company_id"], current_user)
    if updates.get("email") is not None:
        updates["email"] = str(updates["email"])

    for field, value in updates.items():
        setattr(contact, field, value)
    db.commit()
    db.refresh(contact)
    return contact


def _plural(count: int, singular: str, plural: str) -> str:
    return f"{count} {singular}" if count == 1 else f"{count} {plural}"


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contact(contact_id: int, db: DbSession, current_user: CurrentUser) -> None:
    """Delete a contact.

    Refuses while activities or tasks still reference it -- those are records of
    work done and commitments made, and silently destroying them would lose
    history. Deals are different: a deal cannot exist without its contact, so
    they still cascade away as they did in Phase 2.
    """
    contact = _get_owned_contact(db, contact_id, current_user)

    activity_count = db.scalar(
        select(func.count()).select_from(Activity).where(Activity.contact_id == contact.id)
    )
    task_count = db.scalar(
        select(func.count()).select_from(Task).where(Task.contact_id == contact.id)
    )

    if activity_count or task_count:
        blockers = [
            _plural(count, singular, plural)
            for count, singular, plural in (
                (activity_count, "activity", "activities"),
                (task_count, "task", "tasks"),
            )
            if count
        ]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot delete contact: {' and '.join(blockers)} reference it. "
                "Delete or reassign them first."
            ),
        )

    db.delete(contact)
    db.commit()
