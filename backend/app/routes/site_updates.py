from fastapi import APIRouter, Depends, HTTPException, status

from app.core.deps import CurrentUser, Database, require_permission
from app.core.permissions import P
from app.db.mongodb import Collections as C
from app.models.common import serialize, to_object_id, utcnow
from app.schemas.site_update import SiteUpdateCreate, SiteUpdateEdit
from app.services.activity_service import broadcast_ids, log_activity, notify
from app.services.project_service import visibility_filter
from app.utils.dates import to_datetime

router = APIRouter(prefix="/site-updates", tags=["site-updates"])

can_create = Depends(require_permission(P.site_updates_create))
can_edit = Depends(require_permission(P.site_updates_edit))
can_delete = Depends(require_permission(P.site_updates_delete))


@router.get("")
async def index(db: Database, user: CurrentUser, project_id: str | None = None, limit: int = 50):
    visible = [p async for p in db[C.projects].find(visibility_filter(user), {"name": 1})]
    names = {str(p["_id"]): p["name"] for p in visible}

    query: dict = {"project_id": {"$in": [p["_id"] for p in visible]}}
    if project_id and (oid := to_object_id(project_id)):
        query["project_id"] = oid

    cursor = db[C.site_updates].find(query).sort("date", -1).limit(limit)
    items = []
    async for doc in cursor:
        update = serialize(doc)
        update["project_name"] = names.get(str(update["project_id"]), "")
        items.append(update)
    return items


@router.post("", status_code=status.HTTP_201_CREATED, dependencies=[can_create])
async def create(payload: SiteUpdateCreate, db: Database, user: CurrentUser):
    project_oid = to_object_id(payload.project_id)
    project = await db[C.projects].find_one({"_id": project_oid}) if project_oid else None
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That project does not exist.")

    doc = payload.model_dump()
    doc["project_id"] = project_oid
    doc["date"] = to_datetime(doc["date"])
    doc["materials_used"] = [dict(m) for m in doc.get("materials_used", [])]
    doc.update({
        "reported_by": to_object_id(user["id"]),
        "reported_by_name": user.get("name"),
        "reported_by_role": user.get("role"),
        "created_at": utcnow(),
    })

    result = await db[C.site_updates].insert_one(doc)

    # Draw down the materials the site says it consumed.
    for usage in doc["materials_used"]:
        await db[C.materials].update_one(
            {"project_id": project_oid, "name": {"$regex": f"^{usage['name']}$", "$options": "i"}},
            {"$inc": {"used_qty": float(usage["quantity"]), "available_qty": -float(usage["quantity"])}},
        )

    await log_activity(db, actor=user, action="filed a site report", entity_type="site_update",
                       entity_id=str(result.inserted_id), project_id=payload.project_id,
                       detail=f"{payload.progress_percent}% — {payload.work_completed[:60]}")

    if payload.issues.strip():
        await notify(db, user_ids=await broadcast_ids(db, ["admin", "project_manager"]),
                     title=f"Issue raised on {project['name']}", body=payload.issues[:160],
                     tone="warning", link=f"/app/projects/{payload.project_id}?tab=site-updates",
                     project_id=payload.project_id)

    return serialize(await db[C.site_updates].find_one({"_id": result.inserted_id}))


@router.patch("/{update_id}", dependencies=[can_edit])
async def update(update_id: str, payload: SiteUpdateEdit, db: Database, user: CurrentUser):
    """Correct a filed report.

    Only the observations are editable. The project, the date and who filed it
    are what make the report an account of a day on site, so they stay fixed.
    """
    oid = to_object_id(update_id)
    existing = await db[C.site_updates].find_one({"_id": oid}) if oid else None
    if not existing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That site report does not exist.")

    changes = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not changes:
        return serialize(existing)
    changes.update({"edited_at": utcnow(), "edited_by": to_object_id(user["id"]),
                    "edited_by_name": user.get("name")})
    await db[C.site_updates].update_one({"_id": oid}, {"$set": changes})

    await log_activity(db, actor=user, action="edited a site report", entity_type="site_update",
                       entity_id=update_id, project_id=str(existing.get("project_id")),
                       detail=", ".join(k for k in changes if not k.startswith("edited")))
    return serialize(await db[C.site_updates].find_one({"_id": oid}))


@router.delete("/{update_id}", dependencies=[can_delete])
async def remove(update_id: str, db: Database, user: CurrentUser):
    oid = to_object_id(update_id)
    existing = await db[C.site_updates].find_one({"_id": oid}) if oid else None
    if not existing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That site report does not exist.")
    await db[C.site_updates].delete_one({"_id": oid})
    await log_activity(db, actor=user, action="deleted a site report", entity_type="site_update",
                       project_id=str(existing.get("project_id")),
                       detail=existing.get("work_completed", "")[:60])
    return {"ok": True}
