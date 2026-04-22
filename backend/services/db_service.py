import os
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGO_DB_NAME", "resume_sync_db")

_client = AsyncIOMotorClient(MONGO_URI)
db = _client[DB_NAME]


async def get_employee_by_email(email: str) -> Optional[dict]:
    return await db.employee_data.find_one({"email": email}, {"_id": 0})


async def get_employee_resume(employee_id: str) -> Optional[dict]:
    return await db.employee_resume_data.find_one(
        {"employee_id": employee_id}, {"_id": 0}
    )


async def update_employee_resume(employee_id: str, data: dict):
    skills = data.get("technical_skills", {})
    search_tags = list({tag for vals in skills.values() for tag in vals})
    doc = {**data, "employee_id": employee_id, "search_tags": search_tags}
    await db.employee_resume_data.update_one(
        {"employee_id": employee_id}, {"$set": doc}, upsert=True
    )


async def search_candidates_by_query(query: str) -> list:
    keywords = [w.strip() for w in query.split() if len(w.strip()) > 2]
    mongo_query = (
        {"$or": [{"search_tags": {"$regex": kw, "$options": "i"}} for kw in keywords]}
        if keywords
        else {}
    )

    results = []
    async for doc in db.employee_resume_data.find(mongo_query, {"_id": 0}):
        emp_id = doc.get("employee_id")
        emp = await db.employee_data.find_one(
            {"employeeId": emp_id}, {"_id": 0, "email": 1}
        )
        email = emp.get("email", "") if emp else ""
        skills = [
            tag for vals in doc.get("technical_skills", {}).values() for tag in vals
        ]
        results.append(
            {
                "name": doc.get("personal_info", {}).get("full_name", ""),
                "skills": skills,
                "experience": doc.get("total_experience", 0),
                "email": email,
            }
        )
    return results
