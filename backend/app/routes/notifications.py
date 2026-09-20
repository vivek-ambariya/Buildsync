from fastapi import APIRouter

from app.core.deps import CurrentUser, Database
from app.db.mongodb import Collections as C
from app.models.common import serialize, to_object_id
from app.schemas.misc import NotificationRead

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(db: Database, user: CurrentUser, limit: int = 30):
    oid = to_object_id(user["id"])
    cursor = db[C.notifications].find({"user_id": oid}).sort("created_at", -1).limit(limit)
    items = [serialize(doc) async for doc in cursor]
    unread = await db[C.notifications].count_documents({"user_id": oid, "read": False})
    return {"items": items, "unread": unread}


@router.post("/read")
async def mark_read(payload: NotificationRead, db: Database, user: CurrentUser):
    oid = to_object_id(user["id"])
    query: dict = {"user_id": oid}
    if not payload.all:
        ids = [to_object_id(i) for i in payload.ids]
        query["_id"] = {"$in": [i for i in ids if i]}
    result = await db[C.notifications].update_many(query, {"$set": {"read": True}})
    return {"updated": result.modified_count}
