"""Site operations — the surface the people on the ground work from.

This router exists separately from the portfolio API because it answers a
different question. `/projects`, `/expenses` and `/reports` answer *how is the
business doing*; everything here answers *what do I need to do on site today*,
and is shaped for one person, on one site, on a phone.

Three things follow from that and are true of every endpoint below:

  * **One round trip.** `/site/overview` returns the whole morning screen —
    tasks, headcount, stock, open issues — because a field connection may not
    survive six sequential requests.
  * **No money.** Every read goes through `strip_financials`. A site manager
    records what was built and consumed; budgets are not their screen, and the
    API does not send them so the client cannot leak them.
  * **Escalation is the point.** An issue, a material request or a daily report
    is only useful if the project manager hears about it, so each write
    notifies the person running that site before it returns.
"""
import uuid
from datetime import timedelta
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse

from app.ai.engine import material_metrics, project_schedule_metrics
from app.core.config import settings
from app.core.deps import CurrentUser, Database, ensure_permission, forbidden
from app.core.permissions import P, has_permission
from app.db.mongodb import Collections as C
from app.models.common import TaskStatus, serialize, to_object_id, utcnow
from app.schemas.site import (
    DailyReportCreate,
    MaterialRequestCreate,
    MaterialUsageCreate,
    ProgressUpdateCreate,
    SiteIssueCreate,
    SiteIssueUpdate,
    TaskProgressUpdate,
    WorkforceLogCreate,
)
from app.services.activity_service import log_activity, notify
from app.services.project_service import recalculate_progress
from app.services.site_service import (
    FIELD_DOCUMENT_TYPES,
    day_bounds,
    people_map,
    photo_out,
    project_manager_ids,
    resolve_scope,
    site_team_ids,
    strip_financials,
)
from app.utils.dates import to_datetime

router = APIRouter(prefix="/site", tags=["site"])

PHOTO_DIR = "site-photos"
MAX_PHOTO_BYTES = 12 * 1024 * 1024
MAX_PHOTOS_PER_UPLOAD = 12
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}

PHOTO_CATEGORIES = ("foundation", "structure", "electrical", "plumbing", "finishing", "other")


def _photo_storage() -> Path:
    path = settings.storage_path / PHOTO_DIR
    path.mkdir(parents=True, exist_ok=True)
    return path


async def _require_project(db, user, project_id: str) -> dict:
    """Resolve a project the caller is actually attached to, or refuse.

    Passing a project id they are not on is the one way this surface could
    reach an unrelated site, so it is checked against their own scope rather
    than against the project collection.
    """
    scope = await resolve_scope(db, user, project_id)
    project = next((p for p in scope["projects"] if p["id"] == project_id), None)
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That project is not one of your sites.")
    return project


async def _my_task_query(db, user, scope: dict, project_only: bool = True) -> dict:
    """Tasks belonging to this person or the crew on the same site."""
    crew = await site_team_ids(db, user, scope["project"])
    project_filter = (
        {"project_id": scope["current_oid"]}
        if project_only and scope["current_oid"]
        else {"project_id": {"$in": scope["project_ids"]}}
    )
    if not scope["project_ids"]:
        return {"_id": None}  # matches nothing
    return {**project_filter, "assignee_id": {"$in": crew}}


def _decorate_task(task: dict, people: dict, project_names: dict) -> dict:
    assignee = people.get(str(task.get("assignee_id")))
    task["assignee"] = assignee
    task["assignee_name"] = assignee["name"] if assignee else "Unassigned"
    task["project_name"] = project_names.get(str(task.get("project_id")), "")
    deadline = to_datetime(task.get("deadline"))
    now = utcnow()
    task["overdue"] = bool(deadline and deadline < now and task.get("status") != TaskStatus.completed.value)
    task["due_today"] = bool(deadline and deadline.date() == now.date())
    return task


# ---------------------------------------------------------------------------
# The morning screen
# ---------------------------------------------------------------------------

@router.get("/overview")
async def overview(db: Database, user: CurrentUser, project_id: str | None = None):
    """Everything the site dashboard shows, in one request."""
    scope = await resolve_scope(db, user, project_id)
    project = scope["project"]
    start, end = day_bounds()

    if not project:
        return {
            "project": None, "projects": [], "summary": {"tasks": 0, "completed": 0, "pending": 0, "issues": 0},
            "tasks_today": [], "workforce": None, "materials_low": [], "open_issues": [], "schedule": None,
        }

    people = await people_map(db)
    project_names = {p["id"]: p["name"] for p in scope["projects"]}

    # Today's work: what falls due today, plus anything already underway. A
    # task started yesterday and still open is today's work too.
    task_query = await _my_task_query(db, user, scope)
    todays = [
        _decorate_task(serialize(doc), people, project_names)
        async for doc in db[C.tasks].find({
            **task_query,
            "$or": [
                {"deadline": {"$lt": end}},
                {"status": TaskStatus.in_progress.value},
            ],
        }).sort("deadline", 1)
    ]
    # A task closed weeks ago is not today's list; one closed today is.
    todays = [
        t for t in todays
        if t.get("status") != TaskStatus.completed.value
        or (to_datetime(t.get("updated_at")) or start) >= start
    ]

    completed = sum(1 for t in todays if t["status"] == TaskStatus.completed.value)

    open_issues = [
        serialize(doc)
        async for doc in db[C.site_issues]
        .find({"project_id": scope["current_oid"], "status": {"$ne": "resolved"}})
        .sort([("severity", -1), ("created_at", -1)])
        .limit(10)
    ]

    workforce = await db[C.workforce_logs].find_one(
        {"project_id": scope["current_oid"], "date": {"$gte": start, "$lt": end}}
    )

    elapsed = project_schedule_metrics(project).get("elapsed_days", 30)
    materials_low = []
    async for doc in db[C.materials].find({"project_id": scope["current_oid"]}).sort("name", 1):
        material = strip_financials(serialize(doc))
        metrics = material_metrics(material, elapsed)
        if metrics["status"] == "healthy":
            continue
        material.update({"metrics": metrics, "status": metrics["status"]})
        materials_low.append(material)

    pending_requests = await db[C.material_requests].count_documents(
        {"project_id": scope["current_oid"], "status": "pending"}
    )

    return {
        "project": project,
        "projects": scope["projects"],
        "summary": {
            "tasks": len(todays),
            "completed": completed,
            "pending": len(todays) - completed,
            "issues": len(open_issues),
        },
        "tasks_today": todays,
        "workforce": serialize(workforce) if workforce else None,
        "materials_low": materials_low[:6],
        "material_requests_pending": pending_requests,
        "open_issues": open_issues,
        "schedule": project_schedule_metrics(project),
        "report_filed_today": bool(
            await db[C.site_updates].count_documents(
                {"project_id": scope["current_oid"], "date": {"$gte": start, "$lt": end},
                 "reported_by": to_object_id(user["id"])}
            )
        ),
    }


# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------

@router.get("/tasks")
async def my_tasks(
    db: Database,
    user: CurrentUser,
    project_id: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    scope_all: bool = Query(default=False, alias="all_projects"),
):
    scope = await resolve_scope(db, user, project_id)
    if not scope["project"]:
        return []
    query = await _my_task_query(db, user, scope, project_only=not scope_all)
    if status_filter:
        query["status"] = status_filter

    people = await people_map(db)
    project_names = {p["id"]: p["name"] for p in scope["projects"]}
    return [
        _decorate_task(serialize(doc), people, project_names)
        async for doc in db[C.tasks].find(query).sort("deadline", 1)
    ]


@router.patch("/tasks/{task_id}")
async def update_my_task(task_id: str, payload: TaskProgressUpdate, db: Database, user: CurrentUser):
    """Move progress, close, or flag blocked — nothing else.

    Deliberately narrower than `PATCH /tasks/{id}`: a site manager can say how
    far the work has got, not move a deadline or reassign it to someone else.
    """
    ensure_permission(user, P.tasks_update_own)

    oid = to_object_id(task_id)
    task = await db[C.tasks].find_one({"_id": oid}) if oid else None
    if not task:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That task does not exist.")

    scope = await resolve_scope(db, user, str(task["project_id"]))
    crew = await site_team_ids(db, user, scope["project"])
    if task["project_id"] not in scope["project_ids"] or task.get("assignee_id") not in crew:
        raise forbidden()

    changes: dict = {"updated_at": utcnow()}
    if payload.progress is not None:
        changes["progress"] = float(payload.progress)
    if payload.status is not None:
        changes["status"] = payload.status.value

    # Progress and status stay honest with each other, the same way they do on
    # the portfolio route.
    if changes.get("status") == TaskStatus.completed.value:
        changes["progress"] = 100.0
    elif changes.get("progress") == 100:
        changes["status"] = TaskStatus.completed.value
    elif changes.get("progress", 0) > 0 and task.get("status") == TaskStatus.not_started.value:
        changes["status"] = TaskStatus.in_progress.value

    if payload.blocked_reason.strip():
        changes["blocked_reason"] = payload.blocked_reason.strip()
        changes["blocked"] = True
    elif payload.status is not None:
        changes["blocked"] = False
        changes["blocked_reason"] = ""

    if payload.note.strip():
        await db[C.tasks].update_one({"_id": oid}, {"$push": {"site_notes": {
            "note": payload.note.strip(),
            "author_id": to_object_id(user["id"]),
            "author_name": user.get("name"),
            "created_at": utcnow(),
        }}})

    await db[C.tasks].update_one({"_id": oid}, {"$set": changes})
    await recalculate_progress(db, str(task["project_id"]))
    await log_activity(db, actor=user, action="updated task from site", entity_type="task",
                       entity_id=task_id, project_id=str(task["project_id"]),
                       detail=task.get("title", ""))

    if payload.blocked_reason.strip():
        await notify(
            db,
            user_ids=await project_manager_ids(db, scope["project"]),
            title=f"Task blocked: {task.get('title', 'a task')}",
            body=payload.blocked_reason.strip()[:200],
            tone="critical",
            link=f"/app/projects/{task['project_id']}?tab=tasks",
            project_id=str(task["project_id"]),
        )

    people = await people_map(db)
    updated = serialize(await db[C.tasks].find_one({"_id": oid}))
    return _decorate_task(updated, people, {str(task["project_id"]): scope["project"]["name"] if scope["project"] else ""})


# ---------------------------------------------------------------------------
# Progress updates
# ---------------------------------------------------------------------------

@router.get("/progress")
async def progress_history(db: Database, user: CurrentUser, project_id: str | None = None, limit: int = 30):
    scope = await resolve_scope(db, user, project_id)
    if not scope["current_oid"]:
        return []
    cursor = db[C.progress_updates].find({"project_id": scope["current_oid"]}).sort("created_at", -1).limit(limit)
    return [serialize(doc) async for doc in cursor]


@router.post("/progress", status_code=status.HTTP_201_CREATED)
async def record_progress(payload: ProgressUpdateCreate, db: Database, user: CurrentUser):
    """Record work done against a task, and draw down what it consumed."""
    ensure_permission(user, P.site_updates_create)
    project = await _require_project(db, user, payload.project_id)
    project_oid = to_object_id(payload.project_id)

    task = None
    previous = 0.0
    if payload.task_id and (task_oid := to_object_id(payload.task_id)):
        task = await db[C.tasks].find_one({"_id": task_oid, "project_id": project_oid})
        if not task:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "That task is not on this site.")
        previous = float(task.get("progress") or 0)

    record = {
        "project_id": project_oid,
        "task_id": to_object_id(payload.task_id),
        "task_title": task.get("title") if task else None,
        "previous_progress": previous,
        "new_progress": float(payload.new_progress),
        "work_completed": payload.work_completed,
        "workers_used": payload.workers_used,
        "materials_used": [m.model_dump() for m in payload.materials_used],
        "notes": payload.notes,
        "photo_ids": [pid for pid in map(to_object_id, payload.photo_ids) if pid],
        "recorded_by": to_object_id(user["id"]),
        "recorded_by_name": user.get("name"),
        "created_at": utcnow(),
    }
    result = await db[C.progress_updates].insert_one(record)

    if task:
        task_changes = {"progress": float(payload.new_progress), "updated_at": utcnow()}
        if payload.new_progress >= 100:
            task_changes["status"] = TaskStatus.completed.value
        elif payload.new_progress > 0 and task.get("status") == TaskStatus.not_started.value:
            task_changes["status"] = TaskStatus.in_progress.value
        await db[C.tasks].update_one({"_id": task["_id"]}, {"$set": task_changes})
        await recalculate_progress(db, payload.project_id)

    # Consumption is the same event as the progress it produced, so it is
    # applied here rather than asking for it again on a stock screen.
    for usage in record["materials_used"]:
        await db[C.materials].update_one(
            {"project_id": project_oid, "name": {"$regex": f"^{usage['name']}$", "$options": "i"}},
            {"$inc": {"used_qty": float(usage["quantity"]), "available_qty": -float(usage["quantity"])}},
        )

    if record["photo_ids"]:
        await db[C.site_photos].update_many(
            {"_id": {"$in": record["photo_ids"]}},
            {"$set": {"progress_update_id": result.inserted_id}},
        )

    if payload.file_site_update:
        await db[C.site_updates].insert_one({
            "project_id": project_oid,
            "date": to_datetime(utcnow().date()),
            "work_completed": payload.work_completed,
            "progress_percent": float(payload.new_progress),
            "workers_count": payload.workers_used,
            "materials_used": record["materials_used"],
            "issues": "",
            "weather": "Clear",
            "photos": [str(pid) for pid in record["photo_ids"]],
            "reported_by": to_object_id(user["id"]),
            "reported_by_name": user.get("name"),
            "reported_by_role": user.get("role"),
            "created_at": utcnow(),
        })

    await log_activity(db, actor=user, action="recorded progress", entity_type="progress_update",
                       entity_id=str(result.inserted_id), project_id=payload.project_id,
                       detail=f"{previous:.0f}% → {payload.new_progress:.0f}% · {payload.work_completed[:60]}")

    return serialize(await db[C.progress_updates].find_one({"_id": result.inserted_id}))


# ---------------------------------------------------------------------------
# Photos
# ---------------------------------------------------------------------------

@router.get("/photos")
async def list_photos(
    db: Database,
    user: CurrentUser,
    project_id: str | None = None,
    category: str | None = None,
    task_id: str | None = None,
    limit: int = 120,
):
    ensure_permission(user, P.site_photos_view)
    scope = await resolve_scope(db, user, project_id)
    if not scope["current_oid"]:
        return []

    query: dict = {"project_id": scope["current_oid"]}
    if category and category != "all":
        query["category"] = category
    if task_id and (tid := to_object_id(task_id)):
        query["task_id"] = tid

    cursor = db[C.site_photos].find(query).sort("taken_at", -1).limit(limit)
    return [photo_out(doc, settings.api_prefix) async for doc in cursor]


@router.post("/photos", status_code=status.HTTP_201_CREATED)
async def upload_photos(
    db: Database,
    user: CurrentUser,
    files: list[UploadFile] = File(...),
    project_id: str = Form(...),
    task_id: str | None = Form(default=None),
    category: str = Form(default="other"),
    description: str = Form(default=""),
    taken_at: str | None = Form(default=None),
):
    """Several photographs at once — a site manager shoots a sequence, not one."""
    ensure_permission(user, P.site_photos_upload)
    project = await _require_project(db, user, project_id)

    if not files:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Choose at least one photo.")
    if len(files) > MAX_PHOTOS_PER_UPLOAD:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            f"Up to {MAX_PHOTOS_PER_UPLOAD} photos at a time. Send the rest in a second batch.")
    if category not in PHOTO_CATEGORIES:
        category = "other"

    when = to_datetime(taken_at) or utcnow()
    storage = _photo_storage()
    saved = []

    for upload in files:
        raw = await upload.read()
        if not raw:
            continue
        if len(raw) > MAX_PHOTO_BYTES:
            raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                                f"{upload.filename or 'That photo'} is over the 12 MB limit.")
        if upload.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(status.HTTP_400_BAD_REQUEST,
                                f"{upload.filename or 'That file'} is not a photo. Upload a JPEG, PNG or WebP.")

        suffix = Path(upload.filename or "photo.jpg").suffix or ".jpg"
        stored_name = f"{uuid.uuid4().hex}{suffix}"
        (storage / stored_name).write_bytes(raw)

        saved.append({
            "project_id": to_object_id(project_id),
            "task_id": to_object_id(task_id),
            "name": upload.filename or stored_name,
            "stored_name": stored_name,
            "content_type": upload.content_type,
            "size_bytes": len(raw),
            "category": category,
            "description": description,
            "taken_at": when,
            "uploaded_by": to_object_id(user["id"]),
            "uploaded_by_name": user.get("name"),
            "created_at": utcnow(),
        })

    if not saved:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Those files were empty.")

    result = await db[C.site_photos].insert_many(saved)
    await log_activity(db, actor=user, action="uploaded site photos", entity_type="site_photo",
                       project_id=project_id, detail=f"{len(saved)} photo(s) · {category}")

    cursor = db[C.site_photos].find({"_id": {"$in": result.inserted_ids}}).sort("taken_at", -1)
    return [photo_out(doc, settings.api_prefix) async for doc in cursor]


@router.get("/photos/{photo_id}/file")
async def photo_file(photo_id: str, db: Database, user: CurrentUser):
    ensure_permission(user, P.site_photos_view)
    oid = to_object_id(photo_id)
    doc = await db[C.site_photos].find_one({"_id": oid}) if oid else None
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That photo does not exist.")

    scope = await resolve_scope(db, user)
    if doc["project_id"] not in scope["project_ids"]:
        raise forbidden()

    path = _photo_storage() / doc["stored_name"]
    if not path.exists():
        raise HTTPException(status.HTTP_410_GONE, "The stored photo is no longer on disk.")
    return FileResponse(path, media_type=doc.get("content_type") or "image/jpeg", filename=doc["name"])


@router.delete("/photos/{photo_id}")
async def delete_photo(photo_id: str, db: Database, user: CurrentUser):
    ensure_permission(user, P.site_photos_delete)
    oid = to_object_id(photo_id)
    doc = await db[C.site_photos].find_one({"_id": oid}) if oid else None
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That photo does not exist.")

    scope = await resolve_scope(db, user)
    # Their own photograph, on one of their own sites.
    if doc["project_id"] not in scope["project_ids"] or doc.get("uploaded_by") != to_object_id(user["id"]):
        raise forbidden()

    (_photo_storage() / doc["stored_name"]).unlink(missing_ok=True)
    await db[C.site_photos].delete_one({"_id": oid})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Materials
# ---------------------------------------------------------------------------

@router.get("/materials")
async def list_materials(db: Database, user: CurrentUser, project_id: str | None = None):
    """Stock on this site: what is needed, what is here, what has gone in."""
    ensure_permission(user, P.materials_view)
    scope = await resolve_scope(db, user, project_id)
    if not scope["current_oid"]:
        return []

    elapsed = project_schedule_metrics(scope["project"]).get("elapsed_days", 30)
    items = []
    async for doc in db[C.materials].find({"project_id": scope["current_oid"]}).sort("name", 1):
        material = strip_financials(serialize(doc))
        metrics = material_metrics(material, elapsed)
        material.update({"metrics": metrics, "status": metrics["status"]})
        items.append(material)
    return items


@router.post("/materials/{material_id}/usage")
async def record_material_usage(material_id: str, payload: MaterialUsageCreate, db: Database, user: CurrentUser):
    ensure_permission(user, P.materials_edit)
    oid = to_object_id(material_id)
    material = await db[C.materials].find_one({"_id": oid}) if oid else None
    if not material:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That material does not exist.")

    scope = await resolve_scope(db, user)
    if material["project_id"] not in scope["project_ids"]:
        raise forbidden()

    available = float(material.get("available_qty") or 0)
    if payload.quantity_used > available:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Only {available:g} {material.get('unit', 'units')} of {material['name']} are on site. "
            "Record what was actually used, then raise a request for the rest.",
        )

    await db[C.materials].update_one(
        {"_id": oid},
        {"$inc": {"used_qty": payload.quantity_used, "available_qty": -payload.quantity_used},
         "$set": {"updated_at": utcnow()},
         "$push": {"usage_log": {
             "quantity": payload.quantity_used,
             "date": to_datetime(payload.date) or utcnow(),
             "task_id": to_object_id(payload.task_id),
             "notes": payload.notes,
             "recorded_by_name": user.get("name"),
             "created_at": utcnow(),
         }}},
    )

    updated = strip_financials(serialize(await db[C.materials].find_one({"_id": oid})))
    project = next((p for p in scope["projects"] if p["id"] == str(material["project_id"])), None)
    elapsed = project_schedule_metrics(project).get("elapsed_days", 30) if project else 30
    metrics = material_metrics(updated, elapsed)
    await db[C.materials].update_one({"_id": oid}, {"$set": {"status": metrics["status"]}})

    if metrics["status"] == "critical":
        await notify(
            db,
            user_ids=await project_manager_ids(db, project),
            title=f"{updated['name']} stock critical",
            body=f"{metrics['days_of_cover']:.0f} days of cover left after today's consumption on site.",
            tone="critical",
            project_id=str(material["project_id"]),
        )

    await log_activity(db, actor=user, action="recorded material usage", entity_type="material",
                       entity_id=material_id, project_id=str(material["project_id"]),
                       detail=f"{payload.quantity_used:g} {material.get('unit', 'units')} of {material['name']}")

    updated.update({"metrics": metrics, "status": metrics["status"]})
    return updated


@router.get("/material-requests")
async def list_material_requests(db: Database, user: CurrentUser, project_id: str | None = None):
    ensure_permission(user, P.material_requests_view)
    scope = await resolve_scope(db, user, project_id)
    if not scope["current_oid"]:
        return []
    cursor = db[C.material_requests].find({"project_id": scope["current_oid"]}).sort("created_at", -1)
    return [serialize(doc) async for doc in cursor]


@router.post("/material-requests", status_code=status.HTTP_201_CREATED)
async def create_material_request(payload: MaterialRequestCreate, db: Database, user: CurrentUser):
    """Ask for stock the site does not have. The project manager decides."""
    ensure_permission(user, P.material_requests_create)
    project = await _require_project(db, user, payload.project_id)

    doc = payload.model_dump()
    doc.update({
        "project_id": to_object_id(payload.project_id),
        "material_id": to_object_id(payload.material_id),
        "needed_by": to_datetime(payload.needed_by),
        "status": "pending",
        "requested_by": to_object_id(user["id"]),
        "requested_by_name": user.get("name"),
        "created_at": utcnow(),
    })
    result = await db[C.material_requests].insert_one(doc)

    await notify(
        db,
        user_ids=await project_manager_ids(db, project),
        title=f"Material request: {payload.material_name}",
        body=f"{payload.required_qty:g} {payload.unit} needed on {project['name']} — {payload.reason[:120]}",
        tone="critical" if payload.urgency in ("high", "critical") else "warning",
        link=f"/app/projects/{payload.project_id}?tab=materials",
        project_id=payload.project_id,
    )
    await log_activity(db, actor=user, action="requested material", entity_type="material_request",
                       entity_id=str(result.inserted_id), project_id=payload.project_id,
                       detail=f"{payload.material_name} · {payload.required_qty:g} {payload.unit}")

    return serialize(await db[C.material_requests].find_one({"_id": result.inserted_id}))


# ---------------------------------------------------------------------------
# Workforce
# ---------------------------------------------------------------------------

@router.get("/workforce")
async def workforce_history(db: Database, user: CurrentUser, project_id: str | None = None, days: int = 14):
    ensure_permission(user, P.workforce_view)
    scope = await resolve_scope(db, user, project_id)
    if not scope["current_oid"]:
        return {"today": None, "history": []}

    start, end = day_bounds()
    since = start - timedelta(days=max(1, days))
    cursor = db[C.workforce_logs].find(
        {"project_id": scope["current_oid"], "date": {"$gte": since}}
    ).sort("date", -1)
    history = [serialize(doc) async for doc in cursor]
    today = next((h for h in history if (to_datetime(h["date"]) or since) >= start), None)
    return {"today": today, "history": history}


@router.post("/workforce", status_code=status.HTTP_201_CREATED)
async def record_workforce(payload: WorkforceLogCreate, db: Database, user: CurrentUser):
    """One headcount entry per site per day; recording again replaces it."""
    ensure_permission(user, P.workforce_record)
    await _require_project(db, user, payload.project_id)

    when = to_datetime(payload.date) or to_datetime(utcnow().date())
    crews = [c.model_dump() for c in payload.crews]
    present = sum(int(c["present"]) for c in crews)
    absent = sum(int(c["absent"]) for c in crews)

    doc = {
        "project_id": to_object_id(payload.project_id),
        "date": when,
        "crews": crews,
        "present": present,
        "absent": absent,
        "total": present + absent,
        "notes": payload.notes,
        "recorded_by": to_object_id(user["id"]),
        "recorded_by_name": user.get("name"),
        "updated_at": utcnow(),
    }
    await db[C.workforce_logs].update_one(
        {"project_id": doc["project_id"], "date": when},
        {"$set": doc, "$setOnInsert": {"created_at": utcnow()}},
        upsert=True,
    )
    await log_activity(db, actor=user, action="recorded workforce", entity_type="workforce",
                       project_id=payload.project_id, detail=f"{present} present · {absent} absent")

    return serialize(await db[C.workforce_logs].find_one({"project_id": doc["project_id"], "date": when}))


# ---------------------------------------------------------------------------
# Issues
# ---------------------------------------------------------------------------

@router.get("/issues")
async def list_issues(
    db: Database,
    user: CurrentUser,
    project_id: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
):
    ensure_permission(user, P.site_issues_view)
    scope = await resolve_scope(db, user, project_id)
    if not scope["current_oid"]:
        return []

    query: dict = {"project_id": scope["current_oid"]}
    if status_filter and status_filter != "all":
        query["status"] = status_filter

    cursor = db[C.site_issues].find(query).sort("created_at", -1)
    issues = []
    async for doc in cursor:
        issue = serialize(doc)
        if issue.get("photo_ids"):
            issue["photos"] = [
                photo_out(p, settings.api_prefix)
                async for p in db[C.site_photos].find(
                    {"_id": {"$in": [to_object_id(i) for i in issue["photo_ids"]]}}
                )
            ]
        issues.append(issue)
    return issues


@router.post("/issues", status_code=status.HTTP_201_CREATED)
async def report_issue(payload: SiteIssueCreate, db: Database, user: CurrentUser):
    """Raise something that is holding the work up. The manager hears about it."""
    ensure_permission(user, P.site_issues_report)
    project = await _require_project(db, user, payload.project_id)

    doc = payload.model_dump()
    doc.update({
        "project_id": to_object_id(payload.project_id),
        "task_id": to_object_id(payload.task_id),
        "photo_ids": [pid for pid in map(to_object_id, payload.photo_ids) if pid],
        "expected_resolution": to_datetime(payload.expected_resolution),
        "status": "open",
        "reported_by": to_object_id(user["id"]),
        "reported_by_name": user.get("name"),
        "created_at": utcnow(),
        "updated_at": utcnow(),
    })
    result = await db[C.site_issues].insert_one(doc)

    await notify(
        db,
        user_ids=await project_manager_ids(db, project),
        title=f"{payload.severity.title()} issue on {project['name']}: {payload.title}",
        body=payload.description[:200],
        tone="critical" if payload.severity in ("high", "critical") else "warning",
        link=f"/app/projects/{payload.project_id}?tab=site-updates",
        project_id=payload.project_id,
    )
    await log_activity(db, actor=user, action="reported a site issue", entity_type="site_issue",
                       entity_id=str(result.inserted_id), project_id=payload.project_id,
                       detail=f"{payload.severity} — {payload.title}")

    return serialize(await db[C.site_issues].find_one({"_id": result.inserted_id}))


@router.patch("/issues/{issue_id}")
async def update_issue(issue_id: str, payload: SiteIssueUpdate, db: Database, user: CurrentUser):
    """The reporter can close their own issue; a manager can close any of them."""
    ensure_permission(user, P.site_issues_view)
    oid = to_object_id(issue_id)
    issue = await db[C.site_issues].find_one({"_id": oid}) if oid else None
    if not issue:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That issue does not exist.")

    scope = await resolve_scope(db, user)
    own = issue.get("reported_by") == to_object_id(user["id"])
    if issue["project_id"] not in scope["project_ids"] or not (
        own or has_permission(user.get("role"), P.site_issues_resolve)
    ):
        raise forbidden()

    changes: dict = {"updated_at": utcnow()}
    if payload.status:
        changes["status"] = payload.status
        if payload.status == "resolved":
            changes["resolved_at"] = utcnow()
            changes["resolved_by_name"] = user.get("name")

    await db[C.site_issues].update_one({"_id": oid}, {"$set": changes})
    if payload.note.strip():
        await db[C.site_issues].update_one({"_id": oid}, {"$push": {"notes": {
            "note": payload.note.strip(),
            "author_name": user.get("name"),
            "created_at": utcnow(),
        }}})

    return serialize(await db[C.site_issues].find_one({"_id": oid}))


# ---------------------------------------------------------------------------
# Daily site report
# ---------------------------------------------------------------------------

@router.get("/reports")
async def list_daily_reports(db: Database, user: CurrentUser, project_id: str | None = None, limit: int = 30):
    scope = await resolve_scope(db, user, project_id)
    if not scope["current_oid"]:
        return []
    cursor = (
        db[C.site_updates]
        .find({"project_id": scope["current_oid"]})
        .sort("date", -1)
        .limit(limit)
    )
    reports = []
    async for doc in cursor:
        report = serialize(doc)
        report["project_name"] = scope["project"]["name"] if scope["project"] else ""
        reports.append(report)
    return reports


@router.post("/reports", status_code=status.HTTP_201_CREATED)
async def submit_daily_report(payload: DailyReportCreate, db: Database, user: CurrentUser):
    """The end-of-day submission: one write, several records, one notification.

    The wizard collects work, headcount, consumption, issues and photographs
    together because that is how the day is remembered. Splitting them into
    separate submissions would mean five chances to stop halfway.
    """
    ensure_permission(user, P.site_updates_create)
    project = await _require_project(db, user, payload.project_id)
    project_oid = to_object_id(payload.project_id)
    when = to_datetime(payload.date) or to_datetime(utcnow().date())

    photo_ids = [pid for pid in map(to_object_id, payload.photo_ids) if pid]
    materials = [m.model_dump() for m in payload.materials_used]

    update_doc = {
        "project_id": project_oid,
        "date": when,
        "work_completed": payload.work_completed,
        "progress_percent": float(payload.progress_percent),
        "workers_count": payload.workers_present,
        "materials_used": materials,
        "issues": payload.issues,
        "weather": payload.weather,
        "photos": [str(pid) for pid in photo_ids],
        "notes": payload.notes,
        "reported_by": to_object_id(user["id"]),
        "reported_by_name": user.get("name"),
        "reported_by_role": user.get("role"),
        "created_at": utcnow(),
    }
    result = await db[C.site_updates].insert_one(update_doc)

    for usage in materials:
        await db[C.materials].update_one(
            {"project_id": project_oid, "name": {"$regex": f"^{usage['name']}$", "$options": "i"}},
            {"$inc": {"used_qty": float(usage["quantity"]), "available_qty": -float(usage["quantity"])}},
        )

    if payload.crews:
        crews = [c.model_dump() for c in payload.crews]
        present = sum(int(c["present"]) for c in crews) or payload.workers_present
        absent = sum(int(c["absent"]) for c in crews) or payload.workers_absent
        await db[C.workforce_logs].update_one(
            {"project_id": project_oid, "date": when},
            {"$set": {"project_id": project_oid, "date": when, "crews": crews, "present": present,
                      "absent": absent, "total": present + absent, "recorded_by": to_object_id(user["id"]),
                      "recorded_by_name": user.get("name"), "updated_at": utcnow()},
             "$setOnInsert": {"created_at": utcnow()}},
            upsert=True,
        )

    # Anything raised in the report becomes a tracked issue, not a line of
    # prose buried in a paragraph a manager may never scroll to.
    issue_id = None
    if payload.issues.strip():
        issue = await db[C.site_issues].insert_one({
            "project_id": project_oid,
            "title": f"Raised in daily report — {project['name']}",
            "severity": payload.issue_severity,
            "description": payload.issues.strip(),
            "location": "",
            "photo_ids": photo_ids,
            "status": "open",
            "source": "daily_report",
            "reported_by": to_object_id(user["id"]),
            "reported_by_name": user.get("name"),
            "created_at": utcnow(),
            "updated_at": utcnow(),
        })
        issue_id = str(issue.inserted_id)

    if photo_ids:
        await db[C.site_photos].update_many(
            {"_id": {"$in": photo_ids}}, {"$set": {"report_id": result.inserted_id}}
        )

    await notify(
        db,
        user_ids=await project_manager_ids(db, project),
        title=f"Daily site report — {project['name']}",
        body=f"{payload.progress_percent:.0f}% · {payload.workers_present} on site · "
             f"{payload.work_completed[:120]}",
        tone="warning" if payload.issues.strip() else "info",
        link=f"/app/projects/{payload.project_id}?tab=site-updates",
        project_id=payload.project_id,
    )
    await log_activity(db, actor=user, action="submitted the daily site report", entity_type="site_update",
                       entity_id=str(result.inserted_id), project_id=payload.project_id,
                       detail=payload.work_completed[:80])

    return {
        "report": serialize(await db[C.site_updates].find_one({"_id": result.inserted_id})),
        "issue_id": issue_id,
        "notified": "project manager",
    }


# ---------------------------------------------------------------------------
# Documents
# ---------------------------------------------------------------------------

@router.get("/documents")
async def site_documents(db: Database, user: CurrentUser, project_id: str | None = None, q: str | None = None):
    """Drawings, BOQs, instructions and safety papers for this site.

    Invoices and contracts are filtered out: they are commercial documents,
    and the field app is not where they belong.
    """
    ensure_permission(user, P.documents_view)
    scope = await resolve_scope(db, user, project_id)
    if not scope["current_oid"]:
        return []

    query: dict = {"project_id": scope["current_oid"], "doc_type": {"$in": list(FIELD_DOCUMENT_TYPES)}}
    if q:
        query["name"] = {"$regex": q, "$options": "i"}

    cursor = db[C.documents].find(query).sort("uploaded_at", -1)
    items = []
    async for doc in cursor:
        document = strip_financials(serialize(doc))
        document.pop("extracted", None)
        document["project_name"] = scope["project"]["name"] if scope["project"] else ""
        items.append(document)
    return items
