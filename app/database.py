from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


def _engine_kwargs(url: str) -> dict:
    """SQLite needs a couple of quirks that other backends do not."""
    if url.startswith("sqlite"):
        return {"connect_args": {"check_same_thread": False}}
    # Sensible defaults for a real server-backed DB (e.g. PostgreSQL).
    return {"pool_pre_ping": True}


engine = create_engine(settings.database_url, **_engine_kwargs(settings.database_url))

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
