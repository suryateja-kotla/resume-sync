import os
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from fastmcp import FastMCP
from pymongo import MongoClient
from pymongo.errors import PyMongoError
from dotenv import load_dotenv
from bson import json_util
import json

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGO_DB_NAME", "employee_registry")

client = MongoClient(MONGO_URI)
db = client[DB_NAME]

col_employee_data = db["employee_data"]
col_employee_resume_data = db["employee_resume_data"]
col_resume_store = db["resume_store"]
col_audit_data = db["audit_data"]

mcp = FastMCP("mongo-resume-mcp")


# @mcp.tool
def save_employee_resume_data(employee_id: str, resume_data: Dict[str, Any]):
    """Upsert structured resume data for an employee."""

    try:
        skills: dict = resume_data.get("technical_skills", {})
        search_tags = list({tag for values in skills.values() for tag in values})

        doc = {
            **resume_data,
            "employee_id": employee_id,
            "search_tags": search_tags,
        }

        result = col_employee_resume_data.update_one(
            {"employee_id": employee_id}, {"$set": doc}, upsert=True
        )

        return {
            "status": "success",
            "data": {
                "upserted_id": str(result.upserted_id) if result.upserted_id else None,
                "modified_count": result.modified_count,
            },
        }

    except PyMongoError as e:
        return {"status": "error", "message": str(e)}


# @mcp.tool
def save_resume_store(employee_id: str, resume_path: str):
    """Store generated resume path."""

    try:
        result = col_resume_store.update_one(
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
                "resume_path": resume_path,
                "upserted": result.upserted_id is not None,
            },
        }

    except PyMongoError as e:
        return {"status": "error", "message": str(e)}


@mcp.tool
def upsert_employee_data(
    employee_id: str,
    full_name: str,
    email: Optional[str] = None,
    current_role: Optional[str] = None,
    department: Optional[str] = None,
    status: str = "Active",
):
    """Create or update employee profile."""

    try:
        update_fields = {
            "employeeId": employee_id,
            "fullName": full_name,
            "status": status,
            "lastProfileUpdate": datetime.now(timezone.utc),
        }

        if email:
            update_fields["email"] = email
        if current_role:
            update_fields["currentRole"] = current_role
        if department:
            update_fields["department"] = department

        result = col_employee_data.update_one(
            {"employeeId": employee_id}, {"$set": update_fields}, upsert=True
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


@mcp.tool
def log_audit_event(employee_id: str, action: str, details: Optional[Dict] = None):
    """Insert audit log entry."""

    try:
        doc = {
            "employeeId": employee_id,
            "timestamp": datetime.now(timezone.utc),
            "action": action,
            "details": details or {},
        }

        result = col_audit_data.insert_one(doc)

        return {"status": "success", "data": {"inserted_id": str(result.inserted_id)}}

    except PyMongoError as e:
        return {"status": "error", "message": str(e)}


@mcp.tool
def save_employee_resume_profile(
    employee_id: str,
    resume_data: Dict[str, Any],
    resume_path: str,
    full_name: str,
    email: Optional[str] = None,
    current_role: Optional[str] = None,
    department: Optional[str] = None,
    status: str = "Active",
):
    """Save employee resume data and path, update profile"""
    employee_resume_data_result = save_employee_resume_data(employee_id, resume_data)
    if employee_resume_data_result.get("status") != "success":
        return employee_resume_data_result
    resume_store_result = save_resume_store(employee_id, resume_path)
    if resume_store_result.get("status") != "success":
        return resume_store_result
    upsert_employee_result = upsert_employee_data(
        employee_id, full_name, email, current_role, department, status
    )
    if upsert_employee_result.get("status") != "success":
        return upsert_employee_result
    return {"status": "success", "message": "Employee resume data saved successfully"}


def search_employees(
    skills: list[str], min_experience: int, max_experience: int | None = None
) -> dict:
    try:
        skill_queries = [
            {"search_tags": {"$regex": s, "$options": "i"}} for s in skills
        ]

        experience_filter = {"$gte": min_experience}
        if max_experience is not None:
            experience_filter["$lte"] = max_experience

        query = {
            "$and": [
                {"total_experience": experience_filter},
                {"$or": skill_queries},
            ]
        }

        employees = list(
            col_employee_resume_data.find(query, {"_id": 0, "employee_id": 1})
        )

        employee_ids = [emp["employee_id"] for emp in employees]

        return {"status": "success", "employee_ids": employee_ids}

    except Exception as e:
        return {"status": "error", "message": str(e)}


def get_resume_paths(employee_ids: list[str]) -> str:
    try:
        cursor = col_resume_store.find(
            {"employee_id": {"$in": employee_ids}},
            {"_id": 0, "employee_id": 1, "resume_path": 1},
        )

        results = list(cursor)

        return json.dumps(results, default=json_util.default)

    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})


@mcp.tool
def search_employees_and_get_resume_paths(
    skills: list[str], min_experience: int, max_experience: int | None = None
) -> str:
    """
    Search employees based on skills and experience range.
    - min_experience is required
    - max_experience is optional
    Returns resume paths for matching employees.
    """
    search_result_json = search_employees(skills, min_experience, max_experience)

    if search_result_json.get("status") != "success":
        return json.dumps({"status": "error", "message": "Employee search failed"})

    employee_ids = search_result_json.get("employee_ids", [])
    if not employee_ids:
        return json.dumps({"status": "success", "count": 0, "data": []})

    return get_resume_paths(employee_ids)


@mcp.tool
def get_employee_resume_by_id(employee_id: str):
    """Fetch resume document."""

    doc = col_employee_resume_data.find_one({"employee_id": employee_id}, {"_id": 0})

    if not doc:
        return {"status": "error", "message": "Not found"}

    return {"status": "success", "data": doc}


@mcp.tool
def get_resume_path_by_id(employee_id: str):
    """Fetch resume path."""

    doc = col_resume_store.find_one({"employee_id": employee_id}, {"_id": 0})

    if not doc:
        return {"status": "error", "message": "Not found"}

    if "last_updated_at" in doc:
        doc["last_updated_at"] = doc["last_updated_at"].isoformat()

    return {"status": "success", "data": doc}


@mcp.tool
def check_employee_exists(employee_id: str):
    """Check if employee exists."""

    count = col_employee_data.count_documents({"employeeId": employee_id})

    return {"status": "success", "data": {"exists": count > 0}}


if __name__ == "__main__":
    mcp.run()
