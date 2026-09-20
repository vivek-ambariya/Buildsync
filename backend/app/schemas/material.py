from pydantic import BaseModel, Field

from app.models.common import MaterialStatus


class MaterialCreate(BaseModel):
    project_id: str
    name: str = Field(min_length=1, max_length=120)
    category: str = "Structural"
    unit: str = "units"
    required_qty: float = Field(ge=0)
    available_qty: float = Field(ge=0)
    used_qty: float = Field(default=0, ge=0)
    unit_cost: float = Field(default=0, ge=0)
    supplier: str = ""
    lead_time_days: int = 7
    status: MaterialStatus | None = None


class MaterialUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    unit: str | None = None
    required_qty: float | None = None
    available_qty: float | None = None
    used_qty: float | None = None
    unit_cost: float | None = None
    supplier: str | None = None
    lead_time_days: int | None = None
