import os
import shutil
import tempfile
from fastapi import APIRouter, UploadFile, File, Form
import logging
from services.agent_runner import run_agent
from schemas.schemas import SearchRequest

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/health")
async def health_check():
    return {"status": "ok"}


@router.post("/search-employees")
async def search_employee(request: SearchRequest):
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
    try:
        # 1. Save file locally
        suffix = os.path.splitext(file.filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            shutil.copyfileobj(file.file, tmp)
            file_path = tmp.name
        # Send to agent
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
        if os.path.exists(file_path):
            os.remove(file_path)
