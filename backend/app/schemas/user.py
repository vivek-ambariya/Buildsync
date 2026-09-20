"""Request/response shapes for administering people.

No schema here carries a password hash outwards, and `UserOut` is built by
field rather than by spreading the stored document, so a new internal field
cannot leak to the client by accident.
"""
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.common import Role


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    # `role` is the primary workspace; `roles` is every workspace the account
    # may sign in as. Leaving `roles` out means "just the primary one".
    role: Role
    roles: list[Role] | None = None
    title: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=32)
    active: bool = True
    project_ids: list[str] = Field(default_factory=list)
    # Optional: when it is left out the API issues a one-time password and
    # returns it to the admin in that single response. Either way what reaches
    # the database is a bcrypt hash.
    password: str | None = Field(default=None, min_length=8, max_length=128)

    @field_validator("name")
    @classmethod
    def _clean_name(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if len(cleaned) < 2:
            raise ValueError("enter the person's full name")
        return cleaned

    @field_validator("title", "phone")
    @classmethod
    def _blank_to_none(cls, value: str | None) -> str | None:
        return (value or "").strip() or None


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    email: EmailStr | None = None
    role: Role | None = None
    roles: list[Role] | None = None
    title: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=32)
    active: bool | None = None
    project_ids: list[str] | None = None

    @field_validator("name")
    @classmethod
    def _clean_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = " ".join(value.split())
        if len(cleaned) < 2:
            raise ValueError("enter the person's full name")
        return cleaned


class RoleChange(BaseModel):
    role: Role
    roles: list[Role] | None = None
    reason: str | None = Field(default=None, max_length=280)


class StatusChange(BaseModel):
    active: bool
    reason: str | None = Field(default=None, max_length=280)


class PasswordReset(BaseModel):
    password: str | None = Field(default=None, min_length=8, max_length=128)


class ProjectAssignment(BaseModel):
    project_ids: list[str]


class AdminUserOut(BaseModel):
    """One row of the admin user table."""

    id: str
    name: str
    email: EmailStr
    role: Role
    title: str | None = None
    phone: str | None = None
    active: bool = True
    roles: list[Role] = Field(default_factory=list)
    avatar_initials: str | None = None
    created_at: datetime | None = None
    last_active_at: datetime | None = None
    project_count: int = 0
    managed_count: int = 0
    projects: list[dict] = Field(default_factory=list)
