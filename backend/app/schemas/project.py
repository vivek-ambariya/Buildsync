from datetime import date

from pydantic import BaseModel, Field

from app.models.common import ProjectStatus


class ProjectBase(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    code: str = Field(min_length=2, max_length=24)
    category: str = "Residential"
    location: str = ""
    client: str = ""
    description: str = ""
    status: ProjectStatus = ProjectStatus.planning
    start_date: date
    end_date: date
    budget: float = Field(ge=0)
    manager_id: str | None = None
    team_ids: list[str] = []


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    location: str | None = None
    client: str | None = None
    description: str | None = None
    status: ProjectStatus | None = None
    start_date: date | None = None
    end_date: date | None = None
    budget: float | None = None
    planned_progress: float | None = None
    actual_progress: float | None = None
    manager_id: str | None = None
    team_ids: list[str] | None = None
