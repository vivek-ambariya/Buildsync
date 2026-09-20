from datetime import date

from pydantic import BaseModel, Field

from app.models.common import Priority, TaskStatus


class TaskCreate(BaseModel):
    project_id: str
    title: str = Field(min_length=2, max_length=160)
    description: str = ""
    phase: str = "General"
    assignee_id: str | None = None
    start_date: date
    deadline: date
    progress: float = Field(default=0, ge=0, le=100)
    status: TaskStatus = TaskStatus.not_started
    priority: Priority = Priority.medium


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    phase: str | None = None
    assignee_id: str | None = None
    start_date: date | None = None
    deadline: date | None = None
    progress: float | None = Field(default=None, ge=0, le=100)
    status: TaskStatus | None = None
    priority: Priority | None = None
