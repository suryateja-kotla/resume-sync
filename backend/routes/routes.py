import os
import shutil
import tempfile
from fastapi import APIRouter, UploadFile, File, Form
import logging
from services.db_service import (
    get_user_role,
    get_employee_by_email,
    get_employee_resume,
    update_employee_resume,
    search_candidates_by_query,
)
from schemas.schemas import (
    SearchRequest,
    LoginRequest,
    LoginResponse,
    CandidateSearchRequest,
    ProfileUpdateRequest,
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/health")
async def health_check():
    return {"status": "ok"}


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    role = get_user_role(request.email)
    emp = await get_employee_by_email(request.email)
    return LoginResponse(
        email=request.email,
        role=role,
        employeeId=emp.get("employeeId") if emp else None,
        fullName=emp.get("fullName") if emp else None,
    )


@router.post("/search-candidates")
async def search_candidates(request: CandidateSearchRequest):
    results = await search_candidates_by_query(request.query)
    return results


@router.get("/employee-profile")
async def get_employee_profile(email: str):
    emp = await get_employee_by_email(email)
    if not emp:
        return {"status": "error", "message": "Employee not found"}
    resume = await get_employee_resume(emp.get("employeeId", ""))
    return {
        "status": "success",
        "data": {
            "employeeId": emp.get("employeeId"),
            "fullName": emp.get("fullName"),
            "email": emp.get("email"),
            "currentRole": emp.get("currentRole"),
            "department": emp.get("department"),
            "resume": resume,
        },
    }


@router.put("/employee-profile")
async def update_employee_profile(request: ProfileUpdateRequest):
    emp = await get_employee_by_email(request.email)
    if not emp:
        return {"status": "error", "message": "Employee not found"}

    employee_id = emp.get("employeeId", "")
    existing_resume = await get_employee_resume(employee_id) or {}

    updated = {**existing_resume}
    if request.profile_summary is not None:
        updated["profile_summary"] = request.profile_summary
    if request.technical_skills is not None:
        updated["technical_skills"] = request.technical_skills
    if request.total_experience is not None:
        updated["total_experience"] = request.total_experience
    if request.personal_info is not None:
        updated["personal_info"] = request.personal_info
    if request.education is not None:
        updated["education"] = request.education
    if request.certifications is not None:
        updated["certifications"] = request.certifications
    if request.achievements is not None:
        updated["achievements"] = request.achievements
    if request.interests is not None:
        updated["interests"] = request.interests

    await update_employee_resume(employee_id, updated)
    return {"status": "success", "message": "Profile updated"}


@router.post("/search-employees")
async def search_employee(request: SearchRequest):
    from services.agent_runner import run_agent
    response = await run_agent(
        prompt={
            "action": "search_employees",
            "query": request.query,
            "employee_id": request.employee_id,
        },
    )
    return response


@router.post("/upload-resume")
async def upload_resume(
    file: UploadFile = File(...),
    employee_id: str = Form(...),
    employee_email: str = Form(None),
):
    from services.agent_runner import run_agent
    file_path = None
    try:
        suffix = os.path.splitext(file.filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            shutil.copyfileobj(file.file, tmp)
            file_path = tmp.name
        response = await run_agent(
            prompt={
                "action": "ingest_resume",
                "file_path": file_path,
                "employee_id": employee_id,
                "employee_email": employee_email,
            },
            user_id=employee_id,
        )
        return response
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
