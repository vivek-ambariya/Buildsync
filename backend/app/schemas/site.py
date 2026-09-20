"""Request bodies for the site operations surface.

Everything here is filled in on a phone, often outdoors, so the shapes are
deliberately small: the required fields are the ones a person can answer
without leaving the work, and everything else has a sensible default.
"""
from datetime import date as DateValue

from pydantic import BaseModel, Field

from app.models.common import Priority, TaskStatus


class MaterialUsageLine(BaseModel):
    name: str
    quantity: float = Field(ge=0)
    unit: str = "units"


class ProgressUpdateCreate(BaseModel):
    """One task moved forward, recorded from site."""

    project_id: str
    task_id: str | None = None
    new_progress: float = Field(ge=0, le=100)
    work_completed: str = Field(min_length=3, max_length=2000)
    workers_used: int = Field(default=0, ge=0, le=5000)
    materials_used: list[MaterialUsageLine] = []
    notes: str = ""
    photo_ids: list[str] = []
    # Filing the matching daily record is the common case, so it is opt-out.
    file_site_update: bool = True


class TaskProgressUpdate(BaseModel):
    """The narrow set of task fields a site manager may move."""

    progress: float | None = Field(default=None, ge=0, le=100)
    status: TaskStatus | None = None
    note: str = ""
    blocked_reason: str = ""


class SiteIssueCreate(BaseModel):
    title: str = Field(min_length=3, max_length=160)
    project_id: str
    task_id: str | None = None
    severity: str = Field(default="medium", pattern="^(low|medium|high|critical)$")
    description: str = Field(min_length=3, max_length=2000)
    location: str = ""
    photo_ids: list[str] = []
    expected_resolution: DateValue | None = None


class SiteIssueUpdate(BaseModel):
    status: str | None = Field(default=None, pattern="^(open|acknowledged|resolved)$")
    note: str = ""


class MaterialUsageCreate(BaseModel):
    quantity_used: float = Field(gt=0)
    date: DateValue | None = None
    task_id: str | None = None
    notes: str = ""


class MaterialRequestCreate(BaseModel):
    project_id: str
    material_id: str | None = None
    material_name: str = Field(min_length=1, max_length=120)
    required_qty: float = Field(gt=0)
    unit: str = "units"
    reason: str = Field(min_length=3, max_length=600)
    urgency: str = Field(default="medium", pattern="^(low|medium|high|critical)$")
    needed_by: DateValue | None = None


class WorkforceCrew(BaseModel):
    team: str = Field(min_length=1, max_length=120)
    trade: str = ""
    present: int = Field(default=0, ge=0, le=5000)
    absent: int = Field(default=0, ge=0, le=5000)
    shift: str = Field(default="day", pattern="^(day|night|general)$")
    work_assigned: str = ""


class WorkforceLogCreate(BaseModel):
    project_id: str
    date: DateValue | None = None
    crews: list[WorkforceCrew] = Field(min_length=1)
    notes: str = ""


class DailyReportCreate(BaseModel):
    """The guided end-of-day submission, assembled from the wizard steps."""

    project_id: str
    date: DateValue | None = None
    work_completed: str = Field(min_length=3, max_length=4000)
    progress_percent: float = Field(ge=0, le=100)
    workers_present: int = Field(default=0, ge=0, le=5000)
    workers_absent: int = Field(default=0, ge=0, le=5000)
    crews: list[WorkforceCrew] = []
    materials_used: list[MaterialUsageLine] = []
    issues: str = ""
    issue_severity: str = Field(default="medium", pattern="^(low|medium|high|critical)$")
    weather: str = "Clear"
    photo_ids: list[str] = []
    notes: str = ""


class SiteTaskNote(BaseModel):
    note: str = Field(min_length=1, max_length=1000)
    priority: Priority | None = None
