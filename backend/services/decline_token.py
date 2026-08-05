"""
Signed tokens for the "nothing has changed" link in monthly emails.

The link is clicked from an email client, so it cannot require a session — the
person may not be signed in, and forcing sign-in for a one-click "no changes"
would defeat the point.

That makes the URL itself the credential, so it is signed rather than guessable:

    <employee_id>.<period>.<hmac>

HMAC-SHA256 over "employee_id:period" with the app's own secret. Without the
secret nobody can mint a token, so nobody can mark a colleague as declined —
which would quietly remove that person from HR's follow-up list.

Scoped to one period. August's link cannot be replayed in September, so a
forwarded or archived email stops working when the next cycle starts.
"""

from __future__ import annotations

import hashlib
import hmac
import logging

from config.entra_config import settings

logger = logging.getLogger(__name__)


def _secret() -> bytes:
    """Signing key. Reuses the client secret rather than adding another one to
    manage — it is already required, already protected, and rotating it
    invalidates outstanding decline links, which is acceptable."""
    raw = settings.entra_client_secret
    if not raw:
        raise RuntimeError("Cannot sign decline tokens: ENTRA_CLIENT_SECRET is unset")
    return raw.encode()


def _signature(employee_id: str, period: str) -> str:
    return hmac.new(
        _secret(), f"{employee_id}:{period}".encode(), hashlib.sha256
    ).hexdigest()[:32]


def make_token(employee_id: str, period: str) -> str:
    return f"{employee_id}.{period}.{_signature(employee_id, period)}"


def verify_token(token: str) -> tuple[str, str] | None:
    """Returns (employee_id, period) if the signature is valid, else None."""
    try:
        employee_id, period, signature = token.rsplit(".", 2)
    except ValueError:
        return None

    # Constant-time compare — a plain == leaks the signature prefix through
    # response timing, which is enough to forge one given patience.
    if not hmac.compare_digest(signature, _signature(employee_id, period)):
        logger.warning("Rejected decline token with bad signature for %r", employee_id)
        return None

    return employee_id, period
