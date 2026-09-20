from fastapi import APIRouter, HTTPException, status

from app.core.deps import CurrentUser, Database, user_permissions
from app.core.security import create_access_token, verify_password
from app.db.mongodb import Collections as C
from app.models.common import serialize
from app.schemas.auth import LoginRequest, TokenResponse, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


def _public(user: dict) -> dict:
    """What the client is told about the signed-in person.

    The permission list is sent so the interface can hide what it should not
    offer. It is a convenience for the UI, never the check itself: every
    request is authorised again on the server from the stored role.
    """
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "title": user.get("title"),
        "avatar_initials": user.get("avatar_initials"),
        "phone": user.get("phone"),
        "permissions": user_permissions(user),
    }


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: Database):
    doc = await db[C.users].find_one({"email": payload.email.lower()})
    if not doc or not verify_password(payload.password, doc.get("password_hash", "")):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "That email and password do not match.")
    if not doc.get("active", True):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been deactivated.")

    user = serialize(doc)
    token, expires_in = create_access_token(user["id"], user["role"])
    return {"access_token": token, "expires_in": expires_in, "user": _public(user)}


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser):
    return _public(user)


@router.get("/demo-accounts")
async def demo_accounts(db: Database):
    """Local development convenience: the seeded accounts and their roles."""
    cursor = db[C.users].find({"demo": True}, {"name": 1, "email": 1, "role": 1, "title": 1})
    accounts = [serialize(doc) async for doc in cursor]
    return {"accounts": accounts, "password": "buildsync"}
