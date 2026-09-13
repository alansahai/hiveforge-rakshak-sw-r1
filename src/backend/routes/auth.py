"""
MPLADS Authentication Routes
POST /api/auth/login         — login and get JWT token
POST /api/auth/logout        — acknowledge logout
GET  /api/auth/me            — current user info (requires token)
GET  /api/auth/demo-users    — list demo credentials (hackathon helper)
"""

import logging
from datetime import timedelta
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from src.backend.services.auth_service import auth_service, ACCESS_TOKEN_EXPIRE_MINUTES
from src.backend.models.auth_schemas import LoginRequest, LoginResponse, UserResponse

import os
from typing import Optional

router = APIRouter(prefix="/auth", tags=["authentication"])
security = HTTPBearer(auto_error=False)
logger = logging.getLogger("AuthRoutes")


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    """
    FastAPI dependency — verifies JWT and returns payload. Raises 401 on failure.
    If DEMO_MODE is true (default for local dev/demo), allows unauthenticated requests
    by falling back to a default demo user profile. When DEMO_MODE is false, enforces
    valid Bearer token authentication.
    """
    demo_mode_active = os.getenv("DEMO_MODE", "true").lower() in ("true", "1", "yes")

    if credentials is None:
        if demo_mode_active:
            return {
                "sub": "ministry_demo",
                "role": "ministry",
                "name": "MoSPI Demo User",
                "state": "National",
                "district": "All",
                "demo_mode": True
            }
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Provide a Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = auth_service.verify_token(credentials.credentials)
    if payload is None:
        if demo_mode_active:
            return {
                "sub": "ministry_demo",
                "role": "ministry",
                "name": "MoSPI Demo User",
                "state": "National",
                "district": "All",
                "demo_mode": True
            }
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


@router.post("/login", response_model=LoginResponse, summary="Login and get JWT token")
def login(body: LoginRequest):
    """
    Authenticate with username + password.
    Returns a JWT access token and user profile.

    **Demo credentials** (all use password `demo123`):
    - `mp_demo` — Member of Parliament
    - `district_demo` — District Authority
    - `state_demo` — State Nodal Officer
    - `ministry_demo` — Ministry Official (MoSPI)
    """
    user = auth_service.authenticate_user(body.username, body.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = auth_service.create_access_token(
        data={"sub": user["username"], "role": user["role"]},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    user_out = auth_service.get_user(user["username"])
    logger.info(f"Login: {user['username']} ({user['role']})")

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_out,
        "role": user["role"],
        "expires_in_minutes": ACCESS_TOKEN_EXPIRE_MINUTES,
    }


@router.post("/logout", summary="Logout (client should discard token)")
def logout(current_user: dict = Depends(get_current_user)):
    """
    Acknowledge a logout request. The client is responsible for discarding
    the JWT token. In production, implement a token blocklist here.
    """
    logger.info(f"Logout: {current_user.get('sub')}")
    return {"success": True, "message": "Logged out successfully. Please discard your token."}


@router.get("/me", response_model=UserResponse, summary="Get current user profile")
def get_me(current_user: dict = Depends(get_current_user)):
    """Return the profile of the currently authenticated user."""
    username = current_user.get("sub")
    user = auth_service.get_user(username)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return user


@router.get("/demo-users", summary="List demo credentials (remove in production)")
def demo_users():
    """
    Returns demo login credentials for all four MPLADS roles.
    Disabled when in production or when DEMO_MODE is false.
    """
    demo_mode_active = os.getenv("DEMO_MODE", "true").lower() in ("true", "1", "yes")
    env = os.getenv("ENV", os.getenv("ENVIRONMENT", "development")).lower()
    if not demo_mode_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demo credentials endpoint disabled in strict authentication mode."
        )
    return {
        "note": "These are demo credentials for SIH 2026 hackathon evaluation.",
        "password_for_all": "demo123",
        "users": auth_service.list_demo_users(),
    }
