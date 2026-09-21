"""Project reads enriched with people and computed health."""
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.ai.engine import project_budget_metrics, project_schedule_metrics
from app.core.permissions import P, has_permission
from app.db.mongodb import Collections as C
from app.models.common import serialize, to_object_id, utcnow


async def _people_map(db: AsyncIOMotorDatabase) -> dict[str, dict]:
    return {
        str(u["_id"]): {"id": str(u["_id"]), "name": u["name"], "role": u["role"],
                        "title": u.get("title"), "avatar_initials": u.get("avatar_initials")}
        async for u in db[C.users].find({}, {"name": 1, "role": 1, "title": 1, "avatar_initials": 1})
    }


def visibility_filter(user: dict) -> dict:
    """Narrow a project query to the projects `user` is entitled to.

    Only a role holding `projects.view_all` gets the whole portfolio, and only
    the admin holds it. Everyone else — a project manager included — sees the
    projects they run or are on the team of. A manager who has not been given
    a site has no business reading its budget, its drawings or its daily
    reports, and the role matrix has always said as much; this is the query
    that finally means it.

    Reading the permission rather than naming roles keeps this in step with
    `app.core.permissions`, so granting the capability to another role is a
    change in that file alone.
    """
    if has_permission(user.get("role"), P.projects_view_all):
        return {}
    oid = to_object_id(user.get("id"))
    return {"$or": [{"team_ids": oid}, {"manager_id": oid}]}


def scoped_project_query(visible_ids, project_id=None) -> dict:
    """A `project_id` clause that narrows *within* what the caller may see.

    Every list endpoint takes an optional `project_id` to focus on one site.
    Assigning it straight onto the query replaced the visibility constraint
    instead of intersecting with it, so naming another site's id was enough to
    read its tasks, expenses, documents and daily reports whatever the caller's
    own projects were.

    An id outside `visible_ids` therefore matches nothing, which is what a
    project you cannot see contains as far as you are concerned. An unparseable
    id is ignored, as it always was.
    """
    ids = list(visible_ids)
    oid = to_object_id(project_id) if project_id else None
    if oid is None:
        return {"project_id": {"$in": ids}}
    return {"project_id": {"$in": [oid] if oid in ids else []}}


async def visible_project_ids(db: AsyncIOMotorDatabase, user: dict) -> list[ObjectId]:
    """The `_id` of every project this person may touch. Empty means none."""
    return [p["_id"] async for p in db[C.projects].find(visibility_filter(user), {"_id": 1})]


async def can_reach_project(db: AsyncIOMotorDatabase, user: dict, project_id) -> bool:
    """Whether a record hanging off `project_id` is this person's business.

    Records reached by their own id — a document, a report — have to be checked
    against the project they belong to. Without this an id from another site is
    enough to read it, whatever the person's role allows in their own projects.
    """
    oid = project_id if isinstance(project_id, ObjectId) else to_object_id(project_id)
    if not oid:
        return False
    return await db[C.projects].count_documents(
        {"_id": oid, **visibility_filter(user)}, limit=1
    ) > 0


async def ensure_project_member(
    db: AsyncIOMotorDatabase, project_id, user_id, *, role: str | None = None
) -> bool:
    """Put `user_id` on `project_id`'s team, if that is what lets them see it.

    Assignment and membership are two separate facts, and only membership
    passes `visibility_filter`. Giving someone work on a site they are not
    attached to would otherwise create a task they can never open — and a
    notification pointing at a project that answers 404. So an assignment
    grants the membership it already implies.

    Only roles that see every project regardless — the admin — are skipped;
    adding them would fill the site team with people who are not on it. The
    project's own manager is skipped for the same reason. A project manager is
    not skipped: since they are scoped to their own sites like everyone else,
    being given work on one is exactly what has to put them on its team.

    Returns whether the team actually changed.
    """
    oid = project_id if isinstance(project_id, ObjectId) else to_object_id(project_id)
    uid = user_id if isinstance(user_id, ObjectId) else to_object_id(user_id)
    if not oid or not uid:
        return False

    if role is None:
        person = await db[C.users].find_one({"_id": uid}, {"role": 1})
        role = person.get("role") if person else None
    if has_permission(role, P.projects_view_all):
        return False

    result = await db[C.projects].update_one(
        {"_id": oid, "manager_id": {"$ne": uid}},
        {"$addToSet": {"team_ids": uid}},
    )
    return result.modified_count > 0


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
