import logging
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = "mongodb://localhost:27017"
DB_NAME = os.getenv("MONGO_DB_NAME", "resume_sync_db")
logger = logging.getLogger(__name__)


async def seed_database():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]

    existing_collections = await db.list_collection_names()

    audit_data_validator = {
        "$jsonSchema": {
            "bsonType": "object",
            "required": ["event_type", "actor", "timestamp"],
            "properties": {
                "_id": {"bsonType": "objectId"},
                "event_type": {
                    "enum": [
                        "LOGIN",
                        "RESUME_UPLOAD",
                        "PROFILE_UPDATED",
                        "SKILL_PROFILE_UPDATED",
                        "RESUME_REGENERATED",
                        "MONTHLY_UPDATE_SUBMITTED",
                        "NEW_EMPLOYEE_PROVISIONED",
                        "INVITE_SENT",
                        "EXCEL_REPORT_GENERATED",
                        "EMPLOYEE_DELETED",
                    ]
                },
                "actor": {
                    "bsonType": "string",
                    "description": "employee_id of who performed the action, or 'SYSTEM'",
                },
                "employee_id": {
                    "bsonType": ["string", "null"],
                    "description": "employee_id the event is about (may differ from actor, e.g. HR sending an invite)",
                },
                "timestamp": {"bsonType": "date"},
                "payload": {
                    "bsonType": ["object", "null"],
                    "description": "Event-specific context, e.g. before/after diff for edits",
                },
            },
        }
    }

    _AUDIT_TTL_DAYS = int(os.getenv("AUDIT_TTL_DAYS", "15"))
    _AUDIT_TTL_SECONDS = _AUDIT_TTL_DAYS * 24 * 3600

    if "audit_data" not in existing_collections:
        await db.create_collection("audit_data", validator=audit_data_validator)
        await db.audit_data.create_index(
            "timestamp", expireAfterSeconds=_AUDIT_TTL_SECONDS
        )
        await db.audit_data.create_index("event_type")
        await db.audit_data.create_index("actor")
    else:
        await db.command("collMod", "audit_data", validator=audit_data_validator)
        # Drop existing TTL index if present, then recreate with current TTL value
        try:
            await db.command("dropIndexes", "audit_data", index="timestamp_1")
        except Exception:
            pass  # index didn't exist yet — that's fine
        await db.audit_data.create_index(
            "timestamp", expireAfterSeconds=_AUDIT_TTL_SECONDS
        )

    if "employee_data" not in existing_collections:
        await db.create_collection(
            "employee_data",
            validator={
                "$jsonSchema": {
                    "bsonType": "object",
                    "required": ["employeeId", "fullName", "email", "status", "role"],
                    "properties": {
                        "_id": {"bsonType": "objectId"},
                        "employeeId": {"bsonType": "string"},
                        "fullName": {"bsonType": "string"},
                        "email": {
                            "bsonType": "string",
                            "pattern": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
                        },
                        "currentRole": {"bsonType": "string"},
                        "department": {"bsonType": "string"},
                        "status": {"enum": ["Active", "Inactive", "On Leave"]},
                        "role": {"enum": ["HR", "EMPLOYEE"]},
                        "isOnBench": {"bsonType": "bool"},
                        "lastProfileUpdate": {"bsonType": "date"},
                    },
                }
            },
        )

        await db.employee_data.create_index("employeeId", unique=True)

    if "employee_resume_data" not in existing_collections:
        await db.create_collection(
            "employee_resume_data",
            validator={
                "$jsonSchema": {
                    "bsonType": "object",
                    "required": [
                        "personal_info",
                        "profile_summary",
                        "technical_skills",
                        "work_experience",
                        "education",
                    ],
                    "properties": {
                        "employee_id": {"bsonType": "string"},
                        "total_experience": {
                            "bsonType": ["double", "int", "decimal"],
                            "description": "Total years of experience",
                        },
                        "search_tags": {
                            "bsonType": "array",
                            "items": {"bsonType": "string"},
                        },
                        "personal_info": {
                            "bsonType": "object",
                            "required": ["full_name"],
                            "properties": {"full_name": {"bsonType": "string"}},
                        },
                        "profile_summary": {"bsonType": "string"},
                        "technical_skills": {
                            "bsonType": "object",
                            "additionalProperties": {
                                "bsonType": "array",
                                "items": {"bsonType": "string"},
                            },
                        },
                        "work_experience": {
                            "bsonType": "array",
                            "items": {
                                "bsonType": "object",
                                "required": [
                                    "company",
                                    "designation",
                                    "duration",
                                    "project",
                                ],
                                "properties": {
                                    "company": {
                                        "bsonType": "object",
                                        "required": ["name"],
                                        "properties": {
                                            "name": {"bsonType": "string"},
                                            "description": {
                                                "bsonType": ["string", "null"]
                                            },
                                        },
                                    },
                                    "designation": {"bsonType": "string"},
                                    "duration": {"bsonType": "string"},
                                    "project": {
                                        "bsonType": "object",
                                        "required": [
                                            "name",
                                            "client",
                                            "project_description",
                                        ],
                                        "properties": {
                                            "name": {"bsonType": "string"},
                                            "client": {"bsonType": "string"},
                                            "role": {"bsonType": ["string", "null"]},
                                            "environment": {
                                                "bsonType": "array",
                                                "items": {"bsonType": "string"},
                                            },
                                            "project_description": {
                                                "bsonType": ["string", "null"]
                                            },
                                            "responsibilities": {
                                                "bsonType": "array",
                                                "items": {"bsonType": "string"},
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        "education": {
                            "bsonType": "array",
                            "items": {
                                "bsonType": "object",
                                "required": ["institution", "stream", "cgpa"],
                                "properties": {
                                    "year": {"bsonType": ["string", "null"]},
                                    "institution": {"bsonType": "string"},
                                    "stream": {"bsonType": "string"},
                                    "cgpa": {"bsonType": ["double", "int", "decimal"]},
                                },
                            },
                        },
                        "certifications": {
                            "bsonType": "array",
                            "items": {"bsonType": "string"},
                        },
                        "achievements": {
                            "bsonType": "array",
                            "items": {"bsonType": "string"},
                        },
                        "interests": {
                            "bsonType": "array",
                            "items": {"bsonType": "string"},
                        },
                    },
                }
            },
        )

        await db.employee_resume_data.create_index("employee_id")
        await db.employee_resume_data.create_index("search_tags")
    else:
        # Keep total_experience validator in sync — was int, now accepts double.
        await db.command(
            "collMod",
            "employee_resume_data",
            validator={
                "$jsonSchema": {
                    "bsonType": "object",
                    "required": [
                        "personal_info",
                        "profile_summary",
                        "technical_skills",
                        "work_experience",
                        "education",
                    ],
                    "properties": {
                        "employee_id": {"bsonType": "string"},
                        "total_experience": {
                            "bsonType": ["double", "int", "decimal"],
                            "description": "Total years of experience",
                        },
                        "search_tags": {
                            "bsonType": "array",
                            "items": {"bsonType": "string"},
                        },
                        "personal_info": {
                            "bsonType": "object",
                            "required": ["full_name"],
                            "properties": {"full_name": {"bsonType": "string"}},
                        },
                        "profile_summary": {"bsonType": "string"},
                        "technical_skills": {
                            "bsonType": "object",
                            "additionalProperties": {
                                "bsonType": "array",
                                "items": {"bsonType": "string"},
                            },
                        },
                        "work_experience": {
                            "bsonType": "array",
                            "items": {
                                "bsonType": "object",
                                "required": ["company", "designation", "duration", "project"],
                                "properties": {
                                    "company": {
                                        "bsonType": "object",
                                        "required": ["name"],
                                        "properties": {
                                            "name": {"bsonType": "string"},
                                            "description": {"bsonType": ["string", "null"]},
                                        },
                                    },
                                    "designation": {"bsonType": "string"},
                                    "duration": {"bsonType": "string"},
                                    "project": {
                                        "bsonType": "object",
                                        "required": ["name", "client", "project_description"],
                                        "properties": {
                                            "name": {"bsonType": "string"},
                                            "client": {"bsonType": "string"},
                                            "role": {"bsonType": ["string", "null"]},
                                            "environment": {
                                                "bsonType": "array",
                                                "items": {"bsonType": "string"},
                                            },
                                            "project_description": {"bsonType": "string"},
                                            "responsibilities": {
                                                "bsonType": "array",
                                                "items": {"bsonType": "string"},
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        "education": {
                            "bsonType": "array",
                            "items": {
                                "bsonType": "object",
                                "required": ["institution", "stream", "cgpa"],
                                "properties": {
                                    "year": {"bsonType": ["string", "null"]},
                                    "institution": {"bsonType": "string"},
                                    "stream": {"bsonType": "string"},
                                    "cgpa": {"bsonType": ["double", "int", "decimal"]},
                                },
                            },
                        },
                        "certifications": {"bsonType": "array", "items": {"bsonType": "string"}},
                        "achievements": {"bsonType": "array", "items": {"bsonType": "string"}},
                        "interests": {"bsonType": "array", "items": {"bsonType": "string"}},
                    },
                }
            },
        )

    if "resume_store" not in existing_collections:
        await db.create_collection(
            "resume_store",
            validator={
                "$jsonSchema": {
                    "bsonType": "object",
                    "required": ["employee_id", "resume_path", "last_updated_at"],
                    "properties": {
                        "employee_id": {"bsonType": "string"},
                        "resume_path": {"bsonType": "string"},
                        "last_updated_at": {"bsonType": "date"},
                    },
                }
            },
        )

    logger.info("Database and collections are set up successfully.")

    # Unique indexes — drop existing non-unique versions first, then recreate
    for col_name, field in [
        ("employee_data", "employeeId"),
        ("employee_data", "email"),
        ("employee_skill_summary", "employee_id"),
        ("employee_resume_data", "employee_id"),
        ("resume_store", "employee_id"),
    ]:
        col = db[col_name]
        index_name = f"{field}_1"
        try:
            await col.drop_index(index_name)
        except Exception:
            pass  # index didn't exist — fine
        await col.create_index(field, unique=True, background=True)
    logger.info("Unique indexes ensured on all collections.")

    # Seed HR user only if not already present
    hr_exists = await db.employee_data.find_one({"employeeId": "HR001"})
    if not hr_exists:
        await db.employee_data.insert_one(
            {
                "employeeId": "HR001",
                "fullName": "Naveen",
                "email": "hr@sailssoftware.com",
                "currentRole": "HR Manager",
                "department": "Human Resources",
                "status": "Active",
                "role": "HR",
                "isOnBench": False,
                "lastProfileUpdate": datetime.now(timezone.utc),
            }
        )
        logger.info("HR seed record inserted.")
    else:
        logger.info("Seed data already exists, skipping...")
