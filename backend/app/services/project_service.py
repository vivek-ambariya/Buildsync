"""Project reads enriched with people and computed health."""
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.ai.engine import project_budget_metrics, project_schedule_metrics
from app.db.mongodb import Collections as C
from app.models.common import Role, serialize, to_object_id, utcnow


async def _people_map(db: AsyncIOMotorDatabase) -> dict[str, dict]:
    return {
        str(u["_id"]): {"id": str(u["_id"]), "name": u["name"], "role": u["role"],
                        "title": u.get("title"), "avatar_initials": u.get("avatar_initials")}
        async for u in db[C.users].find({}, {"name": 1, "role": 1, "title": 1, "avatar_initials": 1})
    }


def visibility_filter(user: dict) -> dict:
    """Contractors and site engineers only see projects they are attached to."""
    if user.get("role") in (Role.admin.value, Role.project_manager.value):
        return {}
    oid = to_object_id(user.get("id"))
    return {"$or": [{"team_ids": oid}, {"manager_id": oid}]}


async def list_projects(db: AsyncIOMotorDatabase, user: dict, query: dict | None = None) -> list[dict]:
    mongo_query = {**visibility_filter(user), **(query or {})}
    people = await _people_map(db)
    projects = [serialize(p) async for p in db[C.projects].find(mongo_query).sort("name", 1)]
    for project in projects:
        _attach_people(project, people)
    return projects


def _attach_people(project: dict, people: dict[str, dict]) -> None:
    manager = people.get(str(project.get("manager_id")))
    project["manager"] = manager
    project["manager_name"] = manager["name"] if manager else "Unassigned"
    project["team"] = [people[tid] for tid in map(str, project.get("team_ids") or []) if tid in people]


async def get_project(db: AsyncIOMotorDatabase, project_id: str, user: dict) -> dict | None:
    oid = to_object_id(project_id)
    if not oid:
        return None
    doc = await db[C.projects].find_one({"_id": oid, **visibility_filter(user)})
    if not doc:
        return None
    project = serialize(doc)
    _attach_people(project, await _people_map(db))
    return project


async def project_metrics(db: AsyncIOMotorDatabase, project: dict) -> dict:
    """Schedule + budget health for one project."""
    oid = to_object_id(project["id"])
    expenses = [serialize(e) async for e in db[C.expenses].find({"project_id": oid})]
    site_updates = [serialize(s) async for s in db[C.site_updates].find({"project_id": oid}).sort("date", 1)]
    return {
        "schedule": project_schedule_metrics(project, site_updates),
        "budget": project_budget_metrics(project, expenses),
    }


async def recalculate_progress(db: AsyncIOMotorDatabase, project_id: str) -> float:
    """Derive project completion from its tasks, weighted by phase.

    A flat mean over tasks would say a project is half built because half its
    tasks are closed, but "Site clearance" and "Slab concreting" are not the
    same amount of building. Each milestone carries a weight (its share of the
    build), and a phase contributes that share of the total.

    Falls back to a flat mean when a project has no milestones defined.
    """
    oid = to_object_id(project_id)
    if not oid:
        return 0.0

    tasks = [t async for t in db[C.tasks].find({"project_id": oid}, {"progress": 1, "phase": 1})]
    if not tasks:
        return 0.0

    milestones = [
        m async for m in db[C.milestones].find({"project_id": oid}, {"name": 1, "weight": 1})
    ]
    weights = {m["name"]: float(m.get("weight") or 0) for m in milestones}

    by_phase: dict[str, list[float]] = {}
    for task in tasks:
        by_phase.setdefault(task.get("phase") or "General", []).append(float(task.get("progress") or 0))

    covered = sum(weights.get(phase, 0) for phase in by_phase)
    if covered > 0:
        progress = sum(
            weights.get(phase, 0) * (sum(values) / len(values))
            for phase, values in by_phase.items()
        ) / covered
    else:
        progress = sum(float(t.get("progress") or 0) for t in tasks) / len(tasks)

    progress = round(progress, 1)
    await db[C.projects].update_one(
        {"_id": oid}, {"$set": {"actual_progress": progress, "updated_at": utcnow()}}
    )

    # The cached findings quote this number, so they are no longer valid.
    await db[C.ai_insights].delete_many({"project_id": project_id})
    return progress
