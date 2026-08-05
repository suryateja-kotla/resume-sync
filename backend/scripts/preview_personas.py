"""
Dry-run the persona rules against the live Entra directory.

    cd backend && python scripts/preview_personas.py

Read-only — touches nothing in Mongo and creates no sessions. Run it after any
change to ADMIN_EMAILS / HR_DEPARTMENTS / HR_JOB_TITLES to see exactly who the
change lets in before deploying it.

The privileged list is printed in full by design: an allowlist nobody reviews
is not a control.
"""

import json
import sys
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from config.entra_config import settings  # noqa: E402
from services.role_service import Role, evaluate  # noqa: E402

GRAPH_FIELDS = (
    "id,displayName,mail,userPrincipalName,employeeId,employeeType,"
    "jobTitle,department,accountEnabled,userType"
)


def fetch_directory() -> list[dict]:
    form = urllib.parse.urlencode(
        {
            "client_id": settings.entra_client_id,
            "client_secret": settings.entra_client_secret,
            "scope": settings.graph_app_scope,
            "grant_type": "client_credentials",
        }
    ).encode()
    request = urllib.request.Request(
        settings.token_endpoint,
        data=form,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        token = json.load(response)["access_token"]

    users: list[dict] = []
    url = f"https://graph.microsoft.com/v1.0/users?$select={GRAPH_FIELDS}&$top=999"
    while url:
        page_request = urllib.request.Request(url)
        page_request.add_header("Authorization", f"Bearer {token}")
        with urllib.request.urlopen(page_request, timeout=60) as response:
            page = json.load(response)
        users.extend(page.get("value", []))
        url = page.get("@odata.nextLink")
    return users


def main() -> int:
    users = fetch_directory()
    decisions = [(user, evaluate(user)) for user in users]

    allowed = [(u, d) for u, d in decisions if d.can_sign_in]
    denied = [(u, d) for u, d in decisions if not d.can_sign_in]

    print(f"\nDirectory objects: {len(users)}")
    print("=" * 66)

    print(f"\nCAN SIGN IN: {len(allowed)}")
    for role in (Role.ADMIN, Role.HR, Role.EMPLOYEE):
        count = sum(1 for _, d in allowed if d.role is role)
        print(f"   {role.value:<10} {count:>4}")

    print(f"\nCANNOT SIGN IN: {len(denied)}")
    for reason, count in Counter(d.reason for _, d in denied).most_common():
        print(f"   {reason:<22} {count:>4}")

    print("\n" + "-" * 66)
    print("PRIVILEGED ACCESS — review this list")
    print("-" * 66)
    for user, decision in sorted(
        [(u, d) for u, d in allowed if d.role in (Role.ADMIN, Role.HR)],
        key=lambda pair: (pair[1].role.value, pair[0].get("displayName") or ""),
    ):
        print(
            f"   {decision.role.value:<6} {decision.employee_id:<8} "
            f"{(user.get('displayName') or '')[:26]:<26} "
            f"{(user.get('department') or '-')[:6]:<6} "
            f"{(user.get('jobTitle') or '-')[:30]:<30} [{decision.reason}]"
        )

    print("\n" + "-" * 66)
    print("MONTHLY RESUME-UPDATE EMAIL")
    print("-" * 66)
    mailed = [(u, d) for u, d in allowed if d.receives_monthly_email]
    suppressed = [(u, d) for u, d in allowed if not d.receives_monthly_email]
    print(f"   will be emailed  {len(mailed):>4}")
    print(f"   suppressed       {len(suppressed):>4}")
    by_dept = Counter((u.get("department") or "(none)").strip() for u, _ in suppressed)
    for dept, count in by_dept.most_common():
        print(f"      {count:>3}  {dept}")

    print("\n" + "-" * 66)
    print("TALENT POOL")
    print("-" * 66)
    pooled = [(u, d) for u, d in decisions if d.in_talent_pool]
    bench = [(u, d) for u, d in pooled if d.can_sign_in]
    interns = [(u, d) for u, d in pooled if d.is_intern]
    print(f"   Bench tab   {len(bench):>4}  (permanent, unallocated, can sign in)")
    print(f"   Interns tab {len(interns):>4}  (read-only, no account)")
    other = len(pooled) - len(bench) - len(interns)
    if other:
        print(f"   unclassified {other:>3}  (in pool but neither — check these)")

    print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
