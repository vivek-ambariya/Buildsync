from datetime import date as DateValue

from pydantic import BaseModel, Field


class MaterialUsage(BaseModel):
    name: str
    quantity: float
    unit: str = "units"


class SiteUpdateCreate(BaseModel):
    project_id: str
    date: DateValue
    work_completed: str = Field(min_length=3)
    progress_percent: float = Field(ge=0, le=100)
    workers_count: int = Field(default=0, ge=0)
    materials_used: list[MaterialUsage] = []
    issues: str = ""
    weather: str = "Clear"
    photos: list[str] = []


class SiteUpdateEdit(BaseModel):
    """Correcting a filed report. The project it belongs to is not movable."""

    work_completed: str | None = Field(default=None, min_length=3)
    progress_percent: float | None = Field(default=None, ge=0, le=100)
    workers_count: int | None = Field(default=None, ge=0)
    issues: str | None = None
    weather: str | None = None
