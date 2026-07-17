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
    get_resume_path,
)
from services.gcs_service import upload_resume, delete_resume
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


def _parse_gemini_json(raw: str) -> dict:
    """
    Parse JSON from Gemini output, tolerating common LLM formatting issues:
    - Markdown code fences (```json ... ```)
    - Trailing commas before } or ]  (JSON spec violation Gemini sometimes emits)
    - Truncated output (finds the last valid closing brace)
    """
    import re

    # Strip markdown fences
    text = raw.strip()
    text = re.sub(r'^```(?:json)?\s*', '', text)
    text = re.sub(r'\s*```$', '', text)
    text = text.strip()

    # Remove trailing commas before } or ] (e.g. ,\n} or ,})
    text = re.sub(r',\s*([}\]])', r'\1', text)

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Truncated JSON — try to close open braces/brackets and re-parse
        # Count unmatched openers and append the right closers
        opens = []
        in_string = False
        escape = False
        for ch in text:
            if escape:
                escape = False
                continue
            if ch == '\\' and in_string:
                escape = True
                continue
            if ch == '"':
                in_string = not in_string
                continue
            if in_string:
                continue
            if ch in ('{', '['):
                opens.append('}' if ch == '{' else ']')
            elif ch in ('}', ']') and opens:
                opens.pop()

        # Strip any trailing comma before we close
        repaired = text.rstrip().rstrip(',')
        for closer in reversed(opens):
            repaired += closer
        try:
            return json.loads(repaired)
        except json.JSONDecodeError:
            raise json.JSONDecodeError("Could not repair JSON from Gemini output", text, 0)


def _clean_extracted(extracted: dict, employee_id: str) -> dict:
    """Normalise raw Gemini output: set employee_id, sanitise keys, strip nulls, drop stubs."""
    extracted["employee_id"] = employee_id

    # Sanitise MongoDB-unsafe characters in technical_skills keys
    if isinstance(extracted.get("technical_skills"), dict):
        extracted["technical_skills"] = {
            str(k).replace(".", "_").replace("$", ""): v
            for k, v in extracted["technical_skills"].items()
        }

    # Replace all None values with empty strings so Pydantic is happy
    def _strip_nulls(data):
        if isinstance(data, dict):
            return {k: _strip_nulls(v) if v is not None else "" for k, v in data.items()}
        if isinstance(data, list):
            return [_strip_nulls(i) if i is not None else "" for i in data]
        return data

    extracted = _strip_nulls(extracted)

    # Sanitise education.cgpa — Gemini sometimes omits it or sends empty string
    for edu in extracted.get("education", []):
        if isinstance(edu, dict):
            raw_cgpa = edu.get("cgpa", 0.0)
            try:
                edu["cgpa"] = float(raw_cgpa) if raw_cgpa not in ("", None) else 0.0
            except (ValueError, TypeError):
                edu["cgpa"] = 0.0

    # Ensure project_description is always present
    for we in extracted.get("work_experience", []):
        proj = we.get("project")
        if isinstance(proj, dict) and "project_description" not in proj:
            proj["project_description"] = ""

    # Drop company-header stub entries Gemini creates above each project block.
    # A stub has: project.name == designation AND no responsibilities AND no
    # description AND no environment — all four must be true to avoid dropping
    # real fresher entries where Gemini uses designation as project.name fallback.
    if isinstance(extracted.get("work_experience"), list):
        def _is_header_stub(entry: dict) -> bool:
            proj = entry.get("project", {})
            proj_name = (proj.get("name") or "").strip()
            designation = (entry.get("designation") or "").strip()
            responsibilities = proj.get("responsibilities") or []
            description = (proj.get("project_description") or "").strip()
            environment = proj.get("environment") or []
            return (
                proj_name == designation
                and len(responsibilities) == 0
                and not description
                and len(environment) == 0
            )
        extracted["work_experience"] = [
            e for e in extracted["work_experience"] if not _is_header_stub(e)
        ]

    return extracted


def _missing_fields(extracted: dict) -> list[str]:
    """Return names of critical fields that are empty after extraction."""
    missing = []
    if not (extracted.get("personal_info") or {}).get("full_name", "").strip():
        missing.append("personal_info.full_name")
    if not extracted.get("work_experience"):
        missing.append("work_experience")
    if not extracted.get("technical_skills"):
        missing.append("technical_skills")
    if not extracted.get("profile_summary", "").strip():
        missing.append("profile_summary")
    return missing


_RETRY_INSTRUCTION_SUFFIX = """
IMPORTANT: The previous extraction attempt returned empty or missing values for: {missing}.
Look carefully through ALL text AND every embedded image for this information.
For technical_skills: check every image, table, sidebar, and list — skill data is often in image form.
For work_experience: re-check whether the resume actually states a project name and/or client
for each entry — if it does, extract it. If the resume genuinely does not mention one, leave it
as an empty string; do not invent or substitute a value.
Do NOT return empty arrays or empty objects for these fields.
"""


async def extract_resume(
    employee_id: str,
    file_path: str = "",
) -> dict:
    """
    Extracts structured data from a resume file (PDF or DOCX) located at file_path.
    Validates critical fields after extraction and retries with a targeted prompt
    if any are missing, before saving to the database.
    """
    if not file_path or not os.path.exists(file_path):
        return {
            "status": "error",
            "message": f"File path {file_path} not found or invalid.",
        }

    try:
        file_extension = os.path.splitext(file_path)[1].lower()

        # ── Build the Gemini content parts (reused across retries) ──────────
        if file_extension == ".pdf":
            base_parts = _build_pdf_contents(file_path, employee_id)

        elif file_extension == ".docx":
            extracted_text = _docx_tool.parse_docx_bytes(file_path)
            embedded_images = _docx_tool.extract_embedded_images(file_path)
            base_parts = [
                {"text": f"{EXTRACTION_INSTRUCTION}\nUse employee_id: {employee_id}\n\nResume Text:\n{extracted_text}"}
            ]
            if embedded_images:
                base_parts.append({
                    "text": "The resume also contains the following embedded images "
                            "(e.g. skill tables, charts). Extract any additional information from them:"
                })
                base_parts.extend(embedded_images)

        else:
            return {"status": "error", "message": f"Unsupported file type: {file_extension}"}

        # ── First extraction attempt ─────────────────────────────────────────
        raw_text = await _call_gemini_with_retry([{"role": "user", "parts": base_parts}])
        extracted = _clean_extracted(_parse_gemini_json(raw_text), employee_id)

        # ── Validate — retry once if critical fields are missing ─────────────
        missing = _missing_fields(extracted)
        if missing:
            logger.warning(f"[{employee_id}] Missing fields after first extraction: {missing}. Retrying...")
            retry_suffix = _RETRY_INSTRUCTION_SUFFIX.format(missing=", ".join(missing))
            retry_parts = list(base_parts)
            # Prepend retry note to the first text part
            retry_parts[0] = {
                "text": retry_parts[0]["text"] + "\n\n" + retry_suffix
            }
            raw_text2 = await _call_gemini_with_retry([{"role": "user", "parts": retry_parts}])
            extracted2 = _clean_extracted(_parse_gemini_json(raw_text2), employee_id)

            # Merge: use retry result for fields that were missing, keep original for the rest
            for field in missing:
                top_key = field.split(".")[0]
                if extracted2.get(top_key):
                    extracted[top_key] = extracted2[top_key]
                    logger.info(f"[{employee_id}] Recovered '{top_key}' on retry.")

            still_missing = _missing_fields(extracted)
            if still_missing:
                logger.warning(f"[{employee_id}] Still missing after retry: {still_missing}")

        # ── Save to DB ───────────────────────────────────────────────────────
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

        return {"message": "Resume extracted and saved successfully."}

    except json.JSONDecodeError as e:
        return {"status": "error", "message": f"Gemini returned invalid JSON: {str(e)}"}
    except Exception as e:
        return {"status": "error", "message": f"Extraction failed: {str(e)}"}


async def generate_resume_docx(employee_id: str) -> dict:
    """
    Generate a formatted .docx resume from structured employee data and
    upload it to GCS under employee-resumes/{employee_id}/.
    Args: employee_id
    Returns:
        A dict with:
          - status:      "success" or "error"
          - resume_path: GCS blob name of the generated .docx file (on success)
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

        # Delete the old GCS blob if the filename will change
        # (e.g. designation changed → new filename → stale old blob)
        old_blob_name = await get_resume_path(employee_id)
        new_filename = _docx_tool._build_output_filename(norm_result["data"])
        if old_blob_name and os.path.basename(old_blob_name) != new_filename:
            try:
                delete_resume(old_blob_name)
                logger.info(f"[{employee_id}] Removed stale resume blob: {old_blob_name}")
            except Exception:
                pass  # Non-fatal — new file will still be saved correctly

        # Generate DOCX to a local temp path (always overwrites same filename
        # if designation unchanged), then upload it to GCS.
        gen_result = _docx_tool.generate_resume(
            template_path=_TEMPLATE_PATH,
            normalized_data=norm_result["data"],
            output_dir=_OUTPUT_DIR,
        )

        if gen_result["status"] == "error":
            return gen_result

        local_path = gen_result["data"]
        blob_name = upload_resume(local_path, employee_id, new_filename)
        os.remove(local_path)

        await write_audit_event(
            event_type="RESUME_REGENERATED",
            actor=employee_id,
            employee_id=employee_id,
            payload={"resume_path": blob_name},
        )

        return {"status": "success", "resume_path": blob_name}

    except Exception as e:
        return {"status": "error", "message": f"Resume generation failed: {str(e)}"}
