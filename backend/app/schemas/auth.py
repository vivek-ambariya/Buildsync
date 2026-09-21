from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.common import Role


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)


# The workspaces an open sign-up form may create, and no others.
#
# Admin is absent deliberately. Administrators are appointed by an existing
# administrator through POST /users; if a public form could mint one, the
# whole permission matrix would be one registration away from meaningless.
SELF_SIGNUP_ROLES = (Role.contractor, Role.site_engineer, Role.project_manager)


class RegisterRequest(BaseModel):
    """A new account, created by the person who will use it.

    Everything an admin can set on someone else's account — job title, phone,
    project assignments, extra workspaces — is deliberately absent. A new
    account starts as one person in one workspace; the rest is administration.
    """

    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    # Longer than the login minimum on purpose: sign-in has to accept whatever
    # already exists, but a password being chosen now can be held to today's
    # standard.
    password: str = Field(min_length=8, max_length=128)
    # Checked against SELF_SIGNUP_ROLES by the route rather than here, so that
    # asking for Admin is answered as what it is — a refusal, with a sentence
    # saying who to ask — instead of a field-shaped validation complaint.
    role: Role = Role.contractor

    @field_validator("name")
    @classmethod
    def _clean_name(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if len(cleaned) < 2:
            raise ValueError("enter your full name")
        return cleaned


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
