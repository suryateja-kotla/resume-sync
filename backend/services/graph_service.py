"""
Microsoft Graph directory client — app-only (client credentials).

Separate from entra_service, which handles the *delegated* sign-in flow. This
module runs under the application's own identity using the `User.Read.All`
application grant, so it can read the whole directory without a user present.
That is what the scheduled sync needs.

Only one operation is exposed: read every user. The sync layer decides what to
do with them.
"""

from __future__ import annotations

import logging
import time
from typing import Any

import httpx

from config.entra_config import settings

logger = logging.getLogger(__name__)

GRAPH_BASE = "https://graph.microsoft.com/v1.0"

# `employeeId`, `employeeType`, `userType` and `accountEnabled` are NOT in
# Graph's default property set. Without an explicit $select they come back
# absent — and absent employeeId would make every single person look
# unlinkable, silently failing the whole sync.
USER_FIELDS = (
    "id,displayName,givenName,surname,mail,userPrincipalName,"
    "employeeId,employeeType,jobTitle,department,officeLocation,"
    "accountEnabled,userType"
)

# Graph caps $top at 999 for /users. Larger values are rejected outright
# rather than clamped.
PAGE_SIZE = 999

_HTTP_TIMEOUT = httpx.Timeout(60.0)

# App-only tokens last an hour. Cache with a safety margin rather than
# re-authenticating on every page of a paged read.
_token_cache: str | None = None
_token_expires_at: float = 0.0
_TOKEN_SKEW_SECONDS = 300


async def _get_app_token() -> str:
    global _token_cache, _token_expires_at

    if _token_cache and time.monotonic() < _token_expires_at:
        return _token_cache

    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
        response = await client.post(
            settings.token_endpoint,
            data={
                "client_id": settings.entra_client_id,
                "client_secret": settings.entra_client_secret,
                "scope": settings.graph_app_scope,
                "grant_type": "client_credentials",
            },
        )

    if response.status_code != 200:
        detail = response.json()
        # Surface the AADSTS code — it is the difference between "secret
        # expired" and "consent revoked", which need very different fixes.
        logger.error(
            "Graph app token request failed: %s — %s",
            detail.get("error"),
            (detail.get("error_description") or "").split("\r\n")[0],
        )
        raise RuntimeError("graph_token_failed")

    payload = response.json()
    _token_cache = payload["access_token"]
    _token_expires_at = time.monotonic() + payload.get("expires_in", 3600) - _TOKEN_SKEW_SECONDS
    return _token_cache


async def fetch_all_users() -> list[dict[str, Any]]:
    """Every user object in the tenant, following @odata.nextLink.

    Returns raw Graph objects — filtering and persona resolution belong to
    role_service, so this stays a dumb reader with no policy in it.

    Raises rather than returning a partial list: a truncated directory would
    look to the sync like everyone after the failure point had left the
    company, and it would deactivate them.
    """
    token = await _get_app_token()
    users: list[dict[str, Any]] = []
    url: str | None = f"{GRAPH_BASE}/users?$select={USER_FIELDS}&$top={PAGE_SIZE}"
    pages = 0

    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
        while url:
            response = await client.get(url, headers={"Authorization": f"Bearer {token}"})
            if response.status_code != 200:
                detail = response.json().get("error", {})
                logger.error(
                    "Graph /users failed on page %s: %s — %s",
                    pages + 1,
                    detail.get("code"),
                    (detail.get("message") or "")[:200],
                )
                raise RuntimeError(f"graph_users_failed:{detail.get('code')}")

            payload = response.json()
            users.extend(payload.get("value", []))
            url = payload.get("@odata.nextLink")
            pages += 1

    logger.info("Graph directory read: %s users across %s page(s)", len(users), pages)
    return users
