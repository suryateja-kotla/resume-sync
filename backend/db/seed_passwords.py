"""
One-time script: sets a default password for every account in user_accounts.

Default password format: Sails@<EmployeeID>
  e.g. SS045 → Sails@SS045
       HR001 → Sails@HR001

All accounts get must_change_password=True so employees are forced to change
their password the first time they log in.

Run once:
    cd backend
    python db/seed_passwords.py
"""
import asyncio
import os
import sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from dotenv import load_dotenv
load_dotenv()

from motor.motor_asyncio import AsyncIOMotorClient
from services.auth_service import hash_password


async def seed():
    db = AsyncIOMotorClient(os.getenv("MONGO_URI"))["resume_sync_db"]

    accounts = await db.user_accounts.find({}, {"_id": 0, "employeeId": 1, "email": 1}).to_list(length=None)
    print(f"Found {len(accounts)} accounts in user_accounts.")

    updated = skipped = already_set = 0

    for acct in accounts:
        eid = acct["employeeId"]

        # Check if password already set
        existing = await db.user_accounts.find_one(
            {"employeeId": eid},
            {"_id": 0, "password_hash": 1}
        )
        if existing and existing.get("password_hash"):
            already_set += 1
            continue

        default_password = f"Sails@{eid}"
        try:
            hashed = hash_password(default_password)
            await db.user_accounts.update_one(
                {"employeeId": eid},
                {"$set": {
                    "password_hash":        hashed,
                    "must_change_password": True,
                    "refresh_token_hash":   None,
                    "reset_token_hash":     None,
                    "reset_token_expires":  None,
                }},
            )
            updated += 1
            print(f"  Set password for {eid} ({acct.get('email', '')})")
        except Exception as e:
            print(f"  ERROR for {eid}: {e}")
            skipped += 1

    print(f"\nDone. Updated: {updated} | Already had password: {already_set} | Errors: {skipped}")
    print(f"Default password format: Sails@<EmployeeID>  (e.g. Sails@SS045)")
    print(f"All employees will be prompted to change password on first login.")


asyncio.run(seed())
