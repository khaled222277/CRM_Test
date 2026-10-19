from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# tokenUrl is only used to render the "Authorize" button in /docs.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

CREDENTIALS_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(subject: str | int, expires_delta: timedelta | None = None) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    payload = {"sub": str(subject), "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    """Decode the bearer token and load the matching user, or 401."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError:
        # Covers bad signature, malformed token, and expiry.
        raise CREDENTIALS_EXCEPTION from None

    subject = payload.get("sub")
    if subject is None:
        raise CREDENTIALS_EXCEPTION

    try:
        user_id = int(subject)
    except (TypeError, ValueError):
        raise CREDENTIALS_EXCEPTION from None

    user = db.get(User, user_id)
    if user is None:
        raise CREDENTIALS_EXCEPTION
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
DbSession = Annotated[Session, Depends(get_db)]
