"""
Auth routes — /api/auth/*

Endpoints:
  POST /auth/login                 — email + password → access + refresh tokens
  POST /auth/refresh               — refresh token → new access token
  POST /auth/logout                — invalidates refresh token in DB
  POST /auth/change-password       — authenticated, requires current password
  POST /auth/forgot-password       — sends reset email (always returns 200)
  POST /auth/reset-password        — validates reset token, sets new password
"""

import logging
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr
from slowapi import Limiter
from slowapi.util import get_remote_address

from services.auth_service import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    generate_reset_token,
    get_current_user,
    hash_password,
    hash_reset_token,
    is_same_password,
    validate_password_strength,
    verify_password,
)
from services.db_service import col_user_accounts, col_employee_skill_summary, write_audit_event

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

limiter = Limiter(key_func=get_remote_address)

FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:4200")


# ── Request / Response schemas ────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    employee_id: str
    email: str
    role: str
    full_name: str
    must_change_password: bool


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_account_by_email(email: str) -> dict | None:
    return await col_user_accounts.find_one({"email": email}, {"_id": 0})


async def _get_account_by_id(employee_id: str) -> dict | None:
    return await col_user_accounts.find_one({"employeeId": employee_id}, {"_id": 0})


async def _get_full_name(employee_id: str) -> str:
    skill = await col_employee_skill_summary.find_one(
        {"employee_id": employee_id}, {"_id": 0, "name": 1}
    )
    return skill.get("name", "") if skill else ""


# ── POST /auth/login ──────────────────────────────────────────────────────────

@router.post("/login", response_model=LoginResponse)
@limiter.limit("10/15minute")
async def login(request: Request, body: LoginRequest):
    """
    Authenticates an employee with email + password.
    Returns JWT access token (8 h) and refresh token (7 d).
    Rejects inactive accounts and accounts without a password set.
    """
    account = await _get_account_by_email(body.email)

    # Always run verify_password even on failure to prevent timing attacks
    dummy_hash = "$2b$12$invalidhashusedtoblindtiming00000000000000000000000000000"
    stored_hash = account.get("password_hash", dummy_hash) if account else dummy_hash
    password_ok = verify_password(body.password, stored_hash)

    if not account or not password_ok:
        # Log failed attempt without exposing which field was wrong
        if account:
            await write_audit_event(
                event_type="FAILED_LOGIN",
                actor=account.get("employeeId", body.email),
                employee_id=account.get("employeeId"),
                payload={"email": body.email, "reason": "wrong_password"},
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if account.get("status") != "Active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is inactive. Contact HR.",
        )

    if not account.get("password_hash"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Password not set. Contact HR to get your initial credentials.",
        )

    employee_id = account["employeeId"]
    role = account["role"]

    # Issue tokens
    access_token = create_access_token(employee_id, role)
    refresh_token, refresh_hash = create_refresh_token(employee_id)

    # Persist refresh token hash + update last login
    await col_user_accounts.update_one(
        {"employeeId": employee_id},
        {"$set": {
            "refresh_token_hash": refresh_hash,
            "lastLoginAt": datetime.now(timezone.utc),
        }},
    )

    full_name = await _get_full_name(employee_id)

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        employee_id=employee_id,
        email=body.email,
        role=role,
        full_name=full_name,
        must_change_password=account.get("must_change_password", False),
    )


# ── POST /auth/refresh ────────────────────────────────────────────────────────

@router.post("/refresh")
async def refresh_token(body: RefreshRequest):
    """
    Validates the refresh token and issues a new access token.
    The refresh token hash must match what is stored in user_accounts.
    """
    payload = decode_refresh_token(body.refresh_token)
    employee_id = payload["sub"]

    account = await _get_account_by_id(employee_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Account not found.")

    stored_hash = account.get("refresh_token_hash")
    incoming_hash = hash_reset_token(body.refresh_token)  # reuses SHA-256 helper
    if not stored_hash or stored_hash != incoming_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is invalid or has been revoked. Please log in again.",
        )

    if account.get("status") != "Active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Account is inactive.")

    new_access = create_access_token(employee_id, account["role"])
    return {"access_token": new_access, "token_type": "bearer"}


# ── POST /auth/logout ─────────────────────────────────────────────────────────

@router.post("/logout")
async def logout(
    body: LogoutRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Invalidates the refresh token by clearing it from user_accounts.
    The access token expires on its own (8 h TTL).
    """
    await col_user_accounts.update_one(
        {"employeeId": current_user["employee_id"]},
        {"$unset": {"refresh_token_hash": ""}},
    )
    return {"status": "success", "message": "Logged out successfully."}


# ── POST /auth/change-password ────────────────────────────────────────────────

@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Authenticated password change. Requires the current password.
    Clears must_change_password flag and invalidates all refresh tokens.
    """
    employee_id = current_user["employee_id"]
    account = await _get_account_by_id(employee_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found.")

    # Verify current password
    if not verify_password(body.current_password, account.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    # Block password reuse
    if is_same_password(body.new_password, account.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current password.",
        )

    # Enforce strength rules
    error = validate_password_strength(body.new_password)
    if error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)

    new_hash = hash_password(body.new_password)
    await col_user_accounts.update_one(
        {"employeeId": employee_id},
        {"$set": {
            "password_hash":         new_hash,
            "must_change_password":  False,
            "reset_token_hash":      None,
            "reset_token_expires":   None,
        },
        "$unset": {"refresh_token_hash": ""}},  # invalidate all sessions
    )

    await write_audit_event(
        event_type="PASSWORD_CHANGED",
        actor=employee_id,
        employee_id=employee_id,
        payload={"method": "change_password"},
    )
    return {"status": "success", "message": "Password changed successfully. Please log in again."}


# ── POST /auth/forgot-password ────────────────────────────────────────────────

@router.post("/forgot-password")
@limiter.limit("10/hour")
async def forgot_password(request: Request, body: ForgotPasswordRequest):
    """
    Sends a password reset link to the given email.
    Always returns 200 regardless of whether the email exists (prevents email enumeration).
    """
    generic_response = {
        "status": "success",
        "message": "If that email is registered, a reset link has been sent.",
    }

    account = await _get_account_by_email(body.email)
    if not account or account.get("status") != "Active":
        return generic_response

    employee_id = account["employeeId"]
    raw_token, hashed_token, expires_at = generate_reset_token()

    await col_user_accounts.update_one(
        {"employeeId": employee_id},
        {"$set": {
            "reset_token_hash":    hashed_token,
            "reset_token_expires": expires_at,
        }},
    )

    reset_url = f"{FRONTEND_BASE_URL}/reset-password?token={raw_token}"
    full_name = await _get_full_name(employee_id)

    # Send email
    try:
        from config.email_config import settings as email_settings
        from services.email_service import EmailService
        EmailService(email_settings).send_password_reset(
            recipient_email=body.email,
            recipient_name=full_name or body.email.split("@")[0].title(),
            reset_url=reset_url,
            expires_minutes=30,
        )
        logger.info(f"Password reset email sent to {body.email}")
    except Exception as e:
        logger.error(f"Password reset email failed for {body.email}: {type(e).__name__}: {e}", exc_info=True)

    await write_audit_event(
        event_type="PASSWORD_RESET_REQUESTED",
        actor=employee_id,
        employee_id=employee_id,
        payload={"email": body.email},
    )
    return generic_response


# ── POST /auth/reset-password ─────────────────────────────────────────────────

@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest):
    """
    Validates the one-time reset token and sets the new password.
    Token is compared against its SHA-256 hash stored in DB.
    Token is invalidated immediately after use.
    """
    incoming_hash = hash_reset_token(body.token)

    account = await col_user_accounts.find_one(
        {"reset_token_hash": incoming_hash}, {"_id": 0}
    )

    if not account:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset link is invalid or has already been used.",
        )

    # Check expiry
    expires_at = account.get("reset_token_expires")
    if not expires_at or datetime.now(timezone.utc) > expires_at.replace(tzinfo=timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset link has expired. Please request a new one.",
        )

    # Enforce strength rules
    error = validate_password_strength(body.new_password)
    if error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)

    # Block password reuse
    if is_same_password(body.new_password, account.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the previous one.",
        )

    new_hash = hash_password(body.new_password)
    employee_id = account["employeeId"]

    await col_user_accounts.update_one(
        {"employeeId": employee_id},
        {
            "$set": {
                "password_hash":        new_hash,
                "must_change_password": False,
                "reset_token_hash":     None,
                "reset_token_expires":  None,
            },
            "$unset": {"refresh_token_hash": ""},  # revoke all active sessions
        },
    )

    await write_audit_event(
        event_type="PASSWORD_RESET_COMPLETED",
        actor=employee_id,
        employee_id=employee_id,
        payload={"email": account.get("email")},
    )
    return {"status": "success", "message": "Password reset successfully. You can now log in."}
