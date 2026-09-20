"""Aggregates that feed the dashboard and the charts."""
from collections import defaultdict
from datetime import datetime, timedelta, timezone

import pandas as pd
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.ai.engine import portfolio_summary, project_budget_metrics, project_schedule_metrics
from app.db.mongodb import Collections as C
from app.models.common import serialize, to_object_id
from app.services.project_service import list_projects, visibility_filter
from app.utils.dates import to_datetime


async def dashboard_snapshot(db: AsyncIOMotorDatabase, user: dict) -> dict:
    projects = await list_projects(db, user)
    project_ids = [to_object_id(p["id"]) for p in projects]

    expenses = [serialize(e) async for e in db[C.expenses].find({"project_id": {"$in": project_ids}})]
    site_updates = [serialize(s) async for s in db[C.site_updates].find({"project_id": {"$in": project_ids}}).sort("date", 1)]

    expenses_by_project = defaultdict(list)
    for expense in expenses:
        expenses_by_project[str(expense["project_id"])].append(expense)
    updates_by_project = defaultdict(list)
    for update in site_updates:
        updates_by_project[str(update["project_id"])].append(update)

    metrics = {
        p["id"]: {
            "schedule": project_schedule_metrics(p, updates_by_project[p["id"]]),
            "budget": project_budget_metrics(p, expenses_by_project[p["id"]]),
        }
        for p in projects
    }

    summary = portfolio_summary(projects, metrics)
    previous = await _previous_period_summary(db, project_ids, summary)

    health = sorted(
        [
            {
                "id": p["id"],
                "name": p["name"],
                "progress": metrics[p["id"]]["schedule"]["actual_progress"],
                "planned": metrics[p["id"]]["schedule"]["planned_progress"],
                "variance": metrics[p["id"]]["schedule"]["variance"],
                "health": metrics[p["id"]]["schedule"]["schedule_health"],
                "status": p.get("status"),
            }
            for p in projects
        ],
        key=lambda row: row["progress"],
        reverse=True,
    )

    return {
        "summary": {**summary, "trends": previous},
        "project_health": health,
        "progress_series": _progress_series(projects, site_updates),
        "spend_series": _spend_series(expenses),
        "status_breakdown": _status_breakdown(projects),
    }


async def _previous_period_summary(db: AsyncIOMotorDatabase, project_ids: list, summary: dict) -> dict:
    """Week-on-week deltas, derived from the site-update history."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    pipeline = [
        {"$match": {"project_id": {"$in": project_ids}, "date": {"$lt": cutoff}}},
        {"$sort": {"date": -1}},
        {"$group": {"_id": "$project_id", "progress": {"$first": "$progress_percent"}}},
    ]
    rows = [row async for row in db[C.site_updates].aggregate(pipeline)]
    last_week = (sum(r["progress"] for r in rows) / len(rows)) if rows else summary["overall_progress"]

    spent_pipeline = [
        {"$match": {"project_id": {"$in": project_ids}, "date": {"$lt": cutoff}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]
    spent_rows = [row async for row in db[C.expenses].aggregate(spent_pipeline)]
    last_spent = spent_rows[0]["total"] if spent_rows else summary["total_spent"]

    return {
        "overall_progress": round(summary["overall_progress"] - last_week, 1),
        "total_spent": round(summary["total_spent"] - last_spent, 2),
    }


def _progress_series(projects: list[dict], site_updates: list[dict]) -> list[dict]:
    """Weekly planned vs actual across the portfolio.

    Both lines are averaged the same way — per project, at the same instant —
    so the gap between them means something. Averaging every site report in a
    window instead would mix a project at 12% with one at 91%.
    """
    if not projects:
        return []

    now = datetime.now(timezone.utc)
    weeks = 8
    points: list[dict] = []

    updates_by_project: dict[str, list[tuple[datetime, float]]] = defaultdict(list)
    for update in site_updates:
        when = to_datetime(update.get("date"))
        if when:
            updates_by_project[str(update["project_id"])].append(
                (when, float(update.get("progress_percent") or 0))
            )
    for rows in updates_by_project.values():
        rows.sort(key=lambda row: row[0])

    for index in range(weeks + 1):
        at = now - timedelta(weeks=weeks - index)
        planned_values: list[float] = []
        actual_values: list[float] = []

        for project in projects:
            start = to_datetime(project.get("start_date"))
            end = to_datetime(project.get("end_date"))
            if not start or not end or start > at:
                continue  # the project had not broken ground at this point

            span = max(1, (end - start).days)
            planned_values.append(max(0.0, min(100.0, (at - start).days / span * 100)))

            reported = [p for when, p in updates_by_project.get(project["id"], []) if when <= at]
            if reported:
                actual_values.append(reported[-1])
            else:
                # No report filed yet: the site has not claimed any progress.
                actual_values.append(0.0)

        if not planned_values:
            continue
        points.append({
            "label": at.strftime("%d %b"),
            "date": at.date().isoformat(),
            "planned": round(sum(planned_values) / len(planned_values), 1),
            "actual": round(sum(actual_values) / len(actual_values), 1),
        })
    return points


def _spend_series(expenses: list[dict]) -> list[dict]:
    if not expenses:
        return []
    frame = pd.DataFrame([
        {"date": to_datetime(e["date"]), "amount": float(e.get("amount") or 0),
         "planned": float(e.get("planned_amount") or 0), "category": e.get("category")}
        for e in expenses if to_datetime(e.get("date"))
    ])
    if frame.empty:
        return []
    frame["month"] = frame["date"].dt.strftime("%b %Y")
    grouped = frame.groupby("month", sort=False)[["amount", "planned"]].sum().reset_index()
    grouped = grouped.tail(8)
    return [
        {"label": row["month"], "actual": round(row["amount"], 2), "planned": round(row["planned"], 2)}
        for _, row in grouped.iterrows()
    ]


def _status_breakdown(projects: list[dict]) -> list[dict]:
    counts: dict[str, int] = defaultdict(int)
    for project in projects:
        counts[project.get("status", "planning")] += 1
    return [{"status": status, "count": count} for status, count in counts.items()]


async def expense_analytics(db: AsyncIOMotorDatabase, project_id: str | None, user: dict) -> dict:
    query: dict = {}
    if project_id and (oid := to_object_id(project_id)):
        query["project_id"] = oid
    else:
        visible = await list_projects(db, user)
        query["project_id"] = {"$in": [to_object_id(p["id"]) for p in visible]}

    expenses = [serialize(e) async for e in db[C.expenses].find(query).sort("date", -1)]
    if not expenses:
        return {"by_category": [], "monthly": [], "by_vendor": [], "total": 0, "planned_total": 0}

    frame = pd.DataFrame([
        {"category": e.get("category"), "vendor": e.get("vendor") or "Unlisted",
         "amount": float(e.get("amount") or 0), "planned": float(e.get("planned_amount") or 0),
         "date": to_datetime(e.get("date"))}
        for e in expenses
    ])

    by_category = frame.groupby("category")[["amount", "planned"]].sum().reset_index()
    by_vendor = frame.groupby("vendor")["amount"].sum().sort_values(ascending=False).head(6).reset_index()
    frame["month"] = frame["date"].dt.strftime("%b")
    monthly = frame.groupby(frame["date"].dt.to_period("M"))[["amount", "planned"]].sum().reset_index()
    monthly["label"] = monthly["date"].dt.strftime("%b %Y")

    return {
        "by_category": [
            {"category": r["category"], "actual": round(r["amount"], 2), "planned": round(r["planned"], 2)}
            for _, r in by_category.iterrows()
        ],
        "monthly": [
            {"label": r["label"], "actual": round(r["amount"], 2), "planned": round(r["planned"], 2)}
            for _, r in monthly.tail(8).iterrows()
        ],
        "by_vendor": [
            {"vendor": r["vendor"], "amount": round(r["amount"], 2)} for _, r in by_vendor.iterrows()
        ],
        "total": round(float(frame["amount"].sum()), 2),
        "planned_total": round(float(frame["planned"].sum()), 2),
    }
