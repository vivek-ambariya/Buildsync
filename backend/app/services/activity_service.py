"""Activity feed and notification writes, used by every mutating route."""
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db.mongodb import Collections as C
from app.models.common import serialize, to_object_id, utcnow


async def log_activity(
    db: AsyncIOMotorDatabase,
    *,
    actor: dict,
    action: str,
    entity_type: str,
    entity_id: str | None = None,
    project_id: str | None = None,
    detail: str = "",
) -> None:
    await db[C.activities].insert_one({
        "actor_id": to_object_id(actor.get("id")),
        "actor_name": actor.get("name"),
        "actor_role": actor.get("role"),
        "action": action,
        "entity_type": entity_type,
        "entity_id": to_object_id(entity_id),
        "project_id": to_object_id(project_id),
        "detail": detail,
        "created_at": utcnow(),
    })


async def notify(
    db: AsyncIOMotorDatabase,
    *,
    user_ids: list[str],
    title: str,
    body: str,
    tone: str = "info",
    link: str | None = None,
    project_id: str | None = None,
) -> None:
    if not user_ids:
        return
    now = utcnow()
    await db[C.notifications].insert_many([
        {
            "user_id": to_object_id(uid),
            "title": title,
            "body": body,
            "tone": tone,
            "link": link,
            "project_id": to_object_id(project_id),
            "read": False,
            "created_at": now,
        }
        for uid in user_ids if to_object_id(uid)
    ])


async def recent_activity(db: AsyncIOMotorDatabase, limit: int = 12, project_id: str | None = None) -> list[dict]:
    query: dict = {}
    if project_id and (oid := to_object_id(project_id)):
        query["project_id"] = oid
    cursor = db[C.activities].find(query).sort("created_at", -1).limit(limit)
    return [serialize(doc) async for doc in cursor]


async def broadcast_ids(db: AsyncIOMotorDatabase, roles: list[str] | None = None) -> list[str]:
    query = {"active": True}
    if roles:
        query["role"] = {"$in": roles}
    return [str(u["_id"]) async for u in db[C.users].find(query, {"_id": 1})]
