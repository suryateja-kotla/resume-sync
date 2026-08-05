"""
Auth routes — /api/auth/*

Entra ID single sign-on. There is no password anywhere in this application.

    GET  /auth/login     redirect the browser to Microsoft
    GET  /auth/callback  Microsoft redirects back here; session is minted
    POST /auth/logout    revoke the session
    GET  /auth/me        who am I (frontend calls this on load)

The callback is the only place a session is created, and it refuses to create
one unless `role_service.evaluate()` says the person may sign in — so the
intern block, the guest block and the disabled-account block are all enforced
at the single point where access is granted.

Failures redirect to the frontend with a short error code rather than
returning JSON, because the browser is doing a top-level navigation here and
the user needs to land on a page, not a stack trace.
"""

from __future__ import annotations

import logging
import urllib.parse

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse, RedirectResponse

from config.entra_config import settings
from services.auth_service import CurrentUser, get_current_user, public_user
from services.db_service import upsert_user_from_directory, write_audit_event
from services.entra_service import (
    build_authorize_url,
    exchange_code,
    fetch_me,
    start_login,
    verify_id_token,
)
from services.role_service import evaluate
from services.session_service import (
    consume_login_transaction,
    create_login_transaction,
    create_session,
    revoke_session,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

# Binds the sign-in attempt to this browser, so an attacker cannot feed a
# victim a callback URL from a sign-in *they* started (login CSRF).
_LOGIN_STATE_COOKIE = "sf_login_state"

# Error codes surfaced to the frontend. Deliberately coarse — the detail goes
# to the server log, not to the query string.
_ERRORS = {
    "intern_not_permanent": "Your account is not yet enabled for sign-in. "
                            "HR will invite you once your employment is confirmed.",
    "no_employee_id": "Your directory record has no Employee ID. Please contact HR.",
    "guest_account": "Guest accounts cannot access SyncFolio.",
    "account_disabled": "Your account is disabled.",
    "auth_failed": "Sign-in failed. Please try again.",
}


def _redirect_with_error(code: str) -> RedirectResponse:
    target = f"{settings.frontend_base_url}/login?error={urllib.parse.quote(code)}"
    return RedirectResponse(target, status_code=status.HTTP_302_FOUND)


def _cookie_kwargs(http_only: bool, max_age: int | None = None) -> dict:
    kwargs = {
        "httponly": http_only,
        "secure": settings.session_cookie_secure,
        "samesite": settings.session_cookie_samesite,
        "path": "/",
    }
    if max_age is not None:
        kwargs["max_age"] = max_age
    return kwargs


# ── GET /auth/login ──────────────────────────────────────────────────────────


@router.get("/login")
async def login():
    """Kick off sign-in. The browser is sent to Microsoft; nothing is trusted
    from the caller, so this endpoint takes no parameters — in particular no
    caller-supplied redirect target, which would be an open-redirect."""
    transaction = start_login()
    await create_login_transaction(
        transaction.state, transaction.nonce, transaction.code_verifier
    )

    response = RedirectResponse(
        build_authorize_url(transaction), status_code=status.HTTP_302_FOUND
    )
    response.set_cookie(
        _LOGIN_STATE_COOKIE,
        transaction.state,
        **_cookie_kwargs(http_only=True, max_age=600),
    )
    return response


# ── GET /auth/callback ───────────────────────────────────────────────────────


@router.get("/callback")
async def callback(request: Request, code: str = "", state: str = "", error: str = ""):
    if error:
        logger.warning("Entra returned an error at callback: %s", error)
        return _redirect_with_error("auth_failed")

    if not code or not state:
        return _redirect_with_error("auth_failed")

    # The state must match both the server-side transaction and this browser's
    # cookie. Either alone is weaker: the transaction proves we started it, the
    # cookie proves *this* browser started it.
    if request.cookies.get(_LOGIN_STATE_COOKIE) != state:
        logger.warning("login state cookie mismatch — possible login CSRF")
        return _redirect_with_error("auth_failed")

    transaction = await consume_login_transaction(state)
    if not transaction:
        logger.warning("no matching login transaction for state (expired or replayed)")
        return _redirect_with_error("auth_failed")

    try:
        tokens = await exchange_code(code, transaction["code_verifier"])
        identity = await verify_id_token(tokens["id_token"], transaction["nonce"])
        profile = await fetch_me(tokens["access_token"])
    except Exception:
        logger.exception("sign-in failed during token exchange or verification")
        return _redirect_with_error("auth_failed")

    # Graph /me omits userType, so evaluate() would see a missing value and
    # treat the person as a guest. The id_token already proved they are a
    # member of our tenant, so fill it in from that.
    profile.setdefault("userType", "Member")
    profile.setdefault("accountEnabled", True)

    decision = evaluate(profile)

    if not decision.can_sign_in:
        logger.info(
            "sign-in denied for %s: %s", identity.email, decision.reason
        )
        await write_audit_event(
            event_type="LOGIN_DENIED",
            actor=identity.email,
            employee_id=decision.employee_id,
            payload={"reason": decision.reason},
        )
        return _redirect_with_error(decision.reason)

    # Keep the app's copy of the directory record fresh on every sign-in, so a
    # role or department change takes effect immediately rather than waiting
    # for the next scheduled sync.
    await upsert_user_from_directory(profile, decision, identity.object_id)

    # csrf_token itself isn't used here — it's read back from the session on
    # the next /auth/me call instead of being set as a cookie. See the note
    # on response.set_cookie below.
    session_id, _csrf_token = await create_session(
        employee_id=decision.employee_id,
        entra_object_id=identity.object_id,
        email=identity.email,
        display_name=identity.display_name,
        role=decision.role.value,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )

    await write_audit_event(
        event_type="LOGIN",
        actor=decision.employee_id,
        employee_id=decision.employee_id,
        payload={"role": decision.role.value, "reason": decision.reason},
    )

    response = RedirectResponse(
        f"{settings.frontend_base_url}/", status_code=status.HTTP_302_FOUND
    )
    # Session id: httpOnly, unreadable by JavaScript. An XSS cannot exfiltrate it.
    response.set_cookie(
        settings.session_cookie_name, session_id, **_cookie_kwargs(http_only=True)
    )
    # csrf_token is NOT set as a cookie here — a cookie set by this response
    # (backend origin) is invisible to document.cookie on the frontend's
    # different *.run.app origin, so a reader-cookie can never work in this
    # deployment shape. The frontend instead fetches it from GET /auth/me,
    # the first authenticated JSON call it makes after this redirect lands.
    response.delete_cookie(_LOGIN_STATE_COOKIE, path="/")
    return response


# ── POST /auth/logout ────────────────────────────────────────────────────────


@router.post("/logout")
async def logout(request: Request, current_user: CurrentUser = Depends(get_current_user)):
    """Revoke the session server-side and clear the cookies.

    Deleting the row is what actually ends the session — clearing cookies alone
    would leave a still-valid session id in anything that captured it.
    """
    session_id = request.cookies.get(settings.session_cookie_name)
    if session_id:
        await revoke_session(session_id)

    await write_audit_event(
        event_type="LOGOUT",
        actor=current_user.employee_id,
        employee_id=current_user.employee_id,
        payload={},
    )

    response = JSONResponse({"status": "success", "message": "Signed out."})
    response.delete_cookie(settings.session_cookie_name, path="/")
    return response


# ── GET /auth/me ─────────────────────────────────────────────────────────────


@router.get("/me")
async def me(current_user: CurrentUser = Depends(get_current_user)):
    """Called by the frontend on load to rehydrate auth state.

    The frontend holds no token and cannot decode anything itself, so this is
    the only way it learns who it is — which is the point: the client is no
    longer the authority on its own identity or role.
    """
    return {"status": "success", "user": public_user(current_user)}
