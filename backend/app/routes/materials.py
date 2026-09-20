from fastapi import APIRouter, Depends, HTTPException, status

from app.core.deps import CurrentUser, Database, require_permission
from app.core.permissions import P
from app.db.mongodb import Collections as C
from app.models.common import serialize, to_object_id, utcnow
from app.schemas.material import MaterialCreate, MaterialUpdate
from app.services.activity_service import broadcast_ids, log_activity, notify
from app.services.project_service import visibility_filter
from app.ai.engine import material_metrics, project_schedule_metrics

router = APIRouter(prefix="/materials", tags=["materials"])

can_create = Depends(require_permission(P.materials_create))
can_edit = Depends(require_permission(P.materials_edit))
can_delete = Depends(require_permission(P.materials_delete))


async def _elapsed_days(db, project_id) -> int:
    project = await db[C.projects].find_one({"_id": project_id})
    if not project:
        return 30
    return project_schedule_metrics(serialize(project))["elapsed_days"]


@router.get("")
async def index(db: Database, user: CurrentUser, project_id: str | None = None, at_risk: bool = False):
    visible = [p async for p in db[C.projects].find(visibility_filter(user), {"name": 1})]
    names = {str(p["_id"]): p["name"] for p in visible}

    query: dict = {"project_id": {"$in": [p["_id"] for p in visible]}}
    if project_id and (oid := to_object_id(project_id)):
        query["project_id"] = oid

    elapsed_cache: dict[str, int] = {}
    items = []
    async for doc in db[C.materials].find(query).sort("name", 1):
        material = serialize(doc)
        pid = str(material["project_id"])
        if pid not in elapsed_cache:
            elapsed_cache[pid] = await _elapsed_days(db, doc["project_id"])
        metrics = material_metrics(material, elapsed_cache[pid])
        material.update({"metrics": metrics, "status": metrics["status"], "project_name": names.get(pid, "")})
        if at_risk and metrics["status"] == "healthy":
            continue
        items.append(material)
    return items


@router.post("", status_code=status.HTTP_201_CREATED, dependencies=[can_create])
async def create(payload: MaterialCreate, db: Database, user: CurrentUser):
    doc = payload.model_dump()
    doc["project_id"] = to_object_id(doc["project_id"])
    if not doc["project_id"]:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That project does not exist.")
    doc["status"] = doc["status"].value if hasattr(doc.get("status"), "value") else (doc.get("status") or "healthy")
    doc.update({"created_at": utcnow(), "updated_at": utcnow()})

    result = await db[C.materials].insert_one(doc)
    await log_activity(db, actor=user, action="added material", entity_type="material",
                       entity_id=str(result.inserted_id), project_id=payload.project_id, detail=payload.name)
    return serialize(await db[C.materials].find_one({"_id": result.inserted_id}))


@router.patch("/{material_id}", dependencies=[can_edit])
async def update(material_id: str, payload: MaterialUpdate, db: Database, user: CurrentUser):
    oid = to_object_id(material_id)
    existing = await db[C.materials].find_one({"_id": oid}) if oid else None
    if not existing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That material does not exist.")

    changes = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    changes["updated_at"] = utcnow()
    await db[C.materials].update_one({"_id": oid}, {"$set": changes})

    updated = serialize(await db[C.materials].find_one({"_id": oid}))
    metrics = material_metrics(updated, await _elapsed_days(db, existing["project_id"]))
    await db[C.materials].update_one({"_id": oid}, {"$set": {"status": metrics["status"]}})

    if metrics["status"] == "critical":
        await notify(db, user_ids=await broadcast_ids(db, ["admin", "project_manager"]),
                     title=f"{updated['name']} stock critical",
                     body=f"{metrics['days_of_cover']:.0f} days of cover left. Reorder by {metrics['reorder_by']}.",
                     tone="critical", project_id=str(existing["project_id"]))

    await log_activity(db, actor=user, action="updated material", entity_type="material",
                       entity_id=material_id, project_id=str(existing["project_id"]),
                       detail=updated.get("name", ""))
    updated.update({"metrics": metrics, "status": metrics["status"]})
    return updated


@router.delete("/{material_id}", dependencies=[can_delete])
async def remove(material_id: str, db: Database, user: CurrentUser):
    oid = to_object_id(material_id)
    existing = await db[C.materials].find_one({"_id": oid}) if oid else None
    if not existing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That material does not exist.")
    await db[C.materials].delete_one({"_id": oid})
    await log_activity(db, actor=user, action="removed material", entity_type="material",
                       project_id=str(existing["project_id"]), detail=existing.get("name", ""))
    return {"ok": True}
