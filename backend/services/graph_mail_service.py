"""
Outbound email via Microsoft Graph `sendMail`.

Replaces SMTP. Authenticates with the same app registration the rest of the
app uses, under the `Mail.Send` **application** permission, so no mailbox
password exists anywhere in config.

That matters for more than tidiness:

  - Microsoft 365 disables SMTP AUTH by default on new mailboxes, so the SMTP
    path could stop working for reasons nobody here controls.
  - MFA on the sending mailbox breaks basic SMTP auth entirely.
  - A password in env is a secret to protect, rotate and keep out of logs.
    There is nothing to leak here.

## The sender is a configured mailbox, not the signed-in user

`Mail.Send` as an *application* permission can send as any mailbox in the
tenant, which is powerful and worth being deliberate about: the sender is
pinned to `GRAPH_MAIL_SENDER` in config rather than taken from anything a
request supplies. Nothing in the app can choose whose name a mail goes out
under.

## Failure handling

Send failures raise, so callers decide. The directory sync already catches
per-recipient so one bad address cannot stop a batch; the monthly scheduler
does the same.
"""

from __future__ import annotations

import base64
import logging
import time
from functools import lru_cache
from pathlib import Path
from typing import Any

import httpx

from config.entra_config import settings as entra_settings

logger = logging.getLogger(__name__)

GRAPH_BASE = "https://graph.microsoft.com/v1.0"
_HTTP_TIMEOUT = httpx.Timeout(30.0)

# The Content-ID email templates reference as `<img src="cid:LOGO_CID">`.
# Matched in templates/email_base.html.
LOGO_CID = "syncfolio-mark"
_LOGO_PATH = Path(__file__).parent.parent / "assets" / "syncfolio-mark.png"

# App-only tokens last an hour. Cached with a safety margin so a batch of 280
# monthly emails does not re-authenticate for every message.
_token_cache: str | None = None
_token_expires_at: float = 0.0
_TOKEN_SKEW_SECONDS = 300


async def _get_token() -> str:
    global _token_cache, _token_expires_at

    if _token_cache and time.monotonic() < _token_expires_at:
        return _token_cache

    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
        response = await client.post(
            entra_settings.token_endpoint,
            data={
                "client_id": entra_settings.entra_client_id,
                "client_secret": entra_settings.entra_client_secret,
                "scope": entra_settings.graph_app_scope,
                "grant_type": "client_credentials",
            },
        )

    if response.status_code != 200:
        detail = response.json()
        logger.error(
            "Graph mail token request failed: %s — %s",
            detail.get("error"),
            (detail.get("error_description") or "").split("\r\n")[0],
        )
        raise RuntimeError("graph_mail_token_failed")

    payload = response.json()
    _token_cache = payload["access_token"]
    _token_expires_at = time.monotonic() + payload.get("expires_in", 3600) - _TOKEN_SKEW_SECONDS
    return _token_cache


@lru_cache(maxsize=1)
def _logo_attachment() -> dict[str, Any] | None:
    """The SyncFolio mark as a Graph inline attachment, referenced from HTML
    via `<img src="cid:syncfolio-mark">`.

    This is a *CID-embedded* image, not a base64 data URI in the `src`
    attribute — the two look similar but behave very differently in mail
    clients. A data URI is inlined directly into the HTML and is well known
    to fail silently in classic Outlook (Win32, Word rendering engine).
    A CID reference points at a real MIME attachment carried alongside the
    message, which is the mechanism every major transactional-email provider
    (SendGrid, Mailchimp, etc.) uses specifically because Outlook honours it.

    Cached after the first read — the file never changes at runtime, and this
    runs once per process rather than once per recipient in a 280-person batch.
    Returns None if the asset is missing, so a missing logo degrades to no
    image rather than failing every send in the batch.
    """
    try:
        data = _LOGO_PATH.read_bytes()
    except OSError:
        logger.warning("Logo asset not found at %s — sending without it", _LOGO_PATH)
        return None

    return {
        "@odata.type": "#microsoft.graph.fileAttachment",
        "name": "syncfolio-mark.png",
        "contentType": "image/png",
        "contentBytes": base64.b64encode(data).decode("ascii"),
        "contentId": LOGO_CID,
        "isInline": True,
    }


async def send_mail(
    recipient: str,
    subject: str,
    html_body: str,
    *,
    sender: str | None = None,
) -> None:
    """Send one HTML email. Raises on failure.

    `saveToSentItems` is left on so the sending mailbox keeps a record — worth
    having when someone asks whether an invite actually went out.
    """
    from_address = (sender or entra_settings.graph_mail_sender).strip()
    if not from_address:
        raise RuntimeError(
            "GRAPH_MAIL_SENDER is not set — no mailbox to send from."
        )

    token = await _get_token()
    message: dict[str, Any] = {
        "message": {
            "subject": subject,
            "body": {"contentType": "HTML", "content": html_body},
            "toRecipients": [{"emailAddress": {"address": recipient}}],
        },
        "saveToSentItems": True,
    }

    # Only attach the logo when the template actually references it — no
    # point carrying 7KB on every message the base template isn't used for.
    if f"cid:{LOGO_CID}" in html_body:
        logo = _logo_attachment()
        if logo:
            message["message"]["attachments"] = [logo]

    # /users/{sender}/sendMail — app-only, so the mailbox is named explicitly
    # rather than inferred from a signed-in user (/me would have nobody).
    url = f"{GRAPH_BASE}/users/{from_address}/sendMail"

    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
        response = await client.post(
            url,
            json=message,
            headers={"Authorization": f"Bearer {token}"},
        )

    # A successful sendMail returns 202 Accepted with an empty body.
    if response.status_code not in (200, 202):
        try:
            detail = response.json().get("error", {})
            code, msg = detail.get("code"), (detail.get("message") or "")[:200]
        except Exception:
            code, msg = response.status_code, response.text[:200]
        logger.error("Graph sendMail to %s failed: %s — %s", recipient, code, msg)
        raise RuntimeError(f"graph_send_failed:{code}")

    logger.info("Sent %r to %s via Graph", subject, recipient)
