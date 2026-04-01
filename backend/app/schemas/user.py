from datetime import datetime
from typing import Optional

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
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


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