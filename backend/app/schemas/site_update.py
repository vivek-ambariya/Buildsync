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
