"""
Persona resolution — turns an Entra directory record into an access decision.

This is the single place that answers "may this person sign in, and as what?".
Both the sign-in callback and the directory sync call `evaluate()`, so a user's
persona is computed identically whether it is being minted for a live session
or written during a batch sync.

Everything here is pure: no I/O, no database. That keeps it trivially testable
against the real directory (see scripts/preview_personas.py).

## Why the normalization is so defensive

Profiled against the live tenant, these are actual values in use:

    employeeType : 'Full Time', 'Full Time ', 'Full time', 'Full TIme', 'Full',
                   'Permanent', 'Consultant', 'Paid Internship',
                   'Intern\\xa0to Hire', 'Intern\\xa0 to Hire', and 56 blanks
    department   : 'JA', 'JA ', 'Talent Pool', 'HR', 'TM', 'TA', 'EFX-I9HQ', ...

Note the U+00A0 NO-BREAK SPACE inside "Intern to Hire" — someone pasted it from
a document. An equality check against "Intern to Hire" misses it entirely, which
would let four interns sign in. Hence: substring matching over a string that has
had all Unicode whitespace folded to plain spaces.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from enum import Enum

from config.entra_config import settings

logger = logging.getLogger(__name__)


class Role(str, Enum):
    ADMIN = "ADMIN"
    HR = "HR"
    EMPLOYEE = "EMPLOYEE"


class DenyReason(str, Enum):
    GUEST = "guest_account"
    DISABLED = "account_disabled"
    NO_EMPLOYEE_ID = "no_employee_id"
    INTERN = "intern_not_permanent"


# Any Unicode whitespace (incl. U+00A0 NBSP, U+2007, U+202F) -> single space.
_WHITESPACE = re.compile(r"\s+", re.UNICODE)


def normalize(value: str | None) -> str:
    """Casefolded, whitespace-collapsed form used for every comparison.

    `str.strip()` alone is not enough — the problem values have NBSP *inside*
    them, not just at the edges, and 'JA ' vs 'JA' differ only by a trailing
    space. Collapsing first means both sides of every comparison are clean.
    """
    if not value:
        return ""
    return _WHITESPACE.sub(" ", value).strip().casefold()


# ── Typo tolerance ───────────────────────────────────────────────────────────
#
# Departments are hand-typed and genuinely misspelt in the directory:
# "Finanace" for Finance, "Paper Trial" for PaperTrail, "SpeechPandit" for
# SpeechPundit. Exact matching alone quietly mistreats those people.
#
# But fuzzy matching decides who gets HR access, so it has to be conservative.
# Measured against the real tenant, matching at edit distance 1 with no length
# floor produces a genuine catastrophe: "JA" and "TA" differ by one character,
# and JA is a 27-person delivery department that would silently be granted HR.
#
# Hence the floor. Below _FUZZY_MIN_LENGTH characters, only exact matches
# count — which is what keeps the two-letter departments (HR, TM, TA, IT, JA,
# AI) strictly separate. At or above it, one edit is tolerated. Re-verified
# after any change with scripts/preview_personas.py: zero false positives.

_FUZZY_MIN_LENGTH = 5
_FUZZY_MAX_DISTANCE = 1
_SEPARATORS = re.compile(r"[\s\-_]+")


def _squash(value: str) -> str:
    """Drop separators so 'Paper Trial' and 'PaperTrail' are one edit apart
    rather than two — a dropped space plus a transposition would otherwise
    need a distance-2 threshold, which is far riskier."""
    return _SEPARATORS.sub("", value)


def _edit_distance(left: str, right: str) -> int:
    """Damerau-Levenshtein: counts a transposition as one edit.

    Chosen over plain Levenshtein because swapped adjacent characters are the
    most common human typo ('Trial'/'Trail'), and treating that as two edits
    would force a threshold loose enough to cause false positives.
    """
    rows, cols = len(left), len(right)
    if abs(rows - cols) > _FUZZY_MAX_DISTANCE:
        return _FUZZY_MAX_DISTANCE + 1

    grid = [[0] * (cols + 1) for _ in range(rows + 1)]
    for i in range(rows + 1):
        grid[i][0] = i
    for j in range(cols + 1):
        grid[0][j] = j

    for i in range(1, rows + 1):
        for j in range(1, cols + 1):
            cost = 0 if left[i - 1] == right[j - 1] else 1
            grid[i][j] = min(
                grid[i - 1][j] + 1,
                grid[i][j - 1] + 1,
                grid[i - 1][j - 1] + cost,
            )
            if (
                i > 1
                and j > 1
                and left[i - 1] == right[j - 2]
                and left[i - 2] == right[j - 1]
            ):
                grid[i][j] = min(grid[i][j], grid[i - 2][j - 2] + 1)

    return grid[rows][cols]


def canonical_department(value: str | None) -> str:
    """Normalized department with known aliases folded together.

    Separate from typo tolerance on purpose. `matches_any` corrects accidental
    slips — one character, machine-detectable. This handles departments the
    directory genuinely holds under two different names ("Biz Dev" and
    "Business Development"; "SpeechPandit" and "SpeechPundit"), which no edit
    distance could safely merge and which therefore have to be stated
    explicitly by someone who knows they are the same team.
    """
    normalized = normalize(value)
    return settings.department_alias_map.get(normalized, normalized)


def matches_any(value: str | None, candidates: list[str]) -> str | None:
    """Return the matching candidate, or None.

    Exact (normalized) match first; a near match only for values long enough
    to be safe. Fuzzy hits are logged at INFO — a typo silently granting
    privileged access should leave a trace someone can find.
    """
    normalized = normalize(value)
    if not normalized:
        return None

    if normalized in candidates:
        return normalized

    squashed = _squash(normalized)
    if len(squashed) < _FUZZY_MIN_LENGTH:
        return None

    for candidate in candidates:
        squashed_candidate = _squash(candidate)
        if len(squashed_candidate) < _FUZZY_MIN_LENGTH:
            continue
        if _edit_distance(squashed, squashed_candidate) <= _FUZZY_MAX_DISTANCE:
            logger.info(
                "fuzzy match: %r treated as %r (likely typo)", normalized, candidate
            )
            return candidate

    return None


@dataclass(frozen=True)
class AccessDecision:
    """Outcome of evaluating one directory record.

    `reason` is carried on both allow and deny so it can be written to the
    audit log — "why did this person get HR?" is a question that will be asked.
    """

    can_sign_in: bool
    role: Role | None
    employee_id: str | None
    reason: str
    is_intern: bool
    in_talent_pool: bool
    receives_monthly_email: bool
    # Aliases folded together, so "Biz Dev" and "Business Development" group as
    # one team in HR reporting. The raw Entra value is stored alongside it.
    department_canonical: str


# ── Individual rules ─────────────────────────────────────────────────────────


def synthetic_admin_id(email: str | None) -> str:
    """A stable employee id for an admin mailbox that has no real one.

    Service and project mailboxes have no `employeeId` in the directory —
    they are not people — but an admin account still needs an id, because the
    session, the audit trail and every route key on one.

    Derived from the mailbox local-part so it is stable across sign-ins (the
    audit log must attribute repeat actions to the same actor) and prefixed so
    it can never collide with a real id. Real ids seen in this tenant are
    SS###, SSUS##, SSIC###, ST### and T####; none start with "ADMIN-".
    """
    local_part = (email or "").split("@")[0].strip().casefold()
    cleaned = re.sub(r"[^a-z0-9._-]", "", local_part) or "unknown"
    return f"ADMIN-{cleaned}"


def resolve_employee_id(raw: str | None) -> str | None:
    """The employeeId the app should use, applying any configured override.

    Entra is the source of truth for *most* fields, but not always for the id:
    two records carry an id that disagrees with where the person's resume and
    skill history actually live. Resolving here means both the sign-in callback
    and the directory sync agree, so someone with a corrected id gets a session
    under the right key and can see their own data.
    """
    employee_id = (raw or "").strip()
    if not employee_id:
        return None

    override = settings.employee_id_override_map.get(employee_id.upper())
    if override:
        logger.info(
            "employeeId override: Entra %r treated as %r", employee_id, override
        )
        return override
    return employee_id


def is_intern(employee_type: str | None, employee_id: str | None) -> bool:
    """True if either signal says intern.

    Deliberately an OR: a person is only login-capable when *both* signals
    agree they are permanent. In the current directory the two never disagree
    (4 interns, flagged identically by both), so this costs nothing today and
    protects against a half-updated record later — e.g. HR changes the
    employeeType at conversion but has not yet reissued the SS-series ID.
    """
    normalized_type = normalize(employee_type)
    if any(marker in normalized_type for marker in settings.intern_type_marker_list):
        return True

    prefix = settings.intern_id_prefix.strip().casefold()
    return bool(prefix) and (employee_id or "").strip().casefold().startswith(prefix)


def in_talent_pool(department: str | None) -> bool:
    """Talent Pool membership is derived from the department, never stored.

    Departments in this tenant are client/project names (EFX-I9HQ, Loqbox,
    Revvity...), so "Talent Pool" genuinely means unallocated. Someone rolling
    onto a project leaves the pool automatically when HR updates the field —
    which is why the old manual is_on_bench toggle is going away.
    """
    return (
        matches_any(
            canonical_department(department),
            [normalize(settings.talent_pool_department)],
        )
        is not None
    )


def receives_monthly_email(department: str | None, job_title: str | None = None) -> bool:
    """Whether this person is chased monthly to refresh their resume.

    Two independent exclusions, because the population splits two ways:

    - by department — the non-technical support functions (HR, TM, TA,
      Finance, IT, Operations, Biz Dev, Management, Support). MMS is
      deliberately absent: its Technical Writers count as technical staff.

    - by job title — the delivery leadership (Directors, Technical Delivery
      Managers, Delivery Manager, Principal / Senior Technical Architect).
      Department alone cannot catch these: they sit in EFX-*, JA, AI CoE and
      Revvity alongside the engineers they lead, so a department rule would
      either miss them or wrongly suppress their whole team.

    Note this is still not keyed to the *persona*. MMS Technical Writers hold
    the HR persona via their department yet are emailed, and the ADMIN is an
    ordinary employee who is emailed too. Persona governs what you can see;
    these two rules govern whether you maintain your own resume.
    """
    if (
        matches_any(
            canonical_department(department), settings.email_excluded_department_list
        )
        is not None
    ):
        return False
    return matches_any(job_title, settings.hr_job_title_list) is None


def resolve_role(
    email: str | None,
    department: str | None,
    job_title: str | None,
) -> Role:
    """First match wins: ADMIN, then HR, then EMPLOYEE.

    ADMIN is a deployment-config allowlist rather than a database column, so
    the admin set cannot be changed by anyone holding Mongo write access —
    granting it requires a deploy, which is itself access-controlled.
    """
    # Email is matched exactly, never fuzzily. It is a precise identifier, and
    # a near-miss on an admin address would be an privilege-escalation bug,
    # not a helpful correction.
    if normalize(email) in settings.admin_email_list:
        return Role.ADMIN

    if matches_any(canonical_department(department), settings.hr_department_list):
        return Role.HR

    if matches_any(job_title, settings.hr_job_title_list):
        return Role.HR

    return Role.EMPLOYEE


# ── Combined evaluation ──────────────────────────────────────────────────────


def evaluate(user: dict) -> AccessDecision:
    """Evaluate one Graph user object (the `$select` shape used by the sync).

    Deny rules run before role resolution — there is no point deciding someone
    is HR if they cannot sign in at all.
    """
    email = user.get("mail") or user.get("userPrincipalName")
    is_allowlisted_admin = normalize(email) in settings.admin_email_list

    employee_id = resolve_employee_id(user.get("employeeId"))
    department = user.get("department")

    # An admin mailbox provisioned for the project has no employeeId, because
    # it is not a person. Give it a synthetic one so the session and audit
    # trail have a stable actor to record, rather than refusing sign-in under
    # the no_employee_id rule below.
    #
    # Deliberately narrow: this applies only to addresses explicitly listed in
    # ADMIN_EMAILS, which lives in deployment config. It is not a general
    # "accounts without an id may sign in" exemption — the other 45 accounts
    # without one are shared mailboxes and service principals that must stay
    # locked out.
    if is_allowlisted_admin and not employee_id:
        employee_id = synthetic_admin_id(email)
        logger.info(
            "Admin mailbox %s has no employeeId — using synthetic id %s",
            email, employee_id,
        )

    intern = is_intern(user.get("employeeType"), employee_id)
    pooled = in_talent_pool(department)

    def deny(reason: DenyReason) -> AccessDecision:
        return AccessDecision(
            can_sign_in=False,
            role=None,
            employee_id=employee_id,
            reason=reason.value,
            is_intern=intern,
            in_talent_pool=pooled,
            # Someone who cannot sign in has nowhere to action a reminder, so
            # never email them. Interns are invited by the directory sync when
            # they convert to permanent — a different message on a different
            # trigger, not this monthly cycle.
            receives_monthly_email=False,
            department_canonical=canonical_department(department),
        )

    # Guests are real, sign-in-capable accounts (contractors, client staff
    # invited into Teams). They are not employees and must never reach this app.
    if (user.get("userType") or "").casefold() != "member":
        return deny(DenyReason.GUEST)

    if not user.get("accountEnabled"):
        return deny(DenyReason.DISABLED)

    # No employeeId means no way to link the person to their app record.
    # Verified safe as a hard rule: of 48 active members without one, 45 have
    # no jobTitle and no department — they are shared mailboxes and service
    # accounts, not staff. Allowlisted admin mailboxes were given a synthetic
    # id above, so they never reach this.
    if not employee_id:
        return deny(DenyReason.NO_EMPLOYEE_ID)

    # Interns are synced and visible to HR in the Talent Pool, but cannot sign
    # in and get no app profile. The directory sync watches for this flipping
    # to False and sends the onboarding invite at that moment.
    if intern:
        return deny(DenyReason.INTERN)

    role = resolve_role(email, department, user.get("jobTitle"))

    # Record which rule granted the role, using the matched *canonical* value
    # rather than the raw one — so an entry reads "hr_department:finance" even
    # when the directory says "Finanace", making the typo visible in the audit
    # trail instead of silently normalised away.
    is_service_admin = employee_id.startswith("ADMIN-")

    if role is Role.ADMIN:
        reason = "admin_allowlist_service_mailbox" if is_service_admin else "admin_allowlist"
    elif (
        matched := matches_any(
            canonical_department(department), settings.hr_department_list
        )
    ):
        reason = f"hr_department:{matched}"
    elif (matched := matches_any(user.get("jobTitle"), settings.hr_job_title_list)):
        reason = f"hr_job_title:{matched}"
    else:
        reason = "default_employee"

    return AccessDecision(
        can_sign_in=True,
        role=role,
        employee_id=employee_id,
        reason=reason,
        is_intern=False,
        in_talent_pool=pooled,
        # A project mailbox has no resume to keep current, so it is never
        # chased. Real admins who are also employees still are.
        receives_monthly_email=(
            False if is_service_admin
            else receives_monthly_email(department, user.get("jobTitle"))
        ),
        department_canonical=canonical_department(department),
    )
