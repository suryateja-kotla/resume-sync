"""
Application email — templates plus delivery via Microsoft Graph.

SMTP has been removed. Mail now goes out through Graph `Mail.Send` using the
same app registration as sign-in, so no mailbox password exists in config.
See services/graph_mail_service.py for why.

Two delivery modes:

  graph    — actually send, via the GRAPH_MAIL_SENDER mailbox
  console  — log the message instead. The default, and what local development
             should stay on: this app mails ~280 real employees in one cycle,
             so accidentally sending from a dev machine is a real hazard.

## Async, unlike the SMTP version

Graph calls are async, so the send methods are coroutines. The former SMTP
implementation was blocking and ran inside async request handlers, stalling
the event loop for the duration of every send.

## One template, one content module

There used to be two standalone HTML files (new_employee_invite_mail.html,
resume_update_mail.html) with their own copy hardcoded inside them, plus a
`_render()` helper that filled them in directly. That path bypassed
email_content.py entirely — it is why the "Send Invite" button was still
showing 2020-era plain styling with no SyncFolio branding, long after the
group-aware templates were built. All sending now goes through
send_profile_prompt, so there is exactly one place that composes copy.
"""

from __future__ import annotations

import logging
import os

from config.entra_config import settings as entra_settings
from services.decline_token import make_token
from services.email_content import Group, build
from services.graph_mail_service import send_mail

logger = logging.getLogger(__name__)


def _backend_base() -> str:
    """Public base URL of this API — the decline link points here, not at the
    frontend, because it is handled server-side before redirecting."""
    return os.getenv("BACKEND_BASE_URL", "http://localhost:8000").rstrip("/")


class EmailService:
    def __init__(self, settings=None) -> None:
        # `settings` is accepted and ignored so existing call sites
        # (EmailService(email_settings)) keep working unchanged.
        self._mode = (entra_settings.email_delivery_mode or "console").lower()

    # ── Public API ────────────────────────────────────────────────────────

    async def send_profile_prompt(
        self,
        *,
        recipient_email: str,
        recipient_name: str,
        employee_id: str | None,
        group: Group,
        update_url: str,
        launch: bool = False,
        period: str | None = None,
    ) -> None:
        """The monthly (or welcome/launch-framed) prompt, worded for this
        person's situation.

        The "nothing has changed" button is only offered on the monthly
        cycle, and only to people who already have a complete profile.
        Offering it to someone with no resume would let them dismiss a task
        they have not started — and the whole point of that group's email is
        to get them to start.
        """
        decline_url = None
        offer_decline = (
            not launch and group is Group.COMPLETE and employee_id and period
        )
        if offer_decline:
            # Points at the backend, not the frontend — the link is handled
            # server-side (no session required) and then redirects to a
            # confirmation page.
            token = make_token(employee_id, period)
            decline_url = f"{_backend_base()}/api/monthly/decline?token={token}"

        subject, html = build(
            group=group,
            name=recipient_name,
            update_url=update_url,
            decline_url=decline_url,
            launch=launch,
        )
        await self._deliver(recipient_email, subject, html)

    async def send_onboarding_invite(
        self,
        *,
        recipient_email: str,
        recipient_name: str,
        employee_id: str | None,
        update_url: str,
    ) -> None:
        """A one-off invite for someone with no resume on file yet — the "Send
        Invite" button on the New Employees screen, and the automatic invite
        the directory sync sends when an intern converts to permanent.

        Always the NO_RESUME / welcome-framed copy: whoever this is being
        sent to has not been contacted about SyncFolio before, by definition
        of how this method is used, so "Welcome to SyncFolio" is the right
        framing regardless of the calendar date. `launch=True` selects that
        wording from email_content — it does not mean "the tool's launch
        day", it means "first contact with this person".
        """
        await self.send_profile_prompt(
            recipient_email=recipient_email,
            recipient_name=recipient_name,
            employee_id=employee_id,
            group=Group.NO_RESUME,
            update_url=update_url,
            launch=True,
        )

    # ── Internals ─────────────────────────────────────────────────────────

    async def _deliver(self, recipient: str, subject: str, html_body: str) -> None:
        if self._mode != "graph":
            logger.info(
                "[console mode] would send %r to %s (set EMAIL_DELIVERY_MODE=graph to send)",
                subject, recipient,
            )
            logger.debug("Body for %s: %s", recipient, html_body)
            return
        await send_mail(recipient, subject, html_body)
