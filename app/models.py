import enum
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class DealStage(str, enum.Enum):
    """Pipeline stages, in pipeline order. `WON` and `LOST` are terminal."""

    LEAD = "lead"
    CONTACTED = "contacted"
    PROPOSAL_SENT = "proposal_sent"
    NEGOTIATION = "negotiation"
    WON = "won"
    LOST = "lost"

    @property
    def is_terminal(self) -> bool:
        return self in TERMINAL_STAGES


TERMINAL_STAGES = frozenset({DealStage.WON, DealStage.LOST})

# Stored as the lowercase *values* ("proposal_sent"), not the member names.
# native_enum=False keeps it a VARCHAR + CHECK, which is portable across SQLite
# and PostgreSQL and avoids needing a CREATE TYPE migration on Postgres.
DealStageType = Enum(
    DealStage,
    name="deal_stage",
    native_enum=False,
    length=32,
    values_callable=lambda cls: [member.value for member in cls],
)


class ActivityType(str, enum.Enum):
    CALL = "call"
    EMAIL = "email"
    MEETING = "meeting"
    NOTE = "note"


ActivityTypeType = Enum(
    ActivityType,
    name="activity_type",
    native_enum=False,
    length=32,
    values_callable=lambda cls: [member.value for member in cls],
)


class TaskStatus(str, enum.Enum):
    """`COMPLETED` and `CANCELLED` are closed states -- a task cannot leave them."""

    PENDING = "pending"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

    @property
    def is_closed(self) -> bool:
        return self in CLOSED_TASK_STATUSES


CLOSED_TASK_STATUSES = frozenset({TaskStatus.COMPLETED, TaskStatus.CANCELLED})

TaskStatusType = Enum(
    TaskStatus,
    name="task_status",
    native_enum=False,
    length=32,
    values_callable=lambda cls: [member.value for member in cls],
)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=_utcnow, nullable=False
    )

    companies: Mapped[list["Company"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )
    contacts: Mapped[list["Contact"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )
    deals: Mapped[list["Deal"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )
    activities: Mapped[list["Activity"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )
    tasks: Mapped[list["Task"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    industry: Mapped[str | None] = mapped_column(String(255), nullable=True)
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=_utcnow, nullable=False
    )

    owner: Mapped["User"] = relationship(back_populates="companies")
    contacts: Mapped[list["Contact"]] = relationship(back_populates="company")
    # No cascade: deleting a company leaves its deals in place with company_id
    # nulled out, the same way Phase 1 treats contacts.
    deals: Mapped[list["Deal"]] = relationship(back_populates="company")


class Contact(Base):
    __tablename__ = "contacts"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), index=True, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    company_id: Mapped[int | None] = mapped_column(
        ForeignKey("companies.id", ondelete="SET NULL"), index=True, nullable=True
    )
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=_utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=_utcnow,
        onupdate=_utcnow,
        nullable=False,
    )

    owner: Mapped["User"] = relationship(back_populates="contacts")
    company: Mapped["Company | None"] = relationship(back_populates="contacts")
    # A deal cannot exist without a contact (contact_id is NOT NULL), so the
    # deals go with it.
    deals: Mapped[list["Deal"]] = relationship(
        back_populates="contact", cascade="all, delete-orphan"
    )
    # An activity cannot exist without a contact, so it goes with it. In practice
    # DELETE /contacts/{id} refuses while activities or tasks still point at the
    # contact; this cascade is what makes deleting a whole *user* safe.
    activities: Mapped[list["Activity"]] = relationship(
        back_populates="contact", cascade="all, delete-orphan"
    )
    # A task can outlive its contact link, so this one only nulls contact_id.
    tasks: Mapped[list["Task"]] = relationship(back_populates="contact")


class Deal(Base):
    __tablename__ = "deals"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    value: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0"), server_default="0", nullable=False
    )
    stage: Mapped[DealStage] = mapped_column(
        DealStageType,
        default=DealStage.LEAD,
        server_default=DealStage.LEAD.value,
        index=True,
        nullable=False,
    )
    probability: Mapped[int | None] = mapped_column(nullable=True)
    expected_close_date: Mapped[date | None] = mapped_column(nullable=True)
    contact_id: Mapped[int] = mapped_column(
        ForeignKey("contacts.id", ondelete="CASCADE"), index=True, nullable=False
    )
    company_id: Mapped[int | None] = mapped_column(
        ForeignKey("companies.id", ondelete="SET NULL"), index=True, nullable=True
    )
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    won_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    lost_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=_utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=_utcnow,
        onupdate=_utcnow,
        nullable=False,
    )

    owner: Mapped["User"] = relationship(back_populates="deals")
    contact: Mapped["Contact"] = relationship(back_populates="deals")
    company: Mapped["Company | None"] = relationship(back_populates="deals")
    # No cascade: deleting a deal leaves its activities and tasks in place with
    # deal_id nulled out. The history of what happened does not disappear.
    activities: Mapped[list["Activity"]] = relationship(back_populates="deal")
    tasks: Mapped[list["Task"]] = relationship(back_populates="deal")


class Activity(Base):
    """An append-only log entry. Created and deleted, never edited."""

    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(primary_key=True)
    type: Mapped[ActivityType] = mapped_column(ActivityTypeType, index=True, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # Defaults to now, but a client can backdate it -- logging a call that
    # actually happened yesterday is the normal case, not the exception.
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, index=True, nullable=False
    )
    contact_id: Mapped[int] = mapped_column(
        ForeignKey("contacts.id", ondelete="CASCADE"), index=True, nullable=False
    )
    deal_id: Mapped[int | None] = mapped_column(
        ForeignKey("deals.id", ondelete="SET NULL"), index=True, nullable=True
    )
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=_utcnow, nullable=False
    )

    owner: Mapped["User"] = relationship(back_populates="activities")
    contact: Mapped["Contact"] = relationship(back_populates="activities")
    deal: Mapped["Deal | None"] = relationship(back_populates="activities")


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    due_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), index=True, nullable=True
    )
    status: Mapped[TaskStatus] = mapped_column(
        TaskStatusType,
        default=TaskStatus.PENDING,
        server_default=TaskStatus.PENDING.value,
        index=True,
        nullable=False,
    )
    contact_id: Mapped[int | None] = mapped_column(
        ForeignKey("contacts.id", ondelete="SET NULL"), index=True, nullable=True
    )
    deal_id: Mapped[int | None] = mapped_column(
        ForeignKey("deals.id", ondelete="SET NULL"), index=True, nullable=True
    )
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=_utcnow, nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    owner: Mapped["User"] = relationship(back_populates="tasks")
    contact: Mapped["Contact | None"] = relationship(back_populates="tasks")
    deal: Mapped["Deal | None"] = relationship(back_populates="tasks")
