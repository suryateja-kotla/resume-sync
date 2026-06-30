import os
import shutil
import tempfile
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from schemas.schemas import EmployeePayload
import logging
from constants.skill_categories import SKILL_CATEGORIES
from tools.resume_tool import generate_resume_docx
from tools.excel_tools import create_talent_excel
from services.db_service import (
    get_employee_by_email,
    get_employee_resume_data,
    get_employee_skill_summary,
    get_employees_by_skill,
    get_full_employee_directory,
    get_new_employees,
    get_resume_path,
    get_skill_rack_summary,
    provision_new_employee,
    save_employee_resume_data,
    upsert_employee_skill_summary,
    upsert_resume_path,
)
from schemas.schemas import (
    LoginRequest,
    LoginResponse,
    CandidateSearchRequest,
    ProfileUpdateRequest,
    SkillSummaryUpdateRequest,
    SendResumeInviteRequest,
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/health")
async def health_check():
    return {"status": "ok"}


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    emp = await get_employee_by_email(request.email)
    if not emp:
        # First login for this email — auto-provision as a new employee so
        # anyone who received an onboarding invite can log in immediately
        # and land on the Upload Resume tab.
        emp = await provision_new_employee(request.email)
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
    resume = await get_employee_resume_data(emp.get("employeeId", ""))
    return {
        "status": "success",
        "data": {
            "employeeId": emp.get("employeeId"),
            "fullName": emp.get("fullName"),
            "email": emp.get("email"),
            "currentRole": emp.get("currentRole"),
            "department": emp.get("department"),
            "resume": resume,
            "hasResume": resume is not None,
        },
    }


@router.put("/employee-profile")
async def update_employee_profile(request: ProfileUpdateRequest):
    emp = await get_employee_by_email(request.email)
    if not emp:
        return {"status": "error", "message": "Employee not found"}

    employee_id = emp.get("employeeId", "")
    existing_resume = await get_employee_resume_data(employee_id) or {}

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
    logger.info(f"Updating profile for employee_id={employee_id} with data: {updated}")

    try:
        payload = EmployeePayload(**updated)
    except Exception as e:
        logger.error(f"Failed to create EmployeePayload for {employee_id}: {str(e)}")
        return {"status": "error", "message": f"Invalid payload: {str(e)}"}

    save_result = await save_employee_resume_data(employee_id, payload.model_dump())
    if save_result.get("status") != "success":
        logger.error(f"Failed to save resume data for {employee_id}: {save_result}")
        return save_result
    existing_resume_path = await get_resume_path(employee_id)
    if existing_resume_path:
        try:
            abs_path = os.path.abspath(existing_resume_path)
            logger.info(f"Existing resume path for {employee_id}: {abs_path}")

            if os.path.exists(abs_path):
                os.remove(abs_path)
                logger.info(f"Deleted old resume: {abs_path}")
            else:
                logger.warning(f"Skipping delete, not a file: {abs_path}")

        except Exception as e:
            logger.error(f"Failed to remove old resume file: {e}")
    logger.info(f"Generating resume docx for {employee_id}")
    result = await generate_resume_docx(employee_id)
    logger.info(f"generate_resume_docx result for {employee_id}: {result}")
    if result.get("status") != "success":
        logger.error(f"Resume generation failed for {employee_id}: {result}")
        return result
    resume_path = result.get("resume_path")
    upsert_result = await upsert_resume_path(employee_id, resume_path)
    logger.info(f"upsert_resume_path result for {employee_id}: {upsert_result}")

    return {"status": "success", "message": "Profile updated"}


@router.get("/employee-skill-summary")
async def get_skill_summary(email: str):
    emp = await get_employee_by_email(email)
    if not emp:
        return {"status": "error", "message": "Employee not found"}

    employee_id = emp.get("employeeId", "")
    summary = await get_employee_skill_summary(employee_id)
    return {
        "status": "success",
        "data": summary
        or {
            "employee_id": employee_id,
            "name": emp.get("fullName"),
            "current_designation": "",
            "current_skill": "",
            "total_exp": 0,
            "current_skill_exp": 0,
        },
    }


@router.put("/employee-skill-summary")
async def update_skill_summary(request: SkillSummaryUpdateRequest):
    emp = await get_employee_by_email(request.email)
    if not emp:
        return {"status": "error", "message": "Employee not found"}

    # employee_id and name are always derived from the employee record below —
    # they are never taken from the request body, which keeps them immutable.
    employee_id = emp.get("employeeId", "")
    name = emp.get("fullName", "")

    result = await upsert_employee_skill_summary(
        employee_id=employee_id,
        name=name,
        email=emp.get("email"),
        current_designation=request.current_designation,
        current_skill=request.current_skill,
        total_exp=request.total_exp,
        current_skill_exp=request.current_skill_exp,
    )
    if result.get("status") != "success":
        return result

    summary = await get_employee_skill_summary(employee_id)
    return {"status": "success", "data": summary}


@router.get("/hr/new-employees")
async def list_new_employees():
    """Employees who haven't uploaded a resume yet — candidates for an
    onboarding invite email from HR."""
    employees = await get_new_employees()
    return {
        "status": "success",
        "data": [
            {
                "employee_id": e.get("employeeId"),
                "name": e.get("fullName"),
                "email": e.get("email"),
                "department": e.get("department"),
            }
            for e in employees
        ],
    }


@router.post("/hr/send-resume-invite")
async def send_resume_invite(request: SendResumeInviteRequest):
    """Sends an onboarding invite to any email HR types in — the recipient
    does not need to already exist in employee_data. This only sends the
    email; it does not create a login/account, so the recipient can only
    actually log in once they've been provisioned in employee_data through
    whatever onboarding/IT process HR uses for that (account creation and
    credentials are a separate, not-yet-built concern)."""
    from config.email_config import settings as email_settings
    from services.email_service import EmailService

    email = (request.email or "").strip()
    if "@" not in email or "." not in email.split("@")[-1]:
        return {"status": "error", "message": "Enter a valid email address"}

    emp = await get_employee_by_email(email)
    recipient_name = (
        (emp.get("fullName") if emp else None)
        or request.name
        or email.split("@")[0].replace(".", " ").title()
    )

    try:
        EmailService(email_settings).send_new_employee_invite(
            recipient_email=email,
            recipient_name=recipient_name,
            update_url=email_settings.frontend_update_url,
        )
        return {"status": "success", "message": f"Invite sent to {email}"}
    except Exception as e:
        logger.error(f"send_resume_invite failed for {email}: {e}")
        return {"status": "error", "message": "Failed to send invite email"}


@router.get("/skill-categories")
async def list_skill_categories():
    """The fixed list of canonical skill categories used by the Skill
    Profile dropdown (employee side) and the HR Skill Dashboard racks."""
    return {"status": "success", "data": SKILL_CATEGORIES}


@router.get("/hr/skill-summary")
async def skill_summary():
    """Unique skill racks (derived from employee_skill_summary.current_skill)
    with employee headcount, for the HR Skill Dashboard."""
    data = await get_skill_rack_summary()
    return {"status": "success", "data": data}


@router.get("/hr/skill-employees")
async def skill_employees(skill: str):
    """Employees whose current_skill matches the given skill rack."""
    data = await get_employees_by_skill(skill)
    return {"status": "success", "skill": skill, "data": data}


@router.get("/hr/skill-employees-excel")
async def skill_employees_excel(skill: str):
    """Generates an Excel report for the employees in one skill rack
    (e.g. clicking 'Generate Excel' on the Java rack drill-down panel)."""
    data = await get_employees_by_skill(skill)
    if not data:
        raise HTTPException(status_code=404, detail="No employees found for this skill")

    rows = [
        {
            "Employee ID": e.get("employee_id"),
            "Name": e.get("name"),
            "Email": e.get("email"),
            "Current Designation": e.get("current_designation"),
            "Current Skill": e.get("current_skill"),
            "Total Experience (yrs)": e.get("total_exp"),
            "Current Skill Experience (yrs)": e.get("current_skill_exp"),
            # Must stay named exactly "resume_path" — create_talent_excel
            # looks for this column to build the clickable resume hyperlink.
            "resume_path": e.get("resume_path"),
        }
        for e in data
    ]

    result = create_talent_excel(rows)
    if result.get("status") != "success":
        raise HTTPException(status_code=500, detail=result.get("message", "Excel generation failed"))

    filename = os.path.basename(result["saved_location"])
    return {"status": "success", "excel_filename": filename, "count": len(data)}


@router.get("/hr/all-employees")
async def all_employees():
    """Full org-wide employee directory for the HR Employee List section."""
    data = await get_full_employee_directory()
    return {"status": "success", "count": len(data), "data": data}


@router.get("/hr/all-employees-excel")
async def all_employees_excel():
    """Generates an Excel report containing every employee in the org."""
    data = await get_full_employee_directory()
    if not data:
        raise HTTPException(status_code=404, detail="No employees found")

    rows = [
        {
            "Employee ID": e.get("employee_id"),
            "Name": e.get("name"),
            "Email": e.get("email"),
            "Department": e.get("department"),
            "Current Role": e.get("current_role"),
            "Current Designation": e.get("current_designation"),
            "Current Skill": e.get("current_skill"),
            "Total Experience (yrs)": e.get("total_exp"),
            "Current Skill Experience (yrs)": e.get("current_skill_exp"),
            "Bench Status": e.get("bench_status"),
            "Resume Status": e.get("resume_status"),
            # Must stay named exactly "resume_path" — create_talent_excel
            # looks for this column to build the clickable resume hyperlink.
            "resume_path": e.get("resume_path"),
        }
        for e in data
    ]

    result = create_talent_excel(rows)
    if result.get("status") != "success":
        raise HTTPException(status_code=500, detail=result.get("message", "Excel generation failed"))

    filename = os.path.basename(result["saved_location"])
    return {"status": "success", "excel_filename": filename, "count": len(data)}


@router.post("/search-candidates")
async def search_candidates(request: CandidateSearchRequest):
    from services.agent_runner import run_agent

    response = await run_agent(
        prompt={
            "query": request.query,
            "employee_id": request.employee_id,
        },
        session_id=request.session_id,
    )
    reply = response.get("reply", {})
    session_id = response.get("session_id")
    status = reply.get("status", "error")

    # Text/greeting/pending_confirmation replies — no candidate data expected
    if status in ("text", "pending_confirmation"):
        return {
            "status": status,
            "count": 0,
            "candidates": [],
            "message": reply.get("message"),
            "excel_filename": None,
            "session_id": session_id,
        }

    excel_path = reply.get("excel_path")
    excel_filename = os.path.basename(excel_path) if excel_path else None
    return {
        "status": status,
        "count": reply.get("count", 0),
        "candidates": reply.get("candidates", []),
        "message": reply.get("message"),
        "excel_filename": excel_filename,
        "session_id": session_id,
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


