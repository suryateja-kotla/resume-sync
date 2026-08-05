import logging
import os
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import OperationFailure
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
# NOTE: this comparison was inverted — it read `== "false"`, so setting
# MANAGE_INDEXES=false (as this deployment does, deliberately) evaluated to
# True and index management ran anyway, which is exactly the behaviour the
# setting exists to prevent. Now: anything other than "false" enables it.
MANAGE_INDEXES = os.getenv("MANAGE_INDEXES", "true").lower() != "false"


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
        # Firestore's Mongo-compat layer supports neither collMod on
        # expireAfterSeconds ("Unimplemented") nor an in-place TTL rename
        # ("Cannot modify TTL name") — its own error message says the only
        # path is delete-then-recreate, and index deletion there is async, so
        # the create can race a still-in-progress delete ("being deleted,
        # please try again later") and needs a restart to catch up. Only
        # kick off drop+recreate when the TTL actually differs from
        # AUDIT_TTL_DAYS, so a matching value never touches the index.
        #
        # Firestore also names this index e.g. "audit_data_timestamp_ttl"
        # rather than Mongo's usual auto-generated "timestamp_1", so the
        # existing index must be found by its key (timestamp), not by name.
        existing_indexes = await db.audit_data.index_information()
        timestamp_index = next(
            (
                (name, spec)
                for name, spec in existing_indexes.items()
                if spec.get("key") == [("timestamp", 1)]
            ),
            None,
        )
        current_ttl = timestamp_index[1].get("expireAfterSeconds") if timestamp_index else None
        if current_ttl != _AUDIT_TTL_SECONDS:
            if timestamp_index:
                await _ensure_index(
                    db.command("dropIndexes", "audit_data", index=timestamp_index[0]),
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

    # ── SSO session storage ───────────────────────────────────────────────
    # Sessions are server-side so they can be revoked; the browser cookie only
    # carries an opaque id. The TTL index reaps expired rows, but expiry is
    # also re-checked in Python on every lookup (session_service.get_session)
    # — Mongo's reaper runs about once a minute, and an expired-but-still-
    # present row must never be honoured. That double check also means the app
    # stays correct where MANAGE_INDEXES=false prevents the TTL index existing.
    if "sessions" not in existing_collections:
        await db.create_collection("sessions")
    await _ensure_index(
        db.sessions.create_index("session_hash", unique=True),
        "sessions.session_hash unique",
    )
    await _ensure_index(
        db.sessions.create_index("expires_at", expireAfterSeconds=0),
        "sessions.expires_at TTL",
    )
    await _ensure_index(
        db.sessions.create_index("employee_id"),
        "sessions.employee_id",  # bulk revoke on offboarding
    )

    # Short-lived state/nonce/PKCE-verifier records for in-flight sign-ins.
    if "login_transactions" not in existing_collections:
        await db.create_collection("login_transactions")
    await _ensure_index(
        db.login_transactions.create_index("state_hash", unique=True),
        "login_transactions.state_hash unique",
    )
    await _ensure_index(
        db.login_transactions.create_index("expires_at", expireAfterSeconds=0),
        "login_transactions.expires_at TTL",
    )

    logger.info("Database and collections are set up successfully.")

    # Unique indexes. Several of these were created by hand through the
    # Firestore console (e.g. "user_accounts_email_uniques",
    # "employee_skill_summary_employee_id_unique") rather than by this
    # script, so they don't use Mongo's auto-generated "<field>_1" name this
    # code used to assume — meaning the old drop-by-guessed-name step never
    # found anything to drop, and create_index then tried to add a *second*
    # unique index on a field that already had one under the console's name,
    # which Firestore correctly refused every single restart. Look up each
    # index by its actual key pattern instead of a guessed name, and only
    # create one when no unique index on that field exists yet.
    for col_name, field in [
        ("user_accounts", "employeeId"),
        ("user_accounts", "email"),
        ("employee_skill_summary", "employee_id"),
        ("employee_resume_data", "employee_id"),
        ("resume_store", "employee_id"),
    ]:
        col = db[col_name]
        existing_indexes = await col.index_information()
        has_unique_index = any(
            spec.get("key") == [(field, 1)] and spec.get("unique")
            for spec in existing_indexes.values()
        )
        if not has_unique_index:
            await _ensure_index(
                col.create_index(field, unique=True, background=True),
                f"{col_name}.{field} unique",
            )
    logger.info("Unique indexes ensured on all collections (where permitted).")

    # The old HR001 / hr@sailssoftware.com seed record is gone. It was a
    # placeholder with no counterpart in Entra — the real HR identities are
    # ordinary directory accounts (Kavita Dasgupta is SS040, department HR).
    # Under SSO nobody can sign in as HR001, since sign-in requires a verified
    # Entra identity whose employeeId matches, so leaving the row would only
    # be a confusing orphan carrying an HR role.
    #
    # Admin access is no longer a database row at all: it comes from the
    # ADMIN_EMAILS allowlist in deployment config, so it cannot be granted by
    # anyone who merely has write access to Mongo.
    removed = await db.user_accounts.delete_one({"employeeId": "HR001"})
    if removed.deleted_count:
        logger.info("Removed obsolete HR001 placeholder account.")
