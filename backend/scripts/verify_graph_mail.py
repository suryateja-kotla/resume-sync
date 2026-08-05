"""
Check that Graph email is configured and can actually send.

    cd backend && python scripts/verify_graph_mail.py                  # checks only
    cd backend && python scripts/verify_graph_mail.py you@company.com  # sends a test

Without an address it verifies configuration and permission without sending
anything. With one, it sends a single real email to that address — use your
own, not a colleague's.

Deliberately does NOT respect EMAIL_DELIVERY_MODE: the point is to prove
sending works before you switch the app over to "graph".
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx  # noqa: E402

from config.entra_config import settings  # noqa: E402
from services.graph_mail_service import _get_token, send_mail  # noqa: E402

OK, BAD = "  [OK]  ", "  [FAIL]"


async def main() -> int:
    print("\nGraph email preflight\n" + "=" * 60)

    # 1 ── config ----------------------------------------------------------
    print("\n1. Configuration")
    sender = settings.graph_mail_sender.strip()
    if not sender:
        print(BAD, "GRAPH_MAIL_SENDER is empty — set it in backend/.env")
        return 1
    print(OK, f"sender mailbox: {sender}")
    print(OK, f"delivery mode:  {settings.email_delivery_mode}")
    if settings.email_delivery_mode.lower() != "graph":
        print("        note: the app will LOG instead of sending until this is 'graph'.")

    # 2 ── token -----------------------------------------------------------
    print("\n2. App-only token")
    try:
        token = await _get_token()
    except Exception as exc:
        print(BAD, f"could not acquire a token: {exc}")
        return 1
    print(OK, "token acquired")

    # 3 ── mailbox exists --------------------------------------------------
    print("\n3. Sender mailbox")
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"https://graph.microsoft.com/v1.0/users/{sender}"
            "?$select=displayName,mail,userPrincipalName,accountEnabled",
            headers={"Authorization": f"Bearer {token}"},
        )
    if response.status_code != 200:
        detail = response.json().get("error", {})
        print(BAD, f"{detail.get('code')}: {(detail.get('message') or '')[:160]}")
        if response.status_code == 404:
            print("        That mailbox does not exist in this tenant. Check the address.")
        return 1
    box = response.json()
    print(OK, f"found: {box.get('displayName')} <{box.get('mail') or box.get('userPrincipalName')}>")
    if not box.get("accountEnabled"):
        print(BAD, "the mailbox account is disabled — sending will fail")
        return 1

    # 4 ── send ------------------------------------------------------------
    recipient = sys.argv[1] if len(sys.argv) > 1 else None
    print("\n4. Send test")
    if not recipient:
        print("        skipped — pass an address to send a real test email:")
        print("        python scripts/verify_graph_mail.py you@sailssoftware.com")
        print("\n" + "=" * 60)
        print("Configuration looks good. Run again with an address to prove delivery.\n")
        return 0

    try:
        await send_mail(
            recipient,
            "SyncFolio — Graph email test",
            "<p>This is a test from SyncFolio.</p>"
            f"<p>Sent via Microsoft Graph from <b>{sender}</b> "
            "with no SMTP password involved.</p>",
        )
    except Exception as exc:
        print(BAD, f"send failed: {exc}")
        print("        Confirm Mail.Send (Application) has admin consent granted.")
        return 1

    print(OK, f"sent to {recipient}")
    print("\n" + "=" * 60)
    print(f"Check {recipient} — and the Sent Items of {sender}.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
