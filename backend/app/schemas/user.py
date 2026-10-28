from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


def _validate_email(value: str) -> str:
    v = (value or "").strip().lower()
    if "@" not in v or v.startswith("@") or v.endswith("@") or " " in v or "." not in v.split("@")[-1]:
        raise ValueError("Enter a valid email address.")
    return v


class UserBase(BaseModel):
    email: str = Field(..., min_length=3, max_length=255, description="User email address")
    full_name: str = Field(..., min_length=2, max_length=255)
    role: str = "planner"

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        return _validate_email(v)

    @field_validator("role")
    @classmethod
    def _role(cls, v: str) -> str:
        v = (v or "planner").strip().lower()
        if v not in ("planner", "admin", "operator", "viewer"):
            raise ValueError("Role must be one of planner, admin, operator, viewer.")
        return v


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=72, description="8-72 characters")


class UserLogin(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        return _validate_email(v)


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=72)


class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenData(BaseModel):
    email: Optional[str] = None
    user_id: Optional[int] = None
