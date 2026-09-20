"""Shared enums and Mongo (de)serialisation helpers."""
from datetime import date, datetime, timezone
from enum import Enum
from typing import Any

from bson import ObjectId


class Role(str, Enum):
    admin = "admin"
    project_manager = "project_manager"
    site_engineer = "site_engineer"
    contractor = "contractor"


class ProjectStatus(str, Enum):
    planning = "planning"
    active = "active"
    at_risk = "at_risk"
    delayed = "delayed"
    on_hold = "on_hold"
    completed = "completed"


class TaskStatus(str, Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    completed = "completed"
    delayed = "delayed"


class Priority(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class MaterialStatus(str, Enum):
    healthy = "healthy"
    low_stock = "low_stock"
    critical = "critical"
    ordered = "ordered"


class DocumentType(str, Enum):
    boq = "boq"
    invoice = "invoice"
    contract = "contract"
    site_report = "site_report"
    drawing = "drawing"
    other = "other"


class DocumentStatus(str, Enum):
    uploaded = "uploaded"
    processing = "processing"
    processed = "processed"
    failed = "failed"


class Severity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class InsightKind(str, Enum):
    schedule = "schedule"
    budget = "budget"
    material = "material"
    quality = "quality"
    positive = "positive"


class ExpenseCategory(str, Enum):
    materials = "materials"
    labour = "labour"
    equipment = "equipment"
    subcontractor = "subcontractor"
    permits = "permits"
    overheads = "overheads"


class ReportType(str, Enum):
    daily_site = "daily_site"
    weekly_project = "weekly_project"
    budget = "budget"
    progress = "progress"
    risk = "risk"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def to_object_id(value: Any) -> ObjectId | None:
    """Best-effort conversion; returns None for values that are not valid ids."""
    if isinstance(value, ObjectId):
        return value
    if isinstance(value, str) and ObjectId.is_valid(value):
        return ObjectId(value)
    return None


def serialize(value: Any) -> Any:
    """Recursively convert Mongo documents into JSON-safe structures.

    `_id` is surfaced as `id` so the frontend never deals with Mongo internals.
    """
    if isinstance(value, list):
        return [serialize(v) for v in value]
    if isinstance(value, dict):
        out: dict[str, Any] = {}
        for key, val in value.items():
            out["id" if key == "_id" else key] = serialize(val)
        return out
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        # PyMongo hands back naive datetimes even though everything is stored
        # in UTC. Without an explicit offset the browser reads them as local
        # time, which silently shifts every "x hours ago" by the timezone.
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Enum):
        return value.value
    return value
