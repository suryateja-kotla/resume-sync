import os
import tempfile
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Response, BackgroundTasks
from fastapi.responses import FileResponse
from schemas.schemas import EmployeePayload
import logging
from constants.skill_categories import SKILL_CATEGORIES
from tools.resume_tool import generate_resume_docx
from tools.excel_tools import create_talent_excel
from services.gcs_service import delete_resume, download_resume_bytes
from services.db_service import (
    get_audit_log,
    get_all_skill_summary_employees,
    get_bench_employees,
    get_employee_by_email,
    get_employee_resume_data,
    get_employee_skill_summary,
    get_employees_by_skill,
    get_full_employee_directory,
    get_hr_metrics,
    get_new_employees,
    get_resume_path,
    get_skill_rack_summary,
    save_employee_resume_data,
    upsert_employee_skill_summary,
    upsert_resume_path,
    write_audit_event,
    delete_employee,
)
from schemas.schemas import (
    ProfileUpdateRequest,
    SkillSummaryUpdateRequest,
    SendResumeInviteRequest,
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/health")
async def health_check():
    return {"status": "ok"}


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


@router.get("/employee-profile/resume-preview-file")
async def get_resume_preview_file(email: str):
    """Streams the employee's own generated resume DOCX bytes, for the
    frontend to render client-side (docx-preview). Proxying through the
    backend — rather than returning a signed GCS URL — only needs plain
    object-read access, not the signing-key permission a signed URL requires."""
    emp = await get_employee_by_email(email)
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    blob_name = await get_resume_path(emp.get("employeeId", ""))
    if not blob_name:
        raise HTTPException(status_code=404, detail="No resume on file")

    try:
        content = download_resume_bytes(blob_name)
    except Exception as e:
        logger.error(f"Failed to download resume for preview ({email}): {e}")
        raise HTTPException(status_code=502, detail="Could not load resume document")

    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


@router.get("/hr/resume-file/{employee_id}")
async def get_resume_file_for_hr(employee_id: str):
    """Streams a resume DOCX by employee_id, for HR's Excel export
    hyperlinks — same proxy-through-backend approach as
    resume-preview-file, since we don't have a signing-capable credential
    for GCS signed URLs. Records with a pre-GCS-migration local file path
    (not a GCS blob name) can't be served this way; those return 404 with a
    distinct message so the Excel link reads as "not available" rather than
    silently erroring."""
    blob_name = await get_resume_path(employee_id)
    if not blob_name:
        raise HTTPException(status_code=404, detail="No resume on file")

    if os.path.isabs(blob_name) or ":\\" in blob_name:
        raise HTTPException(status_code=404, detail="Resume predates GCS migration — ask employee to re-upload")

    try:
        content = download_resume_bytes(blob_name)
    except Exception as e:
        logger.error(f"Failed to download resume for HR export ({employee_id}): {e}")
        raise HTTPException(status_code=502, detail="Could not load resume document")

    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{os.path.basename(blob_name)}"'},
    )


@router.put("/employee-profile")
async def update_employee_profile(request: ProfileUpdateRequest):
    emp = await get_employee_by_email(request.email)
    if not emp:
        return {"status": "error", "message": "Employee not found"}

    employee_id = emp.get("employeeId", "")
    existing_resume = await get_employee_resume_data(employee_id) or {}

    updated = {**existing_resume}
    changed_fields: dict = {}
    for field in (
        "profile_summary",
        "technical_skills",
        "total_experience",
        "personal_info",
        "education",
        "certifications",
        "achievements",
        "interests",
        "work_experience",
    ):
        new_value = getattr(request, field)
        if new_value is not None:
            changed_fields[field] = {
                "before": existing_resume.get(field),
                "after": new_value,
            }
            updated[field] = new_value
    logger.info(f"Updating profile for employee_id={employee_id} with data: {updated}")

    # Strip nulls and ensure required string fields are always present
    def _replace_nulls(data):
        if isinstance(data, dict):
            return {k: _replace_nulls(v) if v is not None else "" for k, v in data.items()}
        if isinstance(data, list):
            return [_replace_nulls(i) if i is not None else "" for i in data]
        return data

    updated = _replace_nulls(updated)

    # Ensure project_description is always present (may be absent in old DB docs)
    for we in updated.get("work_experience", []):
        proj = we.get("project")
        if isinstance(proj, dict) and "project_description" not in proj:
            proj["project_description"] = ""

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
            delete_resume(existing_resume_path)
            logger.info(f"Deleted old resume blob: {existing_resume_path}")
        except Exception as e:
            logger.error(f"Failed to remove old resume blob: {e}")
    logger.info(f"Generating resume docx for {employee_id}")
    result = await generate_resume_docx(employee_id)
    logger.info(f"generate_resume_docx result for {employee_id}: {result}")
    if result.get("status") != "success":
        logger.error(f"Resume generation failed for {employee_id}: {result}")
        return result
    resume_path = result.get("resume_path")
    upsert_result = await upsert_resume_path(employee_id, resume_path)
    logger.info(f"upsert_resume_path result for {employee_id}: {upsert_result}")

    if changed_fields:
        await write_audit_event(
            event_type="PROFILE_UPDATED",
            actor=employee_id,
            employee_id=employee_id,
            payload={"changed_fields": list(changed_fields.keys()), "diff": changed_fields},
        )

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
    before = await get_employee_skill_summary(employee_id) or {}

    result = await upsert_employee_skill_summary(
        employee_id=employee_id,
        name=name,
        email=emp.get("email"),
        current_designation=request.current_designation,
        current_skill=request.current_skill,
        total_exp=request.total_exp,
        current_skill_exp=request.current_skill_exp,
        primary_skill=request.primary_skill,
        secondary_skill=request.secondary_skill,
        is_on_bench=request.is_on_bench,
    )
    if result.get("status") != "success":
        return result

    summary = await get_employee_skill_summary(employee_id)
    await write_audit_event(
        event_type="SKILL_PROFILE_UPDATED",
        actor=employee_id,
        employee_id=employee_id,
        payload={
            "before": {
                "current_designation": before.get("current_designation"),
                "current_skill": before.get("current_skill"),
                "total_exp": before.get("total_exp"),
                "current_skill_exp": before.get("current_skill_exp"),
            },
            "after": {
                "current_designation": summary.get("current_designation") if summary else None,
                "current_skill": summary.get("current_skill") if summary else None,
                "total_exp": summary.get("total_exp") if summary else None,
                "current_skill_exp": summary.get("current_skill_exp") if summary else None,
            },
        },
    )
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
        await write_audit_event(
            event_type="INVITE_SENT",
            actor=request.actor_email or "HR",
            employee_id=emp.get("employeeId") if emp else None,
            payload={"invited_email": email},
        )
        return {"status": "success", "message": f"Invite sent to {email}"}
    except Exception as e:
        logger.error(f"send_resume_invite failed for {email}: {e}")
        return {"status": "error", "message": "Failed to send invite email"}


@router.get("/hr/metrics")
async def hr_metrics():
    """Live metrics for the HR Monitoring dashboard — coverage, activity, skill distribution."""
    data = await get_hr_metrics()
    return {"status": "success", "data": data}


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
async def skill_employees(skill: str, min_skill_exp: Optional[float] = None):
    """Employees whose current_skill matches the given skill rack, optionally
    filtered to those with at least min_skill_exp years in that skill."""
    data = await get_employees_by_skill(skill, min_skill_exp)
    return {"status": "success", "skill": skill, "data": data}


@router.get("/hr/skill-employees-excel")
async def skill_employees_excel(
    skill: str, min_skill_exp: Optional[float] = None, actor_email: Optional[str] = None
):
    """Generates an Excel report for the employees in one skill rack
    (e.g. clicking 'Generate Excel' on the Java rack drill-down panel),
    honoring the same experience filter as the on-screen list."""
    data = await get_employees_by_skill(skill, min_skill_exp)
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


@router.get("/hr/bench-employees")
async def bench_employees():
    """Employees who have marked themselves as currently on bench."""
    data = await get_bench_employees()
    return {"status": "success", "count": len(data), "data": data}


@router.get("/hr/skill-summary-employees")
async def skill_summary_employees():
    """Employee List sourced directly from employee_skill_summary — the 6
    skill-profile fields (no bench status) joined with resume_store."""
    data = await get_all_skill_summary_employees()
    return {"status": "success", "count": len(data), "data": data}


@router.get("/hr/all-employees-excel")
async def all_employees_excel(actor_email: Optional[str] = None):
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


@router.get("/hr/audit-log")
async def audit_log(
    event_type: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    page: int = 1,
    page_size: int = 50,
):
    """Paginated, filterable audit trail for the HR Audit Log section."""
    result = await get_audit_log(
        event_type=event_type,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
    )
    return {"status": "success", **result}


@router.get("/download-excel")
async def download_excel(filename: str, background_tasks: BackgroundTasks):
    output_dir = os.getenv("EXCEL_OUTPUT_DIR", "output_excels")
    safe_filename = os.path.basename(filename)
    file_path = os.path.join(output_dir, safe_filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    # Delete the server's copy once it's fully streamed to the client —
    # this file only ever needs to exist long enough to reach HR's machine,
    # not persist on the backend afterward.
    background_tasks.add_task(os.remove, file_path)
    return FileResponse(
        file_path,
        filename=safe_filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        background=background_tasks,
    )


@router.delete("/hr/employee/{employee_id}")
async def delete_employee_record(employee_id: str, actor_email: Optional[str] = None):
    """Hard-delete an employee and all their data (HR only)."""
    result = await delete_employee(employee_id)
    if result.get("status") != "success":
        raise HTTPException(status_code=500, detail=result.get("message", "Delete failed"))
    await write_audit_event(
        event_type="EMPLOYEE_DELETED",
        actor=actor_email or "HR",
        employee_id=employee_id,
        payload={"deleted_employee_id": employee_id},
    )
    return {"status": "success", "message": f"Employee {employee_id} deleted"}


_MAX_UPLOAD_BYTES = 15 * 1024 * 1024  # 15 MB
_ALLOWED_EXTENSIONS = {".pdf", ".docx"}
_MAGIC_BYTES = {
    ".pdf": b"%PDF",
    ".docx": b"PK\x03\x04",  # DOCX is a ZIP archive
}


def _validate_upload(file: UploadFile, file_bytes: bytes) -> Optional[str]:
    """Returns an error message string if invalid, else None."""
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in _ALLOWED_EXTENSIONS:
        return f"Unsupported file type '{ext}'. Only PDF and DOCX are allowed."
    if len(file_bytes) > _MAX_UPLOAD_BYTES:
        return f"File too large ({len(file_bytes) // (1024*1024)}MB). Maximum allowed size is 15MB."
    expected_magic = _MAGIC_BYTES.get(ext)
    if expected_magic and not file_bytes.startswith(expected_magic):
        return f"File content does not match the declared type '{ext}'. Upload a valid {ext.upper()} file."
    return None


@router.post("/upload-resume")
async def upload_resume(
    file: UploadFile = File(...),
    employee_id: str = Form(...),
    employee_email: str = Form(None),
):
    from services.agent_runner import run_agent

    file_path = None
    try:
        file_bytes = await file.read()
        validation_error = _validate_upload(file, file_bytes)
        if validation_error:
            return {"status": "error", "message": validation_error}

        suffix = os.path.splitext(file.filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(file_bytes)
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


