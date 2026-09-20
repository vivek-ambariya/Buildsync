from pydantic import BaseModel, EmailStr, Field

from app.models.common import Role


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    # Which workspace the person chose on the way in. A slug
    # ("project-manager") or a role name ("project_manager") are both accepted;
    # either way it is a request, not a grant.
    selected_role: str | None = None


class WorkspaceSwitch(BaseModel):
    selected_role: str


class UserOut(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: Role
    title: str | None = None
    avatar_initials: str | None = None
    phone: str | None = None
    permissions: list[str] = Field(default_factory=list)
    # Every workspace this account may sign in as, and the one in use now.
    authorized_roles: list[Role] = Field(default_factory=list)
    workspace: str | None = None
    home: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut
