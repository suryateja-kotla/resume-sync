"""
Entra ID OIDC client — authorization-code flow with PKCE.

The backend is a *confidential* client: the code-for-token exchange happens
here, server-side, using the client secret. No token ever reaches the browser.
That is the whole point of the BFF shape — it removes the class of attack where
an XSS reads a token out of localStorage, because there is nothing to read.

Flow:

    GET /auth/login
      -> mint state + nonce + PKCE verifier, stash them server-side
      -> 302 to Entra

    GET /auth/callback?code=...&state=...
      -> look up the stashed transaction by state
      -> exchange code + verifier for tokens (client secret used here)
      -> verify the id_token signature and every claim that matters
      -> mint an application session

`verify_id_token` is the security boundary. A token can be perfectly signed by
Microsoft and still be the wrong token — issued to a different application, or
by a different tenant, or replayed from an older sign-in. Each of those is a
separate check below.
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import logging
import secrets
import time
import urllib.parse
from dataclasses import dataclass

import httpx
from jose import jwt
from jose.exceptions import JWTError

from config.entra_config import settings

logger = logging.getLogger(__name__)

# Microsoft rotates signing keys. Cache the JWKS so we are not fetching it on
# every sign-in, but re-fetch on an unknown `kid` so a rotation self-heals
# rather than locking everyone out until the TTL lapses.
_JWKS_TTL_SECONDS = 3600
_jwks_cache: dict | None = None
_jwks_fetched_at: float = 0.0
_jwks_lock = asyncio.Lock()

_HTTP_TIMEOUT = httpx.Timeout(20.0)


@dataclass(frozen=True)
class LoginTransaction:
    """The per-sign-in secrets that must survive the round trip to Entra."""

    state: str
    nonce: str
    code_verifier: str


@dataclass(frozen=True)
class EntraIdentity:
    """Verified claims for the person who just signed in."""

    object_id: str
    email: str
    display_name: str
    tenant_id: str


# ── PKCE + authorize URL ─────────────────────────────────────────────────────


def start_login() -> LoginTransaction:
    """Mint the one-time values for a sign-in attempt.

    - `state` ties the callback back to this attempt and blocks CSRF on the
      login endpoint itself (an attacker cannot make you complete *their*
      sign-in and end up logged in as them).
    - `nonce` is echoed inside the id_token, so a token captured from an older
      sign-in cannot be replayed into a new one.
    - `code_verifier` is PKCE: even if the authorization code leaks from the
      redirect URL, it is useless without this value, which never leaves us.
    """
    verifier = secrets.token_urlsafe(64)
    return LoginTransaction(
        state=secrets.token_urlsafe(32),
        nonce=secrets.token_urlsafe(32),
        code_verifier=verifier,
    )


def _code_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def build_authorize_url(transaction: LoginTransaction) -> str:
    query = {
        "client_id": settings.entra_client_id,
        "response_type": "code",
        "redirect_uri": settings.entra_redirect_uri,
        "response_mode": "query",
        "scope": " ".join(settings.login_scopes),
        "state": transaction.state,
        "nonce": transaction.nonce,
        "code_challenge": _code_challenge(transaction.code_verifier),
        "code_challenge_method": "S256",
    }
    return f"{settings.authorize_endpoint}?{urllib.parse.urlencode(query)}"


# ── Token exchange ───────────────────────────────────────────────────────────


async def exchange_code(code: str, code_verifier: str) -> dict:
    """Trade the authorization code for tokens. Raises on any Entra error."""
    form = {
        "client_id": settings.entra_client_id,
        "client_secret": settings.entra_client_secret,
        "code": code,
        "redirect_uri": settings.entra_redirect_uri,
        "grant_type": "authorization_code",
        "code_verifier": code_verifier,
        "scope": " ".join(settings.login_scopes),
    }
    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
        response = await client.post(settings.token_endpoint, data=form)

    if response.status_code != 200:
        detail = response.json()
        # AADSTS codes are the fastest route to a fix, so keep them in the log —
        # but never log the response body wholesale, it carries tokens.
        logger.error(
            "Entra token exchange failed: %s — %s",
            detail.get("error"),
            (detail.get("error_description") or "").split("\r\n")[0],
        )
        raise ValueError("token_exchange_failed")

    return response.json()


# ── id_token verification ────────────────────────────────────────────────────


async def _get_jwks(force_refresh: bool = False) -> dict:
    global _jwks_cache, _jwks_fetched_at
    async with _jwks_lock:
        fresh = _jwks_cache and (time.monotonic() - _jwks_fetched_at) < _JWKS_TTL_SECONDS
        if fresh and not force_refresh:
            return _jwks_cache

        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
            response = await client.get(settings.jwks_uri)
        response.raise_for_status()
        _jwks_cache = response.json()
        _jwks_fetched_at = time.monotonic()
        return _jwks_cache


async def _signing_key(token: str) -> dict:
    kid = jwt.get_unverified_header(token).get("kid")
    if not kid:
        raise ValueError("id_token has no kid header")

    for refresh in (False, True):
        jwks = await _get_jwks(force_refresh=refresh)
        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                return key
        # Unknown kid on the cached set means Microsoft rotated keys; the
        # second pass re-fetches before we give up.
    raise ValueError(f"no signing key matches kid={kid}")


async def verify_id_token(id_token: str, expected_nonce: str) -> EntraIdentity:
    """Verify signature and claims, returning the identity.

    Raises ValueError on anything suspicious. Every check here matters:

    - signature  : the token really came from Microsoft
    - `aud`      : it was issued *for this application*, not another app in
                   the tenant that happens to share the signing keys
    - `iss`+`tid`: it came from *our* tenant — without this, a token from any
                   Microsoft tenant would be accepted, which is the classic
                   multi-tenant confused-deputy bug
    - `nonce`    : it belongs to *this* sign-in attempt, not a replayed one
    - `exp`/`nbf`: it is currently valid (handled by jose)
    """
    key = await _signing_key(id_token)

    try:
        claims = jwt.decode(
            id_token,
            key,
            algorithms=["RS256"],
            audience=settings.entra_client_id,
            issuer=settings.issuer,
            options={"require_exp": True, "require_iat": True},
        )
    except JWTError as exc:
        logger.warning("id_token rejected: %s", exc)
        raise ValueError("invalid_id_token") from exc

    if claims.get("nonce") != expected_nonce:
        logger.warning("id_token nonce mismatch — possible replay")
        raise ValueError("nonce_mismatch")

    # Defence in depth: `iss` already encodes the tenant, but pin `tid` too so
    # a future change to issuer handling cannot silently widen who is accepted.
    if claims.get("tid") != settings.entra_tenant_id:
        logger.warning("id_token from unexpected tenant: %s", claims.get("tid"))
        raise ValueError("wrong_tenant")

    email = (
        claims.get("email")
        or claims.get("preferred_username")
        or claims.get("upn")
        or ""
    ).strip()
    if not email:
        raise ValueError("id_token carries no email claim")

    return EntraIdentity(
        object_id=claims["oid"],
        email=email,
        display_name=claims.get("name") or email,
        tenant_id=claims["tid"],
    )


# ── Graph /me ────────────────────────────────────────────────────────────────

_ME_FIELDS = (
    "id,displayName,mail,userPrincipalName,employeeId,employeeType,"
    "jobTitle,department,officeLocation,accountEnabled,userType"
)


async def fetch_me(access_token: str) -> dict:
    """Read the signed-in user's own profile via delegated User.Read.

    `employeeId` and `employeeType` are not in Graph's default property set,
    so they must be named in $select or they simply come back absent — which
    would make every user look like they have no employee id.
    """
    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
        response = await client.get(
            f"https://graph.microsoft.com/v1.0/me?$select={_ME_FIELDS}",
            headers={"Authorization": f"Bearer {access_token}"},
        )
    response.raise_for_status()
    return response.json()
