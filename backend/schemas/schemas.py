from fastapi import UploadFile
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from datetime import datetime, UTC


class PersonalInfo(BaseModel):
    full_name: str


class Company(BaseModel):
    name: str
    description: Optional[str] = None


class Project(BaseModel):
    name: str
    client: Optional[str] = "Internal"
    role: Optional[str] = None
    environment: List[str] = Field(default_factory=list)
    project_description: str
    responsibilities: List[str] = Field(default_factory=list)


class WorkExperience(BaseModel):
    company: Company
    designation: str
    duration: str
    project: Project


class Education(BaseModel):
    year: Optional[str] = None
    institution: str
    stream: str
    cgpa: float


class EmployeePayload(BaseModel):
    employee_id: Optional[str] = None
    total_experience: Optional[int] = None
    personal_info: PersonalInfo
    profile_summary: str
    technical_skills: Dict[str, List[str]]
    work_experience: List[WorkExperience]
    education: List[Education]
    certifications: Optional[List[str]] = None
    achievements: Optional[List[str]] = None
    interests: Optional[List[str]] = None

    def get_search_tags(self) -> List[str]:
        """Flatten all skill values into a single list for fast MongoDB querying."""
        tags = []
        for values in self.technical_skills.values():
            tags.extend(values)
        return list(set(tags))  # deduplicate


class BulkEmployees(BaseModel):
    employees: List[EmployeePayload]


class EmployeeDataDocument(BaseModel):
    """Mirrors employee_data collection."""

    employeeId: str
    fullName: str
    email: Optional[str] = None
    currentRole: Optional[str] = None
    department: Optional[str] = None
    status: str = "Active"  # Active | Inactive | On Leave
    lastProfileUpdate: Optional[datetime] = None


class ResumeStoreDocument(BaseModel):
    """Mirrors resume_store collection."""

    employee_id: str
    resume_path: str  # local .docx path (or S3 key later)
    last_updated_at: datetime = Field(default_factory=datetime.now(UTC))


class AuditEventDocument(BaseModel):
    """Mirrors audit_data collection."""

    employeeId: str
    timestamp: datetime = Field(default_factory=datetime.now(UTC))
    action: str  # USER_APPROVED | USER_EDITED | RESUME_UPDATE_REJECTED
    details: Optional[Dict[str, Any]] = None


class UploadResumeRequest(BaseModel):
    file: UploadFile
    employee_id: str
    email: Optional[str] = None


class SearchRequest(BaseModel):
    query: str
    employee_id: Optional[str] | None = None


class IngestionResult(BaseModel):
    status: str  # success | error
    employee_id: Optional[str] = None
    resume_docx_path: Optional[str] = None
    message: Optional[str] = None
