import os
import shutil
import tempfile
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
import logging
from services.db_service import (
    get_employee_by_email,
    get_employee_resume,
    update_employee_resume,
    search_candidates_by_query,
)
from schemas.schemas import (
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
    emp = await get_employee_by_email(request.email)
    return LoginResponse(
        email=request.email,
        role=emp.get("role") if emp else None,
        employeeId=emp.get("employeeId") if emp else None,
        fullName=emp.get("fullName") if emp else None,
    )


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
    if request.work_experience is not None:
        updated["work_experience"] = request.work_experience

    await update_employee_resume(employee_id, updated)
    return {"status": "success", "message": "Profile updated"}


@router.post("/search-candidates")
async def search_candidates(request: CandidateSearchRequest):
    from services.agent_runner import run_agent

    response = await run_agent(
        prompt={
            "query": request.query,
            "employee_id": request.employee_id,
        },
    )
    reply = response.get("reply", {})
    excel_path = reply.get("excel_path")
    excel_filename = os.path.basename(excel_path) if excel_path else None
    return {
        "status": reply.get("status", "error"),
        "count": reply.get("count", 0),
        "candidates": reply.get("candidates", []),
        "excel_filename": excel_filename,
    }


@router.get("/download-excel")
async def download_excel(filename: str):
    output_dir = os.getenv("EXCEL_OUTPUT_DIR", "output_excels")
    safe_filename = os.path.basename(filename)
    file_path = os.path.join(output_dir, safe_filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(
        file_path,
        filename=safe_filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


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
