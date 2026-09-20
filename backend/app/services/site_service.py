"""Shared reads for the site operations surface.

The site manager works from one place at a time, so these helpers resolve a
*scope* once — the projects they are attached to, the people on those sites,
and today's window — and every endpoint reads from it rather than re-deriving
the same joins.

Two rules are enforced here rather than in each route:

  * **Money never leaves.** `strip_financials` removes budget, spend and unit
    cost from anything sent to this surface. A site manager reports what was
    built and consumed; what it cost is not their screen.
  * **The site team, not the portfolio.** `site_team_ids` narrows task reads to
    the person and the crew alongside them, so "My tasks" never fills with the
    commercial team's work.
"""
from datetime import datetime, time, timedelta, timezone

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db.mongodb import Collections as C
from app.models.common import Role, serialize, to_object_id, utcnow
from app.services.project_service import visibility_filter

# Figures that describe what a project costs, in every spelling they appear in
# across projects, materials and documents.
_FINANCIAL_FIELDS = (
    "budget", "spent", "total_budget", "total_spent", "contract_value",
    "unit_cost", "total_cost", "cost", "value", "amount", "committed",
)

# Document types a site manager has no business reading from the site app.
FIELD_DOCUMENT_TYPES = ("drawing", "boq", "site_report", "other")


def strip_financials(doc: dict) -> dict:
    """Return `doc` without any figure describing money."""
    return {k: v for k, v in doc.items() if k not in _FINANCIAL_FIELDS}


def day_bounds(when: datetime | None = None) -> tuple[datetime, datetime]:
    """The UTC start and end of the day `when` falls in."""
    now = when or utcnow()
    start = datetime.combine(now.date(), time.min, tzinfo=timezone.utc)
    return start, start + timedelta(days=1)


async def visible_projects(db: AsyncIOMotorDatabase, user: dict) -> list[dict]:
    """Every project this person is attached to, with money removed."""
    cursor = db[C.projects].find(
        visibility_filter(user),
        {"name": 1, "code": 1, "status": 1, "location": 1, "actual_progress": 1,
         "planned_progress": 1, "start_date": 1, "end_date": 1, "team_ids": 1,
         "manager_id": 1, "client": 1},
    ).sort("name", 1)
    return [strip_financials(serialize(doc)) async for doc in cursor]


async def resolve_scope(db: AsyncIOMotorDatabase, user: dict, project_id: str | None = None) -> dict:
    """The site manager's working context: their projects and the current one.

    With no project named, the current one is the first site that is still
    being built — a finished project should not be what opens on a phone at
    seven in the morning.
    """
    projects = await visible_projects(db, user)
    by_id = {p["id"]: p for p in projects}

    current = by_id.get(project_id or "")
    if current is None:
        live = [p for p in projects if p.get("status") not in ("completed", "on_hold")]
        current = (live or projects or [None])[0]

    return {
        "projects": projects,
        "project": current,
        "project_ids": [to_object_id(p["id"]) for p in projects],
        "current_oid": to_object_id(current["id"]) if current else None,
    }


async def site_team_ids(db: AsyncIOMotorDatabase, user: dict, project: dict | None) -> list:
    """The person plus the crew working alongside them on `project`.

    Managers and commercial staff on the same project are deliberately left
    out: their tasks are not site tasks.
    """
    me = to_object_id(user["id"])
    ids = [me] if me else []
    if not project:
        return ids

    team = [tid for tid in (project.get("team_ids") or []) if to_object_id(tid)]
    if not team:
        return ids

    cursor = db[C.users].find(
        {"_id": {"$in": [to_object_id(t) for t in team]},
         "role": {"$in": [Role.site_engineer.value, Role.contractor.value]}},
        {"_id": 1},
    )
    async for doc in cursor:
        if doc["_id"] not in ids:
            ids.append(doc["_id"])
    return ids


async def people_map(db: AsyncIOMotorDatabase) -> dict[str, dict]:
    return {
        str(u["_id"]): {"id": str(u["_id"]), "name": u["name"], "role": u["role"],
                        "avatar_initials": u.get("avatar_initials")}
        async for u in db[C.users].find({}, {"name": 1, "role": 1, "avatar_initials": 1})
    }


def photo_out(doc: dict, api_prefix: str = "/api") -> dict:
    """A stored photo as the gallery reads it — never the path on disk."""
    photo = serialize(doc)
    photo["url"] = f"{api_prefix}/site/photos/{photo['id']}/file"
    photo.pop("stored_name", None)
    return photo


async def project_manager_ids(db: AsyncIOMotorDatabase, project: dict | None) -> list[str]:
    """Who to tell. The project's own manager first, then the admins.

    Escalation is never broadcast to every manager in the business: an issue
    on one site is the responsibility of the person running that site.
    """
    recipients: list[str] = []
    if project and project.get("manager_id"):
        recipients.append(str(project["manager_id"]))
    async for doc in db[C.users].find({"role": Role.admin.value, "active": True}, {"_id": 1}):
        if str(doc["_id"]) not in recipients:
            recipients.append(str(doc["_id"]))
    return recipients
