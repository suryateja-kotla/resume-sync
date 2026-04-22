import os
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from fastmcp import FastMCP
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import PyMongoError
from dotenv import load_dotenv
import json

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGO_DB_NAME", "resume_sync_db")

client = AsyncIOMotorClient(MONGO_URI)
db = client[DB_NAME]

col_employee_data = db["employee_data"]
col_employee_resume_data = db["employee_resume_data"]
col_resume_store = db["resume_store"]
col_audit_data = db["audit_data"]

mcp = FastMCP("resume-sync")


@mcp.tool
async def save_resume_path(employee_id: str, resume_path: str):
    """Store generated resume path."""
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
                "resume_path": resume_path,
                "upserted": result.upserted_id is not None,
            },
        }

    except PyMongoError as e:
        return {"status": "error", "message": str(e)}


@mcp.tool
async def log_audit_event(
    employee_id: str, action: str, details: Optional[Dict] = None
):
    """Insert audit log entry."""
    try:
        doc = {
            "employeeId": employee_id,
            "timestamp": datetime.now(timezone.utc),
            "action": action,
            "details": details or {},
        }

        result = await col_audit_data.insert_one(doc)

        return {"status": "success", "data": {"inserted_id": str(result.inserted_id)}}

    except PyMongoError as e:
        return {"status": "error", "message": str(e)}


async def search_employees(
    skills: List[str], min_experience: int, max_experience: Optional[int] = None
) -> Dict[str, Any]:
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

        cursor = col_employee_resume_data.find(query, {"_id": 0, "employee_id": 1})

        employees = await cursor.to_list(length=None)
        employee_ids = [emp["employee_id"] for emp in employees]

        return {"status": "success", "employee_ids": employee_ids}

    except Exception as e:
        return {"status": "error", "message": str(e)}


async def get_resume_paths(employee_ids: List[str]) -> List[Dict[str, Any]]:
    cursor = col_resume_store.find(
        {"employee_id": {"$in": employee_ids}},
        {"_id": 0, "employee_id": 1, "resume_path": 1},
    )
    return await cursor.to_list(length=None)


@mcp.tool
async def search_employees_and_get_resume_paths(
    skills: List[str], min_experience: int, max_experience: Optional[int] = None
) -> str:
    """
    Search employees and return enriched results.
    """

    search_result = await search_employees(skills, min_experience, max_experience)

    if search_result.get("status") != "success":
        return json.dumps({"status": "error", "message": "Employee search failed"})

    employee_ids = search_result.get("employee_ids", [])
    if not employee_ids:
        return json.dumps({"status": "success", "count": 0, "data": []})

    resume_cursor = col_resume_store.find(
        {"employee_id": {"$in": employee_ids}},
        {"_id": 0, "employee_id": 1, "resume_path": 1},
    )

    employee_cursor = col_employee_data.find(
        {"employeeId": {"$in": employee_ids}},
        {"_id": 0, "employeeId": 1, "email": 1, "fullName": 1},
    )

    resume_data_cursor = col_employee_resume_data.find(
        {"employee_id": {"$in": employee_ids}},
        {"_id": 0, "employee_id": 1, "search_tags": 1, "total_experience": 1},
    )

    resume_docs = await resume_cursor.to_list(length=None)
    employee_docs = await employee_cursor.to_list(length=None)
    resume_data_docs = await resume_data_cursor.to_list(length=None)

    resume_paths = {d["employee_id"]: d.get("resume_path", "") for d in resume_docs}
    employee_info = {d["employeeId"]: d for d in employee_docs}
    resume_data = {d["employee_id"]: d for d in resume_data_docs}

    results = []
    for emp_id in employee_ids:
        info = employee_info.get(emp_id, {})
        rdata = resume_data.get(emp_id, {})

        results.append(
            {
                "employee_id": emp_id,
                "name": info.get("fullName", ""),
                "email": info.get("email", ""),
                "resume_path": resume_paths.get(emp_id, ""),
                "skills": rdata.get("search_tags", []),
                "experience": rdata.get("total_experience", 0),
            }
        )

    return json.dumps({"status": "success", "count": len(results), "data": results})


@mcp.tool
async def get_employee_resume_by_id(employee_id: str):
    doc = await col_employee_resume_data.find_one(
        {"employee_id": employee_id}, {"_id": 0}
    )

    if not doc:
        return {"status": "error", "message": "Not found"}

    return {"status": "success", "data": doc}


@mcp.tool
async def get_resume_path_by_id(employee_id: str):
    doc = await col_resume_store.find_one({"employee_id": employee_id}, {"_id": 0})

    if not doc:
        return {"status": "error", "message": "Not found"}

    if "last_updated_at" in doc:
        doc["last_updated_at"] = doc["last_updated_at"].isoformat()

    return {"status": "success", "data": doc}


if __name__ == "__main__":
    mcp.run()
