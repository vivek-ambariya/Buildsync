from fastapi import APIRouter, Depends, HTTPException, status

from app.core.deps import CurrentUser, Database, require_permission
from app.core.permissions import P
from app.db.mongodb import Collections as C
from app.models.common import serialize, to_object_id, utcnow
from app.schemas.expense import ExpenseCreate, ExpenseUpdate
from app.services.activity_service import log_activity
from app.services.analytics_service import expense_analytics
from app.services.project_service import visibility_filter
from app.utils.dates import to_datetime

router = APIRouter(prefix="/expenses", tags=["expenses"])

# A site engineer may submit an expense but not edit or remove one, so
# what they file stays auditable by whoever owns the budget.
can_view = Depends(require_permission(P.expenses_view))
can_create = Depends(require_permission(P.expenses_create))
can_edit = Depends(require_permission(P.expenses_edit))
can_delete = Depends(require_permission(P.expenses_delete))


@router.get("", dependencies=[can_view])
async def index(db: Database, user: CurrentUser, project_id: str | None = None,
                category: str | None = None, limit: int = 200):
    visible = [p async for p in db[C.projects].find(visibility_filter(user), {"name": 1})]
    names = {str(p["_id"]): p["name"] for p in visible}

    query: dict = {"project_id": {"$in": [p["_id"] for p in visible]}}
    if project_id and (oid := to_object_id(project_id)):
        query["project_id"] = oid
    if category:
        query["category"] = category

    cursor = db[C.expenses].find(query).sort("date", -1).limit(limit)
    items = []
    async for doc in cursor:
        expense = serialize(doc)
        expense["project_name"] = names.get(str(expense["project_id"]), "")
        items.append(expense)
    return items


@router.get("/analytics", dependencies=[can_view])
async def analytics(db: Database, user: CurrentUser, project_id: str | None = None):
    return await expense_analytics(db, project_id, user)


@router.post("", status_code=status.HTTP_201_CREATED, dependencies=[can_create])
async def create(payload: ExpenseCreate, db: Database, user: CurrentUser):
    doc = payload.model_dump()
    doc["project_id"] = to_object_id(doc["project_id"])
    if not doc["project_id"]:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That project does not exist.")
    doc["category"] = doc["category"].value if hasattr(doc["category"], "value") else doc["category"]
    doc["date"] = to_datetime(doc["date"])
    doc.update({"created_at": utcnow(), "recorded_by": to_object_id(user["id"])})

    result = await db[C.expenses].insert_one(doc)
    await log_activity(db, actor=user, action="recorded expense", entity_type="expense",
                       entity_id=str(result.inserted_id), project_id=payload.project_id,
                       detail=f"{payload.title} — {payload.amount:,.0f}")
    return serialize(await db[C.expenses].find_one({"_id": result.inserted_id}))


@router.patch("/{expense_id}", dependencies=[can_edit])
async def update(expense_id: str, payload: ExpenseUpdate, db: Database, user: CurrentUser):
    oid = to_object_id(expense_id)
    existing = await db[C.expenses].find_one({"_id": oid}) if oid else None
    if not existing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That expense does not exist.")

    changes = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if "date" in changes:
        changes["date"] = to_datetime(changes["date"])
    if "category" in changes and hasattr(changes["category"], "value"):
        changes["category"] = changes["category"].value
    await db[C.expenses].update_one({"_id": oid}, {"$set": changes})
    return serialize(await db[C.expenses].find_one({"_id": oid}))


@router.delete("/{expense_id}", dependencies=[can_delete])
async def remove(expense_id: str, db: Database, user: CurrentUser):
    oid = to_object_id(expense_id)
    existing = await db[C.expenses].find_one({"_id": oid}) if oid else None
    if not existing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That expense does not exist.")
    await db[C.expenses].delete_one({"_id": oid})
    await log_activity(db, actor=user, action="deleted expense", entity_type="expense",
                       project_id=str(existing["project_id"]), detail=existing.get("title", ""))
    return {"ok": True}
