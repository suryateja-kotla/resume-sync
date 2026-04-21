from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "employee_registry"


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
