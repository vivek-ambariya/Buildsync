# `date` is a field name on these models, so the type is aliased to keep the
# class body from shadowing it.
from datetime import date as DateValue

from pydantic import BaseModel, Field

from app.models.common import ExpenseCategory


class ExpenseCreate(BaseModel):
    project_id: str
    title: str = Field(min_length=2, max_length=160)
    category: ExpenseCategory = ExpenseCategory.materials
    amount: float = Field(ge=0)
    planned_amount: float = Field(default=0, ge=0)
    vendor: str = ""
    date: DateValue
    invoice_ref: str | None = None
    notes: str = ""


class ExpenseUpdate(BaseModel):
    title: str | None = None
    category: ExpenseCategory | None = None
    amount: float | None = None
    planned_amount: float | None = None
    vendor: str | None = None
    date: DateValue | None = None
    invoice_ref: str | None = None
    notes: str | None = None
