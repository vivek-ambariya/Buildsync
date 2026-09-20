"""Populate MongoDB with a realistic portfolio.

Run from the backend directory:
    python -m app.seed.seed          # wipe and reseed
    python -m app.seed.seed --keep   # only seed if the database is empty
"""
from __future__ import annotations

import argparse
import asyncio
import random
import sys
from datetime import datetime, timedelta, timezone

from app.ai import document_ai
from app.core.config import settings
from app.core.security import hash_password
from app.db.indexes import ensure_indexes
from app.db.mongodb import Collections as C
from app.db.mongodb import close, get_database
from app.models.common import utcnow
from app.services.project_service import recalculate_progress
from app.seed.catalog import (
    EXPENSE_TEMPLATES,
    ISSUE_NOTES,
    MATERIAL_SPECS,
    PASSWORD,
    PEOPLE,
    PHASES,
    PROJECTS,
    TASK_TEMPLATES,
    WEATHER,
    WORK_NOTES,
)

rng = random.Random(20260920)
# Anchored to the real clock, not a rounded hour, so a record seeded "8 minutes
# ago" actually reads as eight minutes ago rather than drifting into the future.
NOW = datetime.now(timezone.utc)

# Share of the total build each phase represents, used for the timeline bars.
PHASE_WEIGHTS = {"Foundation": 0.14, "Structure": 0.38, "Electrical": 0.12,
                 "Plumbing": 0.10, "Finishing": 0.26}


def initials(name: str) -> str:
    parts = [p for p in name.split() if p]
    return (parts[0][0] + (parts[-1][0] if len(parts) > 1 else "")).upper()


async def seed_users(db) -> dict[str, dict]:
    docs = []
    for person in PEOPLE:
        docs.append({
            **person,
            "email": person["email"].lower(),
            "password_hash": hash_password(PASSWORD),
            "avatar_initials": initials(person["name"]),
            "active": True,
            "demo": True,
            "created_at": utcnow(),
        })
    result = await db[C.users].insert_many(docs)
    for doc, oid in zip(docs, result.inserted_ids):
        doc["_id"] = oid
    return {doc["name"]: doc for doc in docs}


def phase_progress(overall: float) -> dict[str, float]:
    """Spread overall completion across phases in build order.

    Earlier phases finish first: the work flows through Foundation to
    Finishing rather than every phase advancing at the same rate.
    """
    remaining = overall / 100
    out: dict[str, float] = {}
    for phase in PHASES:
        weight = PHASE_WEIGHTS[phase]
        done = min(weight, remaining)
        out[phase] = round(done / weight * 100, 1)
        remaining -= done
    return out


async def seed_project(db, spec: dict, people: dict[str, dict]) -> dict:
    manager = people[spec["manager"]]
    team = [people[name] for name in spec["team"]]
    start = NOW - timedelta(days=spec["started_days_ago"])
    end = start + timedelta(days=spec["duration_days"])
    elapsed = spec["started_days_ago"]
    planned = round(min(100.0, elapsed / spec["duration_days"] * 100), 1)

    project_doc = {
        "name": spec["name"], "code": spec["code"], "category": spec["category"],
        "location": spec["location"], "client": spec["client"], "description": spec["description"],
        "status": spec["status"], "start_date": start, "end_date": end,
        "budget": float(spec["budget"]),
        "planned_progress": planned,
        "actual_progress": spec["progress_target"],
        "manager_id": manager["_id"],
        "team_ids": [m["_id"] for m in team],
        "created_at": start, "updated_at": utcnow(),
        "created_by": people["Vivek Ambariya"]["_id"],
    }
    result = await db[C.projects].insert_one(project_doc)
    pid = result.inserted_id
    project_doc["_id"] = pid

    by_phase = phase_progress(spec["progress_target"])
    await seed_milestones(db, pid, spec, start, by_phase)
    await seed_tasks(db, pid, spec, start, end, by_phase, team, manager)
    await seed_materials(db, pid, spec)
    await seed_expenses(db, pid, spec, start)
    await seed_site_updates(db, pid, spec, start, team)

    # Let the tasks be the source of truth. If the seeded target and the task
    # records disagree, the first task anyone edits would shift the project's
    # progress for no visible reason.
    project_doc["actual_progress"] = await recalculate_progress(db, str(pid))
    return project_doc


async def seed_milestones(db, pid, spec, start, by_phase) -> None:
    cursor = 0.0
    docs = []
    for order, phase in enumerate(PHASES):
        weight = PHASE_WEIGHTS[phase]
        planned_start = start + timedelta(days=int(spec["duration_days"] * cursor))
        planned_end = start + timedelta(days=int(spec["duration_days"] * (cursor + weight)))
        actual_pct = by_phase[phase]
        # Sites drift: the actual start lags the plan a little on later phases.
        drift = int(order * spec["duration_days"] * 0.012)
        docs.append({
            "project_id": pid, "name": phase, "order": order,
            "planned_start": planned_start, "planned_end": planned_end,
            "actual_start": planned_start + timedelta(days=drift) if actual_pct > 0 else None,
            "actual_end": (planned_end + timedelta(days=drift)) if actual_pct >= 100 else None,
            "planned_progress": 100.0 if planned_end < NOW else round(
                max(0.0, min(100.0, (NOW - planned_start).days / max(1, (planned_end - planned_start).days) * 100)), 1),
            "progress": actual_pct,
            "weight": weight,
            "created_at": start,
        })
        cursor += weight
    await db[C.milestones].insert_many(docs)


async def seed_tasks(db, pid, spec, start, end, by_phase, team, manager) -> None:
    assignees = [m for m in team] or [manager]
    docs = []
    cursor = 0.0
    for phase in PHASES:
        weight = PHASE_WEIGHTS[phase]
        titles = TASK_TEMPLATES[phase]
        phase_pct = by_phase[phase]
        span = spec["duration_days"] * weight
        for index, title in enumerate(titles):
            slot = index / len(titles)
            task_start = start + timedelta(days=int(spec["duration_days"] * cursor + span * slot))
            deadline = task_start + timedelta(days=max(6, int(span / len(titles)) + rng.randint(2, 9)))

            # A task is complete once the phase has swept past its slot.
            threshold = slot * 100
            if phase_pct >= threshold + (100 / len(titles)):
                progress, status = 100.0, "completed"
            elif phase_pct > threshold:
                progress = round(min(96.0, (phase_pct - threshold) / (100 / len(titles)) * 100), 0)
                status = "delayed" if deadline < NOW else "in_progress"
            else:
                progress, status = 0.0, "delayed" if deadline < NOW else "not_started"

            docs.append({
                "project_id": pid,
                "title": title,
                "description": f"{title} for {spec['name']}, {phase.lower()} package.",
                "phase": phase,
                "assignee_id": rng.choice(assignees)["_id"],
                "start_date": task_start,
                "deadline": deadline,
                "progress": float(progress),
                "status": status,
                "priority": rng.choice(["medium", "medium", "high", "low", "critical" if status == "delayed" else "high"]),
                "created_at": task_start,
                "updated_at": NOW - timedelta(days=rng.randint(0, 9)),
                "created_by": manager["_id"],
            })
        cursor += weight
    await db[C.tasks].insert_many(docs)


async def seed_materials(db, pid, spec) -> None:
    fraction = spec["progress_target"] / 100
    docs = []
    for name, category, unit, cost, supplier, lead, cost_share, base_profile in MATERIAL_SPECS:
        # The catalogue profile is a tendency, not a rule: a material that is
        # tight on one site is usually fine on another.
        odds = {"tight": (0.34, 0.30), "low": (0.08, 0.28), "ok": (0.03, 0.12)}[base_profile]
        roll = rng.random()
        profile = "tight" if roll < odds[0] else "low" if roll < odds[0] + odds[1] else "ok"
        # Quantity follows the money: budget slice divided by the rate.
        required = round(spec["budget"] * cost_share / cost, 1)
        used = round(required * fraction * rng.uniform(0.92, 1.04), 1)
        burn = used / max(1, spec["started_days_ago"])
        cover_days = lead * {"tight": rng.uniform(0.35, 0.8),
                             "low": rng.uniform(1.15, 1.6),
                             "ok": rng.uniform(2.4, 5.5)}[profile]
        available = round(max(0.0, burn * cover_days), 1)
        status = {"tight": "critical", "low": "low_stock"}.get(profile, "healthy")
        docs.append({
            "project_id": pid, "name": name, "category": category, "unit": unit,
            "required_qty": required, "available_qty": available, "used_qty": used,
            "unit_cost": float(cost), "supplier": supplier, "lead_time_days": lead,
            "status": status, "created_at": NOW - timedelta(days=spec["started_days_ago"]),
            "updated_at": NOW - timedelta(days=rng.randint(0, 5)),
        })
    await db[C.materials].insert_many(docs)


async def seed_expenses(db, pid, spec, start) -> None:
    total = spec["budget"] * spec["spend_ratio"]
    months = max(1, spec["started_days_ago"] // 30)
    docs = []
    # Spend ramps up through the structure phase then tapers, like a real S-curve.
    weights = [max(0.25, 1 - abs((m / months) - 0.55) * 1.6) for m in range(months)]
    scale = total / sum(weights)

    for month_index, weight in enumerate(weights):
        month_total = weight * scale
        picks = rng.sample(EXPENSE_TEMPLATES, k=min(len(EXPENSE_TEMPLATES), rng.randint(4, 7)))
        shares = [rng.uniform(0.6, 1.4) for _ in picks]
        share_sum = sum(shares)
        for (title, category, vendor), share in zip(picks, shares):
            amount = round(month_total * share / share_sum, -2)
            if amount <= 0:
                continue
            date = start + timedelta(days=month_index * 30 + rng.randint(1, 27))
            if date > NOW:
                continue
            docs.append({
                "project_id": pid, "title": title, "category": category,
                "amount": float(amount),
                "planned_amount": round(amount * rng.uniform(0.86, 1.06), -2),
                "vendor": vendor, "date": date,
                "invoice_ref": f"INV-{rng.randint(1000, 9999)}",
                "notes": "", "created_at": date,
            })
    if docs:
        await db[C.expenses].insert_many(docs)


async def seed_site_updates(db, pid, spec, start, team) -> None:
    """Weekly reports tracing the progress curve, so the trend fit has data."""
    reporters = [m for m in team if m["role"] == "site_engineer"] or team
    if not reporters:
        return
    weeks = min(20, max(3, spec["started_days_ago"] // 7))
    docs = []
    for index in range(weeks):
        date = NOW - timedelta(days=(weeks - index) * 7 - rng.randint(0, 2))
        if date < start:
            continue
        # Progress at this report is where the project had actually reached on
        # that date, so the curve joins up with the rest of the project history.
        days_in = spec["started_days_ago"] - (NOW - date).days
        share = max(0.02, min(1.0, days_in / spec["started_days_ago"]))
        progress = round(spec["progress_target"] * share * rng.uniform(0.97, 1.02), 1)
        reporter = rng.choice(reporters)
        has_issue = rng.random() < 0.28
        docs.append({
            "project_id": pid, "date": date,
            "work_completed": rng.choice(WORK_NOTES),
            "progress_percent": min(progress, spec["progress_target"]),
            "workers_count": rng.randint(24, 140),
            "materials_used": [
                {"name": rng.choice(MATERIAL_SPECS)[0], "quantity": round(rng.uniform(2, 40), 1),
                 "unit": "units"}
            ],
            "issues": rng.choice(ISSUE_NOTES) if has_issue else "",
            "weather": rng.choice(WEATHER),
            "photos": [],
            "reported_by": reporter["_id"],
            "reported_by_name": reporter["name"],
            "reported_by_role": reporter["role"],
            "created_at": date,
        })
    if docs:
        await db[C.site_updates].insert_many(docs)


SAMPLE_BOQ = """Item Code,Description,Unit,Quantity,Rate,Amount,Vendor
BOQ-101,TMT Steel Fe550D for raft and columns,tonnes,142.5,62400,8892000,Shree Balaji Steels
BOQ-102,OPC 53 Grade Cement,bags,8900,392,3488800,UltraTech - Sabarmati
BOQ-103,Ready-Mix Concrete M30 pumped,cum,1710,5450,9319500,ACC Concrete Sanand
BOQ-104,AAC Blocks 600x200x150,cum,1075,3250,3493750,Biltech Building Elements
BOQ-105,River Sand Zone II,cum,1370,1980,2712600,Narmada Aggregates
BOQ-106,20mm Coarse Aggregate,cum,1595,1240,1977800,Narmada Aggregates
BOQ-107,Vitrified Tiles 800x800 laid,sqm,5735,720,4129200,Kajaria Morbi Works
BOQ-108,Structural Glazing Unit installed,sqm,780,4900,3822000,Saint-Gobain Glass India
"""

SAMPLE_INVOICE = """Shree Balaji Steels Pvt Ltd
Plot 42, Odhav Industrial Estate, Ahmedabad 382415
GSTIN: 24AABCS1429N1ZP

TAX INVOICE
Invoice No: INV-1024
Invoice Date: 12-Sep-2026
Bill To: Skyline Realty LLP, Bopal, Ahmedabad

Description,Unit,Quantity,Rate,Amount
TMT Steel Fe550D 16mm,tonnes,18.4,62400,1148160
TMT Steel Fe550D 12mm,tonnes,11.2,62400,698880
Binding Wire 18 gauge,kg,240,86,20640

Taxable Value: Rs 1867680
CGST 9%: Rs 168091
SGST 9%: Rs 168091
Amount Payable: Rs 2203862
"""

SAMPLE_SITE_REPORT = """DAILY SITE REPORT - Green Valley Residences
Date: 18-Sep-2026
Weather: Clear
Manpower: 96
Progress: 71%

Work executed:
Block D slab concreting completed, 62 cum poured with M30 from ACC Sanand.
Block E column reinforcement tied to the seventh lift.
Internal plaster continued across 14 units in Block B.

Issues:
Pour stopped for 40 minutes due to a pump line blockage.
"""


async def seed_documents(db, projects: dict[str, dict], people: dict[str, dict]) -> None:
    """Write real files to storage and run them through the extraction pipeline."""
    samples = [
        ("Skyline Tower", "SKY-01-BOQ-Rev3.csv", "boq", SAMPLE_BOQ, "text/csv",
         "Revision 3 issued after the structural redesign of the podium."),
        ("Skyline Tower", "INV-1024-Balaji-Steels.txt", "invoice", SAMPLE_INVOICE, "text/plain",
         "September steel despatch against PO SKY-PO-0088."),
        ("Green Valley Residences", "GVR-Daily-Site-Report-18Sep.txt", "site_report",
         SAMPLE_SITE_REPORT, "text/plain", "Filed by the site engineer at close of shift."),
        ("Metro Commercial Hub", "MCH-03-BOQ-Facade.csv", "boq", SAMPLE_BOQ, "text/csv",
         "Facade package bill of quantities for tender comparison."),
    ]

    for project_name, filename, doc_type, content, content_type, notes in samples:
        project = projects[project_name]
        raw = content.encode("utf-8")
        stored_name = f"seed-{filename}"
        (settings.storage_path / stored_name).write_bytes(raw)

        analysis = await document_ai.process(raw, filename, doc_type)
        uploader = people["Anil Kumar"] if doc_type == "site_report" else people["Meera Shah"]
        await db[C.documents].insert_one({
            "project_id": project["_id"], "name": filename, "stored_name": stored_name,
            "content_type": content_type, "size_bytes": len(raw), "notes": notes,
            "status": "processed",
            "uploaded_by": uploader["_id"], "uploaded_by_name": uploader["name"],
            "uploaded_at": NOW - timedelta(days=rng.randint(1, 12)),
            **analysis,
        })

    # A couple of records without a stored file, as a real archive would have.
    placeholders = [
        ("LJ Business Center", "LJB-Main-Contract-Executed.pdf", "contract", 1_482_000,
         "Executed main contract with Yadav Constructions."),
        ("Riverfront Residency C", "RFR-Structural-GA-Rev5.pdf", "drawing", 4_120_000,
         "General arrangement drawing, revision 5, issued for construction."),
        ("Sardar Industrial Park II", "SIP-Shed-3-Steel-Schedule.csv", "boq", 96_000,
         "Steel schedule for shed 3 pre-engineered frame."),
    ]
    for project_name, filename, doc_type, size, notes in placeholders:
        await db[C.documents].insert_one({
            "project_id": projects[project_name]["_id"], "name": filename,
            "stored_name": f"missing-{filename}", "content_type": "application/pdf",
            "size_bytes": size, "doc_type": doc_type, "notes": notes, "status": "processed",
            "extracted_fields": {}, "line_items": [], "total_value": 0.0, "extractor": "rules",
            "classification_confidence": 0.9, "detected_type": doc_type,
            "uploaded_by": people["Rajesh Patel"]["_id"], "uploaded_by_name": "Rajesh Patel",
            "uploaded_at": NOW - timedelta(days=rng.randint(5, 40)),
        })


async def seed_activity_and_notifications(db, projects: dict[str, dict], people: dict[str, dict]) -> None:
    admin = people["Vivek Ambariya"]
    entries = [
        (people["Anil Kumar"], "filed a site report", "site_update", "Skyline Tower",
         "52% — slab shuttering completed for the typical floor", 8),
        (people["Meera Shah"], "uploaded document", "document", "Skyline Tower",
         "INV-1024-Balaji-Steels.txt", 32),
        (people["Suresh Yadav"], "updated task", "task", "Green Valley Residences",
         "Slab concreting, typical floor — 100%", 64),
        (people["Priya Nair"], "updated material", "material", "Metro Commercial Hub",
         "Structural Glazing Unit stock drawn down", 118),
        (people["Rajesh Patel"], "recorded expense", "expense", "LJ Business Center",
         "MEP subcontract milestone — 24,80,000", 186),
        (people["Devansh Joshi"], "filed a site report", "site_update", "Riverfront Residency C",
         "91% — snag list closure started in eight units", 240),
        (admin, "generated report", "report", "Skyline Tower", "Weekly project report", 320),
        (people["Farhan Qureshi"], "updated task", "task", "Metro Commercial Hub",
         "Cable laying to distribution panels — 45%", 410),
    ]
    await db[C.activities].insert_many([
        {
            "actor_id": actor["_id"], "actor_name": actor["name"], "actor_role": actor["role"],
            "action": action, "entity_type": entity, "entity_id": None,
            "project_id": projects[project]["_id"], "detail": detail,
            "created_at": NOW - timedelta(minutes=minutes),
        }
        for actor, action, entity, project, detail, minutes in entries
    ])

    managers = [p for p in people.values() if p["role"] in ("admin", "project_manager")]
    notifications = [
        ("Skyline Tower milestone delayed", "Structure is 16 points behind plan and forecasts a 34-day overrun.",
         "critical", "Skyline Tower", 12),
        ("TMT Steel stock critical", "Two days of cover left on Skyline Tower. Reorder from Shree Balaji Steels.",
         "critical", "Skyline Tower", 48),
        ("Structural glazing running low", "Metro Commercial Hub has under three days of cover against a 21-day lead time.",
         "warning", "Metro Commercial Hub", 140),
        ("Weekly report generated", "The weekly project report for all sites is ready to review.",
         "success", "Green Valley Residences", 260),
        ("New invoice uploaded", "INV-1024 from Shree Balaji Steels was added to Skyline Tower.",
         "info", "Skyline Tower", 320),
        ("Issue raised on Green Valley Residences", "Pour stopped for 40 minutes due to a pump line blockage.",
         "warning", "Green Valley Residences", 480),
    ]
    docs = []
    for title, body, tone, project, minutes in notifications:
        for manager in managers:
            docs.append({
                "user_id": manager["_id"], "title": title, "body": body, "tone": tone,
                "project_id": projects[project]["_id"],
                "link": f"/app/projects/{projects[project]['_id']}",
                "read": minutes > 300, "created_at": NOW - timedelta(minutes=minutes),
            })
    await db[C.notifications].insert_many(docs)


async def run(keep: bool = False) -> None:
    db = get_database()
    try:
        await db.command("ping")
    except Exception as exc:
        print(f"Cannot reach MongoDB at {settings.mongodb_uri}: {exc}")
        print("Start it with: brew services start mongodb-community")
        sys.exit(1)

    existing = await db[C.projects].count_documents({})
    if existing and keep:
        print(f"Database already holds {existing} projects. Nothing to do.")
        return

    for collection in vars(C).values():
        if isinstance(collection, str) and not collection.startswith("_"):
            await db[collection].delete_many({})
    for stale in settings.storage_path.glob("seed-*"):
        stale.unlink(missing_ok=True)

    await ensure_indexes(db)
    people = await seed_users(db)
    projects: dict[str, dict] = {}
    for spec in PROJECTS:
        projects[spec["name"]] = await seed_project(db, spec, people)

    await seed_documents(db, projects, people)
    await seed_activity_and_notifications(db, projects, people)

    counts = {
        name: await db[getattr(C, name)].count_documents({})
        for name in ("users", "projects", "tasks", "milestones", "materials",
                     "expenses", "documents", "site_updates", "notifications", "activities")
    }
    print(f"Seeded {settings.mongodb_db}:")
    for name, count in counts.items():
        print(f"  {name:<15} {count}")
    print(f"\nSign in with any seeded email and the password '{PASSWORD}'.")
    print("  vivek@buildsync.ai        Admin")
    print("  meera.shah@buildsync.ai   Project manager")
    print("  anil.kumar@buildsync.ai   Site engineer")
    print("  suresh@yadavconstructions.in  Contractor")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the BuildSync AI database.")
    parser.add_argument("--keep", action="store_true", help="skip seeding if data already exists")
    args = parser.parse_args()
    try:
        asyncio.run(_main(args.keep))
    except KeyboardInterrupt:
        pass


async def _main(keep: bool) -> None:
    try:
        await run(keep)
    finally:
        await close()


if __name__ == "__main__":
    main()
