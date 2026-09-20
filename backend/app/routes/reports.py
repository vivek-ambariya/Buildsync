from fastapi import APIRouter, Depends, HTTPException, status

from app.core.deps import CurrentUser, Database, require_permission
from app.core.permissions import P
from app.db.mongodb import Collections as C
from app.models.common import serialize, to_object_id
from app.schemas.misc import ReportCreate
from app.services.activity_service import log_activity
from app.core.permissions import is_admin
from app.services.project_service import visible_project_ids
from app.services.report_service import TITLES, generate

router = APIRouter(prefix="/reports", tags=["reports"])

can_view = Depends(require_permission(P.reports_view))
can_generate = Depends(require_permission(P.reports_generate))
can_delete = Depends(require_permission(P.reports_delete))


@router.get("/types")
async def report_types():
    return [{"value": key, "label": label} for key, label in TITLES.items()]


async def _readable(db: Database, user: dict) -> dict:
    """Which stored reports this person may open.

    A report is a snapshot of whatever its author could see when they ran it,
    so a portfolio-wide one can quote projects the reader is not on. An admin
    reads everything; everyone else reads their own reports and those written
    about a project they can reach.
    """
    if is_admin(user):
        return {}
    ids = [str(oid) for oid in await visible_project_ids(db, user)]
    return {"$or": [
        {"generated_by_id": to_object_id(user["id"])},
        {"project_id": {"$in": ids}},
    ]}


@router.get("", dependencies=[can_view])
async def index(db: Database, user: CurrentUser, limit: int = 30):
    query = await _readable(db, user)
    cursor = db[C.reports].find(query, {"sections": 0}).sort("created_at", -1).limit(limit)
    return [serialize(doc) async for doc in cursor]


@router.get("/{report_id}", dependencies=[can_view])
async def detail(report_id: str, db: Database, user: CurrentUser):
    oid = to_object_id(report_id)
    doc = await db[C.reports].find_one({"_id": oid, **await _readable(db, user)}) if oid else None
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That report does not exist.")
    return serialize(doc)


@router.post("/generate", status_code=status.HTTP_201_CREATED, dependencies=[can_generate])
async def create(payload: ReportCreate, db: Database, user: CurrentUser):
    report = await generate(db, user, payload.report_type.value, payload.project_id, payload.period_days)
    await log_activity(db, actor=user, action="generated report", entity_type="report",
                       entity_id=report["id"], project_id=payload.project_id, detail=report["title"])
    return report


@router.delete("/{report_id}", dependencies=[can_delete])
async def remove(report_id: str, db: Database, user: CurrentUser):
    oid = to_object_id(report_id)
    doc = await db[C.reports].find_one({"_id": oid, **await _readable(db, user)}) if oid else None
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That report does not exist.")
    await db[C.reports].delete_one({"_id": oid})
    await log_activity(db, actor=user, action="deleted report", entity_type="report",
                       entity_id=report_id, detail=doc.get("title", ""))
    return {"ok": True}
