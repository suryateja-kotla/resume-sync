from fastapi import APIRouter, UploadFile, File, Form
import base64
import logging
from services.agent_runner import run_agent
from tools.docx_tools import DocxTool

router = APIRouter()
logger = logging.getLogger(__name__)
_docx_tool = DocxTool()


@router.get("/health")
async def health_check():
    return {"status": "ok"}


@router.post("/upload-resume")
async def upload_resume(
    file: UploadFile = File(...),
    employee_id: str = Form(...),
    employee_email: str = Form(None),
):
    try:
        # 1. Save file locally
        # os.makedirs(UPLOAD_DIR, exist_ok=True)
        # file_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}_{file.filename}")

        # with open(file_path, "wb") as buffer:
        #     shutil.copyfileobj(file.file, buffer)

        # Read file
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
    # finally:
    #     if os.path.exists(file_path):
    #         os.remove(file_path)
