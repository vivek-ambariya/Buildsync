"""Platform-wide aggregates for the admin control centre.

Every read here is deliberately unscoped — an admin sees the whole platform,
so `visibility_filter` contributes nothing and is not applied. That is safe
only because the routes calling into this module sit behind `require_admin`;
nothing in this file checks authorisation for itself.

The portfolio-wide views load each collection once and group in memory rather
than issuing a query per project. With eight projects either would do; the
difference is that this shape does not degrade as the portfolio grows.
"""
from collections import defaultdict
from datetime import timedelta

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.ai import delay_model
from app.ai.engine import project_budget_metrics, project_schedule_metrics
from app.core.config import settings
from app.db.mongodb import Collections as C
from app.core.workspaces import authorized_roles
from app.models.common import Role, serialize, to_object_id, utcnow
from app.services.project_service import _attach_people, _people_map

ROLE_ORDER = [
    Role.admin.value,
    Role.project_manager.value,
    Role.site_engineer.value,
    Role.contractor.value,
]

ACTIVE_PROJECT_STATUSES = ("planning", "active", "at_risk", "delayed")


# --------------------------------------------------------------------------
# Portfolio loading
# --------------------------------------------------------------------------

async def _load_portfolio(db: AsyncIOMotorDatabase) -> dict:
    """Every project with its tasks, materials, expenses and site reports."""
    people = await _people_map(db)
    projects = [serialize(p) async for p in db[C.projects].find().sort("name", 1)]
    for project in projects:
        _attach_people(project, people)

    grouped: dict[str, dict[str, list]] = {
        p["id"]: {"tasks": [], "materials": [], "expenses": [], "updates": []}
        for p in projects
    }

    for key, collection, sort in (
        ("tasks", C.tasks, None),
        ("materials", C.materials, None),
        ("expenses", C.expenses, None),
        ("updates", C.site_updates, ("date", 1)),
    ):
        cursor = db[collection].find({})
        if sort:
            cursor = cursor.sort(*sort)
        async for doc in cursor:
            bucket = grouped.get(str(doc.get("project_id")))
            if bucket is not None:
                bucket[key].append(serialize(doc))

    return {"projects": projects, "related": grouped}


def _metrics_for(project: dict, related: dict) -> dict:
    return {
        "schedule": project_schedule_metrics(project, related["updates"]),
        "budget": project_budget_metrics(project, related["expenses"]),
    }


# --------------------------------------------------------------------------
# Overview (the KPI header)
# --------------------------------------------------------------------------

async def system_overview(db: AsyncIOMotorDatabase) -> dict:
    portfolio = await _load_portfolio(db)
    projects, related = portfolio["projects"], portfolio["related"]

    metrics = {p["id"]: _metrics_for(p, related[p["id"]]) for p in projects}

    at_risk = [
        p for p in projects
        if metrics[p["id"]]["schedule"]["schedule_health"] in ("warning", "critical")
        or metrics[p["id"]]["budget"]["overrun_percent"] >= 7.0
    ]
    active = [p for p in projects if p.get("status") in ACTIVE_PROJECT_STATUSES]

    pending_tasks = await db[C.tasks].count_documents({"status": {"$ne": "completed"}})
    overdue_tasks = await db[C.tasks].count_documents(
        {"status": {"$ne": "completed"}, "deadline": {"$lt": utcnow()}}
    )

    active_users = await db[C.users].count_documents({"active": True})
    total_users = await db[C.users].count_documents({})

    # "Active" here means seen in the last 24 hours, which is what the figure
    # on the dashboard claims.
    seen_recently = await db[C.users].count_documents(
        {"active": True, "last_active_at": {"$gte": utcnow() - timedelta(hours=24)}}
    )

    return {
        "system": await system_status(db),
        "users": {
            "total": total_users,
            "active": active_users,
            "inactive": total_users - active_users,
            "seen_today": seen_recently,
        },
        "projects": {
            "total": len(projects),
            "active": len(active),
            "at_risk": len(at_risk),
            "completed": sum(1 for p in projects if p.get("status") == "completed"),
        },
        "tasks": {"pending": pending_tasks, "overdue": overdue_tasks},
        "budget": _budget_overview(projects, metrics),
    }


async def system_status(db: AsyncIOMotorDatabase) -> dict:
    """What the platform is running with. No secrets, only capability flags."""
    try:
        await db.command("ping")
        database = "connected"
    except Exception:
        database = "unreachable"

    model = delay_model.model_info()
    healthy = database == "connected"
    return {
        "state": "operational" if healthy else "degraded",
        "database": database,
        "environment": settings.environment,
        "app": settings.app_name,
        # Whether a hosted model is configured, never the key itself.
        "assistant_engine": settings.llm_provider or "local",
        "hosted_assistant": bool(settings.llm_provider and settings.llm_api_key),
        "risk_model": model,
    }


def _budget_overview(projects: list[dict], metrics: dict[str, dict]) -> dict:
    planned = sum(float(p.get("budget") or 0) for p in projects)
    spent = sum(metrics[p["id"]]["budget"]["spent"] for p in projects)
    committed = sum(metrics[p["id"]]["budget"]["earned_value"] for p in projects)
    return {
        "planned": round(planned, 2),
        "spent": round(spent, 2),
        "remaining": round(planned - spent, 2),
        # Positive variance means the portfolio has bought more progress than
        # it has paid for.
        "variance": round(committed - spent, 2),
        "variance_percent": round((committed - spent) / spent * 100, 1) if spent else 0.0,
        "burn_percent": round(spent / planned * 100, 1) if planned else 0.0,
    }


# --------------------------------------------------------------------------
# Analytics
# --------------------------------------------------------------------------

async def system_analytics(db: AsyncIOMotorDatabase) -> dict:
    portfolio = await _load_portfolio(db)
    projects, related = portfolio["projects"], portfolio["related"]
    metrics = {p["id"]: _metrics_for(p, related[p["id"]]) for p in projects}

    status_counts: dict[str, int] = defaultdict(int)
    for project in projects:
        status_counts[project.get("status") or "planning"] += 1

    role_counts: dict[str, int] = defaultdict(int)
    async for user in db[C.users].find({}, {"role": 1, "active": 1}):
        role_counts[user.get("role") or "unknown"] += 1

    category_spend: dict[str, float] = defaultdict(float)
    async for expense in db[C.expenses].find({}, {"category": 1, "amount": 1}):
        category_spend[expense.get("category") or "other"] += float(expense.get("amount") or 0)

    progress = sorted(
        (
            {
                "id": p["id"],
                "name": p["name"],
                "code": p.get("code"),
                "status": p.get("status"),
                "manager_name": p.get("manager_name"),
                "actual": metrics[p["id"]]["schedule"]["actual_progress"],
                "planned": metrics[p["id"]]["schedule"]["planned_progress"],
                "variance": metrics[p["id"]]["schedule"]["variance"],
                "health": metrics[p["id"]]["schedule"]["schedule_health"],
                "budget": metrics[p["id"]]["budget"]["budget"],
                "spent": metrics[p["id"]]["budget"]["spent"],
                "overrun_percent": metrics[p["id"]]["budget"]["overrun_percent"],
            }
            for p in projects
        ),
        key=lambda row: row["variance"],
    )

    task_counts: dict[str, int] = defaultdict(int)
    async for task in db[C.tasks].find({}, {"status": 1}):
        task_counts[task.get("status") or "not_started"] += 1

    return {
        "project_distribution": [
            {"status": status, "count": status_counts.get(status, 0)}
            for status in ("planning", "active", "at_risk", "delayed", "on_hold", "completed")
            if status_counts.get(status)
        ],
        "user_distribution": [
            {"role": role, "count": role_counts.get(role, 0)} for role in ROLE_ORDER
        ],
        "task_distribution": [
            {"status": status, "count": task_counts.get(status, 0)}
            for status in ("not_started", "in_progress", "completed", "delayed")
            if task_counts.get(status)
        ],
        "project_progress": progress,
        "budget": _budget_overview(projects, metrics),
        "spend_by_category": [
            {"category": category, "amount": round(amount, 2)}
            for category, amount in sorted(category_spend.items(), key=lambda pair: -pair[1])
        ],
        "totals": {
            "projects": len(projects),
            "tasks": sum(task_counts.values()),
            "materials": await db[C.materials].count_documents({}),
            "documents": await db[C.documents].count_documents({}),
            "site_updates": await db[C.site_updates].count_documents({}),
            "expenses": await db[C.expenses].count_documents({}),
            "reports": await db[C.reports].count_documents({}),
        },
    }


# --------------------------------------------------------------------------
# Intelligence
# --------------------------------------------------------------------------

async def ai_overview(db: AsyncIOMotorDatabase) -> dict:
    """System-wide risk, scored by the trained model where it can run.

    When the model bundle is unavailable every project comes back with a null
    probability and `model.available` is false, so the client can say the
    score is unavailable instead of showing a number nobody computed.
    """
    portfolio = await _load_portfolio(db)
    projects, related = portfolio["projects"], portfolio["related"]

    rows = []
    for project in projects:
        bucket = related[project["id"]]
        metrics = _metrics_for(project, bucket)
        prediction = delay_model.predict(
            project,
            schedule=metrics["schedule"],
            budget=metrics["budget"],
            tasks=bucket["tasks"],
            materials=bucket["materials"],
            site_updates=bucket["updates"],
        )
        rows.append({
            "id": project["id"],
            "name": project["name"],
            "code": project.get("code"),
            "status": project.get("status"),
            "manager_name": project.get("manager_name"),
            "progress": metrics["schedule"]["actual_progress"],
            "planned": metrics["schedule"]["planned_progress"],
            "variance": metrics["schedule"]["variance"],
            "schedule_health": metrics["schedule"]["schedule_health"],
            "forecast_end": metrics["schedule"]["forecast_end"],
            "delay_days": metrics["schedule"]["delay_days"],
            "overrun_percent": metrics["budget"]["overrun_percent"],
            "prediction": prediction,
            "delay_probability": prediction["delay_probability"] if prediction else None,
            "risk_band": prediction["risk_band"] if prediction else None,
        })

    scored = [r for r in rows if r["delay_probability"] is not None]
    scored.sort(key=lambda row: -row["delay_probability"])
    unscored = [r for r in rows if r["delay_probability"] is None]

    insights = [
        serialize(doc)
        async for doc in db[C.ai_insights].find({}).sort("generated_at", -1).limit(12)
    ]

    return {
        "model": delay_model.model_info(),
        "projects": scored + unscored,
        "counts": {
            "analysed": len(scored),
            "unscored": len(unscored),
            "high": sum(1 for r in scored if r["risk_band"] == "high"),
            "medium": sum(1 for r in scored if r["risk_band"] == "medium"),
            "low": sum(1 for r in scored if r["risk_band"] == "low"),
            "flagged": sum(1 for r in scored if (r["prediction"] or {}).get("flagged")),
        },
        "insights": insights,
        "insight_counts": {
            "total": await db[C.ai_insights].count_documents({}),
            "high": await db[C.ai_insights].count_documents({"severity": "high"}),
            "medium": await db[C.ai_insights].count_documents({"severity": "medium"}),
            "low": await db[C.ai_insights].count_documents({"severity": "low"}),
        },
    }


# --------------------------------------------------------------------------
# Activity log
# --------------------------------------------------------------------------

async def activity_log(
    db: AsyncIOMotorDatabase,
    *,
    actor_id: str | None = None,
    entity_type: str | None = None,
    project_id: str | None = None,
    q: str | None = None,
    days: int | None = None,
    page: int = 1,
    page_size: int = 40,
) -> dict:
    query: dict = {}
    if actor_id and (oid := to_object_id(actor_id)):
        query["actor_id"] = oid
    if entity_type:
        query["entity_type"] = entity_type
    if project_id and (oid := to_object_id(project_id)):
        query["project_id"] = oid
    if days:
        query["created_at"] = {"$gte": utcnow() - timedelta(days=days)}
    if q:
        query["$or"] = [
            {"action": {"$regex": q, "$options": "i"}},
            {"detail": {"$regex": q, "$options": "i"}},
            {"actor_name": {"$regex": q, "$options": "i"}},
        ]

    page = max(1, page)
    page_size = max(1, min(200, page_size))
    total = await db[C.activities].count_documents(query)

    cursor = (
        db[C.activities].find(query)
        .sort("created_at", -1)
        .skip((page - 1) * page_size)
        .limit(page_size)
    )
    entries = [serialize(doc) async for doc in cursor]

    project_names = {
        str(p["_id"]): p["name"] async for p in db[C.projects].find({}, {"name": 1})
    }
    for entry in entries:
        entry["project_name"] = project_names.get(str(entry.get("project_id")) or "", None)

    return {
        "entries": entries,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, (total + page_size - 1) // page_size),
        "entity_types": sorted(await db[C.activities].distinct("entity_type")),
    }


# --------------------------------------------------------------------------
# People
# --------------------------------------------------------------------------

def public_user(doc: dict, *, projects: list[dict] | None = None,
                managed: int = 0) -> dict:
    """One user, with nothing from the authentication record attached.

    Built field by field on purpose: spreading the stored document would mean
    every future internal field is exposed until someone remembers to strip it.
    """
    assigned = projects or []
    return {
        "id": doc["id"] if "id" in doc else str(doc.get("_id")),
        "name": doc.get("name"),
        "email": doc.get("email"),
        "role": doc.get("role"),
        "roles": authorized_roles(doc),
        "title": doc.get("title"),
        "phone": doc.get("phone"),
        "active": bool(doc.get("active", True)),
        "avatar_initials": doc.get("avatar_initials"),
        "created_at": doc.get("created_at"),
        "last_active_at": doc.get("last_active_at"),
        "demo": bool(doc.get("demo", False)),
        "projects": assigned,
        "project_count": len(assigned),
        "managed_count": managed,
    }


async def user_rows(
    db: AsyncIOMotorDatabase,
    *,
    role: str | None = None,
    active: bool | None = None,
    q: str | None = None,
) -> list[dict]:
    query: dict = {}
    if role:
        query["role"] = role
    if active is not None:
        query["active"] = active
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
            {"title": {"$regex": q, "$options": "i"}},
        ]

    # One pass over projects builds both memberships and managed counts.
    membership: dict[str, list[dict]] = defaultdict(list)
    managed: dict[str, int] = defaultdict(int)
    async for project in db[C.projects].find({}, {"name": 1, "code": 1, "status": 1,
                                                  "manager_id": 1, "team_ids": 1}):
        summary = {"id": str(project["_id"]), "name": project.get("name"),
                   "code": project.get("code"), "status": project.get("status")}
        manager_id = str(project.get("manager_id")) if project.get("manager_id") else None
        if manager_id:
            managed[manager_id] += 1
            membership[manager_id].append({**summary, "role_on_project": "manager"})
        for member in project.get("team_ids") or []:
            member_id = str(member)
            if member_id == manager_id:
                continue
            membership[member_id].append({**summary, "role_on_project": "team"})

    # `password_hash` is projected away at the query, so it never reaches
    # application memory in the first place.
    cursor = db[C.users].find(query, {"password_hash": 0}).sort("name", 1)
    return [
        public_user(serialize(doc), projects=membership.get(str(doc["_id"]), []),
                    managed=managed.get(str(doc["_id"]), 0))
        async for doc in cursor
    ]


async def user_detail(db: AsyncIOMotorDatabase, user_id: str) -> dict | None:
    oid = to_object_id(user_id)
    if not oid:
        return None
    doc = await db[C.users].find_one({"_id": oid}, {"password_hash": 0})
    if not doc:
        return None

    membership = []
    managed = 0
    async for project in db[C.projects].find(
        {"$or": [{"manager_id": oid}, {"team_ids": oid}]},
        {"name": 1, "code": 1, "status": 1, "manager_id": 1, "actual_progress": 1},
    ):
        is_manager = str(project.get("manager_id")) == str(oid)
        managed += 1 if is_manager else 0
        membership.append({
            "id": str(project["_id"]), "name": project.get("name"),
            "code": project.get("code"), "status": project.get("status"),
            "progress": project.get("actual_progress", 0),
            "role_on_project": "manager" if is_manager else "team",
        })

    detail = public_user(serialize(doc), projects=membership, managed=managed)
    detail["open_tasks"] = await db[C.tasks].count_documents(
        {"assignee_id": oid, "status": {"$ne": "completed"}}
    )
    detail["completed_tasks"] = await db[C.tasks].count_documents(
        {"assignee_id": oid, "status": "completed"}
    )
    detail["activity"] = [
        serialize(a) async for a in
        db[C.activities].find({"actor_id": oid}).sort("created_at", -1).limit(15)
    ]
    return detail


async def count_admins(db: AsyncIOMotorDatabase, *, exclude: str | None = None) -> int:
    """How many active admins would remain, optionally ignoring one account."""
    query: dict = {
        "active": True,
        "$or": [{"role": Role.admin.value}, {"roles": Role.admin.value}],
    }
    if exclude and (oid := to_object_id(exclude)):
        query["_id"] = {"$ne": oid}
    return await db[C.users].count_documents(query)
