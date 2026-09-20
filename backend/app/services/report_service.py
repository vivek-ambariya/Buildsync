"""Assembles the generated reports."""
from datetime import datetime, timedelta, timezone

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db.mongodb import Collections as C
from app.models.common import ReportType, serialize, to_object_id, utcnow
from app.services.analytics_service import dashboard_snapshot
from app.services.insight_service import read_insights
from app.services.project_service import list_projects, project_metrics
from app.utils.formatting import format_date, format_inr

TITLES = {
    ReportType.daily_site.value: "Daily site report",
    ReportType.weekly_project.value: "Weekly project report",
    ReportType.budget.value: "Budget report",
    ReportType.progress.value: "Progress report",
    ReportType.risk.value: "Risk report",
}


async def generate(
    db: AsyncIOMotorDatabase, user: dict, report_type: str, project_id: str | None, period_days: int
) -> dict:
    projects = await list_projects(db, user)
    if project_id:
        projects = [p for p in projects if p["id"] == project_id]
    since = datetime.now(timezone.utc) - timedelta(days=period_days)

    builders = {
        ReportType.daily_site.value: _daily_site,
        ReportType.weekly_project.value: _weekly_project,
        ReportType.budget.value: _budget,
        ReportType.progress.value: _progress,
        ReportType.risk.value: _risk,
    }
    builder = builders.get(report_type, _weekly_project)
    sections = await builder(db, user, projects, since)

    document = {
        "report_type": report_type,
        "title": TITLES.get(report_type, "Project report"),
        "project_id": project_id,
        "project_name": projects[0]["name"] if project_id and projects else "All projects",
        "period_days": period_days,
        "period_start": since,
        "period_end": utcnow(),
        "generated_by": user.get("name"),
        "generated_by_id": to_object_id(user.get("id")),
        "created_at": utcnow(),
        "sections": sections,
    }
    result = await db[C.reports].insert_one(dict(document))
    document["_id"] = result.inserted_id
    return serialize(document)


async def _project_rows(db, projects):
    rows = []
    for project in projects:
        metrics = await project_metrics(db, project)
        rows.append({"project": project, **metrics})
    return rows


async def _weekly_project(db, user, projects, since):
    rows = await _project_rows(db, projects)
    return [
        {
            "heading": "Portfolio position",
            "kind": "metrics",
            "items": [
                {"label": "Projects", "value": str(len(projects))},
                {"label": "Average completion",
                 "value": f"{sum(r['schedule']['actual_progress'] for r in rows) / max(1, len(rows)):.1f}%"},
                {"label": "Behind plan",
                 "value": str(sum(1 for r in rows if r["schedule"]["variance"] < -5))},
                {"label": "Committed spend",
                 "value": format_inr(sum(r["budget"]["spent"] for r in rows))},
            ],
        },
        {
            "heading": "Project by project",
            "kind": "table",
            "columns": ["Project", "Progress", "Plan", "Variance", "Spend", "Forecast finish"],
            "rows": [
                [
                    r["project"]["name"],
                    f"{r['schedule']['actual_progress']}%",
                    f"{r['schedule']['planned_progress']}%",
                    f"{r['schedule']['variance']:+.1f} pts",
                    format_inr(r["budget"]["spent"]),
                    format_date(r["schedule"]["forecast_end"]),
                ]
                for r in rows
            ],
        },
        {
            "heading": "Work closed this period",
            "kind": "list",
            "items": await _recent_task_titles(db, projects, since),
        },
    ]


async def _daily_site(db, user, projects, since):
    ids = [to_object_id(p["id"]) for p in projects]
    updates = [
        serialize(u) async for u in
        db[C.site_updates].find({"project_id": {"$in": ids}, "date": {"$gte": since}}).sort("date", -1).limit(20)
    ]
    names = {p["id"]: p["name"] for p in projects}
    return [
        {
            "heading": "Site activity",
            "kind": "metrics",
            "items": [
                {"label": "Reports filed", "value": str(len(updates))},
                {"label": "Workers deployed",
                 "value": str(sum(int(u.get("workers_count") or 0) for u in updates))},
                {"label": "Sites reporting",
                 "value": str(len({str(u.get("project_id")) for u in updates}))},
                {"label": "Issues raised",
                 "value": str(sum(1 for u in updates if (u.get("issues") or "").strip()))},
            ],
        },
        {
            "heading": "Reports",
            "kind": "table",
            "columns": ["Date", "Project", "Progress", "Workers", "Work completed"],
            "rows": [
                [
                    str(u.get("date", ""))[:10],
                    names.get(str(u.get("project_id")), "-"),
                    f"{u.get('progress_percent', 0)}%",
                    str(u.get("workers_count", 0)),
                    (u.get("work_completed") or "")[:90],
                ]
                for u in updates
            ],
        },
        {
            "heading": "Issues logged",
            "kind": "list",
            "items": [u["issues"] for u in updates if (u.get("issues") or "").strip()] or ["No issues reported."],
        },
    ]


async def _budget(db, user, projects, since):
    rows = await _project_rows(db, projects)
    total_budget = sum(r["budget"]["budget"] for r in rows)
    total_spent = sum(r["budget"]["spent"] for r in rows)
    categories: dict[str, float] = {}
    for r in rows:
        for category, amount in r["budget"]["by_category"].items():
            categories[category] = categories.get(category, 0) + amount
    return [
        {
            "heading": "Financial position",
            "kind": "metrics",
            "items": [
                {"label": "Approved budget", "value": format_inr(total_budget)},
                {"label": "Committed", "value": format_inr(total_spent)},
                {"label": "Remaining", "value": format_inr(total_budget - total_spent)},
                {"label": "Utilisation",
                 "value": f"{total_spent / total_budget * 100:.1f}%" if total_budget else "0%"},
            ],
        },
        {
            "heading": "Spend by category",
            "kind": "table",
            "columns": ["Category", "Amount", "Share"],
            "rows": [
                [c.replace("_", " ").title(), format_inr(a),
                 f"{a / total_spent * 100:.1f}%" if total_spent else "0%"]
                for c, a in sorted(categories.items(), key=lambda kv: -kv[1])
            ],
        },
        {
            "heading": "Cost performance",
            "kind": "table",
            "columns": ["Project", "Budget", "Spent", "CPI", "Forecast at completion"],
            "rows": [
                [
                    r["project"]["name"], format_inr(r["budget"]["budget"]),
                    format_inr(r["budget"]["spent"]),
                    str(r["budget"]["cost_performance_index"]),
                    format_inr(r["budget"]["forecast_total"]),
                ]
                for r in rows
            ],
        },
    ]


async def _progress(db, user, projects, since):
    snapshot = await dashboard_snapshot(db, user)
    rows = await _project_rows(db, projects)
    return [
        {
            "heading": "Completion",
            "kind": "metrics",
            "items": [
                {"label": "Overall progress", "value": f"{snapshot['summary']['overall_progress']}%"},
                {"label": "Active projects", "value": str(snapshot["summary"]["active_projects"])},
                {"label": "At risk", "value": str(snapshot["summary"]["at_risk_projects"])},
                {"label": "Reporting period", "value": f"{(utcnow() - since).days} days"},
            ],
        },
        {
            "heading": "Planned against actual",
            "kind": "chart",
            "chart": {"type": "line", "data": snapshot["progress_series"]},
        },
        {
            "heading": "Rate of build",
            "kind": "table",
            "columns": ["Project", "Daily rate", "Required rate", "Forecast finish", "Delay"],
            "rows": [
                [
                    r["project"]["name"],
                    f"{r['schedule']['daily_rate']}%/day",
                    f"{r['schedule']['required_rate']}%/day" if r["schedule"]["required_rate"] else "-",
                    format_date(r["schedule"]["forecast_end"]),
                    f"{r['schedule']['delay_days']} days" if r["schedule"]["delay_days"] else "On time",
                ]
                for r in rows
            ],
        },
    ]


async def _risk(db, user, projects, since):
    insights = await read_insights(db, user)
    by_severity = {"high": [], "medium": [], "low": []}
    for insight in insights:
        by_severity.setdefault(insight.get("severity", "low"), []).append(insight)
    return [
        {
            "heading": "Risk position",
            "kind": "metrics",
            "items": [
                {"label": "Open findings", "value": str(len(insights))},
                {"label": "High severity", "value": str(len(by_severity["high"]))},
                {"label": "Medium severity", "value": str(len(by_severity["medium"]))},
                {"label": "Projects covered", "value": str(len(projects))},
            ],
        },
        {
            "heading": "Findings",
            "kind": "table",
            "columns": ["Severity", "Project", "Finding", "Measure", "Action"],
            "rows": [
                [
                    i.get("severity", "").title(), i.get("project_name", ""),
                    i.get("title", ""), f"{i.get('metric_label')}: {i.get('metric_value')}",
                    i.get("recommendation", ""),
                ]
                for i in insights
            ],
        },
    ]


async def _recent_task_titles(db, projects, since) -> list[str]:
    """Closed-out work, named by project.

    The same task title appears on every project, so a bare list reads as
    duplicates. Each line has to say which site it was closed on.
    """
    names = {p["id"]: p["name"] for p in projects}
    ids = [to_object_id(p["id"]) for p in projects]
    cursor = db[C.tasks].find(
        {"project_id": {"$in": ids}, "status": "completed", "updated_at": {"$gte": since}}
    ).sort("updated_at", -1).limit(18)

    titles = [
        f"{names.get(str(doc['project_id']), 'Project')}: {doc.get('title')} "
        f"({doc.get('phase', 'General')})"
        async for doc in cursor
    ]
    return titles or ["No tasks were closed out in this period."]
