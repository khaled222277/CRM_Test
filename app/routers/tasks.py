from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.auth import CurrentUser, DbSession
from app.models import Task, TaskStatus, User
from app.ownership import assert_deal_matches_contact, get_owned_contact, get_owned_deal
from app.schemas import TaskCreate, TaskOut, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _get_owned_task(db: Session, task_id: int, user: User) -> Task:
    task = db.scalar(
        select(Task)
        .options(selectinload(Task.contact))
        .where(Task.id == task_id, Task.owner_id == user.id)
    )
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


def _validate_links(
    db: Session, contact_id: int | None, deal_id: int | None, user: User
) -> None:
    """Check ownership of whichever links are set, and that they agree."""
    if contact_id is not None:
        get_owned_contact(db, contact_id, user)

    if deal_id is not None:
        deal = get_owned_deal(db, deal_id, user)
        if contact_id is not None:
            assert_deal_matches_contact(deal, contact_id)


def _close_task(
    db: Session, task_id: int, user: User, new_status: TaskStatus, completed: bool
) -> Task:
    task = _get_owned_task(db, task_id, user)

    if task.status.is_closed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Task is already {task.status.value} and cannot be changed.",
        )

    task.status = new_status
    if completed:
        task.completed_at = _utcnow()

    db.commit()
    db.refresh(task)
    return task


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate, db: DbSession, current_user: CurrentUser) -> Task:
    _validate_links(db, payload.contact_id, payload.deal_id, current_user)

    task = Task(**payload.model_dump(), owner_id=current_user.id)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.get("", response_model=list[TaskOut])
def list_tasks(
    db: DbSession,
    current_user: CurrentUser,
    status_: TaskStatus | None = Query(default=None, alias="status"),
    contact_id: int | None = Query(default=None),
    deal_id: int | None = Query(default=None),
    due_before: datetime | None = Query(
        default=None, description="ISO date or datetime; matches tasks due strictly before it"
    ),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
) -> list[Task]:
    stmt = (
        select(Task).options(selectinload(Task.contact)).where(Task.owner_id == current_user.id)
    )
    if status_ is not None:
        stmt = stmt.where(Task.status == status_)
    if contact_id is not None:
        stmt = stmt.where(Task.contact_id == contact_id)
    if deal_id is not None:
        stmt = stmt.where(Task.deal_id == deal_id)
    if due_before is not None:
        stmt = stmt.where(Task.due_date.is_not(None), Task.due_date < due_before)
    stmt = stmt.order_by(Task.created_at.desc(), Task.id.desc()).offset(skip).limit(limit)
    return list(db.scalars(stmt))


# Declared before /{task_id} so the literal path wins the route match.
@router.get("/overdue", response_model=list[TaskOut])
def list_overdue_tasks(
    db: DbSession,
    current_user: CurrentUser,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
) -> list[Task]:
    """Pending tasks whose due date has passed, most overdue first."""
    stmt = (
        select(Task)
        .options(selectinload(Task.contact))
        .where(
            Task.owner_id == current_user.id,
            Task.status == TaskStatus.PENDING,
            Task.due_date.is_not(None),
            Task.due_date < _utcnow(),
        )
        .order_by(Task.due_date.asc(), Task.id.asc())
        .offset(skip)
        .limit(limit)
    )
    return list(db.scalars(stmt))


@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: int, db: DbSession, current_user: CurrentUser) -> Task:
    return _get_owned_task(db, task_id, current_user)


@router.put("/{task_id}", response_model=TaskOut)
def update_task(
    task_id: int, payload: TaskUpdate, db: DbSession, current_user: CurrentUser
) -> Task:
    """Edit a task's details. Never changes the status."""
    task = _get_owned_task(db, task_id, current_user)
    updates = payload.model_dump(exclude_unset=True)

    # Validate against the state the task will be in once the update lands, so
    # changing only one side of a contact/deal pair is still checked.
    effective_contact_id = updates.get("contact_id", task.contact_id)
    effective_deal_id = updates.get("deal_id", task.deal_id)
    _validate_links(db, effective_contact_id, effective_deal_id, current_user)

    for field, value in updates.items():
        setattr(task, field, value)
    db.commit()
    db.refresh(task)
    return task


@router.patch("/{task_id}/complete", response_model=TaskOut)
def complete_task(task_id: int, db: DbSession, current_user: CurrentUser) -> Task:
    return _close_task(db, task_id, current_user, TaskStatus.COMPLETED, completed=True)


@router.patch("/{task_id}/cancel", response_model=TaskOut)
def cancel_task(task_id: int, db: DbSession, current_user: CurrentUser) -> Task:
    return _close_task(db, task_id, current_user, TaskStatus.CANCELLED, completed=False)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, db: DbSession, current_user: CurrentUser) -> None:
    task = _get_owned_task(db, task_id, current_user)
    db.delete(task)
    db.commit()
