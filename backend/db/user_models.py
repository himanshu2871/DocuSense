from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from datetime import datetime, timezone
import uuid


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid.uuid4())


# ── User ──────────────────────────────────────────────────────────────────────

class UserRecord(BaseModel):
    id: str = Field(default_factory=new_id)
    email: str
    username: str
    hashed_password: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=utcnow)

    class Config:
        populate_by_name = True


# ── Auth request / response schemas ──────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: str
    username: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    username: str
    user_id: str


class RefreshRequest(BaseModel):
    refresh_token: str


class UserPublic(BaseModel):
    id: str
    email: str
    username: str
    created_at: datetime
