from datetime import datetime, timezone, timedelta
import asyncio
import os
import time
from typing import Any, Dict, Optional
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import PyMongoError
from constants.skill_categories import SKILL_CATEGORIES, normalize_skill
from services.gcs_service import delete_resume
import logging

logger = logging.getLogger(__name__)

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGO_DB_NAME", "resume_sync_db")

client = AsyncIOMotorClient(MONGO_URI)
db = client[DB_NAME]

col_user_accounts = db["user_accounts"]
col_employee_resume_data = db["employee_resume_data"]
col_resume_store = db["resume_store"]
col_audit_data = db["audit_data"]
col_employee_skill_summary = db["employee_skill_summary"]


async def get_employee_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Returns a merged dict of user_accounts + employee_skill_summary fields
    so callers get employeeId, role, status, fullName, currentRole, department,
    isOnBench — same shape as before, no code changes needed in routes."""
    try:
        account = await col_user_accounts.find_one({"email": email}, {"_id": 0})
        if not account:
            return None
        skill = await col_employee_skill_summary.find_one(
            {"employee_id": account["employeeId"]}, {"_id": 0}
        ) or {}
        return {
            **account,
            "fullName":    skill.get("name", account.get("email", "").split("@")[0].title()),
            "currentRole": skill.get("current_designation", ""),
            "department":  skill.get("department", ""),
            "isOnBench":   skill.get("is_on_bench", False),
        }
    except PyMongoError as e:
        logger.error(f"get_employee_by_email error: {e}")
        return None


# ── Active-employee cache ────────────────────────────────────────────────────
#
# Every HR view calls active_employee_filter(), and each Firestore round trip
# costs ~330ms regardless of how little data it returns. Fetching the same
# ~330 ids on every request added most of a second to every screen.
#
# The set only changes when the directory sync runs (daily), so a short TTL is
# both safe and enough: worst case a leaver stays visible for a few minutes.
# invalidate_active_employee_cache() is called by the sync so a change lands
# immediately rather than waiting out the TTL.
_ACTIVE_CACHE_TTL_SECONDS = 300
_active_cache: Dict[bool, tuple[float, list[str]]] = {}


def invalidate_active_employee_cache() -> None:
    _active_cache.clear()


async def active_employee_filter(exclude_hr: bool = True) -> Dict[str, Any]:
    """A Mongo filter restricting employee_skill_summary to current staff.

    Two exclusions, both of which used to be applied inconsistently:

    `canSignIn` — `employee_skill_summary` predates the directory sync and has
    no notion of someone having left; only `user_accounts` knows that. Without
    this, HR lists, skill searches, exports and headcount metrics all silently
    included leavers.

    `role != HR` — HR-persona staff are the audience for these screens, not
    the subject of them, so they are excluded from the employee inventory.
    This rule already existed inside get_full_employee_directory but nowhere
    else, so the Employee List showed 246 while the Excel export of the same
    data showed 243. Centralising it keeps every view agreeing.

    Returns a filter rather than a list so callers can merge it into their own
    query. If the lookup fails it returns an empty filter — showing slightly
    too much is a better failure than showing HR an empty dashboard.
    """
    cached = _active_cache.get(exclude_hr)
    if cached and (time.monotonic() - cached[0]) < _ACTIVE_CACHE_TTL_SECONDS:
        return {"employee_id": {"$in": cached[1]}}

    try:
        criteria: Dict[str, Any] = {"canSignIn": True}
        if exclude_hr:
            criteria["role"] = {"$ne": "HR"}
        ids = [
            doc["employeeId"]
            async for doc in col_user_accounts.find(
                criteria, {"_id": 0, "employeeId": 1}
            )
            if doc.get("employeeId")
        ]
        _active_cache[exclude_hr] = (time.monotonic(), ids)
        return {"employee_id": {"$in": ids}}
    except PyMongoError as e:
        logger.error(f"active_employee_filter error: {e}")
        return {}


async def get_employee_by_id(employee_id: str) -> Optional[Dict[str, Any]]:
    """Same merged shape as get_employee_by_email, keyed on employeeId.

    Routes use this rather than get_employee_by_email once identity comes
    from the session — the session carries employee_id (the JWT/session
    subject), never a client-supplied email, so this is the lookup that keeps
    self-service routes from trusting anything the caller sent.
    """
    try:
        account = await col_user_accounts.find_one({"employeeId": employee_id}, {"_id": 0})
        if not account:
            return None
        skill = await col_employee_skill_summary.find_one(
            {"employee_id": employee_id}, {"_id": 0}
        ) or {}
        return {
            **account,
            "fullName":    skill.get("name", account.get("email", "").split("@")[0].title()),
            "currentRole": skill.get("current_designation", ""),
            "department":  skill.get("department", ""),
            "isOnBench":   skill.get("is_on_bench", False),
        }
    except PyMongoError as e:
        logger.error(f"get_employee_by_id error: {e}")
        return None


async def get_all_employees() -> list[Dict[str, Any]]:
    try:
        cursor = col_employee_skill_summary.find(
            {"email": {"$exists": True, "$ne": None}},
            {"_id": 0, "email": 1, "name": 1},
        )
        return [{"email": d["email"], "fullName": d["name"]} async for d in cursor]
    except PyMongoError as e:
        logger.error(f"get_all_employees error: {e}")
        return []


async def get_monthly_email_recipients() -> list[Dict[str, Any]]:
    """Employees who should receive the monthly resume-update prompt.

    Distinct from get_all_employees(), which reads employee_skill_summary and
    returns everyone it finds. This reads user_accounts, which the Entra
    directory sync maintains, and applies two filters:

      canSignIn            — no point prompting someone who cannot log in to
                             action it (guests, interns, disabled accounts)
      receivesMonthlyEmail — excludes the non-technical support functions

    Source of truth is the directory sync, so a leaver stops being emailed on
    the next sync rather than lingering in a stale spreadsheet-derived list.

    Each recipient carries `has_resume` / `has_skill_profile` so the caller can
    send copy matching what the person will actually see when they click. The
    cycle used to send everyone "Want to update your resume?", including 33
    people who had never uploaded one and would land on a blank upload screen.
    """
    try:
        accounts = await col_user_accounts.find(
            {
                "canSignIn": True,
                "receivesMonthlyEmail": True,
                "email": {"$exists": True, "$nin": [None, ""]},
            },
            {"_id": 0, "email": 1, "fullName": 1, "employeeId": 1},
        ).to_list(length=None)

        ids = [a["employeeId"] for a in accounts if a.get("employeeId")]

        # Two batched lookups rather than two per recipient — at ~330ms per
        # Firestore round trip, per-recipient queries would add three minutes
        # to a 278-person cycle.
        with_resume = set(
            await col_employee_resume_data.distinct(
                "employee_id", {"employee_id": {"$in": ids}}
            )
        )
        with_profile = {
            doc["employee_id"]
            for doc in await col_employee_skill_summary.find(
                {"employee_id": {"$in": ids}}, {"_id": 0, "employee_id": 1}
            ).to_list(length=None)
            if doc.get("employee_id")
        }

        return [
            {
                "email": doc["email"],
                "fullName": doc.get("fullName") or "Team Member",
                "employeeId": doc.get("employeeId"),
                "has_resume": doc.get("employeeId") in with_resume,
                "has_skill_profile": doc.get("employeeId") in with_profile,
            }
            for doc in accounts
        ]
    except PyMongoError as e:
        logger.error(f"get_monthly_email_recipients error: {e}")
        return []


async def mark_prompt_sent(employee_ids: list[str]) -> int:
    """Record that this cycle's prompt went out.

    Without this, `derive_monthly_response` has no prompt date to compare
    against and every employee shows "No Response" in the HR list forever —
    which is why that column has never worked. Written after a successful
    send, so a failed delivery does not start someone's response clock.
    """
    if not employee_ids:
        return 0
    try:
        result = await col_employee_skill_summary.update_many(
            {"employee_id": {"$in": employee_ids}},
            {"$set": {
                "monthly_prompt_sent_at": datetime.now(timezone.utc),
                # Clear last cycle's answer so the badge reflects *this* month.
                "monthly_response": None,
            }},
        )
        return result.modified_count
    except PyMongoError as e:
        logger.error(f"mark_prompt_sent error: {e}")
        return 0


async def set_monthly_response(employee_id: str, response: str) -> bool:
    """Record an explicit "updated" or "declined" for the current cycle."""
    try:
        result = await col_employee_skill_summary.update_one(
            {"employee_id": employee_id},
            {"$set": {
                "monthly_response": response,
                "monthly_response_at": datetime.now(timezone.utc),
            }},
        )
        return result.matched_count > 0
    except PyMongoError as e:
        logger.error(f"set_monthly_response error for {employee_id}: {e}")
        return False


async def get_employee_resume_data(employee_id: str) -> Optional[Dict[str, Any]]:
    try:
        return await col_employee_resume_data.find_one(
            {"employee_id": employee_id}, {"_id": 0}
        )
    except PyMongoError as e:
        logger.error(f"get_employee_resume_data error: {e}")
        return None


def _extract_search_tags(skills: Dict[str, Any]) -> list:
    """Safely flatten and deduplicate skills."""
    if not isinstance(skills, dict):
        return []
    return list(
        {
            tag
            for values in skills.values()
            if isinstance(values, list)
            for tag in values
        }
    )


async def upsert_employee_data(
    employee_id: str,
    current_role: Optional[str] = None,  # noqa: kept for call-site compat
    department: Optional[str] = None,    # noqa: kept for call-site compat
    status: str = "Active",
) -> Dict[str, Any]:
    """Updates user_accounts status/lastLoginAt; designation/department live in
    employee_skill_summary and are updated via upsert_employee_skill_summary."""
    try:
        update_fields: Dict[str, Any] = {
            "status":      status,
            "lastLoginAt": datetime.now(timezone.utc),
        }
        result = await col_user_accounts.update_one(
            {"employeeId": employee_id},
            {"$set": update_fields},
            upsert=True,
        )
        return {
            "status": "success",
            "data": {
                "upserted": result.upserted_id is not None,
                "modified": result.modified_count,
            },
        }

    except PyMongoError as e:
        logger.error(f"upsert_employee_data error for {employee_id}: {e}")
        return {"status": "error", "message": str(e)}


async def upsert_user_from_directory(
    profile: Dict[str, Any],
    decision: Any,
    entra_object_id: str,
) -> Dict[str, Any]:
    """Write an Entra directory record into user_accounts.

    Called from two places with identical effect: the sign-in callback (so a
    change lands immediately for the person signing in) and the scheduled
    directory sync (so it lands for everyone else). Keyed on employeeId, which
    the tenant populates consistently and which — unlike email — does not change
    when someone marries or the mail domain is rebranded.

    Entra is the source of truth for every field written here. The app's own
    employee spreadsheet was verified stale: engineering-only, missing HR, TM,
    TA, leadership and all interns.
    """
    employee_id = decision.employee_id
    if not employee_id:
        return {"status": "error", "message": "no employee_id"}

    now = datetime.now(timezone.utc)
    fields: Dict[str, Any] = {
        "employeeId":       employee_id,
        "entraObjectId":    entra_object_id,
        "email":            (profile.get("mail") or profile.get("userPrincipalName") or "").strip().lower(),
        "fullName":         profile.get("displayName"),
        "jobTitle":         profile.get("jobTitle"),
        "department":       profile.get("department"),
        # Aliases folded ("Biz Dev" -> "Business Development"). Group HR
        # reporting on this; keep `department` for the raw Entra value.
        "departmentCanonical": decision.department_canonical,
        "officeLocation":   profile.get("officeLocation"),
        "employeeType":     profile.get("employeeType"),
        "role":             decision.role.value if decision.role else None,
        "roleReason":       decision.reason,
        "canSignIn":        decision.can_sign_in,
        "isIntern":         decision.is_intern,
        "inTalentPool":     decision.in_talent_pool,
        "receivesMonthlyEmail": decision.receives_monthly_email,
        "status":           "Active" if decision.can_sign_in else "Inactive",
        "directorySyncedAt": now,
    }

    try:
        result = await col_user_accounts.update_one(
            {"employeeId": employee_id},
            {"$set": fields, "$setOnInsert": {"createdAt": now}},
            upsert=True,
        )
        return {
            "status": "success",
            "data": {
                "upserted": result.upserted_id is not None,
                "modified": result.modified_count,
            },
        }
    except PyMongoError as e:
        logger.error(f"upsert_user_from_directory error for {employee_id}: {e}")
        return {"status": "error", "message": str(e)}


async def save_employee_resume_data(
    employee_id: str,
    resume_data: Dict[str, Any],
    current_role: Optional[str] = None,
) -> Dict[str, Any]:
    try:
        skills = resume_data.get("technical_skills", {})
        search_tags = _extract_search_tags(skills)

        doc = {
            **resume_data,
            "employee_id": employee_id,
            "search_tags": search_tags,
            "updated_at": datetime.now(timezone.utc),
        }

        result = await col_employee_resume_data.update_one(
            {"employee_id": employee_id},
            {"$set": doc},
            upsert=True,
        )
        await upsert_employee_data(employee_id, current_role)
        return {
            "status": "success",
            "data": {
                "upserted_id": str(result.upserted_id) if result.upserted_id else None,
                "modified_count": result.modified_count,
            },
        }

    except PyMongoError as e:
        return {"status": "error", "message": str(e)}


async def get_resume_path(employee_id: str) -> Optional[str]:
    try:
        doc = await col_resume_store.find_one(
            {"employee_id": employee_id}, {"_id": 0, "resume_path": 1}
        )
        return doc.get("resume_path") if doc else None
    except PyMongoError as e:
        logger.error(f"get_resume_path error: {e}")
        return None


async def upsert_resume_path(employee_id: str, resume_path: str) -> Dict[str, Any]:
    try:
        result = await col_resume_store.update_one(
            {"employee_id": employee_id},
            {
                "$set": {
                    "employee_id": employee_id,
                    "resume_path": resume_path,
                    "last_updated_at": datetime.now(timezone.utc),
                }
            },
            upsert=True,
        )
        return {
            "status": "success",
            "data": {
                "upserted": result.upserted_id is not None,
                "modified": result.modified_count,
            },
        }
    except PyMongoError as e:
        logger.error(f"upsert_resume_path error for {employee_id}: {e}")
        return {"status": "error", "message": str(e)}


async def get_employee_skill_summary(employee_id: str) -> Optional[Dict[str, Any]]:
    try:
        return await col_employee_skill_summary.find_one(
            {"employee_id": employee_id}, {"_id": 0}
        )
    except PyMongoError as e:
        logger.error(f"get_employee_skill_summary error: {e}")
        return None


async def upsert_employee_skill_summary(
    employee_id: str,
    name: str,
    email: Optional[str] = None,
    current_designation: Optional[str] = None,
    current_skill: Optional[str] = None,
    total_exp: Optional[float] = None,
    current_skill_exp: Optional[float] = None,
    primary_skill: Optional[str] = None,
    secondary_skill: Optional[str] = None,
    is_on_bench: Optional[bool] = None,
) -> Dict[str, Any]:
    """employee_id and name are always set from the authenticated employee
    record, never from client input, so they cannot be edited via the API.
    When current_skill changes, the previous skill is automatically pushed
    into skill_history[] with a timestamp so the transition is preserved."""
    try:
        existing = await col_employee_skill_summary.find_one(
            {"employee_id": employee_id}
        ) or {}

        new_skill = normalize_skill(current_skill) if current_skill is not None else existing.get("current_skill", "")
        old_skill = existing.get("current_skill", "")
        old_skill_exp = existing.get("current_skill_exp", 0)
        skill_history = existing.get("skill_history", [])

        # If skill changed and there was a previous skill, push it to history
        if old_skill and new_skill and old_skill != new_skill:
            skill_history = skill_history + [{
                "skill": old_skill,
                "skill_exp": old_skill_exp,
                "designation": existing.get("current_designation", ""),
                "from": existing.get("skill_started_at", existing.get("updated_at", datetime.now(timezone.utc))),
                "to": datetime.now(timezone.utc),
            }]

        update_fields: Dict[str, Any] = {
            "employee_id": employee_id,
            "name": name,
            "email": email if email is not None else existing.get("email"),
            "current_designation": (
                current_designation if current_designation is not None
                else existing.get("current_designation", "")
            ),
            "current_skill": new_skill,
            "total_exp": total_exp if total_exp is not None else existing.get("total_exp", 0),
            "current_skill_exp": (
                current_skill_exp if current_skill_exp is not None
                else existing.get("current_skill_exp", 0)
            ),
            "primary_skill": (
                primary_skill if primary_skill is not None
                else existing.get("primary_skill", "")
            ),
            "secondary_skill": (
                secondary_skill if secondary_skill is not None
                else existing.get("secondary_skill", "")
            ),
            "is_on_bench": (
                is_on_bench if is_on_bench is not None
                else existing.get("is_on_bench", False)
            ),
            "skill_history": skill_history,
            # Reset skill_started_at when skill changes, keep existing if not
            "skill_started_at": (
                datetime.now(timezone.utc) if (old_skill and new_skill and old_skill != new_skill)
                else existing.get("skill_started_at", datetime.now(timezone.utc))
            ),
            "updated_at": datetime.now(timezone.utc),
            # Any save clears the machine-guessed marker — once a human has
            # been through the form, the values are theirs regardless of where
            # they started. Resume ingestion re-sets this immediately after
            # its own call, so pre-filled values stay marked until confirmed.
            "prefilled_fields": [],
        }

        result = await col_employee_skill_summary.update_one(
            {"employee_id": employee_id},
            {"$set": update_fields},
            upsert=True,
        )
        return {
            "status": "success",
            "data": {
                "upserted": result.upserted_id is not None,
                "modified": result.modified_count,
            },
        }
    except PyMongoError as e:
        logger.error(f"upsert_employee_skill_summary error for {employee_id}: {e}")
        return {"status": "error", "message": str(e)}


async def get_new_employees() -> list[Dict[str, Any]]:
    """Staff with no resume yet — candidates for an onboarding invite.

    Sourced from `user_accounts`, which the Entra directory sync keeps current,
    rather than `employee_skill_summary`, which is a frozen snapshot of the
    July spreadsheet import.

    That distinction was the whole bug: 85 people had no resume but only ONE
    appeared here, because the other 84 were never in the spreadsheet. They are
    exactly the population this screen exists to surface — recent joiners the
    sync pulled from the directory. The screen built to find people needing
    onboarding was blind to everyone who joined after the import.

    Excludes HR-persona staff (they are the audience, not the subject) and
    anyone who cannot sign in, since an invite they cannot action is noise.
    """
    try:
        accounts = await col_user_accounts.find(
            {
                "canSignIn": True,
                "role": {"$ne": "HR"},
                "email": {"$exists": True, "$nin": [None, ""]},
            },
            {
                "_id": 0, "employeeId": 1, "fullName": 1, "email": 1,
                "department": 1, "jobTitle": 1, "directorySyncedAt": 1,
            },
        ).sort("employeeId", 1).to_list(length=None)

        # Unfiltered reads, then intersect in Python. Passing a 300-element
        # $in to Firestore's compat layer took 24 seconds; fetching both
        # collections whole and filtering here takes under two, because each
        # is a single round trip over a few hundred small documents.
        resumed, profile_docs = await asyncio.gather(
            col_employee_resume_data.distinct("employee_id"),
            col_employee_skill_summary.find(
                {}, {"_id": 0, "employee_id": 1}
            ).to_list(length=None),
        )
        resumed = set(resumed)
        with_profile = {
            doc["employee_id"] for doc in profile_docs if doc.get("employee_id")
        }

        return [
            {
                "employeeId":  a["employeeId"],
                "fullName":    a.get("fullName") or "",
                "email":       a.get("email") or "",
                "department":  a.get("department") or "",
                "jobTitle":    a.get("jobTitle") or "",
                # Lets HR distinguish "never started" from "uploaded a resume
                # but never completed their skill profile" — different nudge.
                "hasProfile":  a["employeeId"] in with_profile,
            }
            for a in accounts
            if a.get("employeeId")
            and a["employeeId"] not in resumed
            # Service/admin mailboxes carry a synthetic ADMIN- id. They are not
            # people and have no resume to chase.
            and not a["employeeId"].startswith("ADMIN-")
        ]
    except PyMongoError as e:
        logger.error(f"get_new_employees error: {e}")
        return []


async def get_skill_rack_summary() -> list[Dict[str, Any]]:
    """Builds the HR Skill Dashboard racks — one per canonical skill category
    (see constants.skill_categories.SKILL_CATEGORIES) — with employee headcount.
    Any legacy/free-text current_skill values are normalized on read, so the
    racks stay clean even before a full data migration has run. All 17
    categories are always returned (including zero-count ones) so HR can see
    skill gaps, not just where headcount already exists."""
    try:
        counts: Dict[str, int] = {}
        # Rack headcounts must exclude leavers, otherwise HR sees capacity
        # that does not exist.
        cursor = col_employee_skill_summary.find(
            await active_employee_filter(), {"_id": 0, "current_skill": 1}
        )
        async for doc in cursor:
            category = normalize_skill(doc.get("current_skill", ""))
            counts[category] = counts.get(category, 0) + 1

        return [
            {"skill": category, "employee_count": counts.get(category, 0)}
            for category in sorted(
                SKILL_CATEGORIES, key=lambda c: (-counts.get(c, 0), c)
            )
        ]
    except PyMongoError as e:
        logger.error(f"get_skill_rack_summary error: {e}")
        return []


async def get_employees_by_skill(
    skill: str, min_skill_exp: Optional[float] = None
) -> list[Dict[str, Any]]:
    """Returns all employees whose current_skill normalizes to the given
    canonical skill category, with the 6-field skill profile shape used by
    the HR Skill Dashboard drill-down (plus resume_path for Excel export).
    If min_skill_exp is given, only employees with current_skill_exp >=
    that value are returned (the "2+ yrs" / "3+ yrs" experience filter)."""
    try:
        target = normalize_skill(skill)
        cursor = col_employee_skill_summary.find(
            await active_employee_filter(),
            {
                "_id": 0,
                "employee_id": 1,
                "name": 1,
                "email": 1,
                "current_designation": 1,
                "current_skill": 1,
                "total_exp": 1,
                "current_skill_exp": 1,
                "primary_skill": 1,
                "secondary_skill": 1,
                "skill_history": 1,
            },
        )
        results = []
        async for doc in cursor:
            if normalize_skill(doc.get("current_skill", "")) != target:
                continue
            if min_skill_exp is not None and (
                doc.get("current_skill_exp") or 0
            ) < min_skill_exp:
                continue
            results.append(doc)

        resume_paths = await _get_resume_paths_by_employee_id(
            [r["employee_id"] for r in results]
        )
        for r in results:
            r["resume_path"] = resume_paths.get(r["employee_id"])
        return results
    except PyMongoError as e:
        logger.error(f"get_employees_by_skill error: {e}")
        return []


async def _get_resume_paths_by_employee_id(employee_ids: list[str]) -> Dict[str, str]:
    if not employee_ids:
        return {}
    cursor = col_resume_store.find(
        {"employee_id": {"$in": employee_ids}},
        {"_id": 0, "employee_id": 1, "resume_path": 1},
    )
    return {doc["employee_id"]: doc["resume_path"] async for doc in cursor}


async def get_full_employee_directory() -> list[Dict[str, Any]]:
    """Full org-wide employee list for the HR 'Employee List' Excel report —
    sourced entirely from employee_skill_summary (single source of truth)
    joined with user_accounts for role/status and resume collections."""
    try:
        # HR exclusion now lives in active_employee_filter() so the Employee
        # List and this export cannot drift apart again.
        skill_docs = await col_employee_skill_summary.find(
            await active_employee_filter(), {"_id": 0}
        ).to_list(length=None)

        resumed_ids = set(await col_employee_resume_data.distinct("employee_id"))
        resume_paths = await _get_resume_paths_by_employee_id(
            [d["employee_id"] for d in skill_docs]
        )

        results = []
        for skill in skill_docs:
            emp_id = skill["employee_id"]
            results.append(
                {
                    "employee_id":        emp_id,
                    "name":               skill.get("name", ""),
                    "email":              skill.get("email", ""),
                    "department":         skill.get("department", ""),
                    "current_role":       skill.get("current_designation", ""),
                    "current_designation": skill.get("current_designation", ""),
                    "current_skill":      skill.get("current_skill", ""),
                    "total_exp":          skill.get("total_exp", ""),
                    "current_skill_exp":  skill.get("current_skill_exp", ""),
                    "bench_status":       "On Bench" if skill.get("is_on_bench") else "Active",
                    "resume_status":      "Uploaded" if emp_id in resumed_ids else "Pending",
                    "resume_path":        resume_paths.get(emp_id),
                }
            )
        return results
    except PyMongoError as e:
        logger.error(f"get_full_employee_directory error: {e}")
        return []


# ── Monthly-update response tracking ──────────────────────────────────────────
#
# Each employee's monthly-update status is one of three values shown in the HR
# Employee List. The values are driven by the monthly scheduler flow:
#
#   "Updated"     — the employee updated their profile *after* this cycle's prompt
#                   (monthly_response == "updated", set when they save changes, OR
#                   updated_at is newer than monthly_prompt_sent_at).
#   "Declined"    — the employee clicked "Decline / nothing to update" in the email
#                   (monthly_response == "declined").
#   "No Response" — the prompt was sent 7+ days ago and neither of the above happened.
#   "Pending"     — a prompt is out but the 7-day window hasn't elapsed yet (still
#                   waiting to hear back — not yet counted as No Response).
#
# NOTE: the endpoints that actually SET monthly_response ("updated"/"declined") and
# monthly_prompt_sent_at are wired to the email-decline link + the monthly scheduler.
# Those depend on the pending email/IT decision, so today this helper degrades
# gracefully: with no prompt recorded it returns "No Response".

MONTHLY_NO_RESPONSE_DAYS = 7


def derive_monthly_response(doc: Dict[str, Any]) -> str:
    """Derives the display status for an employee's monthly-update response.

    Reads `monthly_response` (an explicit "updated"/"declined" set by the
    employee action / decline link) and `monthly_prompt_sent_at` (when this
    cycle's reminder went out). Falls back to comparing `updated_at` against the
    prompt so a profile save still counts as "Updated" even if the explicit flag
    wasn't set.
    """
    explicit = (doc.get("monthly_response") or "").lower()
    if explicit == "declined":
        return "Declined"

    prompt_at = doc.get("monthly_prompt_sent_at")
    updated_at = doc.get("updated_at") or doc.get("last_updated_at")

    # Explicitly marked updated, or profile was saved after the prompt went out.
    if explicit == "updated":
        return "Updated"
    if prompt_at and updated_at and updated_at >= prompt_at:
        return "Updated"

    # No update/decline recorded. If the 7-day window has elapsed → No Response,
    # otherwise we're still waiting on them (Pending).
    if prompt_at:
        cutoff = datetime.now(timezone.utc) - timedelta(days=MONTHLY_NO_RESPONSE_DAYS)
        prompt_at_aware = prompt_at if prompt_at.tzinfo else prompt_at.replace(tzinfo=timezone.utc)
        return "No Response" if prompt_at_aware <= cutoff else "Pending"

    # No prompt on record at all — nothing to respond to yet.
    return "No Response"


async def get_all_skill_summary_employees() -> list[Dict[str, Any]]:
    """Returns all records from employee_skill_summary joined with resume_store
    for the Employee List table — no bench status, just skill profile fields.

    Resume status uses employee_resume_data as the authoritative source
    (parsed content exists = resume uploaded/seeded). resume_store path is
    included when available but is not required for Uploaded status — some
    employees were seeded directly without a file path record.
    """
    try:
        # Current staff only — leavers were appearing in this list because
        # employee_skill_summary has no active/inactive concept of its own.
        docs = await col_employee_skill_summary.find(
            await active_employee_filter(),
            {
                "_id": 0,
                "employee_id": 1,
                "name": 1,
                "email": 1,
                "current_designation": 1,
                "current_skill": 1,
                "total_exp": 1,
                "current_skill_exp": 1,
                # Monthly-update response tracking (populated by the monthly
                # scheduler flow — see derive_monthly_response below).
                "monthly_response": 1,
                "monthly_prompt_sent_at": 1,
            },
        ).sort("employee_id", 1).to_list(length=None)

        ids = [d["employee_id"] for d in docs]

        # employee_resume_data is the source of truth — if parsed content exists,
        # the employee has a resume regardless of whether resume_store has a path.
        resumed_ids = set(
            await col_employee_resume_data.distinct("employee_id", {"employee_id": {"$in": ids}})
        )
        resume_paths = await _get_resume_paths_by_employee_id(ids)

        for d in docs:
            eid = d["employee_id"]
            d["resume_path"] = resume_paths.get(eid)
            d["resume_status"] = "Uploaded" if eid in resumed_ids else "Pending"
            d["monthly_response"] = derive_monthly_response(d)
            # Drop the raw fields the derivation consumed — the frontend only
            # needs the final status string.
            d.pop("monthly_prompt_sent_at", None)
        return docs
    except PyMongoError as e:
        logger.error(f"get_all_skill_summary_employees error: {e}")
        return []


async def get_talent_pool() -> Dict[str, Any]:
    """Talent Pool, split into the two tabs the HR screen shows.

    Membership is derived from the Entra department, not from a manual flag.
    Departments in this tenant are client/project names (EFX-*, Loqbox,
    Revvity...), so "Talent Pool" genuinely means unallocated — and someone
    rolling onto a project leaves the pool automatically when HR updates their
    department. That is why the old is_on_bench toggle is gone: it was a second
    source of truth that nobody remembered to update.

      bench   — permanent staff, unallocated. They have app profiles, so their
                skill data is joined in from employee_skill_summary.
      interns — no app account and no profile by design. Directory fields only;
                the screen is read-only for them. When their record flips to
                permanent, the directory sync emails them an invite and they
                move to the bench tab on the next run.
    """
    try:
        bench: list[Dict[str, Any]] = []
        interns: list[Dict[str, Any]] = []

        accounts = await col_user_accounts.find(
            {"inTalentPool": True},
            {
                "_id": 0, "employeeId": 1, "fullName": 1, "email": 1,
                "jobTitle": 1, "department": 1, "isIntern": 1, "canSignIn": 1,
                "employeeType": 1, "officeLocation": 1,
            },
        ).sort("employeeId", 1).to_list(length=None)

        # One batched lookup instead of one per bench member. Each Firestore
        # round trip costs ~330ms, so the previous per-person find_one made
        # this screen take 16 seconds for 27 people.
        bench_ids = [
            a["employeeId"] for a in accounts
            if a.get("employeeId") and not a.get("isIntern")
        ]
        skills_by_id = {
            doc["employee_id"]: doc
            for doc in await col_employee_skill_summary.find(
                {"employee_id": {"$in": bench_ids}}, {"_id": 0}
            ).to_list(length=None)
        }

        for account in accounts:
            employee_id = account.get("employeeId")

            if account.get("isIntern"):
                interns.append({
                    "employee_id":     employee_id,
                    "name":            account.get("fullName"),
                    "email":           account.get("email"),
                    "job_title":       account.get("jobTitle"),
                    "employee_type":   account.get("employeeType"),
                    "office_location": account.get("officeLocation"),
                })
                continue

            # Bench members are real employees, so surface the skill data HR
            # actually allocates on. Absent for anyone who has not built a
            # profile yet — shown as blank rather than hidden, so HR can see
            # who still needs chasing.
            skill = skills_by_id.get(employee_id, {})
            bench.append({
                "employee_id":         employee_id,
                "name":                account.get("fullName") or skill.get("name"),
                "email":               account.get("email"),
                "job_title":           account.get("jobTitle"),
                "current_designation": skill.get("current_designation"),
                "current_skill":       skill.get("current_skill"),
                "total_exp":           skill.get("total_exp"),
                "current_skill_exp":   skill.get("current_skill_exp"),
                "primary_skill":       skill.get("primary_skill"),
                "secondary_skill":     skill.get("secondary_skill"),
                "has_profile":         bool(skill),
            })

        return {"bench": bench, "interns": interns}
    except PyMongoError as e:
        logger.error(f"get_talent_pool error: {e}")
        return {"bench": [], "interns": []}


async def get_bench_employees() -> list[Dict[str, Any]]:
    """Returns all employees in employee_skill_summary where is_on_bench=True.

    Superseded by get_talent_pool(); kept only so nothing that still imports
    it breaks. Remove once the is_on_bench field is dropped entirely.
    """
    try:
        docs = await col_employee_skill_summary.find(
            {"is_on_bench": True},
            {
                "_id": 0,
                "employee_id": 1,
                "name": 1,
                "email": 1,
                "current_designation": 1,
                "current_skill": 1,
                "total_exp": 1,
                "current_skill_exp": 1,
                "primary_skill": 1,
                "secondary_skill": 1,
            },
        ).sort("employee_id", 1).to_list(length=None)
        return docs
    except PyMongoError as e:
        logger.error(f"get_bench_employees error: {e}")
        return []


async def delete_employee(employee_id: str) -> Dict[str, Any]:
    """Hard-delete every record for this employee across all collections
    and remove their generated resume file from GCS."""
    try:
        resume_doc = await col_resume_store.find_one({"employee_id": employee_id})
        if resume_doc and resume_doc.get("resume_path"):
            try:
                delete_resume(resume_doc["resume_path"])
            except Exception as e:
                logger.warning(f"delete_employee: could not remove resume blob for {employee_id}: {e}")

        await col_user_accounts.delete_one({"employeeId": employee_id})
        await col_employee_resume_data.delete_one({"employee_id": employee_id})
        await col_resume_store.delete_one({"employee_id": employee_id})
        await col_employee_skill_summary.delete_one({"employee_id": employee_id})
        await col_audit_data.delete_many({"employeeId": employee_id})

        return {"status": "success"}
    except PyMongoError as e:
        logger.error(f"delete_employee error for {employee_id}: {e}")
        return {"status": "error", "message": str(e)}


async def write_audit_event(
    event_type: str,
    actor: str,
    employee_id: Optional[str] = None,
    payload: Optional[Dict[str, Any]] = None,
) -> None:
    """Appends one entry to the audit trail. Never raises — auditing must
    not be able to break the action it's recording, so failures are only
    logged, not propagated."""
    try:
        await col_audit_data.insert_one(
            {
                "event_type": event_type,
                "actor": actor,
                "employee_id": employee_id,
                "timestamp": datetime.now(timezone.utc),
                "payload": payload or {},
            }
        )
    except PyMongoError as e:
        logger.error(f"write_audit_event error ({event_type}, actor={actor}): {e}")


async def get_hr_metrics() -> Dict[str, Any]:
    """Live metrics for the HR Monitoring dashboard."""
    try:
        from datetime import timedelta
        now = datetime.now(timezone.utc)
        last_7  = now - timedelta(days=7)
        last_30 = now - timedelta(days=30)

        # Every count here is scoped to current staff. Including leavers made
        # headcount and resume-coverage both wrong: the denominator counted
        # people who had left, so coverage read lower than it really was.
        active = await active_employee_filter()

        # Both counts must come from the *same* population or coverage is
        # nonsense. Scoping them separately produced 248 resumes against 246
        # employees — 100.8% coverage and -2 pending — because some people
        # have parsed resume data but no skill-summary row.
        active_summary_ids = [
            doc["employee_id"]
            async for doc in col_employee_skill_summary.find(
                active, {"_id": 0, "employee_id": 1}
            )
            if doc.get("employee_id")
        ]
        total_employees = len(active_summary_ids)

        # These seven queries are independent of each other, so they run
        # concurrently. Run sequentially they cost seven ~330ms Firestore
        # round trips in a row — over 2s of pure waiting on a dashboard that
        # returns a handful of numbers.
        skill_pipeline = [
            {"$match": {**active, "current_skill": {"$exists": True, "$ne": ""}}},
            {"$group": {"_id": "$current_skill", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 12},
        ]
        (
            total_with_resume,
            bench_count,
            skill_dist_raw,
            uploads_7d,
            updates_7d,
            invites_7d,
            uploads_30d,
            feed_docs,
        ) = await asyncio.gather(
            col_employee_resume_data.count_documents(
                {"employee_id": {"$in": active_summary_ids}}
            ),
            # Bench comes from the directory (department = Talent Pool), not
            # the retired is_on_bench flag.
            col_user_accounts.count_documents({"inTalentPool": True, "canSignIn": True}),
            col_employee_skill_summary.aggregate(skill_pipeline).to_list(length=None),
            col_audit_data.count_documents({"event_type": "RESUME_UPLOAD",   "timestamp": {"$gte": last_7}}),
            col_audit_data.count_documents({"event_type": "PROFILE_UPDATED", "timestamp": {"$gte": last_7}}),
            col_audit_data.count_documents({"event_type": "INVITE_SENT",     "timestamp": {"$gte": last_7}}),
            col_audit_data.count_documents({"event_type": "RESUME_UPLOAD",   "timestamp": {"$gte": last_30}}),
            col_audit_data.find(
                {"event_type": {"$in": ["RESUME_UPLOAD", "PROFILE_UPDATED", "INVITE_SENT", "SKILL_PROFILE_UPDATED"]}},
            ).sort("timestamp", -1).limit(8).to_list(length=8),
        )

        pending_resumes = total_employees - total_with_resume
        coverage_pct    = round((total_with_resume / total_employees * 100) if total_employees else 0, 1)
        skill_distribution = [{"skill": d["_id"], "count": d["count"]} for d in skill_dist_raw]
        recent_feed = [
            {
                "event_type":  doc.get("event_type"),
                "actor":       doc.get("actor"),
                "employee_id": doc.get("employee_id"),
                "timestamp":   doc["timestamp"].isoformat() if doc.get("timestamp") else None,
            }
            for doc in feed_docs
        ]

        return {
            "overview": {
                "total_employees":   total_employees,
                "total_with_resume": total_with_resume,
                "pending_resumes":   pending_resumes,
                "coverage_pct":      coverage_pct,
                "bench_count":       bench_count,
            },
            "activity": {
                "uploads_last_7d":  uploads_7d,
                "updates_last_7d":  updates_7d,
                "invites_last_7d":  invites_7d,
                "uploads_last_30d": uploads_30d,
            },
            "skill_distribution": skill_distribution,
            "recent_feed": recent_feed,
        }
    except PyMongoError as e:
        logger.error(f"get_hr_metrics error: {e}")
        return {}


async def get_audit_log(
    event_type: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    page: int = 1,
    page_size: int = 50,
) -> Dict[str, Any]:
    """Paginated, filterable audit trail for the HR Audit Log section."""
    try:
        query: Dict[str, Any] = {}
        if event_type:
            query["event_type"] = event_type
        if date_from or date_to:
            ts_filter: Dict[str, Any] = {}
            if date_from:
                ts_filter["$gte"] = date_from
            if date_to:
                ts_filter["$lte"] = date_to
            query["timestamp"] = ts_filter

        total = await col_audit_data.count_documents(query)
        cursor = (
            col_audit_data.find(query)
            .sort("timestamp", -1)
            .skip(max(page - 1, 0) * page_size)
            .limit(page_size)
        )
        events = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            events.append(doc)

        return {"total": total, "page": page, "page_size": page_size, "events": events}
    except PyMongoError as e:
        logger.error(f"get_audit_log error: {e}")
        return {"total": 0, "page": page, "page_size": page_size, "events": []}
