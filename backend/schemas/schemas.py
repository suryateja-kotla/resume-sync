from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any


class PersonalInfo(BaseModel):
    full_name: str


class Company(BaseModel):
    name: str
    description: Optional[str] = None


class Project(BaseModel):
    name: Optional[str] = None
    client: Optional[str] = None
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
    cgpa: Optional[float] = 0.0


class EmployeePayload(BaseModel):
    employee_id: Optional[str] = None
    total_experience: Optional[float] = 0
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


# Employee profile
class ProfileUpdateRequest(BaseModel):
    email: str
    profile_summary: Optional[str] = None
    technical_skills: Optional[Dict[str, List[str]]] = None
    total_experience: Optional[float] = None
    personal_info: Optional[Dict[str, str]] = None
    education: Optional[List[Dict[str, Any]]] = None
    certifications: Optional[List[str]] = None
    achievements: Optional[List[str]] = None
    interests: Optional[List[str]] = None
    work_experience: Optional[List[Dict[str, Any]]] = None


# Experience Snapshot (employee_skill_summary collection)
class SkillSummaryUpdateRequest(BaseModel):
    """employee_id and name are intentionally excluded — they are immutable
    and always derived server-side from the authenticated employee record."""

    email: str
    current_designation: Optional[str] = None
    current_skill: Optional[str] = None
    total_exp: Optional[float] = None
    current_skill_exp: Optional[float] = None
    primary_skill: Optional[str] = None
    secondary_skill: Optional[str] = None
    is_on_bench: Optional[bool] = None


# HR — onboarding invite
class SendResumeInviteRequest(BaseModel):
    email: str
    name: Optional[str] = None
    actor_email: Optional[str] = None
