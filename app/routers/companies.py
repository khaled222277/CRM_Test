from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import CurrentUser, DbSession
from app.models import Company, User
from app.schemas import CompanyCreate, CompanyOut, CompanyUpdate

router = APIRouter(prefix="/companies", tags=["companies"])


def get_owned_company(db: Session, company_id: int, user: User) -> Company:
    """Fetch a company owned by `user`, or raise 404.

    Deliberately 404 (not 403) for someone else's row so the API does not
    reveal whether that id exists.
    """
    company = db.scalar(
        select(Company).where(Company.id == company_id, Company.owner_id == user.id)
    )
    if company is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
    return company


@router.post("", response_model=CompanyOut, status_code=status.HTTP_201_CREATED)
def create_company(payload: CompanyCreate, db: DbSession, current_user: CurrentUser) -> Company:
    company = Company(**payload.model_dump(), owner_id=current_user.id)
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


@router.get("", response_model=list[CompanyOut])
def list_companies(
    db: DbSession,
    current_user: CurrentUser,
    search: str | None = Query(default=None, description="Case-insensitive match on name"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
) -> list[Company]:
    stmt = select(Company).where(Company.owner_id == current_user.id)
    if search:
        stmt = stmt.where(Company.name.ilike(f"%{search}%"))
    stmt = stmt.order_by(Company.created_at.desc(), Company.id.desc()).offset(skip).limit(limit)
    return list(db.scalars(stmt))


@router.get("/{company_id}", response_model=CompanyOut)
def get_company(company_id: int, db: DbSession, current_user: CurrentUser) -> Company:
    return get_owned_company(db, company_id, current_user)


@router.put("/{company_id}", response_model=CompanyOut)
def update_company(
    company_id: int, payload: CompanyUpdate, db: DbSession, current_user: CurrentUser
) -> Company:
    company = get_owned_company(db, company_id, current_user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(company, field, value)
    db.commit()
    db.refresh(company)
    return company


@router.delete("/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_company(company_id: int, db: DbSession, current_user: CurrentUser) -> None:
    company = get_owned_company(db, company_id, current_user)
    db.delete(company)
    db.commit()
