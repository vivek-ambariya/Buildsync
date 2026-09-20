from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.deps import (
    CurrentUser,
    Database,
    forbidden,
    require_permission,
)
from app.core.permissions import P, has_permission
from app.db.mongodb import Collections as C
from app.models.common import Role, TaskStatus, serialize, to_object_id, utcnow
from app.schemas.task import TaskCreate, TaskUpdate
from app.services.activity_service import log_activity, notify
from app.services.project_service import recalculate_progress, visibility_filter
from app.utils.dates import to_datetime

router = APIRouter(prefix="/tasks", tags=["tasks"])

can_create = Depends(require_permission(P.tasks_create))
can_delete = Depends(require_permission(P.tasks_delete))

# What someone who may only update their own work is allowed to change:
# how far along it is, not what it is or who owns it.
OWN_TASK_FIELDS = frozenset({"progress", "status"})


async def _people(db) -> dict[str, dict]:
    return {
        str(u["_id"]): {"id": str(u["_id"]), "name": u["name"], "avatar_initials": u.get("avatar_initials"),
                        "role": u["role"]}
        async for u in db[C.users].find({}, {"name": 1, "avatar_initials": 1, "role": 1})
    }


def _decorate(task: dict, people: dict, projects: dict) -> dict:
    assignee = people.get(str(task.get("assignee_id")))
    task["assignee"] = assignee
    task["assignee_name"] = assignee["name"] if assignee else "Unassigned"
    task["project_name"] = projects.get(str(task.get("project_id")), "")
    deadline = to_datetime(task.get("deadline"))
    task["overdue"] = bool(deadline and deadline < utcnow() and task.get("status") != "completed")
    return task


@router.get("")
async def index(
    db: Database,
    user: CurrentUser,
    project_id: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    assignee_id: str | None = None,
    q: str | None = None,
):
    visible = [p async for p in db[C.projects].find(visibility_filter(user), {"name": 1})]
    project_names = {str(p["_id"]): p["name"] for p in visible}

    query: dict = {"project_id": {"$in": [p["_id"] for p in visible]}}
    if project_id and (oid := to_object_id(project_id)):
        query["project_id"] = oid
    if status_filter:
        query["status"] = status_filter
    if assignee_id and (aid := to_object_id(assignee_id)):
        query["assignee_id"] = aid
    if user["role"] == Role.contractor.value:
        query["assignee_id"] = to_object_id(user["id"])
    if q:
        query["title"] = {"$regex": q, "$options": "i"}

    people = await _people(db)
    cursor = db[C.tasks].find(query).sort("deadline", 1)
    return [_decorate(serialize(doc), people, project_names) async for doc in cursor]


@router.post("", status_code=status.HTTP_201_CREATED, dependencies=[can_create])
async def create(payload: TaskCreate, db: Database, user: CurrentUser):
    project = await db[C.projects].find_one({"_id": to_object_id(payload.project_id)})
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That project does not exist.")

    doc = payload.model_dump()
    doc["project_id"] = to_object_id(doc["project_id"])
    doc["assignee_id"] = to_object_id(doc.get("assignee_id"))
    doc["start_date"] = to_datetime(doc["start_date"])
    doc["deadline"] = to_datetime(doc["deadline"])
    doc["status"] = doc["status"].value if hasattr(doc["status"], "value") else doc["status"]
    doc["priority"] = doc["priority"].value if hasattr(doc["priority"], "value") else doc["priority"]
    doc.update({"created_at": utcnow(), "updated_at": utcnow(), "created_by": to_object_id(user["id"])})

    result = await db[C.tasks].insert_one(doc)
    await recalculate_progress(db, payload.project_id)
    await log_activity(db, actor=user, action="created task", entity_type="task",
                       entity_id=str(result.inserted_id), project_id=payload.project_id, detail=payload.title)
    if doc["assignee_id"]:
        await notify(db, user_ids=[str(doc["assignee_id"])], title="New task assigned",
                     body=f"{payload.title} on {project['name']}, due {payload.deadline}.",
                     tone="info", link=f"/app/projects/{payload.project_id}?tab=tasks",
                     project_id=payload.project_id)

    people = await _people(db)
    created = serialize(await db[C.tasks].find_one({"_id": result.inserted_id}))
    return _decorate(created, people, {str(project["_id"]): project["name"]})


@router.patch("/{task_id}")
async def update(task_id: str, payload: TaskUpdate, db: Database, user: CurrentUser):
    oid = to_object_id(task_id)
    existing = await db[C.tasks].find_one({"_id": oid}) if oid else None
    if not existing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That task does not exist.")

    changes = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}

    # Anyone with tasks.edit may change any visible task. Everyone else may
    # only move their own work along, and only its progress and status — so a
    # contractor cannot reassign a task to themselves or push its deadline.
    if not has_permission(user["role"], P.tasks_edit):
        if str(existing.get("assignee_id")) != str(user["id"]):
            raise forbidden()
        if not set(changes) <= OWN_TASK_FIELDS:
            raise forbidden()

    for field in ("start_date", "deadline"):
        if field in changes:
            changes[field] = to_datetime(changes[field])
    if "assignee_id" in changes:
        changes["assignee_id"] = to_object_id(changes["assignee_id"])
    for field in ("status", "priority"):
        if field in changes and hasattr(changes[field], "value"):
            changes[field] = changes[field].value

    # Keep progress and status honest with each other.
    if changes.get("status") == TaskStatus.completed.value:
        changes["progress"] = 100.0
    elif changes.get("progress") == 100 and existing.get("status") != TaskStatus.completed.value:
        changes["status"] = TaskStatus.completed.value
    changes["updated_at"] = utcnow()

    await db[C.tasks].update_one({"_id": oid}, {"$set": changes})
    project_id = str(existing["project_id"])
    await recalculate_progress(db, project_id)
    await log_activity(db, actor=user, action="updated task", entity_type="task",
                       entity_id=task_id, project_id=project_id, detail=existing.get("title", ""))

    people = await _people(db)
    project = await db[C.projects].find_one({"_id": existing["project_id"]}, {"name": 1})
    updated = serialize(await db[C.tasks].find_one({"_id": oid}))
    return _decorate(updated, people, {project_id: project["name"] if project else ""})


@router.delete("/{task_id}", dependencies=[can_delete])
async def remove(task_id: str, db: Database, user: CurrentUser):
    oid = to_object_id(task_id)
    existing = await db[C.tasks].find_one({"_id": oid}) if oid else None
    if not existing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That task does not exist.")
    await db[C.tasks].delete_one({"_id": oid})
    await recalculate_progress(db, str(existing["project_id"]))
    await log_activity(db, actor=user, action="deleted task", entity_type="task",
                       project_id=str(existing["project_id"]), detail=existing.get("title", ""))
    return {"ok": True}
