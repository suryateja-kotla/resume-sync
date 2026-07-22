import logging
import os
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import OperationFailure
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGO_DB_NAME", "resume_sync_db")
logger = logging.getLogger(__name__)

# Some MongoDB-compatible backends (e.g. Firestore) require a separate,
# more privileged credential to manage indexes than to read/write data —
# and issuing index commands the credential can't run has been observed to
# destabilize the connection (AutoReconnect) rather than just returning a
# clean permission error. Set to "false" to skip all index management at
# startup entirely; an admin is expected to pre-create the needed indexes
# out of band in that case. Defaults to "true" (normal behavior, e.g. Atlas).
MANAGE_INDEXES = os.getenv("MANAGE_INDEXES", "true").lower() == "true"


async def _ensure_index(coro, description: str):
    """Runs an index create/drop call, tolerating IAM permission errors and
    "already in the desired state" errors — see MANAGE_INDEXES above for
    why this exists. The app should still start rather than crash on a
    missing grant or a drop-index-that-doesn't-exist-yet."""
    if not MANAGE_INDEXES:
        logger.info(f"Skipping index op ({description}): MANAGE_INDEXES=false")
        return
    try:
        await coro
    except OperationFailure as e:
        if e.code == 13:  # PermissionDenied
            logger.warning(f"Skipping index op ({description}): permission denied — {e}")
        elif e.code in (26, 27, 4):  # NamespaceNotFound / IndexNotFound / NotFound
            pass  # nothing to drop — fine
        else:
            logger.warning(f"Skipping index op ({description}): {e}")


async def seed_database():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]

    existing_collections = await db.list_collection_names()

    # Schema shape is enforced at the API boundary via Pydantic models
    # (schemas.py) rather than DB-level $jsonSchema validators — Firestore's
    # MongoDB-compatibility layer doesn't support the `validator` option on
    # createCollection/collMod at all (errors with "Unsupported fields in
    # createCollection request: [validator]"), so collections are created
    # plain here and indexes still apply for lookup/uniqueness.

    _AUDIT_TTL_DAYS = int(os.getenv("AUDIT_TTL_DAYS", "15"))
    _AUDIT_TTL_SECONDS = _AUDIT_TTL_DAYS * 24 * 3600

    if "audit_data" not in existing_collections:
        await db.create_collection("audit_data")
        await _ensure_index(
            db.audit_data.create_index("timestamp", expireAfterSeconds=_AUDIT_TTL_SECONDS),
            "audit_data.timestamp TTL",
        )
        await _ensure_index(db.audit_data.create_index("event_type"), "audit_data.event_type")
        await _ensure_index(db.audit_data.create_index("actor"), "audit_data.actor")
    else:
        # Drop existing TTL index if present, then recreate with current TTL value
        await _ensure_index(
            db.command("dropIndexes", "audit_data", index="timestamp_1"),
            "audit_data.timestamp drop",
        )
        await _ensure_index(
            db.audit_data.create_index("timestamp", expireAfterSeconds=_AUDIT_TTL_SECONDS),
            "audit_data.timestamp TTL",
        )

    if "user_accounts" not in existing_collections:
        await db.create_collection("user_accounts")
        await _ensure_index(db.user_accounts.create_index("employeeId", unique=True), "user_accounts.employeeId")
        await _ensure_index(db.user_accounts.create_index("email", unique=True), "user_accounts.email")

    if "employee_resume_data" not in existing_collections:
        await db.create_collection("employee_resume_data")
        await _ensure_index(db.employee_resume_data.create_index("employee_id"), "employee_resume_data.employee_id")
        await _ensure_index(db.employee_resume_data.create_index("search_tags"), "employee_resume_data.search_tags")

    if "resume_store" not in existing_collections:
        await db.create_collection("resume_store")

    logger.info("Database and collections are set up successfully.")

    # Unique indexes — drop existing non-unique versions first, then recreate
    for col_name, field in [
        ("user_accounts", "employeeId"),
        ("user_accounts", "email"),
        ("employee_skill_summary", "employee_id"),
        ("employee_resume_data", "employee_id"),
        ("resume_store", "employee_id"),
    ]:
        col = db[col_name]
        index_name = f"{field}_1"
        await _ensure_index(col.drop_index(index_name), f"{col_name}.{field} drop")
        await _ensure_index(col.create_index(field, unique=True, background=True), f"{col_name}.{field} unique")
    logger.info("Unique indexes ensured on all collections (where permitted).")

    # Seed HR user account only if not already present
    hr_exists = await db.user_accounts.find_one({"employeeId": "HR001"})
    if not hr_exists:
        now = datetime.now(timezone.utc)
        await db.user_accounts.insert_one(
            {
                "employeeId":  "HR001",
                "email":       "hr@sailssoftware.com",
                "status":      "Active",
                "role":        "HR",
                "lastLoginAt": now,
            }
        )
        logger.info("HR user_account seed record inserted.")
    else:
        logger.info("HR user_account already exists, skipping...")
