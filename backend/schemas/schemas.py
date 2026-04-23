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
    name: Optional[str] = None
    client: Optional[str] = "Internal"
    role: Optional[str] = None
    environment: List[str] = Field(default_factory=list)
    project_description: Optional[str] = None
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
    total_experience: Optional[int] = 0
    personal_info: PersonalInfo = Field(default_factory=PersonalInfo)
    profile_summary: Optional[str] = ""
    technical_skills: Dict[str, List[str]] = Field(default_factory=dict)
    work_experience: List[WorkExperience] = Field(default_factory=list)
    education: List[Education] = Field(default_factory=list)
    certifications: Optional[List[str]] = Field(default_factory=list)
    achievements: Optional[List[str]] = Field(default_factory=list)
    interests: Optional[List[str]] = Field(default_factory=list)

    def get_search_tags(self) -> List[str]:
        """Flatten all skill values into a single list for fast MongoDB querying."""
        tags = []
        for values in self.technical_skills.values():
            tags.extend(values)
        return list(set(tags))


class BulkEmployees(BaseModel):
    employees: List[EmployeePayload]


class EmployeeDataDocument(BaseModel):
    """Mirrors employee_data collection."""

    employeeId: str
    fullName: str
    email: Optional[str] = None
    currentRole: Optional[str] = None
    department: Optional[str] = None
    status: str = "Active"
    is_on_bench: bool = False
    lastProfileUpdate: Optional[datetime] = None


class ResumeStoreDocument(BaseModel):
    """Mirrors resume_store collection."""

    employee_id: str
    resume_path: str
    last_updated_at: datetime = Field(default_factory=datetime.now(UTC))


class AuditEventDocument(BaseModel):
    """Mirrors audit_data collection."""

    employeeId: str
    timestamp: datetime = Field(default_factory=datetime.now(UTC))
    action: str
    details: Optional[Dict[str, Any]] = None


class UploadResumeRequest(BaseModel):
    file: UploadFile
    employee_id: str
    email: Optional[str] = None


class IngestionResult(BaseModel):
    status: str
    employee_id: Optional[str] = None
    resume_docx_path: Optional[str] = None
    message: Optional[str] = None


# Auth schemas
class LoginRequest(BaseModel):
    email: str


class LoginResponse(BaseModel):
    email: str
    role: str
    employeeId: Optional[str] = None
    fullName: Optional[str] = None


class CandidateSearchRequest(BaseModel):
    query: str
    employee_id: Optional[str] | None = None


class CandidateResult(BaseModel):
    name: str
    skills: List[str]
    experience: int
    email: str
    is_on_bench: bool = False

# Employee profile
class ProfileUpdateRequest(BaseModel):
    email: str
    profile_summary: Optional[str] = None
    technical_skills: Optional[Dict[str, List[str]]] = None
    total_experience: Optional[int] = None
    personal_info: Optional[Dict[str, str]] = None
    education: Optional[List[Dict[str, Any]]] = None
    certifications: Optional[List[str]] = None
    achievements: Optional[List[str]] = None
    interests: Optional[List[str]] = None
    work_experience: Optional[List[Dict[str, Any]]] = None
