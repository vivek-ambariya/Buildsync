"""Runs the intelligence engine over the portfolio and caches the findings."""
from collections import defaultdict

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.ai.engine import analyse_project, rank_key
from app.db.mongodb import Collections as C
from app.models.common import serialize, to_object_id, utcnow
from app.services.project_service import list_projects


async def generate_insights(db: AsyncIOMotorDatabase, user: dict, project_id: str | None = None) -> list[dict]:
    projects = await list_projects(db, user)
    if project_id:
        projects = [p for p in projects if p["id"] == project_id]
    if not projects:
        return []

    ids = [to_object_id(p["id"]) for p in projects]
    tasks = defaultdict(list)
    materials = defaultdict(list)
    expenses = defaultdict(list)
    updates = defaultdict(list)

    async for doc in db[C.tasks].find({"project_id": {"$in": ids}}):
        tasks[str(doc["project_id"])].append(serialize(doc))
    async for doc in db[C.materials].find({"project_id": {"$in": ids}}):
        materials[str(doc["project_id"])].append(serialize(doc))
    async for doc in db[C.expenses].find({"project_id": {"$in": ids}}):
        expenses[str(doc["project_id"])].append(serialize(doc))
    async for doc in db[C.site_updates].find({"project_id": {"$in": ids}}).sort("date", 1):
        updates[str(doc["project_id"])].append(serialize(doc))

    findings: list[dict] = []
    for project in projects:
        pid = project["id"]
        findings.extend(
            analyse_project(project, tasks[pid], materials[pid], expenses[pid], updates[pid])
        )

    # analyse_project only orders findings within one project, so the combined
    # list has to be ranked across the portfolio before it is returned. Without
    # this the cached path and the freshly generated path come back in a
    # different order, and the dashboard shows whichever it got.
    findings.sort(key=rank_key)

    # Replace the cache for the projects we just analysed so stale findings
    # never linger after a risk has been resolved.
    await db[C.ai_insights].delete_many({"project_id": {"$in": [p["id"] for p in projects]}})
    if findings:
        await db[C.ai_insights].insert_many([dict(f) for f in findings])

    return [serialize(f) for f in findings]


async def read_insights(db: AsyncIOMotorDatabase, user: dict, project_id: str | None = None) -> list[dict]:
    """Cached findings, regenerated when the cache is empty or stale."""
    query: dict = {}
    if project_id:
        query["project_id"] = project_id

    cached = [serialize(doc) async for doc in db[C.ai_insights].find(query)]
    if cached:
        cached.sort(key=rank_key)
        return cached
    return await generate_insights(db, user, project_id)


async def acknowledge(db: AsyncIOMotorDatabase, insight_id: str) -> bool:
    oid = to_object_id(insight_id)
    if not oid:
        return False
    result = await db[C.ai_insights].update_one(
        {"_id": oid}, {"$set": {"acknowledged": True, "acknowledged_at": utcnow()}}
    )
    return result.modified_count > 0
