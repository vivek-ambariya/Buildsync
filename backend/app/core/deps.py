"""Shared FastAPI dependencies: database handle, current user, role and permission guards.

Authorisation is decided here and only here. A route declares what it needs
(`require_admin`, `require_roles(...)`, `require_permission(...)`) and the guard
resolves the caller's role from the database record the token points at — never
from anything the client sent. A forged or edited `role` claim in a JWT changes
nothing, because the claim is not what is read.
"""
from typing import Annotated

from bson import ObjectId
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.permissions import has_all, has_any, permissions_for
from app.core.workspaces import authorized_roles, label_for
from app.core.security import decode_access_token
from app.db.mongodb import Collections as C
from app.db.mongodb import get_database
from app.models.common import Role, serialize, utcnow

bearer_scheme = HTTPBearer(auto_error=False)

Database = Annotated[AsyncIOMotorDatabase, Depends(get_database)]

# One sentence for every refusal. It tells the caller the answer is "no"
# without naming the role, permission or record that produced it.
FORBIDDEN = "Your role does not have access to this action."

# How stale a person's "last active" stamp may get before it is rewritten.
# Refreshing it on every request would mean a database write per API call.
_PRESENCE_INTERVAL_SECONDS = 300


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Database,
) -> dict:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in to continue.")

    payload = decode_access_token(credentials.credentials)
    if not payload or not payload.get("sub"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Your session has expired. Sign in again.")

    if not ObjectId.is_valid(payload["sub"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Your session has expired. Sign in again.")

    user = await db[C.users].find_one({"_id": ObjectId(payload["sub"])})
    if not user or not user.get("active", True):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "This account is no longer active.")

    # Which workspace this session is using, checked against the roles stored
    # on the account. The token says what was chosen; the database decides
    # whether it is allowed. A role revoked a minute ago is refused now, not
    # whenever the token happens to expire.
    allowed = authorized_roles(user)
    if not allowed:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED,
                            "This account has no workspace assigned. Ask an administrator.")

    # A session is tied to the workspace it was opened for. If that workspace
    # is no longer among the account's roles — the claim was edited, or an
    # admin changed the roles since — the *session* is what has become
    # invalid, so this is a 401 and not a 403. The client already knows how to
    # recover from a 401: sign in again and choose a workspace. A 403 here
    # would strand the person in a session that can no longer do anything,
    # including switch to a workspace they legitimately hold.
    workspace = payload.get("ws") or payload.get("role")
    if workspace not in allowed:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Your session is no longer valid for that workspace. Please sign in again.",
        )

    await _touch_presence(db, user)

    signed_in = serialize(user)
    # `role` is the *active* workspace for the rest of this request. Every
    # permission check downstream reads it, so one validated value here is
    # what the whole authorisation layer runs on.
    signed_in["role"] = workspace
    signed_in["authorized_roles"] = allowed
    return signed_in


async def _touch_presence(db: AsyncIOMotorDatabase, user: dict) -> None:
    """Keep `last_active_at` roughly current for the admin user list."""
    now = utcnow()
    previous = user.get("last_active_at")
    if previous is not None:
        if previous.tzinfo is None:
            previous = previous.replace(tzinfo=now.tzinfo)
        if (now - previous).total_seconds() < _PRESENCE_INTERVAL_SECONDS:
            return
    user["last_active_at"] = now
    await db[C.users].update_one({"_id": user["_id"]}, {"$set": {"last_active_at": now}})


CurrentUser = Annotated[dict, Depends(get_current_user)]


def require_roles(*roles: Role | str):
    """Guard a route so only the listed roles may call it."""
    allowed = {r.value if isinstance(r, Role) else r for r in roles}

    async def _guard(user: CurrentUser) -> dict:
        if user.get("role") not in allowed:
            raise HTTPException(status.HTTP_403_FORBIDDEN, FORBIDDEN)
        return user

    return _guard


def require_role(role: Role | str):
    """Guard a route so only one specific role may call it."""
    return require_roles(role)


def require_permission(*permissions: str, mode: str = "all"):
    """Guard a route by capability rather than by role name.

    Routes state what they do — `require_permission(P.projects_delete)` — so
    moving a capability between roles is a change to the matrix in
    `app.core.permissions`, not a sweep through every router.
    """
    check = has_all if mode == "all" else has_any

    async def _guard(user: CurrentUser) -> dict:
        if not check(user.get("role"), permissions):
            raise HTTPException(status.HTTP_403_FORBIDDEN, FORBIDDEN)
        return user

    return _guard


# The admin guard, named as its own dependency because it is used everywhere
# the admin surface is mounted.
require_admin = require_roles(Role.admin)

AdminUser = Annotated[dict, Depends(require_admin)]


def ensure_permission(user: dict, *permissions: str, mode: str = "all") -> None:
    """The same check, inside a handler, for rules a dependency cannot express.

    Used where the decision needs the record being edited — "may this person
    change *this* task" — rather than only the caller's role.
    """
    check = has_all if mode == "all" else has_any
    if not check(user.get("role"), permissions):
        raise HTTPException(status.HTTP_403_FORBIDDEN, FORBIDDEN)


def forbidden() -> HTTPException:
    return HTTPException(status.HTTP_403_FORBIDDEN, FORBIDDEN)


def user_permissions(user: dict) -> list[str]:
    """The caller's capability list, for the client to shape its own UI with."""
    return sorted(permissions_for(user.get("role")))
