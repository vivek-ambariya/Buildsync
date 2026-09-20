from fastapi import APIRouter, HTTPException, status

from app.core.deps import CurrentUser, Database
from app.db.mongodb import Collections as C
from app.models.common import serialize, to_object_id
from app.schemas.misc import ReportCreate
from app.services.activity_service import log_activity
from app.services.report_service import TITLES, generate

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/types")
async def report_types():
    return [{"value": key, "label": label} for key, label in TITLES.items()]


@router.get("")
async def index(db: Database, user: CurrentUser, limit: int = 30):
    cursor = db[C.reports].find({}, {"sections": 0}).sort("created_at", -1).limit(limit)
    return [serialize(doc) async for doc in cursor]


@router.get("/{report_id}")
async def detail(report_id: str, db: Database, user: CurrentUser):
    doc = await db[C.reports].find_one({"_id": to_object_id(report_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That report does not exist.")
    return serialize(doc)


@router.post("/generate", status_code=status.HTTP_201_CREATED)
async def create(payload: ReportCreate, db: Database, user: CurrentUser):
    report = await generate(db, user, payload.report_type.value, payload.project_id, payload.period_days)
    await log_activity(db, actor=user, action="generated report", entity_type="report",
                       entity_id=report["id"], project_id=payload.project_id, detail=report["title"])
    return report


@router.delete("/{report_id}")
async def remove(report_id: str, db: Database, user: CurrentUser):
    result = await db[C.reports].delete_one({"_id": to_object_id(report_id)})
    if result.deleted_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That report does not exist.")
    return {"ok": True}
