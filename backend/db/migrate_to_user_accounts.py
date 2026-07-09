"""
One-time migration: employee_data → user_accounts

What it does:
  1. Creates user_accounts with only: employeeId, email, role, status, lastLoginAt
  2. Copies every doc from employee_data into user_accounts (stripping fullName,
     currentRole, department, isOnBench — those live in employee_skill_summary)
  3. Drops employee_data

Run once:
    cd backend
    python db/migrate_to_user_accounts.py
"""
import asyncio, os, sys
from datetime import datetime, timezone
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from dotenv import load_dotenv
load_dotenv()
from motor.motor_asyncio import AsyncIOMotorClient

async def migrate():
    db = AsyncIOMotorClient(os.getenv("MONGO_URI"))["resume_sync_db"]

    existing = await db.list_collection_names()

    if "employee_data" not in existing:
        print("employee_data not found — nothing to migrate.")
        return

    # Create user_accounts if needed
    if "user_accounts" not in existing:
        await db.create_collection(
            "user_accounts",
            validator={
                "$jsonSchema": {
                    "bsonType": "object",
                    "required": ["employeeId", "email", "role", "status"],
                    "properties": {
                        "employeeId":  {"bsonType": "string"},
                        "email":       {"bsonType": "string"},
                        "role":        {"enum": ["HR", "EMPLOYEE"]},
                        "status":      {"enum": ["Active", "Inactive", "On Leave"]},
                        "lastLoginAt": {"bsonType": ["date", "null"]},
                    },
                }
            },
        )
        await db.user_accounts.create_index("employeeId", unique=True)
        await db.user_accounts.create_index("email",      unique=True)
        print("Created user_accounts collection.")

    # Copy docs
    docs = await db.employee_data.find({}, {"_id": 0}).to_list(length=None)
    print(f"Migrating {len(docs)} docs from employee_data → user_accounts ...")

    migrated = skipped = 0
    for doc in docs:
        account = {
            "employeeId":  doc["employeeId"],
            "email":       doc.get("email", ""),
            "role":        doc.get("role", "EMPLOYEE"),
            "status":      doc.get("status", "Active"),
            "lastLoginAt": doc.get("lastProfileUpdate") or datetime.now(timezone.utc),
        }
        try:
            await db.user_accounts.update_one(
                {"employeeId": account["employeeId"]},
                {"$setOnInsert": account},
                upsert=True,
            )
            migrated += 1
        except Exception as e:
            print(f"  Skipped {doc.get('employeeId')}: {e}")
            skipped += 1

    print(f"Migrated: {migrated}  Skipped: {skipped}")

    # Verify counts match before dropping
    old_count = await db.employee_data.count_documents({})
    new_count = await db.user_accounts.count_documents({})
    print(f"employee_data: {old_count} docs  |  user_accounts: {new_count} docs")

    if new_count >= old_count:
        await db.employee_data.drop()
        print("Dropped employee_data. Migration complete.")
    else:
        print("WARNING: counts don't match — employee_data NOT dropped. Check manually.")

asyncio.run(migrate())
