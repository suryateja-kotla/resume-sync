"""
Admin routes — /api/admin/*

Endpoints that trigger scheduled work, callable two ways:

  - by a signed-in ADMIN, from the UI ("run now")
  - by Cloud Scheduler, presenting a shared secret in X-Trigger-Token

The second is why token auth exists at all: Cloud Scheduler has no browser,
no cookie and no session, so it cannot authenticate the way a person does.

## Why the trigger moved out of the app

These jobs used to run on asyncio timers inside the FastAPI process, which
fails in both directions on Cloud Run:

  - scaled to zero (the normal idle state), no process exists at 06:00, so
    the job silently never runs and nobody notices for weeks
  - scaled to several instances, *every* instance runs its own timer, so ~280
    employees receive the monthly email two or three times

An external trigger fires exactly once, whether or not a container is warm.
Combined with the run-once guard in job_service, a retried or duplicated
trigger still cannot double-send.
"""

from __future__ import annotations

import logging
import secrets

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status

from config.entra_config import settings
from services.auth_service import CurrentUser, get_current_user, require_admin
from services.db_service import write_audit_event
from services.directory_sync import run_directory_sync
from services.job_service import (
    DIRECTORY_SYNC,
    MONTHLY_EMAIL,
    already_ran,
    day_key,
    last_run,
    month_key,
    record_run,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])


async def require_admin_or_trigger_token(
    request: Request,
    x_trigger_token: str | None = Header(default=None),
) -> str:
    """Allow either a signed-in ADMIN or a valid trigger token.

    Returns a string describing the caller, used as the audit actor so a
    scheduled run is distinguishable from someone pressing a button.
    """
    configured = settings.job_trigger_token.strip()
    if x_trigger_token and configured:
        # Constant-time compare — a token checked with == leaks its prefix to
        # a patient attacker through response timing.
        if secrets.compare_digest(x_trigger_token, configured):
            return "cloud_scheduler"
        logger.warning("Rejected job trigger: bad X-Trigger-Token")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Invalid trigger token."
        )

    # No token supplied (or none configured) — fall back to a real session.
    # CSRF is enforced by get_current_user for POST, as everywhere else.
    current_user: CurrentUser = await get_current_user(request)
    await require_admin(current_user)
    return current_user.employee_id


# ── POST /admin/sync ─────────────────────────────────────────────────────────


@router.post("/sync")
async def trigger_directory_sync(
    actor: str = Depends(require_admin_or_trigger_token),
    force: bool = False,
):
    """Reconcile the Entra directory into user_accounts.

    Idempotent, so unlike the monthly email this is not guarded against
    running twice — re-running only refreshes the same records. The daily
    period key is still recorded, for the status endpoint.
    """
    logger.info("Directory sync triggered by %s", actor)
    summary = await run_directory_sync(send_invites=True)

    if not summary.get("aborted"):
        await record_run(DIRECTORY_SYNC, day_key(), {
            "upserted": summary.get("upserted"),
            "deactivated": summary.get("deactivated"),
            "converted": summary.get("converted"),
            "invites_sent": summary.get("invites_sent"),
        })

    await write_audit_event(
        event_type="DIRECTORY_SYNC_RUN",
        actor=actor,
        employee_id=None,
        payload={
            "upserted": summary.get("upserted"),
            "deactivated": summary.get("deactivated"),
            "aborted": summary.get("aborted"),
        },
    )
    return {"status": "success", "summary": _serialisable(summary)}


# ── POST /admin/run-monthly ──────────────────────────────────────────────────


@router.post("/run-monthly")
async def trigger_monthly_email(
    actor: str = Depends(require_admin_or_trigger_token),
    force: bool = False,
    launch: bool = False,
):
    """Send the monthly resume-update prompt.

    Guarded: one send per calendar month. A retried Cloud Scheduler call, an
    overlapping deploy, or a double click cannot mail ~280 people twice.
    `?force=true` overrides, for a cycle that genuinely needs repeating.
    """
    period = month_key()
    previous = await already_ran(MONTHLY_EMAIL, period)

    if previous and not force:
        logger.info(
            "Monthly email already completed for %s — refusing to re-send", period
        )
        return {
            "status": "skipped",
            "reason": "already_sent_this_period",
            "period": period,
            "completed_at": previous.get("completed_at"),
            "previous_summary": previous.get("summary"),
            "hint": "Pass ?force=true to send anyway.",
        }

    # Imported here rather than at module scope so the email stack is only
    # constructed when a send is actually attempted.
    from config.email_config import settings as email_settings
    from scheduler.scheduler_agent import SchedulerAgent
    from services.email_service import EmailService

    logger.info(
        "Monthly email triggered by %s for %s%s",
        actor, period, " (forced)" if force else "",
    )
    agent = SchedulerAgent(
        email_service=EmailService(email_settings),
        frontend_update_url=email_settings.frontend_update_url,
    )
    sent = await agent.run_cycle(launch=launch, period=period)

    await record_run(MONTHLY_EMAIL, period, {"sent": sent, "forced": force, "launch": launch})
    await write_audit_event(
        event_type="LAUNCH_EMAIL_RUN" if launch else "MONTHLY_EMAIL_RUN",
        actor=actor,
        employee_id=None,
        payload={"period": period, "sent": sent, "forced": force, "launch": launch},
    )
    return {"status": "success", "period": period, "sent": sent, "launch": launch}


# ── GET /admin/status ────────────────────────────────────────────────────────


@router.get("/status")
async def job_status(current_user: CurrentUser = Depends(require_admin)):
    """When each scheduled job last completed.

    Session-only — no token path. This is for the UI, and a status page is not
    something a scheduler needs.
    """
    return {
        "status": "success",
        "email_delivery_mode": settings.email_delivery_mode,
        "trigger_token_configured": bool(settings.job_trigger_token.strip()),
        "jobs": {
            "directory_sync": await last_run(DIRECTORY_SYNC),
            "monthly_email": await last_run(MONTHLY_EMAIL),
        },
        "current_month": month_key(),
    }


# ── GET /monthly/decline ─────────────────────────────────────────────────────
#
# Deliberately on its own router with no /admin prefix and no authentication:
# it is clicked straight from an email client, where the person may not have a
# session and should not be made to sign in just to say "nothing changed".
#
# The signed token IS the credential. It is scoped to one employee and one
# period, so it cannot be replayed next month or used to mark a colleague as
# declined — which would quietly drop that person off HR's follow-up list.

public_router = APIRouter(tags=["monthly"])


@public_router.get("/monthly/decline")
async def decline_monthly_update(token: str = ""):
    """Record "nothing has changed" for this cycle."""
    from fastapi.responses import HTMLResponse

    from services.db_service import set_monthly_response
    from services.decline_token import verify_token

    verified = verify_token(token) if token else None
    if not verified:
        return HTMLResponse(
            _simple_page(
                "Link not valid",
                "This link has expired or is not valid. You can still update "
                "your profile by signing in to SyncFolio.",
            ),
            status_code=400,
        )

    employee_id, period = verified
    if period != month_key():
        # An old email resurfacing. Harmless, but recording it would overwrite
        # this month's genuine answer.
        return HTMLResponse(
            _simple_page(
                "This link is from an earlier month",
                "It is no longer active. If nothing has changed this month, "
                "use the button in the latest email.",
            ),
            status_code=400,
        )

    await set_monthly_response(employee_id, "declined")
    await write_audit_event(
        event_type="MONTHLY_DECLINED",
        actor=employee_id,
        employee_id=employee_id,
        payload={"period": period},
    )
    logger.info("Monthly update declined by %s for %s", employee_id, period)

    return HTMLResponse(
        _simple_page(
            "Thanks — noted",
            "We have recorded that nothing has changed this month. You will "
            "not be chased again until the next cycle.",
        )
    )


def _simple_page(title: str, message: str) -> str:
    """A plain confirmation page. No JS, no assets — this renders in whatever
    browser an email client happens to open."""
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f7;margin:0;padding:40px 20px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:8px;padding:36px 32px;text-align:center;">
    <h2 style="color:#1e1b4b;margin:0 0 12px;font-size:20px;">{title}</h2>
    <p style="color:#64748b;font-size:14.5px;line-height:1.6;margin:0;">{message}</p>
  </div>
</body></html>"""


def _serialisable(summary: dict) -> dict:
    """Drop datetimes the JSON encoder would choke on, keep the counts."""
    return {
        k: v for k, v in summary.items()
        if isinstance(v, (int, str, bool, list, type(None)))
    }
