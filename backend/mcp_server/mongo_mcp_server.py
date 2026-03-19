import os
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from fastmcp import FastMCP
from pymongo import MongoClient
from pymongo.errors import PyMongoError
from dotenv import load_dotenv

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


@mcp.tool
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


@mcp.tool
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
