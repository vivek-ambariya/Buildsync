"""The admin control centre: platform-wide reads that no other role may make.

`require_admin` is attached to the router, not to each handler, so a route
added to this file is guarded by construction. There is no way to add an
endpoint here and forget the check.
"""
from fastapi import APIRouter, Depends, Query

from app.core.deps import CurrentUser, Database, require_admin, user_permissions
from app.services.admin_service import (
    activity_log,
    ai_overview,
    system_analytics,
    system_overview,
    system_status,
)
from app.services.insight_service import generate_insights

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/overview")
async def overview(db: Database, user: CurrentUser):
    """The KPI header: system state, people, projects, tasks, budget."""
    return await system_overview(db)


@router.get("/analytics")
async def analytics(db: Database, user: CurrentUser):
    """Distributions and totals across the whole platform."""
    return await system_analytics(db)


@router.get("/ai")
async def intelligence(db: Database, user: CurrentUser):
    """Every project scored by the trained delay model, plus open findings."""
    return await ai_overview(db)


@router.post("/ai/refresh")
async def refresh_intelligence(db: Database, user: CurrentUser):
    """Re-run the rules engine over the portfolio, then re-read the scores."""
    findings = await generate_insights(db, user)
    overview = await ai_overview(db)
    return {**overview, "generated": len(findings)}


@router.get("/activity")
async def activity(
    db: Database,
    user: CurrentUser,
    actor_id: str | None = None,
    entity_type: str | None = None,
    project_id: str | None = None,
    q: str | None = None,
    days: int | None = Query(default=None, ge=1, le=365),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=40, ge=1, le=200),
):
    """The administrative audit trail, newest first."""
    return await activity_log(
        db, actor_id=actor_id, entity_type=entity_type, project_id=project_id,
        q=q, days=days, page=page, page_size=page_size,
    )


@router.get("/system")
async def system(db: Database, user: CurrentUser):
    """Runtime configuration, as capability flags. Never secrets."""
    return {
        "status": await system_status(db),
        "permissions": user_permissions(user),
    }
