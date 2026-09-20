from fastapi import APIRouter

from app.core.deps import CurrentUser, Database
from app.services.activity_service import recent_activity
from app.services.analytics_service import dashboard_snapshot
from app.services.insight_service import read_insights

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _headline_insights(findings: list[dict], limit: int = 4) -> list[dict]:
    """Lead with one finding of each kind before doubling up.

    Without this the panel fills with four material alerts and the schedule
    slip that actually matters never gets seen.
    """
    seen: set[str] = set()
    headline = []
    for finding in findings:
        kind = finding.get("kind")
        if kind not in seen:
            seen.add(kind)
            headline.append(finding)
        if len(headline) == limit:
            return headline
    for finding in findings:
        if finding not in headline:
            headline.append(finding)
        if len(headline) == limit:
            break
    return headline


@router.get("")
async def dashboard(db: Database, user: CurrentUser):
    snapshot = await dashboard_snapshot(db, user)
    insights = await read_insights(db, user)
    return {
        **snapshot,
        "insights": _headline_insights(insights),
        "insight_counts": {
            "high": sum(1 for f in insights if f.get("severity") == "high"),
            "medium": sum(1 for f in insights if f.get("severity") == "medium"),
            "total": len(insights),
        },
        "activity": await recent_activity(db, limit=8),
    }
