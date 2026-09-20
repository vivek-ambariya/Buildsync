"""Password hashing and JWT issuing/validation."""
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(subject: str, workspace: str) -> tuple[str, int]:
    """Return (token, expires_in_seconds).

    `workspace` is the role the person chose to sign in as. It is recorded in
    the token only so the server knows which of their authorised roles this
    session is using — it is never taken as proof of anything. Every request
    re-checks it against the roles stored on the account, so a token whose
    claim has been edited, or whose holder has since been demoted, stops
    working on the next call.
    """
    expires_delta = timedelta(minutes=settings.access_token_expire_minutes)
    expire = datetime.now(timezone.utc) + expires_delta
    payload = {"sub": subject, "role": workspace, "ws": workspace,
               "exp": expire, "iat": datetime.now(timezone.utc)}
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, int(expires_delta.total_seconds())


def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        return None
