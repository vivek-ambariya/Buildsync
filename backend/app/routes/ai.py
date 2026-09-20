from fastapi import APIRouter, HTTPException, status

from app.ai.assistant import SUGGESTED_PROMPTS, ask, build_context
from app.ai.engine import project_schedule_metrics
from app.ai.llm_provider import get_provider
from app.core.deps import CurrentUser, Database
from app.db.mongodb import Collections as C
from app.models.common import serialize, to_object_id, utcnow
from app.schemas.misc import AssistantRequest
from app.services.insight_service import acknowledge, generate_insights, read_insights
from app.services.project_service import list_projects, visibility_filter

router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/insights")
async def insights(db: Database, user: CurrentUser, project_id: str | None = None):
    findings = await read_insights(db, user, project_id)
    grouped: dict[str, list] = {"schedule": [], "budget": [], "material": [], "quality": [], "positive": []}
    for finding in findings:
        grouped.setdefault(finding.get("kind", "schedule"), []).append(finding)
    return {
        "findings": findings,
        "grouped": grouped,
        "counts": {
            "high": sum(1 for f in findings if f.get("severity") == "high"),
            "medium": sum(1 for f in findings if f.get("severity") == "medium"),
            "low": sum(1 for f in findings if f.get("severity") == "low"),
        },
    }


@router.post("/insights/refresh")
async def refresh(db: Database, user: CurrentUser, project_id: str | None = None):
    findings = await generate_insights(db, user, project_id)
    return {"findings": findings, "generated": len(findings)}


@router.post("/insights/{insight_id}/acknowledge")
async def ack(insight_id: str, db: Database, user: CurrentUser):
    if not await acknowledge(db, insight_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That finding is no longer open.")
    return {"ok": True}


@router.get("/assistant/suggestions")
async def suggestions(db: Database, user: CurrentUser):
    provider = get_provider()
    projects = await list_projects(db, user)
    prompts = list(SUGGESTED_PROMPTS)

    if projects:
        # Name the project that is genuinely furthest behind. Suggesting
        # "why is X behind" about a project that is ahead of plan makes the
        # assistant look like it has not read the data.
        worst = min(projects, key=lambda p: project_schedule_metrics(p)["variance"])
        prompts[4] = f"Why is {worst['name']} behind schedule?"

    return {"prompts": prompts, "engine": provider.name, "hosted_model": provider.available}


@router.post("/assistant")
async def assistant(payload: AssistantRequest, db: Database, user: CurrentUser):
    visible = [p async for p in db[C.projects].find(visibility_filter(user), {"_id": 1})]
    ids = [p["_id"] for p in visible]

    projects = await list_projects(db, user)
    materials = [serialize(m) async for m in db[C.materials].find({"project_id": {"$in": ids}})]
    tasks = [serialize(t) async for t in db[C.tasks].find({"project_id": {"$in": ids}})]
    expenses = [serialize(e) async for e in db[C.expenses].find({"project_id": {"$in": ids}})]

    if not projects:
        return {
            "answer": "There are no projects in your portfolio yet. Create one and I can start "
                      "tracking its schedule, spend and materials.",
            "cards": [], "chart": None, "sources": [], "engine": "local",
        }

    context = build_context(projects, materials, tasks, expenses)
    result = await ask(payload.message, context)

    await db[C.conversations].update_one(
        {"user_id": to_object_id(user["id"]), "_id": to_object_id(payload.conversation_id)}
        if payload.conversation_id else {"user_id": to_object_id(user["id"]), "active": True},
        {
            "$push": {"messages": {"$each": [
                {"role": "user", "content": payload.message, "at": utcnow()},
                {"role": "assistant", "content": result["answer"], "at": utcnow()},
            ]}},
            "$set": {"updated_at": utcnow(), "active": True, "user_id": to_object_id(user["id"])},
        },
        upsert=True,
    )
    return result


@router.get("/assistant/history")
async def history(db: Database, user: CurrentUser):
    doc = await db[C.conversations].find_one(
        {"user_id": to_object_id(user["id"]), "active": True}
    )
    return serialize(doc) if doc else {"messages": []}


@router.delete("/assistant/history")
async def clear_history(db: Database, user: CurrentUser):
    await db[C.conversations].delete_many({"user_id": to_object_id(user["id"])})
    return {"ok": True}
