"""
End-to-end authorization checks for every API route.

    cd backend && python scripts/check_route_guards.py

Runs the real FastAPI app in-process (httpx ASGI transport — no server to
start), mints genuine sessions for an EMPLOYEE, an HR user and an ADMIN, and
asserts the status code each persona gets on each route.

Anonymous 401s are only half the story: the failure that actually matters is
an HR user reaching an ADMIN-only route, or an employee reaching /hr/*. Those
return 200 in a broken build and are invisible unless something asserts on
them, which is what this file does.

Sessions are created and torn down in Mongo, so this needs the same database
connection the app uses.
"""

import asyncio
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# One line per request from httpx drowns the actual results.
logging.getLogger("httpx").setLevel(logging.WARNING)

import httpx  # noqa: E402

from config.entra_config import settings  # noqa: E402
from main import app  # noqa: E402
from services.session_service import (  # noqa: E402
    col_sessions,
    create_session,
    revoke_session,
)

_failures: list[str] = []

# (method, path, expected status per persona)
#   anon / employee / hr / admin
ROUTES = [
    ("GET", "/api/health", 200, 200, 200, 200),
    # self-service — any signed-in user
    ("GET", "/api/employee-profile", 401, 200, 200, 200),
    ("GET", "/api/employee-skill-summary", 401, 200, 200, 200),
    ("GET", "/api/skill-categories", 401, 200, 200, 200),
    # HR views — HR or ADMIN
    ("GET", "/api/hr/all-employees", 401, 403, 200, 200),
    ("GET", "/api/hr/skill-summary-employees", 401, 403, 200, 200),
    ("GET", "/api/hr/talent-pool", 401, 403, 200, 200),
    ("GET", "/api/hr/metrics", 401, 403, 200, 200),
    # New Employees is ADMIN-only: it sends onboarding mail to arbitrary
    # addresses, which should not be reachable by 55 HR-persona accounts.
    ("GET", "/api/hr/new-employees", 401, 403, 403, 200),
    ("GET", "/api/hr/skill-summary", 401, 403, 200, 200),
    ("GET", "/api/hr/skill-employees?skill=Java", 401, 403, 200, 200),
    # ADMIN only — the two that must NOT open up to 55 HR users
    ("GET", "/api/hr/audit-log", 401, 403, 403, 200),
    # 200 for admin even though SS_NOBODY does not exist: delete_employee
    # reports success regardless of whether anything matched. That is
    # pre-existing behaviour, not an authorization result — what this row
    # asserts is the 401/403/403 in front of it.
    ("DELETE", "/api/hr/employee/SS_NOBODY", 401, 403, 403, 200),
]


def check(label: str, actual, expected) -> None:
    if actual == expected:
        print(f"  [OK]   {label}")
    else:
        print(f"  [FAIL] {label} — expected {expected}, got {actual}")
        _failures.append(label)


async def main() -> int:
    print("\nRoute guard checks\n" + "=" * 66)

    personas = {}
    for name, role in (("employee", "EMPLOYEE"), ("hr", "HR"), ("admin", "ADMIN")):
        session_id, csrf = await create_session(
            employee_id=f"ZZ_TEST_{role}",
            entra_object_id="00000000-0000-0000-0000-000000000000",
            email=f"test.{name}@example.invalid",
            display_name=f"Test {role}",
            role=role,
        )
        personas[name] = (session_id, csrf)

    transport = httpx.ASGITransport(app=app)
    try:
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test"
        ) as client:
            print("\nPer-route status by persona (anon / employee / hr / admin)")
            for method, path, *expected in ROUTES:
                actuals = []
                for who, want in zip(
                    (None, "employee", "hr", "admin"), expected
                ):
                    cookies = {}
                    headers = {}
                    if who:
                        session_id, csrf = personas[who]
                        cookies[settings.session_cookie_name] = session_id
                        headers["X-CSRF-Token"] = csrf
                    response = await client.request(
                        method, path, cookies=cookies, headers=headers
                    )
                    actuals.append(response.status_code)

                label = f"{method} {path}"
                check(f"{label}  {tuple(actuals)}", tuple(actuals), tuple(expected))

            # ── CSRF ────────────────────────────────────────────────────────
            print("\nCSRF enforcement on state-changing requests")
            session_id, csrf = personas["admin"]
            cookies = {settings.session_cookie_name: session_id}

            response = await client.request(
                "DELETE", "/api/hr/employee/SS_NOBODY", cookies=cookies
            )
            check("DELETE with no CSRF header is rejected", response.status_code, 403)

            response = await client.request(
                "DELETE",
                "/api/hr/employee/SS_NOBODY",
                cookies=cookies,
                headers={"X-CSRF-Token": "wrong-token"},
            )
            check("DELETE with a wrong CSRF token is rejected", response.status_code, 403)

            response = await client.get("/api/hr/all-employees", cookies=cookies)
            check("GET does not require a CSRF header", response.status_code, 200)

            # ── Revocation ──────────────────────────────────────────────────
            print("\nSession revocation takes effect immediately")
            await revoke_session(session_id)
            response = await client.get("/api/hr/all-employees", cookies=cookies)
            check("revoked session is refused", response.status_code, 401)

    finally:
        for session_id, _ in personas.values():
            await revoke_session(session_id)
        await col_sessions.delete_many({"employee_id": {"$regex": "^ZZ_TEST_"}})

    print("\n" + "=" * 66)
    if _failures:
        print(f"{len(_failures)} CHECK(S) FAILED:")
        for name in _failures:
            print(f"   - {name}")
        return 1
    print("All route guard checks passed.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
