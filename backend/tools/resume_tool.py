import os
import json
import asyncio
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

def _detect_scanned_pages(file_path: str) -> list[int]:
    """Return list of 0-based page indices that have no extractable text blocks."""
    import fitz
    doc = fitz.open(file_path)
    scanned = []
    for i, page in enumerate(doc):
        text_blocks = [b for b in page.get_text("blocks") if b[6] == 0 and b[4].strip()]
        if not text_blocks:
            scanned.append(i)
    doc.close()
    return scanned


def _render_page_as_image_part(file_path: str, page_index: int) -> dict:
    """Render a single PDF page as a PNG and return a Gemini inline_data part."""
    import fitz
    import base64
    doc = fitz.open(file_path)
    page = doc[page_index]
    pix = page.get_pixmap(dpi=150)
    img_bytes = pix.tobytes("png")
    doc.close()
    return {
        "inline_data": {
            "mime_type": "image/png",
            "data": base64.b64encode(img_bytes).decode("utf-8"),
        }
    }


def _build_pdf_contents(file_path: str, employee_id: str) -> list:
    """
    Build Gemini content parts for a PDF.
    - Text pages: extracted as structured text (existing flow).
    - Scanned/image pages: rendered as PNG and sent via vision.
    Returns a list of parts for the Gemini message.
    """
    import fitz

    scanned_pages = _detect_scanned_pages(file_path)
    doc = fitz.open(file_path)
    total_pages = doc.page_count
    doc.close()

    parts = []

    if not scanned_pages:
        # All pages have text — use existing text extraction flow entirely
        extracted_text = _extract_pdf_text(file_path)
        parts.append({
            "text": f"{EXTRACTION_INSTRUCTION}\nUse employee_id: {employee_id}\n\nResume Text:\n{extracted_text}"
        })
        return parts

    # Mixed or fully scanned — build per-page parts
    text_page_indices = [i for i in range(total_pages) if i not in scanned_pages]

    if text_page_indices:
        # Extract text only from text pages
        import fitz as fitz2
        doc2 = fitz2.open(file_path)
        text_parts = []
        for i in text_page_indices:
            page_text = doc2[i].get_text().strip()
            if page_text:
                text_parts.append(f"[Page {i+1}]\n{page_text}")
        doc2.close()
        if text_parts:
            parts.append({
                "text": f"{EXTRACTION_INSTRUCTION}\nUse employee_id: {employee_id}\n\nResume Text (text pages):\n" + "\n\n".join(text_parts)
            })
    else:
        # Fully scanned — instruction goes as first text part
        parts.append({
            "text": f"{EXTRACTION_INSTRUCTION}\nUse employee_id: {employee_id}\n\nThis resume is image-based. Extract all information from the page images below:"
        })

    # Append scanned pages as images
    for page_index in scanned_pages:
        parts.append(_render_page_as_image_part(file_path, page_index))

    return parts


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


_GEMINI_TIMEOUT = int(os.getenv("GEMINI_TIMEOUT_SECONDS", "60"))
_GEMINI_MAX_RETRIES = int(os.getenv("GEMINI_MAX_RETRIES", "3"))


async def _call_gemini_with_retry(contents: list) -> str:
    """
    Call Gemini asynchronously with timeout and retry logic.
    - Uses client.aio.models.generate_content (true async, no thread pool).
    - Retries up to _GEMINI_MAX_RETRIES times on timeout or transient errors.
    - Each attempt has a _GEMINI_TIMEOUT second deadline.
    - Raises the last exception if all attempts fail.
    """
    last_error = None
    for attempt in range(1, _GEMINI_MAX_RETRIES + 1):
        try:
            response = await asyncio.wait_for(
                client.aio.models.generate_content(
                    model=os.getenv("MODEL", "gemini-2.5-flash"),
                    contents=contents,
                ),
                timeout=_GEMINI_TIMEOUT,
            )
            return response.text
        except asyncio.TimeoutError:
            last_error = f"Gemini timed out after {_GEMINI_TIMEOUT}s (attempt {attempt}/{_GEMINI_MAX_RETRIES})"
            logger.warning(last_error)
        except Exception as e:
            err_str = str(e)
            last_error = f"Gemini error on attempt {attempt}/{_GEMINI_MAX_RETRIES}: {err_str}"
            logger.warning(last_error)
            # Don't retry on quota/auth errors — they won't recover
            if any(code in err_str for code in ("PERMISSION_DENIED", "INVALID_ARGUMENT", "API_KEY")):
                raise
        if attempt < _GEMINI_MAX_RETRIES:
            await asyncio.sleep(2 ** attempt)  # exponential backoff: 2s, 4s
    raise RuntimeError(f"Gemini failed after {_GEMINI_MAX_RETRIES} attempts. Last error: {last_error}")


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
            pdf_parts = _build_pdf_contents(file_path, employee_id)
            raw_text = await _call_gemini_with_retry([{"role": "user", "parts": pdf_parts}])

        elif file_extension == ".docx":
            extracted_text = _docx_tool.parse_docx_bytes(file_path)
            raw_text = await _call_gemini_with_retry([
                {
                    "role": "user",
                    "parts": [{"text": f"{EXTRACTION_INSTRUCTION}\nUse employee_id: {employee_id}\n\nResume Text:\n{extracted_text}"}],
                }
            ])

        else:
            return {
                "status": "error",
                "message": f"Unsupported file type: {file_extension}",
            }

        raw_text = raw_text.strip()

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
