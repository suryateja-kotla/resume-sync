import os
import json
from google import genai
import logging
from tools.docx_tools import DocxTool
from tools.normalizer import ResumeNormalizer
from schemas.schemas import EmployeePayload
from services.db_service import (
    get_employee_resume_data,
    save_employee_resume_data,
)
from instructions.extraction_instruction import EXTRACTION_INSTRUCTION

logger = logging.getLogger(__name__)

client = genai.Client(
    # vertexai=True,
    # project=os.getenv("GOOGLE_CLOUD_PROJECT"),
    # location=os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1"),
    api_key=os.getenv("GOOGLE_API_KEY"),
)

_docx_tool = DocxTool()
_normalizer = ResumeNormalizer()
_TEMPLATE_PATH = os.getenv(
    "RESUME_TEMPLATE_PATH", "templates/sample_resume_template.docx"
)
_OUTPUT_DIR = os.getenv("RESUME_OUTPUT_DIR", "output")


async def extract_resume(
    employee_id: str,
    file_path: str = "",
) -> dict:
    """
    Extracts structured data from a resume file (PDF or DOCX) located at file_path.
    Args:
        employee_id: The unique employee ID to associate with the data.
        file_path: The absolute local path to the PDF or DOCX file.
    """
    if not file_path or not os.path.exists(file_path):
        return {
            "status": "error",
            "message": f"File path {file_path} not found or invalid.",
        }

    try:
        file_extension = os.path.splitext(file_path)[1].lower()

        if file_extension == ".pdf":
            with open(file_path, "rb") as f:
                file_bytes = f.read()

            response = client.models.generate_content(
                model=os.getenv("MODEL", "gemini-2.5-flash"),
                contents=[
                    {
                        "role": "user",
                        "parts": [
                            {
                                "inline_data": {
                                    "mime_type": "application/pdf",
                                    "data": file_bytes,
                                }
                            },
                            {
                                "text": f"{EXTRACTION_INSTRUCTION}\nUse employee_id: {employee_id}"
                            },
                        ],
                    }
                ],
            )

        elif file_extension == ".docx":
            extracted_text = _docx_tool.parse_docx_bytes(file_path)

            response = client.models.generate_content(
                model=os.getenv("MODEL", "gemini-2.5-flash"),
                contents=[
                    {
                        "role": "user",
                        "parts": [
                            {
                                "text": f"{EXTRACTION_INSTRUCTION}\nUse employee_id: {employee_id}\n\nResume Text:\n{extracted_text}"
                            }
                        ],
                    }
                ],
            )

        else:
            return {
                "status": "error",
                "message": f"Unsupported file type: {file_extension}",
            }

        raw_text = response.text.strip()

        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]
        raw_text = raw_text.strip()

        extracted = json.loads(raw_text)
        extracted["employee_id"] = employee_id
        if "technical_skills" in extracted and isinstance(extracted["technical_skills"], dict):
            clean_skills = {}
            for k, v in extracted["technical_skills"].items():
                clean_key = str(k).replace(".", "_").replace("$", "")
                clean_skills[clean_key] = v
            extracted["technical_skills"] = clean_skills

        # CRITICAL FIX 1.5: Strip all nulls to satisfy MongoDB's strict string schemas
        def replace_nulls_with_empty_string(data):
            if isinstance(data, dict):
                return {k: replace_nulls_with_empty_string(v) if v is not None else "" for k, v in data.items()}
            elif isinstance(data, list):
                return [replace_nulls_with_empty_string(i) if i is not None else "" for i in data]
            return data

        extracted = replace_nulls_with_empty_string(extracted)

        payload = EmployeePayload(**extracted)
        await save_employee_resume_data(
            employee_id,
            payload.model_dump(),
            payload.work_experience[0].designation if payload.work_experience else None,
        )

        return {
            "message": "Resume extracted and saved successfully.",
        }

    except json.JSONDecodeError as e:
        return {"status": "error", "message": f"Gemini returned invalid JSON: {str(e)}"}
    except Exception as e:
        return {"status": "error", "message": f"Extraction failed: {str(e)}"}


async def generate_resume_docx(employee_id: str) -> dict:
    """
    Generate a formatted .docx resume from structured employee data.
    Args: employee_id
    Returns:
        A dict with:
          - status:      "success" or "error"
          - resume_path: Absolute path to the generated .docx file (on success)
          - message:     Error reason (on error)
    """

    try:
        payload = await get_employee_resume_data(employee_id)
        if not payload:
            return {
                "status": "error",
                "message": f"No resume data found for employee_id {employee_id}",
            }
        payload = EmployeePayload(**payload)
        # Normalize to template format
        norm_result = _normalizer.normalize(payload)
        if norm_result["status"] == "error":
            return norm_result

        # Generate DOCX
        gen_result = _docx_tool.generate_resume(
            template_path=_TEMPLATE_PATH,
            normalized_data=norm_result["data"],
            employee_id=payload.employee_id,
            output_dir=_OUTPUT_DIR,
        )

        if gen_result["status"] == "error":
            return gen_result

        return {"status": "success", "resume_path": gen_result["data"]}

    except Exception as e:
        return {"status": "error", "message": f"Resume generation failed: {str(e)}"}
