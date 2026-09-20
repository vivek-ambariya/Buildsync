"""The construction copilot.

Answers questions about the live portfolio. It always grounds its reply in a
context snapshot built from the database, and returns that snapshot's sources
alongside the answer so the user can see what the answer was based on.

With a hosted model configured it writes the prose; without one it routes the
question to a deterministic answer. Either way the numbers come from the same
engine that powers the dashboard.
"""
from __future__ import annotations

import re

from app.ai.engine import material_metrics, project_budget_metrics, project_schedule_metrics
from app.ai.llm_provider import get_provider
from app.utils.formatting import format_date, format_inr

SUGGESTED_PROMPTS = [
    "Which projects are delayed?",
    "What are the biggest risks right now?",
    "Which materials are running low?",
    "How much budget is left?",
    "Why is Skyline Tower behind schedule?",
    "Generate this week's project summary.",
]

_SYSTEM = (
    "You are BuildSync AI, a construction project copilot for Indian real-estate "
    "developers. Answer only from the supplied context. Be direct and specific: "
    "quote the numbers, name the project, and say what to do next. Use short "
    "markdown with at most one heading. Never invent a figure. Amounts are in "
    "rupees, quoted in lakh or crore. If the context does not cover the question, "
    "say so and name what data would answer it."
)


# --------------------------------------------------------------------------
# Context
# --------------------------------------------------------------------------

def build_context(projects: list[dict], materials: list[dict], tasks: list[dict], expenses: list[dict]) -> dict:
    """Everything the copilot is allowed to reason about, in one structure."""
    expenses_by_project: dict[str, list[dict]] = {}
    for expense in expenses:
        expenses_by_project.setdefault(str(expense.get("project_id")), []).append(expense)

    rows = []
    for project in projects:
        pid = str(project.get("id"))
        schedule = project_schedule_metrics(project)
        budget = project_budget_metrics(project, expenses_by_project.get(pid, []))
        rows.append({
            "id": pid,
            "name": project.get("name"),
            "status": project.get("status"),
            "category": project.get("category"),
            "manager": project.get("manager_name"),
            "deadline": project.get("end_date"),
            "schedule": schedule,
            "budget": budget,
        })

    material_rows = []
    for material in materials:
        project = next((p for p in rows if p["id"] == str(material.get("project_id"))), None)
        elapsed = project["schedule"]["elapsed_days"] if project else 30
        metrics = material_metrics(material, elapsed)
        material_rows.append({
            "name": material.get("name"),
            "project": project["name"] if project else "Unassigned",
            "available": material.get("available_qty"),
            "required": material.get("required_qty"),
            "unit": material.get("unit"),
            "supplier": material.get("supplier"),
            **metrics,
        })

    open_tasks = [t for t in tasks if t.get("status") != "completed"]
    return {
        "projects": rows,
        "materials": material_rows,
        "open_task_count": len(open_tasks),
        "overdue_tasks": [
            {"title": t.get("title"), "deadline": t.get("deadline"), "assignee": t.get("assignee_name")}
            for t in open_tasks if t.get("status") == "delayed"
        ][:10],
    }


def context_to_prompt(context: dict, question: str) -> str:
    lines = ["PORTFOLIO CONTEXT", ""]
    for p in context["projects"]:
        s, b = p["schedule"], p["budget"]
        lines.append(
            f"- {p['name']} ({p['category']}, {p['status']}, manager {p['manager']}): "
            f"actual {s['actual_progress']}% vs planned {s['planned_progress']}% "
            f"(variance {s['variance']}pts, forecast finish {s['forecast_end']}, "
            f"delay {s['delay_days']}d). Budget {format_inr(b['budget'])}, "
            f"spent {format_inr(b['spent'])} ({b['burn_percent']}%), "
            f"remaining {format_inr(b['remaining'])}, CPI {b['cost_performance_index']}. "
            f"Deadline {p['deadline']}."
        )
    lines += ["", "MATERIALS AT RISK"]
    for m in context["materials"]:
        if m["status"] != "healthy":
            lines.append(
                f"- {m['name']} on {m['project']}: {m['available']} {m['unit']} left, "
                f"{m['days_of_cover']} days of cover, shortfall {m['shortfall']} {m['unit']}, "
                f"supplier {m['supplier']}."
            )
    lines += ["", f"Open tasks: {context['open_task_count']}. Delayed: {len(context['overdue_tasks'])}."]
    lines += ["", "QUESTION", question]
    return "\n".join(lines)


# --------------------------------------------------------------------------
# Deterministic answers
# --------------------------------------------------------------------------

_INTENTS: list[tuple[str, str]] = [
    ("delay", r"delay|behind|late|slipp|schedule"),
    ("risk", r"risk|worry|concern|problem|issue|attention"),
    ("material", r"material|steel|cement|stock|inventory|shortage|supply|procure"),
    ("budget", r"budget|cost|spend|spent|money|expense|remaining|financ"),
    ("summary", r"summary|summarise|summarize|report|overview|status|week"),
    ("why", r"^why\b|reason|cause"),
]


def detect_intent(question: str) -> str:
    text = question.lower()
    for intent, pattern in _INTENTS:
        if re.search(pattern, text):
            return intent
    return "summary"


def _named_project(question: str, context: dict) -> dict | None:
    text = question.lower()
    for project in context["projects"]:
        name = (project["name"] or "").lower()
        if name and (name in text or name.split()[0] in text):
            return project
    return None


def answer_locally(question: str, context: dict) -> dict:
    """Route to a grounded answer without a hosted model."""
    projects = context["projects"]
    intent = detect_intent(question)
    target = _named_project(question, context)

    if target and intent in ("why", "delay", "summary"):
        s, b = target["schedule"], target["budget"]
        behind = s["variance"] < 0
        parts: list[str] = []

        # If the question assumes a delay that is not there, correct it first.
        # Answering around a false premise is how a copilot loses trust.
        if intent in ("why", "delay") and not behind:
            parts.append(
                f"### {target['name']} is not behind\n\n"
                f"It is running **{s['variance']} points ahead** of plan: "
                f"{s['actual_progress']}% built against a planned {s['planned_progress']}%. "
                f"Here is where it actually stands."
            )
        else:
            parts.append(f"### {target['name']}")

        parts.append(
            f"Progress is **{s['actual_progress']}%** against a planned "
            f"**{s['planned_progress']}%**, a variance of **{s['variance']} points**. "
            f"The site is adding {s['daily_rate']}% a day, and holding that rate puts "
            f"completion at **{format_date(s['forecast_end'])}**, "
            + (
                f"{s['delay_days']} days past the {format_date(target['deadline'])} deadline."
                if s["delay_days"]
                else f"inside the {format_date(target['deadline'])} deadline."
            )
        )

        parts.append(
            f"Spending is at {format_inr(b['spent'])} of {format_inr(b['budget'])} "
            f"({b['burn_percent']}%), with a cost performance index of "
            f"{b['cost_performance_index']}."
        )

        if s["required_rate"] is None:
            parts.append(
                "**Forecast:** the schedule has already run past its contract window, so the "
                "remaining work needs re-planning rather than re-forecasting."
            )
        elif behind:
            parts.append(
                f"**What is driving it:** hitting the deadline needs "
                f"{s['required_rate']}% a day from here, and the site is running at "
                f"{s['daily_rate']}%. Every day below that widens the gap."
            )
        else:
            parts.append(
                f"**Holding position:** the deadline needs only "
                f"{s['required_rate']}% a day from here, below the {s['daily_rate']}% "
                f"the site is already achieving."
            )

        body = "\n\n".join(parts)
        return _response(body, cards=_project_cards(target), chart=_progress_chart(target), sources=[target["name"]])

    if intent == "delay":
        late = sorted([p for p in projects if p["schedule"]["variance"] < 0],
                      key=lambda p: p["schedule"]["variance"])
        if not late:
            return _response("No project is behind plan right now. Every site is at or ahead of its planned curve.")
        lines = [
            f"- **{p['name']}** — {p['schedule']['actual_progress']}% against "
            f"{p['schedule']['planned_progress']}% planned, {p['schedule']['variance']} points behind. "
            f"Holding the current rate finishes {format_date(p['schedule']['forecast_end'])}."
            for p in late[:6]
        ]
        if len(late) > 6:
            lines.append(f"- and {len(late) - 6} more behind plan")
        body = f"### {len(late)} projects are behind plan\n\n" + "\n".join(lines) + \
               f"\n\n{late[0]['name']} is the furthest behind and needs the first intervention."
        return _response(body, cards=[_card(p['name'], f"{p['schedule']['variance']}%", "variance",
                                            "critical" if p['schedule']['variance'] <= -12 else "warning")
                                      for p in late[:4]],
                         sources=[p["name"] for p in late])

    if intent == "material":
        at_risk = [m for m in context["materials"] if m["status"] != "healthy"]
        if not at_risk:
            return _response("All tracked materials have more than a week of cover at the current consumption rate.")
        at_risk.sort(key=lambda m: m["days_of_cover"])
        lines = [
            f"- **{m['name']}** on {m['project']} — {m['available']} {m['unit']} left, "
            f"{m['days_of_cover']:.0f} days of cover against a {m['lead_time_days']:.0f}-day "
            f"lead time. Order from {m['supplier']} by {format_date(m['reorder_by'])}."
            for m in at_risk[:8]
        ]
        if len(at_risk) > 8:
            lines.append(f"- and {len(at_risk) - 8} more below a safe stock level")
        body = (f"### {len(at_risk)} materials need reordering\n\n" + "\n".join(lines) +
                "\n\nThe ones above are ordered by how soon they stop work.")
        return _response(body, cards=[_card(m["name"], f"{m['days_of_cover']:.0f}d", "cover left",
                                            "critical" if m["status"] == "critical" else "warning")
                                      for m in at_risk[:4]],
                         sources=[m["name"] for m in at_risk])

    if intent == "budget":
        total_budget = sum(p["budget"]["budget"] for p in projects)
        total_spent = sum(p["budget"]["spent"] for p in projects)
        remaining = total_budget - total_spent
        worst = max(projects, key=lambda p: p["budget"]["overrun_percent"], default=None)
        body = (
            f"### {format_inr(remaining)} remaining across the portfolio\n\n"
            f"Committed spend is {format_inr(total_spent)} of {format_inr(total_budget)} "
            f"({total_spent / total_budget * 100:.1f}%).\n\n"
        )
        if worst and worst["budget"]["overrun_percent"] > 5:
            body += (
                f"**{worst['name']}** carries the largest cost variance at "
                f"+{worst['budget']['overrun_percent']}%, forecasting "
                f"{format_inr(worst['budget']['forecast_total'])} at completion."
            )
        else:
            body += "No project is materially over its value-adjusted plan."
        return _response(
            body,
            cards=[
                _card("Total budget", format_inr(total_budget), "approved", "info"),
                _card("Spent", format_inr(total_spent), f"{total_spent / total_budget * 100:.0f}% committed", "info"),
                _card("Remaining", format_inr(remaining), "available", "healthy"),
            ],
            chart=_budget_chart(projects),
            sources=[p["name"] for p in projects],
        )

    if intent == "risk":
        ranked = sorted(projects, key=lambda p: (p["schedule"]["variance"], -p["budget"]["overrun_percent"]))
        low_materials = [m for m in context["materials"] if m["status"] != "healthy"]
        top = ranked[0]
        body = (
            "### Three things need attention\n\n"
            f"1. **{top['name']} schedule** — {top['schedule']['variance']} points behind plan, "
            f"forecasting a {top['schedule']['delay_days']}-day overrun.\n"
        )
        if low_materials:
            m = min(low_materials, key=lambda m: m["days_of_cover"])
            body += (f"2. **{m['name']} supply** — {m['days_of_cover']:.0f} days of cover on "
                     f"{m['project']}, against a lead time from {m['supplier']}.\n")
        over = max(projects, key=lambda p: p["budget"]["overrun_percent"])
        body += (f"3. **{over['name']} cost** — spending is {over['budget']['overrun_percent']}% "
                 f"ahead of the work delivered.")
        return _response(body, cards=_project_cards(top), sources=[p["name"] for p in ranked[:3]])

    # summary
    avg = sum(p["schedule"]["actual_progress"] for p in projects) / max(1, len(projects))
    behind = [p for p in projects if p["schedule"]["variance"] < -5]
    total_budget = sum(p["budget"]["budget"] for p in projects)
    total_spent = sum(p["budget"]["spent"] for p in projects)
    body = (
        f"### Portfolio summary\n\n"
        f"{len(projects)} projects averaging **{avg:.0f}% complete**, with "
        f"{format_inr(total_spent)} of {format_inr(total_budget)} committed.\n\n"
        f"**Behind plan:** {', '.join(p['name'] for p in behind) if behind else 'none'}.\n\n"
        f"**Open tasks:** {context['open_task_count']}, of which "
        f"{len(context['overdue_tasks'])} are marked delayed.\n\n"
        f"**Materials to reorder:** "
        f"{', '.join(m['name'] for m in context['materials'] if m['status'] != 'healthy') or 'none'}."
    )
    return _response(body, cards=[
        _card("Projects", str(len(projects)), "in portfolio", "info"),
        _card("Average progress", f"{avg:.0f}%", "across sites", "healthy" if avg > 50 else "warning"),
        _card("Behind plan", str(len(behind)), "need attention", "critical" if behind else "healthy"),
    ], chart=_portfolio_chart(projects), sources=[p["name"] for p in projects])


# --------------------------------------------------------------------------
# Response shaping
# --------------------------------------------------------------------------

def _card(label: str, value: str, caption: str, tone: str) -> dict:
    return {"label": label, "value": value, "caption": caption, "tone": tone}


def _project_cards(project: dict) -> list[dict]:
    s, b = project["schedule"], project["budget"]
    return [
        _card("Progress", f"{s['actual_progress']}%", f"plan {s['planned_progress']}%",
              "critical" if s["variance"] <= -12 else "warning" if s["variance"] < 0 else "healthy"),
        _card("Forecast finish", format_date(s["forecast_end"]),
              f"{s['delay_days']}d late" if s["delay_days"] else "on time",
              "critical" if s["delay_days"] > 14 else "warning" if s["delay_days"] else "healthy"),
        _card("Budget used", f"{b['burn_percent']}%", format_inr(b["remaining"]) + " left", "info"),
    ]


def _progress_chart(project: dict) -> dict:
    s = project["schedule"]
    return {
        "type": "bar",
        "title": f"{project['name']} — planned vs actual",
        "data": [
            {"name": "Planned", "value": s["planned_progress"]},
            {"name": "Actual", "value": s["actual_progress"]},
        ],
    }


def _budget_chart(projects: list[dict]) -> dict:
    return {
        "type": "bar",
        "title": "Spend against budget",
        "data": [
            {"name": p["name"], "value": round(p["budget"]["burn_percent"], 1)}
            for p in projects
        ],
    }


def _portfolio_chart(projects: list[dict]) -> dict:
    return {
        "type": "bar",
        "title": "Completion by project",
        "data": [
            {"name": p["name"], "value": p["schedule"]["actual_progress"]}
            for p in projects
        ],
    }


def _response(markdown: str, cards: list[dict] | None = None, chart: dict | None = None,
              sources: list[str] | None = None, engine: str = "local") -> dict:
    return {
        "answer": markdown,
        "cards": cards or [],
        "chart": chart,
        "sources": sources or [],
        "engine": engine,
    }


async def ask(question: str, context: dict) -> dict:
    """Answer a question, preferring a hosted model for the prose."""
    local = answer_locally(question, context)
    provider = get_provider()
    if not provider.available:
        return local
    try:
        prose = await provider.complete(_SYSTEM, context_to_prompt(context, question))
        if prose.strip():
            local["answer"] = prose.strip()
            local["engine"] = provider.name
    except Exception:
        pass  # keep the grounded local answer if the model call fails
    return local
