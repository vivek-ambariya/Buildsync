"""Index definitions, applied on startup. Idempotent."""
import logging

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db.mongodb import Collections as C

log = logging.getLogger(__name__)

INDEXES: dict[str, list[tuple]] = {
    C.users: [([("email", 1)], {"unique": True})],
    C.projects: [([("code", 1)], {"unique": True}), ([("status", 1)], {}), ([("manager_id", 1)], {})],
    C.tasks: [([("project_id", 1), ("status", 1)], {}), ([("assignee_id", 1)], {}), ([("deadline", 1)], {})],
    C.milestones: [([("project_id", 1), ("order", 1)], {})],
    C.materials: [([("project_id", 1)], {}), ([("name", "text"), ("supplier", "text")], {})],
    C.expenses: [([("project_id", 1), ("date", -1)], {}), ([("category", 1)], {})],
    C.documents: [([("project_id", 1), ("uploaded_at", -1)], {}), ([("doc_type", 1)], {})],
    C.site_updates: [([("project_id", 1), ("date", -1)], {})],
    C.notifications: [([("user_id", 1), ("created_at", -1)], {}), ([("read", 1)], {})],
    C.reports: [([("created_at", -1)], {})],
    C.ai_insights: [([("project_id", 1), ("severity", 1)], {}), ([("generated_at", -1)], {})],
    C.activities: [([("created_at", -1)], {}), ([("project_id", 1)], {})],
    C.conversations: [([("user_id", 1), ("updated_at", -1)], {})],
}


async def ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    for collection, specs in INDEXES.items():
        for keys, options in specs:
            try:
                await db[collection].create_index(keys, **options)
            except Exception as exc:  # index conflicts should never block boot
                log.warning("Could not create index on %s %s: %s", collection, keys, exc)
