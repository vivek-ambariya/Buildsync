"""Shared FastAPI dependencies: database handle, current user, role guards."""
from typing import Annotated

from bson import ObjectId
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.security import decode_access_token
from app.db.mongodb import Collections as C
from app.db.mongodb import get_database
from app.models.common import Role, serialize

bearer_scheme = HTTPBearer(auto_error=False)

Database = Annotated[AsyncIOMotorDatabase, Depends(get_database)]


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Database,
) -> dict:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in to continue.")

    payload = decode_access_token(credentials.credentials)
    if not payload or not payload.get("sub"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Your session has expired. Sign in again.")

    user = await db[C.users].find_one({"_id": ObjectId(payload["sub"])})
    if not user or not user.get("active", True):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "This account is no longer active.")

    return serialize(user)


CurrentUser = Annotated[dict, Depends(get_current_user)]


def require_roles(*roles: Role):
    """Guard a route so only the listed roles may call it."""
    allowed = {r.value for r in roles}

    async def _guard(user: CurrentUser) -> dict:
        if user.get("role") not in allowed:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "Your role does not have access to this action.",
            )
        return user

    return _guard
