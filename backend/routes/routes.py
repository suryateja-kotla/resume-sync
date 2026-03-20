from fastapi import APIRouter, UploadFile, File, Form
import base64
import logging
from services.agent_runner import run_agent
from tools.docx_tools import DocxTool
from schemas.schemas import SearchRequest

router = APIRouter()
logger = logging.getLogger(__name__)
_docx_tool = DocxTool()


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
        contents = await file.read()
        logging.info(
            f"Received file: {file.filename} (size: {len(contents)} bytes) content_type: {file.content_type}"
        )
        if (
            file.content_type
            == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ):
            extracted_text = _docx_tool.parse_docx_bytes(contents)

            response = await run_agent(
                prompt={
                    "action": "ingest_resume",
                    "text_content": extracted_text,
                    "file_name": file.filename,
                    "employee_id": employee_id,
                    "employee_email": employee_email,
                },
                user_id=employee_id,
            )
            return response
        # Encode to base64
        encoded_file = base64.b64encode(contents).decode("utf-8")

        # Send to agent
        response = await run_agent(
            prompt={
                "action": "ingest_resume",
                "file_data": encoded_file,
                "mime_type": file.content_type,
                "file_name": file.filename,
                "employee_id": employee_id,
                "employee_email": employee_email,
            },
            user_id=employee_id,
        )

        return response

    except Exception as e:
        return {"status": "error", "message": str(e)}
