"""Construction intelligence engine.

Turns raw project/task/material/expense records into ranked, explainable risk
findings. Every number a finding quotes is computed here, so the UI and the
assistant always agree with each other.

Uses pandas for the tabular work and a small scikit-learn regression to
extrapolate the progress trend from reported site updates.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression

from app.models.common import InsightKind, Severity
from app.utils.dates import elapsed_fraction, to_datetime
from app.utils.formatting import format_date, format_inr

# Tuning constants, kept together so they can be reasoned about as a policy.
SCHEDULE_HIGH_VARIANCE = -12.0   # percentage points behind plan
SCHEDULE_MED_VARIANCE = -5.0
BUDGET_HIGH_OVERRUN = 15.0       # percent over the value-adjusted plan
BUDGET_MED_OVERRUN = 7.0
# Stock is judged against supplier lead time, not against a fixed number of
# days: a material with a three-week lead time needs far more cover on site
# than one that arrives the next morning.
MATERIAL_LOW_COVER_MULTIPLE = 1.75


def _now() -> datetime:
    return datetime.now(timezone.utc)


# --------------------------------------------------------------------------
# Per-domain metrics
# --------------------------------------------------------------------------

def project_schedule_metrics(project: dict, site_updates: list[dict] | None = None) -> dict:
    """Planned vs actual progress, variance, and a forecast completion date."""
    start = to_datetime(project.get("start_date"))
    end = to_datetime(project.get("end_date"))
    now = _now()

    # Planned progress is always derived from where the schedule says the
    # project should be today, so it cannot drift out of date in the database.
    planned = round(elapsed_fraction(start, end, now) * 100, 1)
    actual = float(project.get("actual_progress") or 0)
    variance = round(actual - float(planned), 1)

    elapsed_days = max(1, (now - start).days) if start else 1
    total_days = max(1, (end - start).days) if (start and end) else 1

    observed_rate = actual / elapsed_days                       # %/day achieved
    trend_rate = _trend_rate(site_updates) or observed_rate     # %/day from recent reports
    rate = max(trend_rate, 0.01)

    remaining = max(0.0, 100.0 - actual)
    days_to_finish = remaining / rate
    forecast_end = now + timedelta(days=days_to_finish)
    delay_days = (forecast_end.date() - end.date()).days if end else 0

    return {
        "planned_progress": round(float(planned), 1),
        "actual_progress": round(actual, 1),
        "variance": variance,
        "elapsed_days": elapsed_days,
        "total_days": total_days,
        "daily_rate": round(rate, 3),
        "required_rate": round(remaining / max(1, (end - now).days), 3) if end and end > now else None,
        "forecast_end": forecast_end.date().isoformat(),
        "delay_days": max(0, delay_days),
        "schedule_health": _health_from_variance(variance),
    }


def _trend_rate(site_updates: list[dict] | None) -> float | None:
    """Fit progress-over-time from site updates to get a %/day trend.

    Needs at least three reports; below that the fit is noise and we say so by
    returning None, which makes the caller fall back to the average rate.
    """
    if not site_updates or len(site_updates) < 3:
        return None
    rows = []
    for u in site_updates:
        dt = to_datetime(u.get("date"))
        if dt is None:
            continue
        rows.append({"t": dt.timestamp() / 86400, "p": float(u.get("progress_percent") or 0)})
    if len(rows) < 3:
        return None

    frame = pd.DataFrame(rows).sort_values("t")
    frame = frame.tail(12)  # recent behaviour predicts better than project history
    x = frame[["t"]].to_numpy()
    y = frame["p"].to_numpy()
    if np.ptp(x) < 1:
        return None

    model = LinearRegression().fit(x, y)
    slope = float(model.coef_[0])
    return slope if slope > 0 else None


def project_budget_metrics(project: dict, expenses: list[dict]) -> dict:
    """Spend against budget, earned-value style cost performance."""
    budget = float(project.get("budget") or 0)
    frame = pd.DataFrame(expenses) if expenses else pd.DataFrame(columns=["amount", "category"])
    spent = float(frame["amount"].sum()) if not frame.empty else 0.0
    remaining = budget - spent

    actual = float(project.get("actual_progress") or 0)
    earned_value = budget * (actual / 100)
    # >1 means each rupee is buying more progress than planned.
    cpi = (earned_value / spent) if spent > 0 else 1.0
    overrun_pct = ((spent - earned_value) / earned_value * 100) if earned_value > 0 else 0.0
    forecast_total = (budget / cpi) if cpi > 0 else budget

    by_category = (
        frame.groupby("category")["amount"].sum().sort_values(ascending=False).to_dict()
        if not frame.empty
        else {}
    )

    return {
        "budget": budget,
        "spent": round(spent, 2),
        "remaining": round(remaining, 2),
        "burn_percent": round(spent / budget * 100, 1) if budget else 0.0,
        "earned_value": round(earned_value, 2),
        "cost_performance_index": round(cpi, 2),
        "overrun_percent": round(overrun_pct, 1),
        "forecast_total": round(forecast_total, 2),
        "by_category": {k: round(float(v), 2) for k, v in by_category.items()},
    }


def material_metrics(material: dict, elapsed_days: int) -> dict:
    """Days of cover left, based on how fast the material is actually going out."""
    available = float(material.get("available_qty") or 0)
    used = float(material.get("used_qty") or 0)
    required = float(material.get("required_qty") or 0)
    lead_time = float(material.get("lead_time_days") or 7)

    burn = used / max(1, elapsed_days)
    days_cover = (available / burn) if burn > 0 else 999.0
    still_needed = max(0.0, required - used)
    shortfall = max(0.0, still_needed - available)

    if days_cover < lead_time:
        # A replacement order placed today would arrive after the site runs dry.
        status = "critical"
    elif days_cover < lead_time * MATERIAL_LOW_COVER_MULTIPLE:
        status = "low_stock"
    else:
        status = "healthy"

    return {
        "burn_rate": round(burn, 3),
        "days_of_cover": round(min(days_cover, 999), 1),
        "lead_time_days": lead_time,
        "still_needed": round(still_needed, 2),
        "shortfall": round(shortfall, 2),
        "coverage_percent": round(available / still_needed * 100, 1) if still_needed else 100.0,
        "status": status,
        "reorder_by": (_now() + timedelta(days=max(0.0, days_cover - lead_time))).date().isoformat(),
    }


def _health_from_variance(variance: float) -> str:
    if variance <= SCHEDULE_HIGH_VARIANCE:
        return "critical"
    if variance <= SCHEDULE_MED_VARIANCE:
        return "warning"
    return "healthy"


# --------------------------------------------------------------------------
# Finding generation
# --------------------------------------------------------------------------

def _finding(**kwargs) -> dict:
    """One finding. `impact` (0-100) orders findings within a severity band so
    a 16-point schedule slip outranks two overdue tasks."""
    base = {
        "generated_at": _now(),
        "confidence": 0.8,
        "impact": 50,
        "acknowledged": False,
    }
    base.update(kwargs)
    return base


def analyse_project(
    project: dict,
    tasks: list[dict],
    materials: list[dict],
    expenses: list[dict],
    site_updates: list[dict],
) -> list[dict]:
    """Produce every finding for one project, ordered by severity."""
    findings: list[dict] = []
    pid = str(project.get("id") or project.get("_id"))
    pname = project.get("name", "Project")

    schedule = project_schedule_metrics(project, site_updates)
    budget = project_budget_metrics(project, expenses)

    # --- Schedule ---------------------------------------------------------
    variance = schedule["variance"]
    if variance <= SCHEDULE_MED_VARIANCE:
        severity = Severity.high if variance <= SCHEDULE_HIGH_VARIANCE else Severity.medium
        findings.append(
            _finding(
                project_id=pid,
                project_name=pname,
                kind=InsightKind.schedule.value,
                severity=severity.value,
                title=f"Progress is {abs(variance)} points behind plan",
                summary=(
                    f"Actual progress is {schedule['actual_progress']}% against a planned "
                    f"{schedule['planned_progress']}%, a variance of {variance} points. At the "
                    f"current rate of {schedule['daily_rate']}% a day, completion lands around "
                    f"{format_date(schedule['forecast_end'])}."
                ),
                metric_label="Progress variance",
                metric_value=f"{variance}%",
                secondary_label="Forecast overrun",
                secondary_value=f"{schedule['delay_days']} days",
                recommendation=(
                    "Re-sequence the critical path and add a second shift on the lagging phase."
                    if severity == Severity.high
                    else "Review the lagging tasks in this week's site meeting before the gap widens."
                ),
                confidence=0.86 if len(site_updates) >= 3 else 0.7,
                impact=min(100, int(abs(variance) * 4) + schedule["delay_days"] // 2),
                evidence={"schedule": schedule},
            )
        )

    # --- Task-level bottlenecks ------------------------------------------
    overdue = [
        t for t in tasks
        if (to_datetime(t.get("deadline")) or _now()) < _now() and t.get("status") != "completed"
    ]
    if len(overdue) >= 2:
        worst = sorted(overdue, key=lambda t: to_datetime(t.get("deadline")) or _now())[0]
        days_over = (_now() - (to_datetime(worst.get("deadline")) or _now())).days
        findings.append(
            _finding(
                project_id=pid,
                project_name=pname,
                kind=InsightKind.schedule.value,
                severity=Severity.medium.value if len(overdue) < 4 else Severity.high.value,
                title=f"{len(overdue)} tasks are past their deadline",
                summary=(
                    f"\"{worst.get('title')}\" is the oldest, {days_over} days over and "
                    f"{worst.get('progress', 0)}% done. Unfinished work here holds up everything "
                    f"sequenced after it."
                ),
                metric_label="Overdue tasks",
                metric_value=str(len(overdue)),
                secondary_label="Oldest overdue",
                secondary_value=f"{days_over} days",
                recommendation="Reassign or split the oldest task so the dependent phases can start.",
                confidence=0.95,
                impact=min(88, len(overdue) * 11 + days_over),
                evidence={"task_ids": [str(t.get("id") or t.get("_id")) for t in overdue[:8]]},
            )
        )

    # --- Budget -----------------------------------------------------------
    if budget["overrun_percent"] >= BUDGET_MED_OVERRUN and budget["spent"] > 0:
        severity = Severity.high if budget["overrun_percent"] >= BUDGET_HIGH_OVERRUN else Severity.medium
        findings.append(
            _finding(
                project_id=pid,
                project_name=pname,
                kind=InsightKind.budget.value,
                severity=severity.value,
                title="Spending is ahead of the work delivered",
                summary=(
                    f"{format_inr(budget['spent'])} spent has produced {schedule['actual_progress']}% "
                    f"of the build, worth {format_inr(budget['earned_value'])}. That is "
                    f"{budget['overrun_percent']}% over, and projects a final cost of "
                    f"{format_inr(budget['forecast_total'])} against a "
                    f"{format_inr(budget['budget'])} budget."
                ),
                metric_label="Cost variance",
                metric_value=f"+{budget['overrun_percent']}%",
                secondary_label="Forecast at completion",
                secondary_value=format_inr(budget["forecast_total"]),
                recommendation="Freeze non-critical purchase orders and re-quote the largest open category.",
                confidence=0.82,
                impact=min(100, int(budget["overrun_percent"] * 4)),
                evidence={"budget": budget},
            )
        )
    elif budget["budget"] and budget["burn_percent"] < schedule["actual_progress"] + 3:
        findings.append(
            _finding(
                project_id=pid,
                project_name=pname,
                kind=InsightKind.positive.value,
                severity=Severity.low.value,
                title="Spending is tracking to plan",
                summary=(
                    f"{budget['burn_percent']}% of budget is committed against "
                    f"{schedule['actual_progress']}% completion, leaving "
                    f"{format_inr(budget['remaining'])} available."
                ),
                metric_label="Budget used",
                metric_value=f"{budget['burn_percent']}%",
                secondary_label="Remaining",
                secondary_value=format_inr(budget["remaining"]),
                recommendation="No action needed. Keep the current procurement cadence.",
                confidence=0.9,
                impact=8,
                evidence={"budget": budget},
            )
        )

    # --- Materials --------------------------------------------------------
    # A finding per low material would bury everything else, so only the
    # three closest to stopping work are raised.
    at_risk = [
        (m, material_metrics(m, schedule["elapsed_days"]))
        for m in materials
    ]
    at_risk = sorted(
        [pair for pair in at_risk if pair[1]["status"] != "healthy"],
        key=lambda pair: pair[1]["days_of_cover"],
    )[:3]
    for material, metrics in at_risk:
        severity = Severity.high if metrics["status"] == "critical" else Severity.medium
        findings.append(
            _finding(
                project_id=pid,
                project_name=pname,
                kind=InsightKind.material.value,
                severity=severity.value,
                title=f"{material.get('name')} runs out in {metrics['days_of_cover']:.0f} days",
                summary=(
                    f"{material.get('available_qty')} {material.get('unit')} on site against "
                    f"{metrics['burn_rate']} {material.get('unit')} a day of consumption. "
                    f"{material.get('supplier') or 'The supplier'} needs "
                    f"{metrics['lead_time_days']:.0f} days to deliver, so the order has to go out by "
                    f"{format_date(metrics['reorder_by'])} to avoid a stoppage. "
                    f"{metrics['still_needed']:.0f} {material.get('unit')} are still needed to finish."
                ),
                metric_label="Days of cover",
                metric_value=f"{metrics['days_of_cover']:.0f}",
                secondary_label="Lead time",
                secondary_value=f"{metrics['lead_time_days']:.0f} days",
                recommendation=f"Raise a purchase order for {material.get('name')} before {format_date(metrics['reorder_by'])}.",
                confidence=0.88,
                impact=min(96, int((metrics["lead_time_days"] - metrics["days_of_cover"]) * 5) + 35),
                evidence={"material_id": str(material.get("id") or material.get("_id")), **metrics},
            )
        )

    findings.sort(key=rank_key)
    return findings


SEVERITY_RANK = {"high": 0, "medium": 1, "low": 2}


def rank_key(finding: dict) -> tuple:
    return (
        SEVERITY_RANK.get(finding.get("severity"), 3),
        -finding.get("impact", 0),
        -finding.get("confidence", 0),
    )


def portfolio_summary(projects: list[dict], all_metrics: dict[str, dict]) -> dict:
    """Roll project metrics up into the numbers the dashboard header shows."""
    if not projects:
        return {
            "active_projects": 0,
            "at_risk_projects": 0,
            "overall_progress": 0.0,
            "total_budget": 0.0,
            "total_spent": 0.0,
        }

    active = [p for p in projects if p.get("status") not in ("completed", "on_hold")]
    def _is_at_risk(project: dict) -> bool:
        metrics = all_metrics.get(str(project.get("id")), {})
        behind = metrics.get("schedule", {}).get("schedule_health") in ("warning", "critical")
        overspending = metrics.get("budget", {}).get("overrun_percent", 0) >= BUDGET_MED_OVERRUN
        return behind or overspending

    at_risk = [p for p in projects if _is_at_risk(p)]
    budgets = [float(p.get("budget") or 0) for p in projects]
    progress = [float(p.get("actual_progress") or 0) for p in active] or [0]
    spent = sum(all_metrics.get(str(p.get("id")), {}).get("budget", {}).get("spent", 0) for p in projects)

    return {
        "active_projects": len(active),
        "at_risk_projects": len(at_risk),
        "overall_progress": round(float(np.mean(progress)), 1),
        "total_budget": sum(budgets),
        "total_spent": round(spent, 2),
    }
