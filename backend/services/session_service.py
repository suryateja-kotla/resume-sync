"""
Server-side session store.

The browser cookie carries an opaque random id and nothing else — no claims,
no role, no expiry the client can see or edit. All of that lives in Mongo,
which means a session can actually be *revoked*: deleting the row logs the
person out immediately.

That is a deliberate correction of the previous design. The old system issued
stateless 8-hour JWTs with no revocation list, so changing a password did not
invalidate an already-stolen access token — it stayed valid until it expired.
Here, revoking is a delete.

Two independent expiries, both enforced server-side:

  idle      — rolls forward on each request (default 60 min of inactivity)
  absolute  — fixed from sign-in, never extends (default 8 h)

The absolute cap is what stops a session living forever just because someone
keeps a tab open.

## CSRF

Cookies are sent by the browser automatically, so a cookie-authenticated API
is CSRF-exposed by default. Mitigated with a double-submit token: a second,
JS-readable cookie holds a random value that the frontend echoes in the
`X-CSRF-Token` header. An attacker's page can cause a request to be sent, but
cannot read our cookie to populate that header (same-origin policy), so the
comparison fails.

This matters more here than usual: the frontend and backend sit on different
*.run.app hosts, forcing `SameSite=None`, which removes the partial protection
SameSite would otherwise give.
"""

from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from pymongo.errors import PyMongoError

from config.entra_config import settings
from services.db_service import db

logger = logging.getLogger(__name__)

col_sessions = db["sessions"]


def _hash(raw: str) -> str:
    """Sessions are stored hashed, so a leaked database dump does not hand
    over live sessions the way plaintext ids would."""
    return hashlib.sha256(raw.encode()).hexdigest()


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def create_session(
    *,
    employee_id: str,
    entra_object_id: str,
    email: str,
    display_name: str,
    role: str,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> tuple[str, str]:
    """Create a session. Returns (session_id, csrf_token) — both raw, to be
    set as cookies. Only their hashes are persisted."""
    session_id = secrets.token_urlsafe(32)
    csrf_token = secrets.token_urlsafe(32)
    now = _now()

    await col_sessions.insert_one(
        {
            "session_hash": _hash(session_id),
            "csrf_hash": _hash(csrf_token),
            "employee_id": employee_id,
            "entra_object_id": entra_object_id,
            "email": email,
            "display_name": display_name,
            "role": role,
            "created_at": now,
            "last_seen_at": now,
            # Drives the TTL index. Recomputed on every touch, so an idle
            # session is reaped by Mongo even if nothing ever reads it again.
            "expires_at": now + timedelta(minutes=settings.session_idle_minutes),
            "absolute_expires_at": now + timedelta(hours=settings.session_absolute_hours),
            "user_agent": (user_agent or "")[:300],
            "ip_address": ip_address,
        }
    )
    return session_id, csrf_token


async def get_session(session_id: str) -> Optional[dict[str, Any]]:
    """Look up and refresh a session. Returns None if missing or expired.

    Expiry is re-checked in Python rather than trusted to the TTL index:
    Mongo's TTL reaper runs on roughly a 60-second cycle, so an expired row
    can still be present and must not be honoured.
    """
    if not session_id:
        return None

    try:
        session = await col_sessions.find_one({"session_hash": _hash(session_id)})
    except PyMongoError as exc:
        logger.error("session lookup failed: %s", exc)
        return None

    if not session:
        return None

    now = _now()

    def _aware(value: datetime) -> datetime:
        # Mongo hands back naive datetimes; compare in UTC either way.
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)

    if now > _aware(session["absolute_expires_at"]):
        await revoke_session(session_id)
        return None

    if now > _aware(session["expires_at"]):
        await revoke_session(session_id)
        return None

    # Slide the idle window forward, but never past the absolute cap.
    new_expiry = min(
        now + timedelta(minutes=settings.session_idle_minutes),
        _aware(session["absolute_expires_at"]),
    )
    await col_sessions.update_one(
        {"_id": session["_id"]},
        {"$set": {"last_seen_at": now, "expires_at": new_expiry}},
    )
    return session


def verify_csrf(session: dict[str, Any], token: str | None) -> bool:
    """Constant-time compare of the submitted CSRF token against the session."""
    if not token:
        return False
    return secrets.compare_digest(session.get("csrf_hash", ""), _hash(token))


async def revoke_session(session_id: str) -> None:
    try:
        await col_sessions.delete_one({"session_hash": _hash(session_id)})
    except PyMongoError as exc:
        logger.error("session revoke failed: %s", exc)


async def revoke_all_for_employee(employee_id: str) -> int:
    """Kill every session for one person.

    Called when the directory sync sees someone disabled, off-boarded, or
    demoted — the point of server-side sessions is that this takes effect on
    the next request rather than whenever a token would have expired.
    """
    try:
        result = await col_sessions.delete_many({"employee_id": employee_id})
        return result.deleted_count
    except PyMongoError as exc:
        logger.error("bulk session revoke failed for %s: %s", employee_id, exc)
        return 0


# ── Login transactions ───────────────────────────────────────────────────────
#
# The state / nonce / PKCE verifier have to survive the round trip out to
# Microsoft and back. They are held server-side rather than in a cookie so the
# verifier — the thing that makes a stolen authorization code useless — never
# touches the browser at all.

col_login_transactions = db["login_transactions"]

_LOGIN_TRANSACTION_TTL_MINUTES = 10


async def create_login_transaction(state: str, nonce: str, code_verifier: str) -> None:
    now = _now()
    await col_login_transactions.insert_one(
        {
            "state_hash": _hash(state),
            "nonce": nonce,
            "code_verifier": code_verifier,
            "created_at": now,
            "expires_at": now + timedelta(minutes=_LOGIN_TRANSACTION_TTL_MINUTES),
        }
    )


async def consume_login_transaction(state: str) -> Optional[dict[str, Any]]:
    """Fetch and delete in one atomic step.

    `find_one_and_delete` rather than find-then-delete so a replayed callback
    cannot race a legitimate one and have both succeed — the code may only be
    exchanged once.
    """
    if not state:
        return None

    try:
        transaction = await col_login_transactions.find_one_and_delete(
            {"state_hash": _hash(state)}
        )
    except PyMongoError as exc:
        logger.error("login transaction lookup failed: %s", exc)
        return None

    if not transaction:
        return None

    expires_at = transaction["expires_at"]
    if not expires_at.tzinfo:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if _now() > expires_at:
        return None

    return transaction
