from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field

from app.models import ActivityType, DealStage, TaskStatus


def _to_utc(value: datetime) -> datetime:
    """Normalise a client-supplied datetime to UTC.

    SQLite has no timezone-aware column type, so whatever wall clock we hand it
    is what comes back. Converting on the way in means "2026-10-01T09:00+05:00"
    and "2026-10-01T04:00Z" are stored identically instead of four hours apart.
    A naive datetime is taken to already be UTC.
    """
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


UtcDatetime = Annotated[datetime, AfterValidator(_to_utc)]

# --------------------------------------------------------------------------- #
# Auth / User
# --------------------------------------------------------------------------- #


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    full_name: str = Field(min_length=1, max_length=255)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: str | None = None
    exp: int | None = None


# --------------------------------------------------------------------------- #
# Company
# --------------------------------------------------------------------------- #


class CompanyBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    industry: str | None = Field(default=None, max_length=255)
    website: str | None = Field(default=None, max_length=255)


class CompanyCreate(CompanyBase):
    pass


class CompanyUpdate(BaseModel):
    """All fields optional so PUT can be used for partial updates too."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    industry: str | None = Field(default=None, max_length=255)
    website: str | None = Field(default=None, max_length=255)


class CompanyOut(CompanyBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: int
    created_at: datetime


class CompanyBrief(BaseModel):
    """Trimmed company representation for nesting inside a contact."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


# --------------------------------------------------------------------------- #
# Contact
# --------------------------------------------------------------------------- #


class ContactBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=50)
    company_id: int | None = None
    notes: str | None = None


class ContactCreate(ContactBase):
    pass


class ContactUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=50)
    company_id: int | None = None
    notes: str | None = None


class ContactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr | None
    phone: str | None
    company_id: int | None
    owner_id: int
    notes: str | None
    created_at: datetime
    updated_at: datetime
    company: CompanyBrief | None = None


class ContactBrief(BaseModel):
    """Trimmed contact representation for nesting inside a deal."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


# --------------------------------------------------------------------------- #
# Deal
# --------------------------------------------------------------------------- #

# Money is a Decimal end to end. Pydantic serialises Decimal to a JSON *string*
# ("5000.00") rather than a float, which is deliberate -- it keeps cents exact.
Money = Decimal


class DealCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    value: Money = Field(default=Decimal("0"), ge=0, max_digits=14, decimal_places=2)
    stage: DealStage = DealStage.LEAD
    probability: int | None = Field(default=None, ge=0, le=100)
    expected_close_date: date | None = None
    contact_id: int
    company_id: int | None = None


class DealUpdate(BaseModel):
    """Fields PUT /deals/{id} may change.

    `stage` is deliberately absent and `extra="forbid"` is set, so an attempt to
    move a deal's stage through this endpoint fails loudly with a 422 instead of
    being silently dropped. Stage changes go through PATCH /deals/{id}/stage.
    """

    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=255)
    value: Money | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    probability: int | None = Field(default=None, ge=0, le=100)
    expected_close_date: date | None = None
    contact_id: int | None = None
    company_id: int | None = None


class DealStageUpdate(BaseModel):
    stage: DealStage


class DealOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    value: Money
    stage: DealStage
    probability: int | None
    expected_close_date: date | None
    contact_id: int
    company_id: int | None
    owner_id: int
    won_at: datetime | None
    lost_at: datetime | None
    created_at: datetime
    updated_at: datetime
    contact: ContactBrief
    company: CompanyBrief | None = None


class PipelineStageSummary(BaseModel):
    stage: DealStage
    count: int
    total_value: Money


# --------------------------------------------------------------------------- #
# Activity
# --------------------------------------------------------------------------- #


class ActivityCreate(BaseModel):
    type: ActivityType
    content: str = Field(min_length=1)
    # Omitted -> stamped with now() by the router.
    occurred_at: UtcDatetime | None = None
    contact_id: int
    deal_id: int | None = None


class ActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: ActivityType
    content: str
    occurred_at: datetime
    contact_id: int
    deal_id: int | None
    owner_id: int
    created_at: datetime
    contact: ContactBrief


# --------------------------------------------------------------------------- #
# Task
# --------------------------------------------------------------------------- #


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    due_date: UtcDatetime | None = None
    contact_id: int | None = None
    deal_id: int | None = None


class TaskUpdate(BaseModel):
    """Fields PUT /tasks/{id} may change.

    `status` is deliberately absent and `extra="forbid"` is set, so trying to set
    a status here fails with a 422 rather than being silently dropped. Status
    moves through PATCH /tasks/{id}/complete and /cancel only.
    """

    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    due_date: UtcDatetime | None = None
    contact_id: int | None = None
    deal_id: int | None = None


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    due_date: datetime | None
    status: TaskStatus
    contact_id: int | None
    deal_id: int | None
    owner_id: int
    created_at: datetime
    completed_at: datetime | None
    contact: ContactBrief | None = None


# --------------------------------------------------------------------------- #
# Dashboard
# --------------------------------------------------------------------------- #


class TaskCounts(BaseModel):
    overdue_count: int
    due_this_week_count: int


class DashboardTotals(BaseModel):
    contacts: int
    companies: int
    open_deals: int
    open_pipeline_value: Money


class DashboardSummary(BaseModel):
    pipeline: list[PipelineStageSummary]
    tasks: TaskCounts
    recent_activity: list[ActivityOut]
    totals: DashboardTotals
    deals_closing_soon: list[DealOut]
