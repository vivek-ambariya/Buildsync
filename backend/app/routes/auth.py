from fastapi import APIRouter, HTTPException, status
from pymongo.errors import DuplicateKeyError

from app.core.deps import CurrentUser, Database, user_permissions
from app.core.security import create_access_token, hash_password, verify_password
from app.core.workspaces import (
    authorized_roles,
    home_for,
    label_for,
    public_workspaces,
    slug_for_role,
)
from app.db.mongodb import Collections as C
from app.models.common import serialize, utcnow
from app.schemas.auth import (
    SELF_SIGNUP_ROLES,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserOut,
)
from app.services.activity_service import log_activity
from app.utils.formatting import initials

router = APIRouter(prefix="/auth", tags=["auth"])


def _public(user: dict, workspace: str | None = None) -> dict:
    """What the client is told about the signed-in person.

    The permission list and the authorised workspaces are sent so the
    interface can hide what it should not offer. They are a convenience for
    the UI, never the check itself: every request is authorised again on the
    server from the roles stored on the account.
    """
    active = workspace or user.get("role")
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": active,
        "title": user.get("title"),
        "avatar_initials": user.get("avatar_initials"),
        "phone": user.get("phone"),
        "permissions": user_permissions({**user, "role": active}),
        "authorized_roles": authorized_roles(user),
        "workspace": slug_for_role(active),
        "home": home_for(active),
    }


def _issue(user: dict, workspace: str) -> dict:
    token, expires_in = create_access_token(user["id"], workspace)
    return {
        "access_token": token,
        "expires_in": expires_in,
        "user": _public(user, workspace),
    }


@router.get("/workspaces")
async def workspaces():
    """The workspace chooser's contents.

    Public by design: it lists the four ways into the product and says what
    each is for. It names no account and confers nothing — what a given person
    may actually open is decided at sign-in.
    """
    return {"workspaces": public_workspaces()}


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: Database):
    """Sign in.

    There is one workspace per account, so signing in is only a question of
    identity: the role on the record decides where the session lands, and the
    caller has no say in it. An account with no valid role is refused rather
    than dropped somewhere plausible.
    """
    doc = await db[C.users].find_one({"email": payload.email.lower()})
    if not doc or not verify_password(payload.password, doc.get("password_hash", "")):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password.")
    if not doc.get("active", True):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been deactivated.")

    user = serialize(doc)
    allowed = authorized_roles(doc)
    if not allowed:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "This account has no workspace assigned. Ask an administrator.",
        )

    # Nothing to choose: the account's role is the workspace it opens.
    return _issue(user, allowed[0])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: Database):
    """Create an account and open a session in it.

    The workspace asked for here is the one the account gets, within the
    limits of `SELF_SIGNUP_ROLES` — Admin is not among them, so no amount of
    posting to this route produces an administrator.

    The duplicate check is written twice on purpose. The lookup is there to
    answer with a sentence a person can act on; the `DuplicateKeyError` catch
    is there because two registrations for the same address can pass that
    lookup at the same moment, and the unique index on `email` is the thing
    that actually decides it.
    """
    if payload.role not in SELF_SIGNUP_ROLES:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            f"The {label_for(payload.role.value)} workspace cannot be created from the "
            "sign-up form. Ask an administrator to grant it.",
        )

    email = payload.email.lower()
    if await db[C.users].find_one({"email": email}):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{email} already has a BuildSync account. Sign in instead.",
        )

    workspace = payload.role.value
    doc = {
        "name": payload.name,
        "email": email,
        "role": workspace,
        "roles": [workspace],
        "title": None,
        "phone": None,
        "active": True,
        "avatar_initials": initials(payload.name),
        "password_hash": hash_password(payload.password),
        "created_at": utcnow(),
        # Nobody created this account but its owner, so there is no creator to
        # record. The flag is what lets an admin tell the two apart later.
        "created_by": None,
        "self_registered": True,
        "last_active_at": None,
    }

    try:
        result = await db[C.users].insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{email} already has a BuildSync account. Sign in instead.",
        ) from None

    user = serialize({**doc, "_id": result.inserted_id})
    await log_activity(
        db, actor=user, action="created account", entity_type="user",
        entity_id=user["id"], detail=f"signed up for the {label_for(workspace)} workspace",
    )
    return _issue(user, workspace)


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser):
    return _public(user)


@router.get("/demo-accounts")
async def demo_accounts(db: Database):
    """Local development convenience: the seeded accounts and their workspaces."""
    cursor = db[C.users].find({"demo": True}, {"name": 1, "email": 1, "role": 1,
                                              "roles": 1, "title": 1})
    accounts = []
    async for doc in cursor:
        account = serialize(doc)
        account["authorized_roles"] = authorized_roles(doc)
        accounts.append(account)
    return {"accounts": accounts, "password": "buildsync"}
