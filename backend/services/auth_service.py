"""
Auth service — password hashing, JWT creation/validation, FastAPI dependency.

Design decisions:
- Access token: short-lived (8 h), carries employeeId + role.
- Refresh token: long-lived (7 d), stored as a hash in user_accounts so it can
  be invalidated on logout or password change.
- Reset token: one-time, stored as a SHA-256 hash in user_accounts with an
  expiry timestamp. The raw token is sent in the email; the DB never sees it.
- Rate limiting: handled at the route layer via slowapi (5 login attempts / 15 min).
"""

import hashlib
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import bcrypt as _bcrypt_lib
from jose import JWTError, jwt

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────

SECRET_KEY     = os.getenv("JWT_SECRET_KEY", "change-me-in-production")
ALGORITHM      = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_EXPIRY  = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))   # 8 h
REFRESH_EXPIRY = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS",   "7"))     # 7 d
RESET_EXPIRY   = int(os.getenv("RESET_TOKEN_EXPIRE_MINUTES",  "30"))    # 30 min

# ── Password hashing — uses bcrypt directly (avoids passlib compat issues) ───

def hash_password(plain: str) -> str:
    return _bcrypt_lib.hashpw(plain.encode(), _bcrypt_lib.gensalt(rounds=12)).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _bcrypt_lib.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


def is_same_password(plain: str, hashed: str) -> bool:
    """True when the new password is identical to the current one."""
    return verify_password(plain, hashed)


# ── Password strength ─────────────────────────────────────────────────────────

def validate_password_strength(password: str) -> Optional[str]:
    """
    Returns an error message string if the password is too weak, else None.
    Rules: 8+ chars, at least one uppercase, one lowercase, one digit.
    """
    if len(password) < 8:
        return "Password must be at least 8 characters long."
    if not any(c.isupper() for c in password):
        return "Password must contain at least one uppercase letter."
    if not any(c.islower() for c in password):
        return "Password must contain at least one lowercase letter."
    if not any(c.isdigit() for c in password):
        return "Password must contain at least one digit."
    return None


# ── JWT helpers ───────────────────────────────────────────────────────────────

def create_access_token(employee_id: str, role: str) -> str:
    expiry = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_EXPIRY)
    payload = {
        "sub":  employee_id,
        "role": role,
        "type": "access",
        "exp":  expiry,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(employee_id: str) -> tuple[str, str]:
    """
    Returns (raw_token, hashed_token).
    Store the hash in DB; send the raw token to the client.
    """
    expiry = datetime.now(timezone.utc) + timedelta(days=REFRESH_EXPIRY)
    payload = {
        "sub":  employee_id,
        "type": "refresh",
        "exp":  expiry,
    }
    signed = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    hashed = _hash_token(signed)
    return signed, hashed


def decode_access_token(token: str) -> dict:
    """
    Decodes and validates an access token.
    Raises HTTPException 401 on any failure.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail="Invalid token type.")
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is invalid or has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )


def decode_refresh_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail="Invalid token type.")
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is invalid or has expired. Please log in again.",
        )


# ── Reset token helpers ───────────────────────────────────────────────────────

def generate_reset_token() -> tuple[str, str, datetime]:
    """
    Returns (raw_token, hashed_token, expires_at).
    Send raw_token in the email; store hashed_token in DB.
    """
    raw = secrets.token_urlsafe(32)
    hashed = _hash_token(raw)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=RESET_EXPIRY)
    return raw, hashed, expires_at


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def hash_reset_token(raw: str) -> str:
    return _hash_token(raw)


# ── FastAPI dependency — get_current_user ─────────────────────────────────────

bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """
    Validates the Bearer token and returns the decoded payload.
    Raises 401 if token is missing, invalid, or expired.
    Import and use as: current_user = Depends(get_current_user)
    """
    payload = decode_access_token(credentials.credentials)
    return {
        "employee_id": payload["sub"],
        "role":        payload["role"],
    }


async def require_hr(current_user: dict = Depends(get_current_user)) -> dict:
    """
    Dependency that ensures the caller has the HR role.
    Use on all /hr/* routes.
    """
    if current_user["role"] != "HR":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to HR accounts.",
        )
    return current_user
