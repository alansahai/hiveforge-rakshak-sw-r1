"""
MPLADS JWT Authentication Service
Demo users with role-based access: mp / district / state / ministry
Secret key and user store should move to a DB + env var in production.
"""

import os
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from jose import JWTError, jwt

logger = logging.getLogger("AuthService")

# ── Config ────────────────────────────────────────────────────────────────────
SECRET_KEY = os.getenv("SECRET_KEY", "mplads-sih2026-secret-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))  # 24 h

# ── Demo user store ───────────────────────────────────────────────────────────
# In production replace this with a PostgreSQL/SQLite user table.
_DEMO_USERS: dict = {}

def _build_demo_users() -> dict:
    def h(pw: str) -> str:
        return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
    return {
        "mp_demo": {
            "username": "mp_demo",
            "full_name": "Member of Parliament — Demo",
            "email": "mp@parliament.gov.in",
            "hashed_password": h("demo123"),
            "role": "mp",
            "is_active": True,
        },
        "district_demo": {
            "username": "district_demo",
            "full_name": "District Authority — Demo",
            "email": "district@mplads.gov.in",
            "hashed_password": h("demo123"),
            "role": "district",
            "is_active": True,
        },
        "state_demo": {
            "username": "state_demo",
            "full_name": "State Nodal Officer — Demo",
            "email": "state@mplads.gov.in",
            "hashed_password": h("demo123"),
            "role": "state",
            "is_active": True,
        },
        "ministry_demo": {
            "username": "ministry_demo",
            "full_name": "Ministry Official — MoSPI",
            "email": "ministry@mospi.gov.in",
            "hashed_password": h("demo123"),
            "role": "ministry",
            "is_active": True,
        },
        "admin": {
            "username": "admin",
            "full_name": "System Administrator",
            "email": "admin@mplads.gov.in",
            "hashed_password": h("admin2026"),
            "role": "ministry",
            "is_active": True,
        },
    }


class AuthService:
    """JWT-based authentication with role-based access control."""

    def __init__(self):
        global _DEMO_USERS
        if not _DEMO_USERS:
            logger.info("Hashing demo user passwords (first-time setup)…")
            _DEMO_USERS = _build_demo_users()
            logger.info(f"Demo users ready: {list(_DEMO_USERS.keys())}")

    # ── Password ───────────────────────────────────────────────────────────────

    @staticmethod
    def verify_password(plain: str, hashed: str) -> bool:
        return bcrypt.checkpw(plain.encode(), hashed.encode())

    @staticmethod
    def hash_password(plain: str) -> str:
        return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()

    # ── User lookup ────────────────────────────────────────────────────────────

    def authenticate_user(self, username: str, password: str) -> Optional[dict]:
        """Return user dict if credentials are valid, else None."""
        user = _DEMO_USERS.get(username)
        if not user:
            return None
        if not self.verify_password(password, user["hashed_password"]):
            return None
        if not user.get("is_active", True):
            return None
        return user

    def get_user(self, username: str) -> Optional[dict]:
        """Return public user info (no hashed_password)."""
        user = _DEMO_USERS.get(username)
        if not user:
            return None
        return {
            "username": user["username"],
            "full_name": user["full_name"],
            "email": user["email"],
            "role": user["role"],
            "is_active": user["is_active"],
        }

    def list_demo_users(self) -> list:
        """Return demo credential list for the /demo-users endpoint."""
        roles_labels = {
            "mp": "Member of Parliament",
            "district": "District Authority",
            "state": "State Nodal Officer",
            "ministry": "Ministry Official (MoSPI)",
        }
        result = []
        for uname, info in _DEMO_USERS.items():
            if uname == "admin":
                continue
            result.append({
                "role_label": roles_labels.get(info["role"], info["role"].title()),
                "username": uname,
                "password": "demo123",
                "email": info["email"],
                "role": info["role"],
            })
        return result

    # ── JWT ────────────────────────────────────────────────────────────────────

    @staticmethod
    def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
        payload = data.copy()
        expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=15))
        payload["exp"] = expire
        return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

    @staticmethod
    def verify_token(token: str) -> Optional[dict]:
        """Decode and verify a JWT; returns payload dict or None."""
        try:
            return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        except JWTError:
            return None


# Singleton
auth_service = AuthService()
