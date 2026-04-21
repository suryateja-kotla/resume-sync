import logging
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone

MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "employee_registry_local"
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

    print("Database & collections initialized")
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
                "lastProfileUpdate": datetime.now(timezone.utc),
            }
        )

        await db.employee_resume_data.insert_one(
            {
                "employee_id": "EMP001",
                "total_experience": 3,
                "search_tags": ["python", "fastapi", "mongodb", "react", "aws"],
                "personal_info": {"full_name": "Kavya Namballa"},
                "profile_summary": "Software Engineer with 3 years of experience in backend development using FastAPI and MongoDB. Skilled in building scalable APIs and cloud deployment.",
                "technical_skills": {
                    "backend": ["Python", "FastAPI", "Node.js"],
                    "frontend": ["React"],
                    "database": ["MongoDB", "PostgreSQL"],
                    "cloud": ["AWS"],
                },
                "work_experience": [
                    {
                        "company": {
                            "name": "TechNova Solutions",
                            "description": "A SaaS company focused on retail analytics",
                        },
                        "designation": "Software Engineer",
                        "duration": "Jan 2023 - Present",
                        "project": {
                            "name": "Retail AI Platform",
                            "client": "Internal",
                            "role": "Backend Developer",
                            "environment": ["Python", "FastAPI", "MongoDB", "Docker"],
                            "project_description": "Developed APIs for AI-driven inventory forecasting and monitoring system.",
                            "responsibilities": [
                                "Designed REST APIs using FastAPI",
                                "Integrated MongoDB for scalable data storage",
                                "Worked on real-time data pipelines",
                                "Collaborated with frontend team",
                            ],
                        },
                    },
                    {
                        "company": {"name": "CodeCraft Pvt Ltd", "description": None},
                        "designation": "Junior Developer",
                        "duration": "Jun 2022 - Dec 2022",
                        "project": {
                            "name": "HR Management System",
                            "client": "Internal",
                            "role": "Full Stack Developer",
                            "environment": ["Node.js", "React", "MongoDB"],
                            "project_description": "Built employee management and resume tracking system.",
                            "responsibilities": [
                                "Developed CRUD APIs",
                                "Built UI components in React",
                                "Handled database schema design",
                            ],
                        },
                    },
                ],
                "education": [
                    {
                        "year": "2022",
                        "institution": "JNTU Hyderabad",
                        "stream": "Computer Science",
                        "cgpa": 8.2,
                    }
                ],
                "certifications": [
                    "AWS Certified Developer Associate",
                    "MongoDB Basics Certification",
                ],
                "achievements": [
                    "Employee of the Month - March 2024",
                    "Built internal automation tool reducing manual work by 40%",
                ],
                "interests": ["Open Source Contribution", "System Design", "AI/ML"],
            }
        )
        logger.info("Seed data inserted successfully.")
    else:
        logger.info("Seed data already exists, skipping...")
