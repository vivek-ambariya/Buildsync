"""People: the directory every role reads, and the administration only admins may do.

Three rules are enforced here rather than left to the interface, because the
interface is not what protects them:

  * the platform can never be left without a way in — the last active admin
    cannot be deleted, deactivated or demoted;
  * nobody may delete, deactivate or demote themselves, which is the same
    lockout by a shorter route;
  * a password is only ever written as a bcrypt hash, and is never read back.

Role changes take effect immediately, because `get_current_user` reads the
role from the stored record on every request rather than from the token.
"""
import secrets

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.deps import CurrentUser, Database, require_admin, require_permission
from app.core.permissions import P
from app.core.security import hash_password
from app.core.workspaces import authorized_roles
from app.db.mongodb import Collections as C
from app.models.common import Role, serialize, to_object_id, utcnow
from app.schemas.user import (
    PasswordReset,
    ProjectAssignment,
    RoleChange,
    StatusChange,
    UserCreate,
    UserUpdate,
)
from app.services.activity_service import log_activity, notify
from app.services.admin_service import count_admins, public_user, user_detail, user_rows
from app.utils.formatting import initials as _initials

router = APIRouter(prefix="/users", tags=["users"])

admin_only = Depends(require_admin)

# Fields safe to hand to any signed-in person for assignment pickers.
DIRECTORY_FIELDS = {
    "name": 1, "email": 1, "role": 1, "roles": 1, "title": 1,
    "avatar_initials": 1, "phone": 1, "active": 1,
}


async def _require_user(db, user_id: str) -> dict:
    oid = to_object_id(user_id)
    doc = await db[C.users].find_one({"_id": oid}) if oid else None
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That person does not have an account here.")
    return doc


async def _guard_last_admin(db, target: dict, *, action: str) -> None:
    """Refuse a change that would remove the platform's only way in."""
    if Role.admin.value not in authorized_roles(target) or not target.get("active", True):
        return
    if await count_admins(db, exclude=str(target["_id"])) == 0:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"This is the only active administrator, so it cannot be {action}. "
            "Promote another person to administrator first.",
        )


def _guard_not_self(actor: dict, target: dict, *, action: str) -> None:
    if str(target["_id"]) == str(actor.get("id")):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"You cannot {action} your own account. Ask another administrator.",
        )


async def _assign_projects(db, user_oid, project_ids: list[str]) -> int:
    """Make the person's project membership exactly `project_ids`."""
    wanted = {oid for oid in map(to_object_id, project_ids) if oid}
    # Drop them from everything they are no longer on...
    await db[C.projects].update_many(
        {"team_ids": user_oid, "_id": {"$nin": list(wanted)}},
        {"$pull": {"team_ids": user_oid}},
    )
    # ...and add them where they now belong. $addToSet keeps this idempotent.
    if wanted:
        await db[C.projects].update_many(
            {"_id": {"$in": list(wanted)}}, {"$addToSet": {"team_ids": user_oid}}
        )
    return len(wanted)


# --------------------------------------------------------------------------
# Directory — any signed-in person
# --------------------------------------------------------------------------

@router.get("")
async def list_users(
    db: Database,
    user: CurrentUser,
    role: str | None = None,
    include_inactive: bool = False,
):
    """The assignment directory. Only an admin may look at deactivated accounts."""
    from app.core.permissions import is_admin

    query: dict = {}
    if role:
        query["role"] = role
    if include_inactive and is_admin(user):
        pass
    else:
        query["active"] = True

    cursor = db[C.users].find(query, DIRECTORY_FIELDS).sort("name", 1)
    return [serialize(doc) async for doc in cursor]


@router.get("/team")
async def team_directory(db: Database, user: CurrentUser):
    """People grouped by role, for assignment pickers."""
    cursor = db[C.users].find({"active": True}, DIRECTORY_FIELDS).sort("name", 1)
    grouped: dict[str, list] = {}
    async for doc in cursor:
        person = serialize(doc)
        grouped.setdefault(person["role"], []).append(person)
    return grouped


# --------------------------------------------------------------------------
# Administration — admin only
# --------------------------------------------------------------------------

@router.get("/admin", dependencies=[admin_only])
async def admin_index(
    db: Database,
    user: CurrentUser,
    role: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    q: str | None = None,
):
    """The admin user table: every account, with its project load."""
    active = None
    if status_filter == "active":
        active = True
    elif status_filter == "inactive":
        active = False

    rows = await user_rows(db, role=role, active=active, q=q)
    counts: dict[str, int] = {}
    for row in rows:
        counts[row["role"]] = counts.get(row["role"], 0) + 1
    return {
        "users": rows,
        "counts": {
            "total": len(rows),
            "active": sum(1 for r in rows if r["active"]),
            "inactive": sum(1 for r in rows if not r["active"]),
            "by_role": counts,
        },
    }


@router.get("/{user_id}", dependencies=[admin_only])
async def detail(user_id: str, db: Database, user: CurrentUser):
    found = await user_detail(db, user_id)
    if not found:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That person does not have an account here.")
    return found


@router.post("", status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_permission(P.users_create))])
async def create(payload: UserCreate, db: Database, user: CurrentUser):
    email = payload.email.lower()
    if await db[C.users].find_one({"email": email}):
        raise HTTPException(status.HTTP_409_CONFLICT, f"{email} already has an account.")

    # When no password is supplied the account still gets a real one; it is
    # returned to the admin exactly once and only the hash is stored.
    issued = payload.password or secrets.token_urlsafe(9)
    # The primary workspace is always among the authorised ones, whatever the
    # caller sent, so an account can never be created that cannot sign in.
    roles = [r.value for r in (payload.roles or [])] or [payload.role.value]
    if payload.role.value not in roles:
        roles.insert(0, payload.role.value)

    doc = {
        "name": payload.name,
        "email": email,
        "role": payload.role.value,
        "roles": roles,
        "title": payload.title,
        "phone": payload.phone,
        "active": payload.active,
        "avatar_initials": _initials(payload.name),
        "password_hash": hash_password(issued),
        "created_at": utcnow(),
        "created_by": to_object_id(user["id"]),
        "last_active_at": None,
    }
    result = await db[C.users].insert_one(doc)
    assigned = await _assign_projects(db, result.inserted_id, payload.project_ids)

    await log_activity(
        db, actor=user, action="created user", entity_type="user",
        entity_id=str(result.inserted_id),
        detail=f"{payload.name} as {payload.role.value}",
    )
    await notify(
        db, user_ids=[str(result.inserted_id)],
        title="Welcome to BuildSync",
        body=f"Your account was created with the {payload.role.value.replace('_', ' ')} role.",
        tone="info",
    )

    created = await user_detail(db, str(result.inserted_id))
    return {
        "user": created,
        "assigned_projects": assigned,
        # Present only when the API generated it, so the admin can pass it on.
        "temporary_password": None if payload.password else issued,
    }


@router.patch("/{user_id}", dependencies=[Depends(require_permission(P.users_edit))])
async def update(user_id: str, payload: UserUpdate, db: Database, user: CurrentUser):
    target = await _require_user(db, user_id)
    changes = payload.model_dump(exclude_unset=True)
    project_ids = changes.pop("project_ids", None)

    if "email" in changes and changes["email"]:
        email = changes["email"].lower()
        clash = await db[C.users].find_one({"email": email, "_id": {"$ne": target["_id"]}})
        if clash:
            raise HTTPException(status.HTTP_409_CONFLICT, f"{email} already has an account.")
        changes["email"] = email

    if "roles" in changes and changes["roles"] is not None:
        changes["roles"] = [r.value if hasattr(r, "value") else r for r in changes["roles"]]

    if "role" in changes and changes["role"] is not None:
        role = changes["role"]
        changes["role"] = role.value if hasattr(role, "value") else role
        if changes["role"] != Role.admin.value:
            _guard_not_self(user, target, action="change the role of")
            await _guard_last_admin(db, target, action="demoted")

    # Whichever of the two arrived, they have to end up agreeing: the primary
    # workspace must be one the account is authorised for.
    if changes.get("role") or changes.get("roles"):
        primary = changes.get("role") or target.get("role")
        roles = changes.get("roles") or authorized_roles(target)
        if primary not in roles:
            roles = [primary, *roles]
        changes["roles"] = roles
        changes["role"] = primary
        if Role.admin.value not in roles and Role.admin.value in authorized_roles(target):
            _guard_not_self(user, target, action="remove admin access from")
            await _guard_last_admin(db, target, action="demoted")

    if changes.get("active") is False:
        _guard_not_self(user, target, action="deactivate")
        await _guard_last_admin(db, target, action="deactivated")

    if "name" in changes and changes["name"]:
        changes["avatar_initials"] = _initials(changes["name"])

    changes = {k: v for k, v in changes.items() if k != "password"}
    if changes:
        changes["updated_at"] = utcnow()
        await db[C.users].update_one({"_id": target["_id"]}, {"$set": changes})

    if project_ids is not None:
        await _assign_projects(db, target["_id"], project_ids)

    described = ", ".join(k for k in changes if k not in ("updated_at", "avatar_initials"))
    await log_activity(
        db, actor=user, action="updated user", entity_type="user", entity_id=user_id,
        detail=f"{target.get('name')}: {described or 'project assignments'}",
    )
    return await user_detail(db, user_id)


@router.patch("/{user_id}/role", dependencies=[Depends(require_permission(P.roles_manage))])
async def change_role(user_id: str, payload: RoleChange, db: Database, user: CurrentUser):
    target = await _require_user(db, user_id)
    previous = target.get("role")
    if previous == payload.role.value:
        return await user_detail(db, user_id)

    if payload.role != Role.admin:
        _guard_not_self(user, target, action="change the role of")
        await _guard_last_admin(db, target, action="demoted")

    roles = [r.value for r in (payload.roles or [])] or [payload.role.value]
    if payload.role.value not in roles:
        roles.insert(0, payload.role.value)
    if Role.admin.value not in roles and Role.admin.value in authorized_roles(target):
        _guard_not_self(user, target, action="remove admin access from")
        await _guard_last_admin(db, target, action="demoted")

    await db[C.users].update_one(
        {"_id": target["_id"]},
        {"$set": {"role": payload.role.value, "roles": roles, "updated_at": utcnow()}},
    )
    await log_activity(
        db, actor=user, action="changed user role", entity_type="user", entity_id=user_id,
        detail=f"{target.get('name')}: {previous} → {payload.role.value}"
               + (f" ({payload.reason})" if payload.reason else ""),
    )
    await notify(
        db, user_ids=[user_id], title="Your role changed",
        body=f"You are now a {payload.role.value.replace('_', ' ')}. "
             "What you can reach has changed accordingly.",
        tone="info",
    )
    return await user_detail(db, user_id)


@router.patch("/{user_id}/status", dependencies=[Depends(require_permission(P.users_edit))])
async def change_status(user_id: str, payload: StatusChange, db: Database, user: CurrentUser):
    target = await _require_user(db, user_id)
    if not payload.active:
        _guard_not_self(user, target, action="deactivate")
        await _guard_last_admin(db, target, action="deactivated")

    await db[C.users].update_one(
        {"_id": target["_id"]}, {"$set": {"active": payload.active, "updated_at": utcnow()}}
    )
    await log_activity(
        db, actor=user,
        action="activated user" if payload.active else "deactivated user",
        entity_type="user", entity_id=user_id,
        detail=f"{target.get('name')}" + (f" ({payload.reason})" if payload.reason else ""),
    )
    return await user_detail(db, user_id)


@router.post("/{user_id}/password", dependencies=[Depends(require_permission(P.users_edit))])
async def reset_password(user_id: str, payload: PasswordReset, db: Database, user: CurrentUser):
    """Issue a new password. The plaintext is returned once and never stored."""
    target = await _require_user(db, user_id)
    issued = payload.password or secrets.token_urlsafe(9)
    await db[C.users].update_one(
        {"_id": target["_id"]},
        {"$set": {"password_hash": hash_password(issued), "updated_at": utcnow()}},
    )
    # The password itself is deliberately kept out of the activity detail.
    await log_activity(
        db, actor=user, action="reset user password", entity_type="user",
        entity_id=user_id, detail=target.get("name", ""),
    )
    return {"ok": True, "temporary_password": None if payload.password else issued}


@router.put("/{user_id}/projects", dependencies=[Depends(require_permission(P.users_assign))])
async def assign_projects(user_id: str, payload: ProjectAssignment,
                          db: Database, user: CurrentUser):
    target = await _require_user(db, user_id)
    count = await _assign_projects(db, target["_id"], payload.project_ids)
    await log_activity(
        db, actor=user, action="changed project assignments", entity_type="user",
        entity_id=user_id, detail=f"{target.get('name')}: {count} project(s)",
    )
    return await user_detail(db, user_id)


@router.delete("/{user_id}", dependencies=[Depends(require_permission(P.users_delete))])
async def remove(user_id: str, db: Database, user: CurrentUser):
    """Delete an account, but only when nothing depends on it.

    An account that manages a project or owns open work is not deleted, because
    doing so would orphan the records that point at it. Deactivating keeps the
    history readable and takes access away just as completely.
    """
    target = await _require_user(db, user_id)
    _guard_not_self(user, target, action="delete")
    await _guard_last_admin(db, target, action="deleted")

    managing = await db[C.projects].count_documents({"manager_id": target["_id"]})
    if managing:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{target.get('name')} still manages {managing} project(s). "
            "Reassign those projects first, or deactivate the account instead.",
        )
    open_tasks = await db[C.tasks].count_documents(
        {"assignee_id": target["_id"], "status": {"$ne": "completed"}}
    )
    if open_tasks:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{target.get('name')} has {open_tasks} open task(s). "
            "Reassign them first, or deactivate the account instead.",
        )

    await db[C.projects].update_many(
        {"team_ids": target["_id"]}, {"$pull": {"team_ids": target["_id"]}}
    )
    await db[C.notifications].delete_many({"user_id": target["_id"]})
    await db[C.conversations].delete_many({"user_id": target["_id"]})
    await db[C.users].delete_one({"_id": target["_id"]})

    await log_activity(
        db, actor=user, action="deleted user", entity_type="user",
        detail=f"{target.get('name')} ({target.get('role')})",
    )
    return {"ok": True}
