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
    if "audit_data" not in existing_collections:
        await db.create_collection(
            "audit_data",
            validator={
                "$jsonSchema": {
                    "bsonType": "object",
                    "required": ["employeeId", "timestamp", "action"],
                    "properties": {
                        "_id": {"bsonType": "objectId"},
                        "employeeId": {"bsonType": "string"},
                        "timestamp": {"bsonType": "date"},
                        "action": {
                            "enum": [
                                "USER_APPROVED",
                                "USER_EDITED",
                                "RESUME_UPDATE_REJECTED",
                            ]
                        },
                        "details": {"bsonType": "object"},
                    },
                }
            },
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
                            "bsonType": "int",
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
                                                "bsonType": "string"
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
    # Check if already seeded
    existing = await db.employee_data.find_one({"employeeId": "EMP001"})
    if not existing:
        # HR USER
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

        # EMPLOYEE USER
        await db.employee_data.insert_one(
            {
                "employeeId": "EMP001",
                "fullName": "Kavya Namballa",
                "email": "kavya.namballa@sailssoftware.com",
                "currentRole": "Software Engineer",
                "department": "Engineering",
                "status": "Active",
                "role": "EMPLOYEE",
                "isOnBench": False,
                "lastProfileUpdate": datetime.now(timezone.utc),
            }
        )

        await db.employee_data.insert_one(
            {
                "employeeId": "EMP002",
                "fullName": "Pavan Kumar",
                "email": "pavankumar.yele@sailssoftware.com",
                "currentRole": "senior Qa Automation Engineer",
                "department": "Engineering",
                "status": "Active",
                "role": "EMPLOYEE",
                "isOnBench": False,
                "lastProfileUpdate": datetime.now(timezone.utc),
            }
        )

        await db.employee_data.insert_one(
            {
                "employeeId": "EMP003",
                "fullName": "Sai Spandana",
                "email": "saispandana.Komati@sailssoftware.com",
                "currentRole": "Senior QA Engineer",
                "department": "Engineering",
                "status": "Active",
                "role": "EMPLOYEE",
                "isOnBench": False,
                "lastProfileUpdate": datetime.now(timezone.utc),
            }
        )

        await db.employee_data.insert_one(
            {
                "employeeId": "EMP004",
                "fullName": "karthik kumar",
                "email": "karthikkumar.Malapati@sailssoftware.com",
                "currentRole": "Test Engineer",
                "department": "Engineering",
                "status": "Active",
                "role": "EMPLOYEE",
                "isOnBench": False,
                "lastProfileUpdate": datetime.now(timezone.utc),
            }
        )

        await db.employee_data.insert_one(
            {
                "employeeId": "EMP005",
                "fullName": "Subramanyam Kanithi",
                "email": "subramanyam.kanithi@sailssoftware.com",
                "currentRole": "Software Engineer",
                "department": "Engineering",
                "status": "Active",
                "role": "EMPLOYEE",
                "isOnBench": False,
                "lastProfileUpdate": datetime.now(timezone.utc),
            }
        )

        await db.employee_data.insert_one(
            {
                "employeeId": "EMP006",
                "fullName": "Prathyusha Bobbala",
                "email": "prathyusha.bobbala@sailssoftware.com",
                "currentRole": ".net Developer",
                "department": "Engineering",
                "status": "Active",
                "role": "EMPLOYEE",
                "isOnBench": False,
                "lastProfileUpdate": datetime.now(timezone.utc),
            }
        )

        await db.employee_data.insert_one(
            {
                "employeeId": "EMP007",
                "fullName": "ThilaKavathi Dommaraju",
                "email": "thilakavathi.dommaraju@sailssoftware.com",
                "currentRole": ".net Developer",
                "department": "Engineering",
                "status": "Active",
                "role": "EMPLOYEE",
                "isOnBench": False,
                "lastProfileUpdate": datetime.now(timezone.utc),
            }
        )

        await db.employee_data.insert_one(
            {
                "employeeId": "EMP008",
                "fullName": "Rajarshee Roy",
                "email": "rajarshee.roy@sailssoftware.com",
                "currentRole": "SoftwareEngineer",
                "department": "Engineering",
                "status": "Active",
                "role": "EMPLOYEE",
                "isOnBench": False,
                "lastProfileUpdate": datetime.now(timezone.utc),
            }
        )

        await db.employee_data.insert_one(
            {
                "employeeId": "EMP009",
                "fullName": "kiran kumar Avk ",
                "email": "kirankumar.avk@sailssoftware.com",
                "currentRole": "Full Stack Developer",
                "department": "Engineering",
                "status": "Active",
                "role": "EMPLOYEE",
                "isOnBench": False,
                "lastProfileUpdate": datetime.now(timezone.utc),
            }
        )
        await db.employee_data.insert_one(
            {
                "employeeId": "EMP010",
                "fullName": "SaiPreethi Abbireddy",
                "email": "saipreethi.abbireddy@sailssoftware.com",
                "currentRole": "Software Engineer",
                "department": "Engineering",
                "status": "Active",
                "role": "EMPLOYEE",
                "isOnBench": False,
                "lastProfileUpdate": datetime.now(timezone.utc),
            }
        )

        await db.employee_data.insert_one(
            {
                "employeeId": "EMP011",
                "fullName": "UdayGanesh Kanteti",
                "email": "udayganesh.kanteti@sailssoftware.com",
                "currentRole": "SoftwareEngineer",
                "department": "Engineering",
                "status": "Active",
                "role": "EMPLOYEE",
                "isOnBench": False,
                "lastProfileUpdate": datetime.now(timezone.utc),
            }
        )

        await db.employee_data.insert_one(
            {
                "employeeId": "EMP012",
                "fullName": "Madhuri Taddi",
                "email": "madhuri.taddi@sailssoftware.com",
                "currentRole": "Software Engineer",
                "department": "Engineering",
                "status": "Active",
                "role": "EMPLOYEE",
                "isOnBench": False,
                "lastProfileUpdate": datetime.now(timezone.utc),
            }
        )

        await db.employee_data.insert_one(
            {
                "employeeId": "EMP013",
                "fullName": "Siva Sai Manikanta",
                "email": "sivasai@sailssoftware.com",
                "currentRole": "Software Engineer",
                "department": "Engineering",
                "status": "Active",
                "role": "EMPLOYEE",
                "isOnBench": False,
                "lastProfileUpdate": datetime.now(timezone.utc),
            }
        )

        await db.employee_data.insert_one(
            {
                "employeeId": "EMP014",
                "fullName": "Jayasree Maddi",
                "email": "jayasree.maddi@sailssoftware.com",
                "currentRole": "Technical Delivery Manager",
                "department": "Delivery",
                "status": "Active",
                "role": "EMPLOYEE",
                "isOnBench": False,
                "lastProfileUpdate": datetime.now(timezone.utc),
            }
        )

        logger.info("Seed data inserted successfully.")
    else:
        logger.info("Seed data already exists, skipping...")
