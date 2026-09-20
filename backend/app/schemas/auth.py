from pydantic import BaseModel, EmailStr, Field

from app.models.common import Role


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)


class UserOut(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: Role
    title: str | None = None
    avatar_initials: str | None = None
    phone: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut
