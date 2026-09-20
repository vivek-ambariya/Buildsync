from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.deps import CurrentUser, Database, ensure_permission, require_permission
from app.core.permissions import P
from app.db.mongodb import Collections as C
from app.models.common import ProjectStatus, Role, serialize, to_object_id, utcnow
from app.schemas.project import ProjectCreate, ProjectUpdate
from app.services.activity_service import broadcast_ids, log_activity, notify, recent_activity
from app.services.project_service import get_project, list_projects, project_metrics
from app.utils.dates import to_datetime

router = APIRouter(prefix="/projects", tags=["projects"])

# Capabilities rather than role names, so moving one is a change to the
# matrix in app.core.permissions and not to this file.
can_create = Depends(require_permission(P.projects_create))
can_edit = Depends(require_permission(P.projects_edit))
can_delete = Depends(require_permission(P.projects_delete))


@router.get("")
async def index(
    db: Database,
    user: CurrentUser,
    status_filter: str | None = Query(default=None, alias="status"),
    category: str | None = None,
    q: str | None = None,
):
    query: dict = {}
    if status_filter:
        query["status"] = status_filter
    if category:
        query["category"] = category
    if q:
        query["$or"] = [{"name": {"$regex": q, "$options": "i"}}, {"code": {"$regex": q, "$options": "i"}}]

    projects = await list_projects(db, user, query)
    for project in projects:
        project["metrics"] = await project_metrics(db, project)
    return projects


@router.get("/{project_id}")
async def detail(project_id: str, db: Database, user: CurrentUser):
    project = await get_project(db, project_id, user)
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That project does not exist, or you cannot see it.")
    oid = to_object_id(project_id)
    project["metrics"] = await project_metrics(db, project)
    project["milestones"] = [
        serialize(m) async for m in db[C.milestones].find({"project_id": oid}).sort("order", 1)
    ]
    project["activity"] = await recent_activity(db, limit=10, project_id=project_id)
    project["counts"] = {
        "tasks": await db[C.tasks].count_documents({"project_id": oid}),
        "open_tasks": await db[C.tasks].count_documents({"project_id": oid, "status": {"$ne": "completed"}}),
        "materials": await db[C.materials].count_documents({"project_id": oid}),
        "documents": await db[C.documents].count_documents({"project_id": oid}),
        "site_updates": await db[C.site_updates].count_documents({"project_id": oid}),
    }
    return project


@router.post("", status_code=status.HTTP_201_CREATED, dependencies=[can_create])
async def create(payload: ProjectCreate, db: Database, user: CurrentUser):
    if await db[C.projects].find_one({"code": payload.code.upper()}):
        raise HTTPException(status.HTTP_409_CONFLICT, f"Project code {payload.code.upper()} is already in use.")

    doc = payload.model_dump()
    doc["code"] = doc["code"].upper()
    doc["start_date"] = to_datetime(doc["start_date"])
    doc["end_date"] = to_datetime(doc["end_date"])
    doc["manager_id"] = to_object_id(doc.get("manager_id")) or to_object_id(user["id"])
    doc["team_ids"] = [t for t in map(to_object_id, doc.get("team_ids") or []) if t]
    doc["status"] = doc["status"].value if hasattr(doc["status"], "value") else doc["status"]
    doc.update({"actual_progress": 0.0, "planned_progress": 0.0,
                "created_at": utcnow(), "updated_at": utcnow(), "created_by": to_object_id(user["id"])})

    result = await db[C.projects].insert_one(doc)
    project_id = str(result.inserted_id)

    await log_activity(db, actor=user, action="created project", entity_type="project",
                       entity_id=project_id, project_id=project_id, detail=payload.name)
    await notify(db, user_ids=await broadcast_ids(db, [Role.admin.value, Role.project_manager.value]),
                 title="New project created", body=f"{payload.name} was added to the portfolio.",
                 tone="info", link=f"/app/projects/{project_id}", project_id=project_id)

    return await detail(project_id, db, user)


@router.patch("/{project_id}", dependencies=[can_edit])
async def update(project_id: str, payload: ProjectUpdate, db: Database, user: CurrentUser):
    oid = to_object_id(project_id)
    if not oid:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That project does not exist.")

    changes = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    for field in ("start_date", "end_date"):
        if field in changes:
            changes[field] = to_datetime(changes[field])
    if "manager_id" in changes:
        # Handing a project to a different manager changes who can act on it,
        # so it is guarded separately from ordinary project edits.
        existing = await db[C.projects].find_one({"_id": oid}, {"manager_id": 1})
        if str((existing or {}).get("manager_id")) != str(changes["manager_id"]):
            ensure_permission(user, P.projects_assign_manager)
        changes["manager_id"] = to_object_id(changes["manager_id"])
    if "team_ids" in changes:
        changes["team_ids"] = [t for t in map(to_object_id, changes["team_ids"]) if t]
    if "status" in changes and hasattr(changes["status"], "value"):
        changes["status"] = changes["status"].value
    changes["updated_at"] = utcnow()

    result = await db[C.projects].update_one({"_id": oid}, {"$set": changes})
    if result.matched_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That project does not exist.")

    await log_activity(db, actor=user, action="updated project", entity_type="project",
                       entity_id=project_id, project_id=project_id,
                       detail=", ".join(k for k in changes if k != "updated_at"))
    return await detail(project_id, db, user)


@router.delete("/{project_id}", dependencies=[can_delete])
async def remove(project_id: str, db: Database, user: CurrentUser):
    oid = to_object_id(project_id)
    project = await db[C.projects].find_one({"_id": oid})
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That project does not exist.")

    for collection in (C.tasks, C.materials, C.expenses, C.documents, C.site_updates, C.milestones):
        await db[collection].delete_many({"project_id": oid})
    await db[C.projects].delete_one({"_id": oid})
    await log_activity(db, actor=user, action="deleted project", entity_type="project",
                       entity_id=project_id, detail=project.get("name", ""))
    return {"ok": True}


@router.get("/{project_id}/timeline")
async def timeline(project_id: str, db: Database, user: CurrentUser):
    """Milestones with planned and actual bars, plus the tasks inside each."""
    oid = to_object_id(project_id)
    project = await get_project(db, project_id, user)
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That project does not exist.")

    milestones = [serialize(m) async for m in db[C.milestones].find({"project_id": oid}).sort("order", 1)]
    tasks = [serialize(t) async for t in db[C.tasks].find({"project_id": oid})]

    for milestone in milestones:
        phase_tasks = [t for t in tasks if t.get("phase") == milestone.get("name")]
        milestone["task_count"] = len(phase_tasks)
        milestone["tasks"] = [
            {"id": t["id"], "title": t["title"], "progress": t.get("progress", 0), "status": t.get("status")}
            for t in phase_tasks
        ]
    return {"project": {"id": project["id"], "name": project["name"],
                        "start_date": project["start_date"], "end_date": project["end_date"]},
            "milestones": milestones}
