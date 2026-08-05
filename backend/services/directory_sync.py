"""
Entra directory sync.

Pulls the whole tenant from Graph and reconciles it into `user_accounts`, so
the app's view of who works here matches the directory rather than a stale
spreadsheet. Runs on a schedule and can be triggered manually.

Four things happen per cycle:

  1. Upsert    every directory user, with their resolved persona.
  2. Convert   anyone who flipped from intern to permanent gets the profile
               invite emailed to them — this is the intern lifecycle, and the
               sync is the only place that can notice the transition.
  3. Deactivate anyone who has left, been disabled, or otherwise stopped being
               able to sign in. Their sessions are revoked immediately.
  4. Report    counts, so a run that quietly did nothing is visible.

## Why deactivate rather than delete

A leaver's row stays, marked `canSignIn: false`. Deleting it would take their
resume and skill history with it, which HR still needs for reporting, and would
make the audit trail reference an employee_id that no longer exists.

## The safety rail

If Graph returns implausibly few users the sync aborts without writing. A
partial read looks identical to "everyone left the company", and acting on it
would deactivate the entire organisation and revoke every session. A refusal to
act is recoverable; a mass deactivation at 3am is not.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from pymongo.errors import PyMongoError

from config.entra_config import settings
from services.db_service import (
    col_user_accounts,
    invalidate_active_employee_cache,
    upsert_user_from_directory,
    write_audit_event,
)
from services.graph_service import fetch_all_users
from services.role_service import evaluate
from services.session_service import revoke_all_for_employee

logger = logging.getLogger(__name__)

# Abort if the directory read returns fewer than this many users. The tenant
# has ~420 objects; anything under 50 means a truncated or failed read, not a
# genuinely tiny company.
_MIN_PLAUSIBLE_USERS = 50


def _pick_preferred_account(accounts: list[dict[str, Any]]) -> dict[str, Any]:
    """Choose which Entra account owns a duplicated employeeId.

    Three tiers, most specific first:

      1. an address named explicitly in PREFERRED_ACCOUNT_EMAILS
      2. an address on the company's own domain, over any external one
      3. lowest address alphabetically — arbitrary, but *stable*, so the
         winner does not flip between runs and cause the two records to
         overwrite each other in alternation
    """
    def address(account: dict[str, Any]) -> str:
        return (account.get("mail") or account.get("userPrincipalName") or "").casefold()

    for account in accounts:
        if address(account) in settings.preferred_account_email_list:
            return account

    domain = settings.primary_email_domain.casefold()
    on_domain = [a for a in accounts if address(a).endswith(f"@{domain}")]
    if len(on_domain) == 1:
        return on_domain[0]

    return sorted(on_domain or accounts, key=address)[0]


async def run_directory_sync(send_invites: bool = True) -> dict[str, Any]:
    """One reconciliation cycle. Returns a summary dict for logging/reporting.

    `send_invites=False` gives a dry-ish run that still writes records but does
    not email anyone — useful for the first sync, when every previously-unseen
    intern would otherwise look like a fresh conversion.
    """
    started_at = datetime.now(timezone.utc)
    summary: dict[str, Any] = {
        "started_at": started_at,
        "total_directory": 0,
        "can_sign_in": 0,
        "upserted": 0,
        "deactivated": 0,
        "converted": 0,
        "invites_sent": 0,
        "errors": 0,
    }

    try:
        directory = await fetch_all_users()
    except Exception:
        logger.exception("Directory sync aborted: could not read Graph")
        summary["errors"] += 1
        summary["aborted"] = "graph_read_failed"
        return summary

    summary["total_directory"] = len(directory)

    if len(directory) < _MIN_PLAUSIBLE_USERS:
        logger.error(
            "Directory sync aborted: Graph returned only %s users, below the "
            "plausibility floor of %s. Refusing to write — a truncated read "
            "would deactivate the entire organisation.",
            len(directory),
            _MIN_PLAUSIBLE_USERS,
        )
        summary["aborted"] = "implausibly_small_directory"
        return summary

    # Previous state, needed to spot transitions. Keyed on employeeId because
    # that is what the app links identity on.
    try:
        previous: dict[str, dict[str, Any]] = {
            doc["employeeId"]: doc
            async for doc in col_user_accounts.find(
                {"employeeId": {"$exists": True}},
                {"_id": 0, "employeeId": 1, "isIntern": 1, "canSignIn": 1, "email": 1, "fullName": 1},
            )
        }
    except PyMongoError:
        logger.exception("Directory sync aborted: could not read existing accounts")
        summary["errors"] += 1
        summary["aborted"] = "db_read_failed"
        return summary

    # ── Detect employeeIds claimed by more than one Entra account ──────────
    #
    # The app keys identity on employeeId, so two accounts sharing one is not
    # a cosmetic issue: both sign in as the *same* app record, see the same
    # resume, and the last sync silently overwrites the other's department and
    # role. If one of the pair sat in an HR department, the persona would flip
    # depending on read order.
    #
    # Reported rather than resolved — picking a winner is a people decision.
    by_employee_id: dict[str, list[dict[str, Any]]] = {}
    for user in directory:
        candidate_id = (user.get("employeeId") or "").strip()
        if candidate_id:
            by_employee_id.setdefault(candidate_id, []).append(user)

    duplicate_ids = {k: v for k, v in by_employee_id.items() if len(v) > 1}
    summary["duplicate_employee_ids"] = []

    # Entra object ids of the accounts that lose a duplicate contest. Skipped
    # during the write pass so the winner's data is not overwritten by whoever
    # happens to come last in the page order.
    losing_object_ids: set[str] = set()

    for dup_id, accounts in sorted(duplicate_ids.items()):
        winner = _pick_preferred_account(accounts)
        addresses = []
        for account in accounts:
            address = (account.get("mail") or account.get("userPrincipalName") or "?")
            if account is winner:
                addresses.append(f"{address}  (used)")
            else:
                addresses.append(f"{address}  (skipped)")
                losing_object_ids.add(account.get("id", ""))

        summary["duplicate_employee_ids"].append(
            {"employee_id": dup_id, "accounts": addresses}
        )
        logger.warning(
            "employeeId %s is claimed by %s Entra accounts — using %s, skipping the rest. "
            "Disable the stale account in Entra to resolve this properly.",
            dup_id,
            len(accounts),
            (winner.get("mail") or winner.get("userPrincipalName")),
        )

    seen_employee_ids: set[str] = set()
    conversions: list[dict[str, Any]] = []
    summary["conflicts"] = []

    for user in directory:
        # Loser of a duplicate-employeeId contest — writing it would clobber
        # the preferred account's record.
        if user.get("id") in losing_object_ids:
            continue

        decision = evaluate(user)

        # No employeeId means nothing to key on. Verified safe to skip: of the
        # 48 such accounts, 45 are shared mailboxes and service principals.
        if not decision.employee_id:
            continue

        employee_id = decision.employee_id
        seen_employee_ids.add(employee_id)
        prior = previous.get(employee_id)

        try:
            result = await upsert_user_from_directory(user, decision, user.get("id", ""))
            if result.get("status") == "success":
                summary["upserted"] += 1
            else:
                summary["errors"] += 1
                # A duplicate-key error here means this person's email already
                # belongs to a *different* employeeId in our records — i.e.
                # Entra and the app disagree about their ID. The unique index
                # is doing its job by refusing to create a second row; the
                # conflict needs a human to say which ID is correct.
                message = str(result.get("message", ""))
                if "Duplicate" in message or "11000" in message:
                    email = (user.get("mail") or user.get("userPrincipalName") or "").lower()
                    existing = await col_user_accounts.find_one(
                        {"email": email}, {"_id": 0, "employeeId": 1}
                    )
                    conflict = {
                        "name": user.get("displayName"),
                        "email": email,
                        "entra_employee_id": employee_id,
                        "app_employee_id": (existing or {}).get("employeeId"),
                    }
                    summary["conflicts"].append(conflict)
                    logger.error(
                        "Identity conflict for %s (%s): Entra says employeeId=%s "
                        "but the app already holds that email under employeeId=%s. "
                        "Not synced — their profile and resume stay under the old id.",
                        conflict["name"],
                        email,
                        conflict["entra_employee_id"],
                        conflict["app_employee_id"],
                    )
        except Exception:
            logger.exception("Failed to upsert %s", employee_id)
            summary["errors"] += 1
            continue

        if decision.can_sign_in:
            summary["can_sign_in"] += 1

        # Intern -> permanent. Only counts as a conversion when we have seen
        # this person before AND they were previously an intern; otherwise the
        # first sync would "convert" every permanent employee in the tenant.
        if prior and prior.get("isIntern") and not decision.is_intern and decision.can_sign_in:
            conversions.append(
                {
                    "employee_id": employee_id,
                    "email": (user.get("mail") or user.get("userPrincipalName") or "").strip(),
                    "name": user.get("displayName") or employee_id,
                }
            )

        # Someone who could sign in yesterday and cannot today — disabled,
        # converted to a guest, or had their employeeId removed. Kill their
        # sessions now rather than letting them run to expiry.
        if prior and prior.get("canSignIn") and not decision.can_sign_in:
            revoked = await revoke_all_for_employee(employee_id)
            summary["deactivated"] += 1
            logger.info(
                "Deactivated %s (%s) — revoked %s session(s)",
                employee_id,
                decision.reason,
                revoked,
            )
            await write_audit_event(
                event_type="ACCESS_REVOKED",
                actor="directory_sync",
                employee_id=employee_id,
                payload={"reason": decision.reason},
            )

    # Anyone in our records but no longer in the directory at all — offboarded
    # and their Entra account deleted. Same treatment as a disabled account.
    departed = set(previous) - seen_employee_ids
    for employee_id in departed:
        if not previous[employee_id].get("canSignIn"):
            continue  # already inactive, nothing to do
        try:
            await col_user_accounts.update_one(
                {"employeeId": employee_id},
                {"$set": {
                    "canSignIn": False,
                    "status": "Inactive",
                    "roleReason": "absent_from_directory",
                    "directorySyncedAt": datetime.now(timezone.utc),
                }},
            )
            revoked = await revoke_all_for_employee(employee_id)
            summary["deactivated"] += 1
            logger.info(
                "Deactivated %s — no longer present in the directory "
                "(revoked %s session(s))",
                employee_id,
                revoked,
            )
            await write_audit_event(
                event_type="ACCESS_REVOKED",
                actor="directory_sync",
                employee_id=employee_id,
                payload={"reason": "absent_from_directory"},
            )
        except PyMongoError:
            logger.exception("Failed to deactivate departed employee %s", employee_id)
            summary["errors"] += 1

    summary["converted"] = len(conversions)

    if conversions and send_invites:
        summary["invites_sent"] = await _send_conversion_invites(conversions)

    # The sync is the only thing that changes who counts as active, so drop
    # the cache now rather than leaving HR views stale for up to the TTL.
    invalidate_active_employee_cache()

    summary["finished_at"] = datetime.now(timezone.utc)
    summary["duration_seconds"] = round(
        (summary["finished_at"] - started_at).total_seconds(), 1
    )

    logger.info(
        "Directory sync complete: %s directory users, %s upserted, %s can sign in, "
        "%s deactivated, %s converted, %s invites, %s errors (%.1fs)",
        summary["total_directory"],
        summary["upserted"],
        summary["can_sign_in"],
        summary["deactivated"],
        summary["converted"],
        summary["invites_sent"],
        summary["errors"],
        summary["duration_seconds"],
    )
    return summary


async def _send_conversion_invites(conversions: list[dict[str, Any]]) -> int:
    """Email newly-permanent employees asking them to build their profile.

    Sent via Microsoft Graph — see services/graph_mail_service.py.
    """
    from config.email_config import settings as email_settings
    from services.email_service import EmailService

    service = EmailService(email_settings)
    sent = 0

    for person in conversions:
        if not person["email"]:
            logger.warning(
                "Skipping conversion invite for %s — no email address",
                person["employee_id"],
            )
            continue
        try:
            await service.send_onboarding_invite(
                recipient_email=person["email"],
                recipient_name=person["name"],
                employee_id=person["employee_id"],
                update_url=email_settings.frontend_update_url,
            )
            sent += 1
            await write_audit_event(
                event_type="INTERN_CONVERTED",
                actor="directory_sync",
                employee_id=person["employee_id"],
                payload={"invited_email": person["email"]},
            )
            logger.info(
                "Intern converted to permanent: %s — invite sent to %s",
                person["employee_id"],
                person["email"],
            )
        except Exception:
            # One bad address must not stop the rest of the conversions.
            logger.exception(
                "Failed to send conversion invite to %s", person["employee_id"]
            )

    return sent
