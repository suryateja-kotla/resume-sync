"""
Request-time authentication and authorization.

Everything the application uses to answer "who is calling, and may they do
this?" lives here. Routes attach these as FastAPI dependencies; they never
read identity out of a request parameter.

That last point is the correction of a specific, serious flaw in the previous
design: routes took `?email=` and `?actor_email=` from the query string and
trusted them. Anyone could read or modify anyone's record, and could choose
whose name appeared in the audit log. Identity now comes only from the session,
which the caller cannot forge.

Three levels:

    get_current_user  any signed-in employee
    require_hr        HR or ADMIN  — read-only views plus Excel export
    require_admin     ADMIN only   — delete employee, audit log

HR deliberately does *not* include destructive actions. Twenty-eight people
resolve to HR against the live directory; delete-employee should not be twenty-
eight people's to press.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import Depends, HTTPException, Request, status

from config.entra_config import settings
from services.role_service import Role
from services.session_service import get_session, verify_csrf

logger = logging.getLogger(__name__)

# Methods that change state and therefore need CSRF verification. GET/HEAD/
# OPTIONS are exempt because they must not have side effects in the first
# place — if one of them does, that is the bug to fix.
_UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


class CurrentUser(dict):
    """Session identity. A dict subclass so existing `current_user["..."]`
    access keeps working, with attribute access for readability."""

    @property
    def employee_id(self) -> str:
        return self["employee_id"]

    @property
    def role(self) -> str:
        return self["role"]

    @property
    def email(self) -> str:
        return self["email"]

    @property
    def is_admin(self) -> bool:
        return self["role"] == Role.ADMIN.value

    @property
    def is_hr(self) -> bool:
        return self["role"] in (Role.HR.value, Role.ADMIN.value)


async def get_current_user(request: Request) -> CurrentUser:
    """Resolve the caller from the session cookie, enforcing CSRF on writes.

    Raises 401 when there is no valid session, 403 when the CSRF token is
    missing or wrong.
    """
    session_id = request.cookies.get(settings.session_cookie_name)
    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not signed in.",
        )

    session = await get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your session has expired. Please sign in again.",
        )

    if request.method in _UNSAFE_METHODS:
        submitted = request.headers.get("X-CSRF-Token")
        if not verify_csrf(session, submitted):
            logger.warning(
                "CSRF check failed for %s on %s %s",
                session.get("employee_id"),
                request.method,
                request.url.path,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid or missing CSRF token.",
            )

    return CurrentUser(
        employee_id=session["employee_id"],
        role=session["role"],
        email=session["email"],
        display_name=session.get("display_name", ""),
        entra_object_id=session.get("entra_object_id"),
    )


async def require_hr(
    current_user: CurrentUser = Depends(get_current_user),
) -> CurrentUser:
    """HR or ADMIN. Use on read-only HR views and Excel exports."""
    if not current_user.is_hr:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This area is restricted to HR.",
        )
    return current_user


async def require_admin(
    current_user: CurrentUser = Depends(get_current_user),
) -> CurrentUser:
    """ADMIN only. Use on destructive actions and the audit log."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This action is restricted to administrators.",
        )
    return current_user


def assert_owns_record(current_user: CurrentUser, employee_id: str) -> None:
    """Guard for routes addressed by employee id.

    An employee may only ever touch their own record; HR and ADMIN may touch
    any. Without this, adding a session check alone would still leave the
    original IDOR intact — authentication is not authorization.
    """
    if current_user.is_hr:
        return
    if current_user.employee_id != employee_id:
        logger.warning(
            "IDOR attempt: %s tried to access %s",
            current_user.employee_id,
            employee_id,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access your own record.",
        )


def public_user(current_user: CurrentUser) -> dict[str, Any]:
    """Shape returned by /auth/me — no session internals leak to the client."""
    return {
        "employee_id": current_user["employee_id"],
        "email": current_user["email"],
        "full_name": current_user.get("display_name", ""),
        "role": current_user["role"],
    }
