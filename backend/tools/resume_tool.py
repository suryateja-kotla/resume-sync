import os
import json
import vertexai
from vertexai.generative_models import GenerativeModel, Part
from dotenv import load_dotenv
import logging
from tools.docx_tools import DocxTool
from tools.normalizer import ResumeNormalizer
from schemas.schemas import EmployeePayload
from instructions.extraction_instruction import EXTRACTION_INSTRUCTION

load_dotenv()
logger = logging.getLogger(__name__)
vertexai.init(
    project=os.getenv("GOOGLE_CLOUD_PROJECT"),
    location=os.getenv("GOOGLE_CLOUD_LOCATION"),
)

_docx_tool = DocxTool()
_normalizer = ResumeNormalizer()
_TEMPLATE_PATH = os.getenv(
    "RESUME_TEMPLATE_PATH", "templates/sample_resume_template.docx"
)
_OUTPUT_DIR = os.getenv("RESUME_OUTPUT_DIR", "output")


def extract_resume(
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
        model = GenerativeModel(
            os.getenv("MODEL", "gemini-2.5-flash"),
        )
        file_extension = os.path.splitext(file_path)[1].lower()

        if file_extension == ".pdf":
            with open(file_path, "rb") as f:
                file_bytes = f.read()

            response = model.generate_content(
                [
                    Part.from_data(
                        data=file_bytes,
                        mime_type="application/pdf",
                    ),
                    f"{EXTRACTION_INSTRUCTION}\nUse employee_id: {employee_id}",
                ]
            )
        elif file_extension == ".docx":
            extracted_text = _docx_tool.parse_docx_bytes(file_path)
            response = model.generate_content(
                f"{EXTRACTION_INSTRUCTION}\nUse employee_id: {employee_id}\n\nResume Text:\n{extracted_text}"
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

        payload = EmployeePayload(**extracted)
        return {"status": "success", "data": payload.model_dump()}

    except json.JSONDecodeError as e:
        return {"status": "error", "message": f"Gemini returned invalid JSON: {str(e)}"}
    except Exception as e:
        return {"status": "error", "message": f"Extraction failed: {str(e)}"}


def generate_resume_docx(employee_payload_dict: dict) -> dict:
    """
    Generate a formatted .docx resume from structured employee data.

    Args:
        employee_payload_dict: A dict matching the EmployeePayload schema.
                               This is the 'data' field returned by extract_resume function.

    Returns:
        A dict with:
          - status:      "success" or "error"
          - resume_path: Absolute path to the generated .docx file (on success)
          - message:     Error reason (on error)
    """
    if "data" in employee_payload_dict and "status" in employee_payload_dict:
        employee_payload_dict = employee_payload_dict["data"]
    try:
        # Validate and coerce the dict into a typed payload
        payload = EmployeePayload(**employee_payload_dict)

        if not payload.employee_id:
            return {
                "status": "error",
                "message": "employee_id is required to generate resume",
            }

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
