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
    write_audit_event,
)
from instructions.extraction_instruction import EXTRACTION_INSTRUCTION

logger = logging.getLogger(__name__)

_USE_VERTEXAI = os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "false").lower() == "true"

if _USE_VERTEXAI:
    client = genai.Client(
        vertexai=True,
        project=os.getenv("GOOGLE_CLOUD_PROJECT"),
        location=os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1"),
    )
else:
    client = genai.Client(
        api_key=os.getenv("GOOGLE_API_KEY"),
    )

def _extract_pdf_text(file_path: str) -> str:
    """
    Extract text from a PDF preserving reading order for both single-column
    and two-column layouts.

    For two-column layouts (sidebar + main content): sends the main/right
    column first (professional experience, projects, etc.) followed by the
    sidebar sections (skills, certifications, education, etc.) clearly
    labelled, so Gemini receives all content without interleaving.

    For single-column layouts: returns full linear text unchanged.
    """
    import fitz

    doc = fitz.open(file_path)
    all_pages_right = []
    all_pages_left = []
    is_two_column = False

    for page in doc:
        page_width = page.rect.width
        col_boundary = page_width * 0.35
        blocks = page.get_text("blocks")  # (x0,y0,x1,y1,text,block_no,block_type)
        text_blocks = [b for b in blocks if b[6] == 0]

        left = [b for b in text_blocks if b[0] < col_boundary]
        right = [b for b in text_blocks if b[0] >= col_boundary]

        if left and right:
            is_two_column = True

        right.sort(key=lambda b: (b[1], b[0]))
        left.sort(key=lambda b: (b[1], b[0]))

        for b in right:
            t = b[4].strip()
            if t:
                all_pages_right.append(t)
        for b in left:
            t = b[4].strip()
            if t:
                all_pages_left.append(t)

    doc.close()

    if not is_two_column:
        # Single-column: just return full text linearly
        doc2 = fitz.open(file_path)
        full = "\n".join(page.get_text() for page in doc2)
        doc2.close()
        return full

    # Two-column: main content first, then sidebar (skills/certs/education)
    parts = []
    if all_pages_right:
        parts.append("\n".join(all_pages_right))
    if all_pages_left:
        parts.append("\n--- SIDEBAR (Skills, Certifications, Education, etc.) ---\n")
        parts.append("\n".join(all_pages_left))
    return "\n".join(parts)


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
            extracted_text = _extract_pdf_text(file_path)

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

        # Ensure project_description is always present (Gemini sometimes omits it)
        for we in extracted.get("work_experience", []):
            proj = we.get("project")
            if isinstance(proj, dict) and "project_description" not in proj:
                proj["project_description"] = ""

        # Drop company-header duplicate entries that Gemini creates when a resume
        # lists a company header line above each project block. Those entries have
        # no responsibilities and project.name == designation (the fallback we set).
        if isinstance(extracted.get("work_experience"), list):
            def _is_header_stub(entry: dict) -> bool:
                proj = entry.get("project", {})
                proj_name = (proj.get("name") or "").strip()
                designation = (entry.get("designation") or "").strip()
                responsibilities = proj.get("responsibilities") or []
                return proj_name == designation and len(responsibilities) == 0
            extracted["work_experience"] = [
                e for e in extracted["work_experience"]
                if not _is_header_stub(e)
            ]

        payload = EmployeePayload(**extracted)
        await save_employee_resume_data(
            employee_id,
            payload.model_dump(),
            payload.work_experience[0].designation if payload.work_experience else None,
        )
        await write_audit_event(
            event_type="RESUME_UPLOAD",
            actor=employee_id,
            employee_id=employee_id,
            payload={"file_path": file_path},
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

        await write_audit_event(
            event_type="RESUME_REGENERATED",
            actor=employee_id,
            employee_id=employee_id,
            payload={"resume_path": gen_result["data"]},
        )

        return {"status": "success", "resume_path": gen_result["data"]}

    except Exception as e:
        return {"status": "error", "message": f"Resume generation failed: {str(e)}"}
