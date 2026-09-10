"""
Pydantic schemas for authentication endpoints.
"""

from pydantic import BaseModel, Field
from typing import Optional


class LoginRequest(BaseModel):
    username: str = Field(..., example="mp_demo")
    password: str = Field(..., example="demo123")


class UserResponse(BaseModel):
    username: str
    full_name: str
    email: str
    role: str
    is_active: bool


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
    role: str
    expires_in_minutes: int


class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None
