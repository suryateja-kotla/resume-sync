from datetime import datetime, timezone
import os
from typing import Any, Dict, Optional
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import PyMongoError
from schemas.schemas import EmployeePayload
from constants.skill_categories import SKILL_CATEGORIES, normalize_skill
import logging

logger = logging.getLogger(__name__)

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGO_DB_NAME", "resume_sync_db")

client = AsyncIOMotorClient(MONGO_URI)
db = client[DB_NAME]

col_employee_data = db["employee_data"]
col_employee_resume_data = db["employee_resume_data"]
col_resume_store = db["resume_store"]
col_audit_data = db["audit_data"]
col_employee_skill_summary = db["employee_skill_summary"]


async def get_employee_by_email(email: str) -> Optional[Dict[str, Any]]:
    try:
        return await col_employee_data.find_one({"email": email}, {"_id": 0})
    except PyMongoError as e:
        logger.error(f"get_employee_by_email error: {e}")
        return None


async def provision_new_employee(email: str) -> Optional[Dict[str, Any]]:
    """Auto-creates a minimal employee_data record the first time someone
    logs in with an email that isn't in the system yet — e.g. a new hire who
    received an HR onboarding invite. They land with role=EMPLOYEE and no
    resume data, so the dashboard shows them straight to Upload Resume."""
    try:
        local_part = email.split("@")[0]
        guessed_name = local_part.replace(".", " ").replace("_", " ").title() or email

        last = await col_employee_data.find(
            {"employeeId": {"$regex": "^EMP\\d+$"}},
            {"_id": 0, "employeeId": 1},
        ).sort("employeeId", -1).to_list(length=1)
        next_num = 1
        if last:
            try:
                next_num = int(last[0]["employeeId"].replace("EMP", "")) + 1
            except ValueError:
                next_num = 1
        employee_id = f"EMP{next_num:03d}"

        doc = {
            "employeeId": employee_id,
            "fullName": guessed_name,
            "email": email,
            "currentRole": "New Employee",
            "department": "Unassigned",
            "status": "Active",
            "role": "EMPLOYEE",
            "isOnBench": False,
            "lastProfileUpdate": datetime.now(timezone.utc),
        }
        await col_employee_data.insert_one(doc)
        doc.pop("_id", None)
        return doc
    except PyMongoError as e:
        logger.error(f"provision_new_employee error for {email}: {e}")
        return None


async def get_all_employees() -> list[Dict[str, Any]]:
    try:
        cursor = col_employee_data.find(
            {"email": {"$exists": True, "$ne": None}},
            {"_id": 0, "email": 1, "fullName": 1},
        )
        return [employee async for employee in cursor]
    except PyMongoError as e:
        logger.error(f"get_all_employees error: {e}")
        return []


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
    current_role: Optional[str] = None,
    department: Optional[str] = None,
    status: str = "Active",
) -> Dict[str, Any]:
    try:
        update_fields = {
            "employeeId": employee_id,
            "status": status,
            "lastProfileUpdate": datetime.now(timezone.utc),
        }
        if current_role:
            update_fields["currentRole"] = current_role
        if department:
            update_fields["department"] = department
        logger.debug(f"upsert_employee_data update_fields: {update_fields}")

        result = await col_employee_data.update_one(
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
) -> Dict[str, Any]:
    """employee_id and name are always set from the authenticated employee
    record, never from client input, so they cannot be edited via the API.
    Missing editable fields fall back to existing stored values (or safe
    defaults on first insert) so the collection's required-fields schema
    validator is always satisfied."""
    try:
        existing = await col_employee_skill_summary.find_one(
            {"employee_id": employee_id}
        ) or {}

        update_fields: Dict[str, Any] = {
            "employee_id": employee_id,
            "name": name,
            "email": email if email is not None else existing.get("email"),
            "current_designation": (
                current_designation
                if current_designation is not None
                else existing.get("current_designation", "")
            ),
            "current_skill": (
                normalize_skill(current_skill)
                if current_skill is not None
                else existing.get("current_skill", "")
            ),
            "total_exp": (
                total_exp if total_exp is not None else existing.get("total_exp", 0)
            ),
            "current_skill_exp": (
                current_skill_exp
                if current_skill_exp is not None
                else existing.get("current_skill_exp", 0)
            ),
            "updated_at": datetime.now(timezone.utc),
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
    """Employees who exist in employee_data but have not uploaded/been seeded
    with resume data yet — i.e. still need an onboarding invite email."""
    try:
        resumed_ids = await col_employee_resume_data.distinct("employee_id")
        cursor = col_employee_data.find(
            {
                "employeeId": {"$nin": resumed_ids},
                "email": {"$exists": True, "$ne": None},
                "role": {"$ne": "HR"},
            },
            {"_id": 0, "employeeId": 1, "fullName": 1, "email": 1, "department": 1},
        )
        return [employee async for employee in cursor]
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
        cursor = col_employee_skill_summary.find({}, {"_id": 0, "current_skill": 1})
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
            {},
            {
                "_id": 0,
                "employee_id": 1,
                "name": 1,
                "email": 1,
                "current_designation": 1,
                "current_skill": 1,
                "total_exp": 1,
                "current_skill_exp": 1,
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
    joins employee_data (identity/status) with employee_skill_summary
    (current designation/skill/experience) and flags resume status."""
    try:
        employees = await col_employee_data.find(
            {"role": {"$ne": "HR"}},
            {
                "_id": 0,
                "employeeId": 1,
                "fullName": 1,
                "email": 1,
                "department": 1,
                "currentRole": 1,
                "status": 1,
                "isOnBench": 1,
            },
        ).to_list(length=None)

        skill_docs = await col_employee_skill_summary.find({}, {"_id": 0}).to_list(
            length=None
        )
        skill_by_id = {d["employee_id"]: d for d in skill_docs}

        resumed_ids = set(await col_employee_resume_data.distinct("employee_id"))
        resume_paths = await _get_resume_paths_by_employee_id(
            [emp.get("employeeId", "") for emp in employees]
        )

        results = []
        for emp in employees:
            emp_id = emp.get("employeeId", "")
            skill = skill_by_id.get(emp_id, {})
            results.append(
                {
                    "employee_id": emp_id,
                    "name": emp.get("fullName"),
                    "email": emp.get("email"),
                    "department": emp.get("department"),
                    "current_role": emp.get("currentRole"),
                    "current_designation": skill.get("current_designation", ""),
                    "current_skill": skill.get("current_skill", ""),
                    "total_exp": skill.get("total_exp", ""),
                    "current_skill_exp": skill.get("current_skill_exp", ""),
                    "bench_status": "On Bench" if emp.get("isOnBench") else "Active",
                    "resume_status": "Uploaded" if emp_id in resumed_ids else "Pending",
                    "resume_path": resume_paths.get(emp_id),
                }
            )
        return results
    except PyMongoError as e:
        logger.error(f"get_full_employee_directory error: {e}")
        return []


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
