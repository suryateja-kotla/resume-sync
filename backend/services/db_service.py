from datetime import datetime, timezone
import os
from typing import Any, Dict, Optional
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import PyMongoError
from schemas.schemas import EmployeePayload

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGO_DB_NAME", "resume_sync_db")

client = AsyncIOMotorClient(MONGO_URI)
db = client[DB_NAME]

col_employee_data = db["employee_data"]
col_employee_resume_data = db["employee_resume_data"]
col_resume_store = db["resume_store"]
col_audit_data = db["audit_data"]


async def get_employee_by_email(email: str) -> Optional[Dict[str, Any]]:
    try:
        return await col_employee_data.find_one({"email": email}, {"_id": 0})
    except PyMongoError as e:
        print(f"[ERROR] get_employee_by_email: {e}")
        return None


async def get_employee_resume_data(employee_id: str) -> Optional[Dict[str, Any]]:
    try:
        return await col_employee_resume_data.find_one(
            {"employee_id": employee_id}, {"_id": 0}
        )
    except PyMongoError as e:
        print(f"[ERROR] get_employee_resume_data: {e}")
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
    full_name: str,
    current_role: Optional[str] = None,
    department: Optional[str] = None,
    status: str = "Active",
) -> Dict[str, Any]:
    try:
        update_fields = {
            "employeeId": employee_id,
            "fullName": full_name,
            "status": status,
            "lastProfileUpdate": datetime.now(timezone.utc),
        }
        if current_role:
            update_fields["currentRole"] = current_role
        if department:
            update_fields["department"] = department

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
        return {"status": "error", "message": str(e)}


async def save_employee_resume_data(
    employee_id: str,
    resume_data: Dict[str, Any],
    full_name: Optional[str] = None,
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
        await upsert_employee_data(employee_id, full_name, current_role)
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
        print(f"[ERROR] get_resume_path: {e}")
        return None


async def upsert_resume_path(employee_id: str, resume_path: str) -> Dict[str, Any]:
    try:
        result = await col_resume_store.update_one(
            {"employee_id": employee_id},
            {"$set": {"employee_id": employee_id, "resume_path": resume_path}},
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
        return {"status": "error", "message": str(e)}
