import os
from datetime import datetime, timezone
from fastmcp import FastMCP
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import PyMongoError
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGO_DB_NAME", "resume_sync_db")

client = AsyncIOMotorClient(MONGO_URI)
db = client[DB_NAME]

col_resume_store = db["resume_store"]
mcp = FastMCP("resume-sync")


@mcp.tool
async def save_resume_path(employee_id: str, resume_path: str):
    """Store the GCS blob name of a generated resume (not a local path or URL)."""
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


if __name__ == "__main__":
    mcp.run()
