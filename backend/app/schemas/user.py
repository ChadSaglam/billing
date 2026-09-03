from datetime import datetime

from pydantic import BaseModel, EmailStr


class UserRead(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    full_name: str | None = None
    role: str | None = None
    is_active: bool | None = None


class InviteRequest(BaseModel):
    email: EmailStr
    full_name: str
    role: str = "editor"


class InviteResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    temp_password: str
    model_config = {"from_attributes": True}