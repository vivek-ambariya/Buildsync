from pydantic import BaseModel, Field

from app.models.common import ReportType


class ReportCreate(BaseModel):
    report_type: ReportType
    project_id: str | None = None
    period_days: int = Field(default=7, ge=1, le=90)


class AssistantRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    project_id: str | None = None
    conversation_id: str | None = None


class NotificationRead(BaseModel):
    ids: list[str] = []
    all: bool = False
