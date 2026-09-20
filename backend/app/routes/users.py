from fastapi import APIRouter, Depends

from app.core.deps import CurrentUser, Database, require_roles
from app.db.mongodb import Collections as C
from app.models.common import Role, serialize

router = APIRouter(prefix="/users", tags=["users"])


@router.get("")
async def list_users(db: Database, user: CurrentUser, role: str | None = None):
    query = {"active": True}
    if role:
        query["role"] = role
    projection = {"password_hash": 0}
    cursor = db[C.users].find(query, projection).sort("name", 1)
    return [serialize(doc) async for doc in cursor]


@router.get("/team")
async def team_directory(db: Database, user: CurrentUser):
    """People grouped by role, for assignment pickers."""
    cursor = db[C.users].find({"active": True}, {"password_hash": 0}).sort("name", 1)
    people = [serialize(doc) async for doc in cursor]
    grouped: dict[str, list] = {}
    for person in people:
        grouped.setdefault(person["role"], []).append(person)
    return grouped


@router.patch("/{user_id}/role", dependencies=[Depends(require_roles(Role.admin))])
async def change_role(user_id: str, role: Role, db: Database):
    from app.models.common import to_object_id
    await db[C.users].update_one({"_id": to_object_id(user_id)}, {"$set": {"role": role.value}})
    return {"ok": True}
