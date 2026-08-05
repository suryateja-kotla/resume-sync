"""
Regression checks for the persona rules.

    cd backend && python scripts/check_role_rules.py

Offline and deterministic — no Graph calls, no database. Run it after touching
role_service.py or the persona settings; exits non-zero on any failure so it
can gate a deploy.

The fuzzy-matching cases are the point of this file. Typo tolerance decides who
gets HR access, and the failure mode is silent: a threshold loosened by one
character hands privileged access to a whole department without erroring. The
JA/TA case below is not hypothetical — it is a real 27-person delivery
department one edit away from a real HR department.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services import role_service as rs  # noqa: E402
from services.role_service import Role, evaluate  # noqa: E402

_failures: list[str] = []


def check(label: str, actual, expected) -> None:
    if actual == expected:
        print(f"  [OK]   {label}")
    else:
        print(f"  [FAIL] {label}\n           expected {expected!r}, got {actual!r}")
        _failures.append(label)


def user(**overrides) -> dict:
    """A permanent, enabled member — override one field per case."""
    base = {
        "displayName": "Test Person",
        "mail": "test.person@sailssoftware.com",
        "employeeId": "SS999",
        "employeeType": "Full Time",
        "jobTitle": "Software Engineer",
        "department": "EFX-I9HQ",
        "accountEnabled": True,
        "userType": "Member",
    }
    base.update(overrides)
    return base


print("\nPersona rule checks\n" + "=" * 62)

# ── The false positive that must never happen ────────────────────────────────
print("\nFuzzy matching — false-positive guards")

check(
    "'JA' is NOT matched to HR department 'TA' (27 people at stake)",
    evaluate(user(department="JA")).role,
    Role.EMPLOYEE,
)
check(
    "'AI' is NOT matched to 'IT'",
    evaluate(user(department="AI")).role,
    Role.EMPLOYEE,
)
check(
    "'SI9' is NOT matched to any HR department",
    evaluate(user(department="SI9")).role,
    Role.EMPLOYEE,
)
check(
    "'ACA' is NOT matched to 'TA'",
    evaluate(user(department="ACA")).role,
    Role.EMPLOYEE,
)
check(
    "short strings never fuzzy-match at all",
    rs.matches_any("JA", ["ta", "hr", "it"]),
    None,
)

# ── Typos that should be corrected ───────────────────────────────────────────
print("\nFuzzy matching — real typos corrected")

check(
    "'Finanace' resolves to HR via 'finance'",
    evaluate(user(department="Finanace")).role,
    Role.HR,
)
check(
    "'Finanace' is also suppressed from the monthly email",
    evaluate(user(department="Finanace")).receives_monthly_email,
    False,
)
check(
    "transposition: 'Talent Poool' still lands in the talent pool",
    rs.in_talent_pool("Talent Poool"),
    True,
)
check(
    "separator drop: 'Paper Trial' ~ 'papertrail'",
    rs.matches_any("Paper Trial", ["papertrail"]),
    "papertrail",
)
check(
    "two edits is too far: 'Finnnance' does not match",
    rs.matches_any("Finnnance", ["finance"]),
    None,
)

# Aliases handle departments IT genuinely creates under two names. Distinct
# from typo tolerance: these are different words, not slips, so no edit
# distance could merge them safely.
print("\nDepartment aliases")

check(
    "'Biz Dev' canonicalizes to 'business development'",
    rs.canonical_department("Biz Dev"),
    "business development",
)
check(
    "'SpeechPandit' canonicalizes to 'speechpundit'",
    rs.canonical_department("SpeechPandit"),
    "speechpundit",
)
check(
    "aliasing is case-insensitive",
    rs.canonical_department("BIZ DEV"),
    "business development",
)
check(
    "'Biz Dev' gets HR even though only 'Business Development' is configured",
    evaluate(user(department="Biz Dev", jobTitle="Digital Marketing Executive")).role,
    Role.HR,
)
check(
    "'Biz Dev' is also suppressed from the monthly email",
    evaluate(user(department="Biz Dev")).receives_monthly_email,
    False,
)
check(
    "'SpeechPandit' stays EMPLOYEE (aliasing must not grant access)",
    evaluate(user(department="SpeechPandit")).role,
    Role.EMPLOYEE,
)
check(
    "'SpeechPandit' is still emailed (it is a delivery department)",
    evaluate(user(department="SpeechPandit")).receives_monthly_email,
    True,
)
check(
    "an unaliased department passes through unchanged",
    rs.canonical_department("EFX-I9HQ"),
    "efx-i9hq",
)

# Two directory records carry an employeeId that disagrees with where the
# person's resume actually lives. The override must apply at *sign-in* too,
# not just during the sync — otherwise they authenticate fine and land on an
# empty profile, which is the confusing failure this guards against.
print("\nEmployee ID overrides")

check(
    "EFX-I9HQ resolves to SS471 (Ashok Thota)",
    rs.resolve_employee_id("EFX-I9HQ"),
    "SS471",
)
check(
    "SSUS11 resolves to SS044 (Phani Sai Balantrapu)",
    rs.resolve_employee_id("SSUS11"),
    "SS044",
)
check(
    "override matching ignores case",
    rs.resolve_employee_id("efx-i9hq"),
    "SS471",
)
check(
    "an ordinary id is untouched",
    rs.resolve_employee_id("SS519"),
    "SS519",
)
check(
    "a blank id stays None",
    rs.resolve_employee_id(""),
    None,
)
check(
    "evaluate() applies the override end to end",
    evaluate(user(employeeId="EFX-I9HQ")).employee_id,
    "SS471",
)

# A project/service mailbox has no employeeId because it is not a person.
# Allowlisted admin mailboxes get a synthetic id so they can sign in; every
# OTHER account without an id must still be refused — that exemption must not
# widen into "any account without an id may sign in".
print("\nAdmin service mailboxes (no employeeId)")

admin_mailbox = "syncfolio.admin@sailssoftware.invalid"
original_admins = rs.settings.admin_email_list
try:
    rs.settings.__dict__["admin_email_list"] = original_admins + [admin_mailbox]

    decision = evaluate(user(employeeId=None, mail=admin_mailbox, jobTitle=None, department=None))
    check("allowlisted mailbox with no employeeId CAN sign in", decision.can_sign_in, True)
    check("...and gets ADMIN", decision.role, Role.ADMIN)
    check("...with a synthetic id", decision.employee_id, "ADMIN-syncfolio.admin")
    check("...flagged as a service mailbox", decision.reason, "admin_allowlist_service_mailbox")
    check("...and is never emailed", decision.receives_monthly_email, False)

    check(
        "a NON-allowlisted account with no employeeId is still refused",
        evaluate(user(employeeId=None, mail="shared.inbox@sailssoftware.invalid")).reason,
        "no_employee_id",
    )
    check(
        "the synthetic id cannot collide with a real one",
        rs.synthetic_admin_id(admin_mailbox).startswith("ADMIN-"),
        True,
    )
    check(
        "a real admin WITH an employeeId keeps it",
        evaluate(user(employeeId="SS519", mail=admin_mailbox)).employee_id,
        "SS519",
    )
finally:
    rs.settings.__dict__["admin_email_list"] = original_admins

# ── Admin is exact-match only ────────────────────────────────────────────────
print("\nAdmin allowlist — exact match only")

admin_email = rs.settings.admin_email_list[0] if rs.settings.admin_email_list else ""
if admin_email:
    near_miss = admin_email.replace("@", "x@", 1)
    check(
        "a near-miss on an admin address does NOT grant ADMIN",
        rs.resolve_role(near_miss, "EFX-I9HQ", "Software Engineer"),
        Role.EMPLOYEE,
    )
    check(
        "the exact admin address does grant ADMIN",
        rs.resolve_role(admin_email, "EFX-I9HQ", "Software Engineer"),
        Role.ADMIN,
    )

# ── Intern gating ────────────────────────────────────────────────────────────
print("\nIntern gating — both signals, NBSP tolerant")

check(
    "NBSP inside 'Intern\\xa0to Hire' is still detected",
    evaluate(user(employeeType="Intern\xa0to Hire", employeeId="T0080")).can_sign_in,
    False,
)
check(
    "'Paid Internship' is detected by substring",
    evaluate(user(employeeType="Paid Internship", employeeId="T0084")).can_sign_in,
    False,
)
check(
    "T-prefix alone blocks, even if employeeType looks permanent",
    evaluate(user(employeeType="Full Time", employeeId="T0099")).can_sign_in,
    False,
)
check(
    "employeeType alone blocks, even with an SS id",
    evaluate(user(employeeType="Intern to Hire", employeeId="SS123")).can_sign_in,
    False,
)
check(
    "'ST008' is NOT treated as an intern (starts with S, not T)",
    evaluate(user(employeeId="ST008")).can_sign_in,
    True,
)
check(
    "blank employeeType does not imply intern",
    evaluate(user(employeeType=None)).can_sign_in,
    True,
)

# ── Deny rules ───────────────────────────────────────────────────────────────
print("\nDeny rules")

check("guests denied", evaluate(user(userType="Guest")).reason, "guest_account")
check(
    "disabled accounts denied",
    evaluate(user(accountEnabled=False)).reason,
    "account_disabled",
)
check(
    "missing employeeId denied",
    evaluate(user(employeeId=None)).reason,
    "no_employee_id",
)
check(
    "denied users are never emailed",
    evaluate(user(userType="Guest")).receives_monthly_email,
    False,
)

# ── Persona assignment ───────────────────────────────────────────────────────
print("\nPersona assignment")

check(
    "VP of Technical Delivery gets HR",
    evaluate(user(department="Management", jobTitle="VP of Technical Delivery")).role,
    Role.HR,
)
check(
    "casing drift: 'Director Of Technical Delivery' gets HR",
    evaluate(user(department="AI CoE", jobTitle="Director Of Technical Delivery")).role,
    Role.HR,
)
check(
    "a US-based engineer stays EMPLOYEE (id prefix grants nothing)",
    evaluate(user(employeeId="SSUS09", jobTitle="Senior Software Engineer")).role,
    Role.EMPLOYEE,
)
check(
    "'Delivery Manager' gets HR (not just 'Technical Delivery Manager')",
    evaluate(user(jobTitle="Delivery Manager")).role,
    Role.HR,
)

# Architects are split deliberately: the two most senior titles carry HR, the
# rest do not. These four guard that boundary — the titles are similar enough
# that a loosened fuzzy threshold would quietly merge them.
check(
    "Principal Architect gets HR",
    evaluate(user(jobTitle="Principal Architect")).role,
    Role.HR,
)
check(
    "Senior Technical Architect gets HR even with a trailing space",
    evaluate(user(jobTitle="Senior Technical Architect ")).role,
    Role.HR,
)
check(
    "Software Architect stays EMPLOYEE",
    evaluate(user(jobTitle="Software Architect")).role,
    Role.EMPLOYEE,
)
check(
    "Test Architect stays EMPLOYEE",
    evaluate(user(jobTitle="Test Architect")).role,
    Role.EMPLOYEE,
)
check(
    "SDET Architect stays EMPLOYEE",
    evaluate(user(jobTitle="SDET Architect")).role,
    Role.EMPLOYEE,
)
check(
    "a US-based engineer still receives the monthly email",
    evaluate(user(employeeId="SSUS09", department="EFX-I9A")).receives_monthly_email,
    True,
)
check(
    "Maternity Leave keeps EMPLOYEE persona",
    evaluate(user(department="Maternity Leave", jobTitle="Software Engineer")).role,
    Role.EMPLOYEE,
)
check(
    "Maternity Leave suppresses the monthly email",
    evaluate(user(department="Maternity Leave")).receives_monthly_email,
    False,
)
check(
    "MMS is technical — still emailed",
    evaluate(user(department="MMS", jobTitle="Technical Writer")).receives_monthly_email,
    True,
)
check(
    "client delivery staff are emailed",
    evaluate(user(department="EFX-I9HQ")).receives_monthly_email,
    True,
)

# Delivery leads sit in the same departments as the engineers they lead, so
# only the job title distinguishes them. These guard that the title-based
# email exclusion does not leak onto the wider team.
print("\nLeads — HR persona but no monthly email")

for lead_title in (
    "Director of Technical Delivery",
    "Technical Delivery Manager",
    "Delivery Manager",
    "Principal Architect",
    "Senior Technical Architect",
):
    decision = evaluate(user(department="EFX-I9HQ", jobTitle=lead_title))
    check(f"{lead_title}: HR persona", decision.role, Role.HR)
    check(f"{lead_title}: NOT emailed", decision.receives_monthly_email, False)

check(
    "an engineer in the SAME department is still emailed",
    evaluate(user(department="EFX-I9HQ", jobTitle="Senior Software Engineer")).receives_monthly_email,
    True,
)
check(
    "Software Architect is emailed (not a lead)",
    evaluate(user(department="EFX-UC-Edge", jobTitle="Software Architect")).receives_monthly_email,
    True,
)

# ── Result ───────────────────────────────────────────────────────────────────
print("\n" + "=" * 62)
if _failures:
    print(f"{len(_failures)} CHECK(S) FAILED:")
    for name in _failures:
        print(f"   - {name}")
    raise SystemExit(1)
print("All checks passed.\n")
