# Resume Generation & Versioning — Backend

> Part of: [Backend Specs Index](INDEX.md)

---

## Overview

Resume generation happens at three trigger points:

| Trigger | When | Version Increment |
|---|---|---|
| `UPLOAD` | Employee uploads original resume | Yes — starts at v1 |
| `MONTHLY_UPDATE` | Employee submits monthly update form | Yes — v+1 |
| `MANUAL_EDIT` | Employee edits profile and saves with regenerate flag | Yes — v+1 |

The generated output is always an org-standard DOCX. PDF download is a conversion on demand.

---

## Generation Flow

```
employee_data dict (normalized, complete)
        │
        ▼
generate_resume_docx(employee_data, output_path)   [tools/resume_tool.py]
        │
        ▼
DocxTool.generate_resume(data, template_path, output_path)   [tools/docx_tools.py]
        │
        ├─ Open org DOCX template
        ├─ Replace placeholders / fill structured sections:
        │     ├─ Header block: Name, Designation, Email, Mobile, Location
        │     ├─ Professional Summary paragraph
        │     ├─ Technical Skills table (grouped by category)
        │     ├─ Work Experience blocks (one per project)
        │     ├─ Education table
        │     └─ Certifications table
        │
        └─ Save to output_path
                │
                ▼
        upsert_resume_path(email, path, version, trigger)   [services/db_service.py]
                │
                └─ Appends to resume_store.versions[]
                   Updates resume_store.current_resume_path
                   Increments resume_store.current_version
```

---

## Tool: `generate_resume_docx`

**File:** `backend/tools/resume_tool.py`

| Param | Type | Description |
|---|---|---|
| `employee_data` | `dict` | Full normalized employee data from extraction/DB |
| `output_path` | `str` | Absolute path where the DOCX should be saved |

**Returns:** `str` — the saved DOCX file path

**Internally calls:** `DocxTool.generate_resume(data, template_path, output_path)`

---

## DocxTool — Resume Generation

**File:** `backend/tools/docx_tools.py`  
**Class:** `DocxTool`  
**Method:** `generate_resume(data, template_path, output_path)`

### Template sections populated

| Section | Source field | Format |
|---|---|---|
| Name | `personal_info.name` | Bold heading |
| Designation | `personal_info.designation` | Sub-heading |
| Contact line | `email`, `mobile`, `location` | Single line |
| Professional Summary | `professional_summary` | Paragraph |
| Technical Skills | `skills[]` grouped by `category` | Table: Category \| Skills |
| Work Experience | `work_experience[]` per project | Block per project |
| Education | `education[]` | Table: Degree \| University \| Year |
| Certifications | `certifications[]` | Table: Name \| Provider \| Date |
| Achievements | `achievements[]` | Bulleted list |

### Work Experience block per project
```
Project Name: {project_name}           Client: {client_name}
Role:         {role}                   Domain: {domain}
Duration:     {start_date} – {end_date} ({duration})
Team Size:    {team_size}
Tech Stack:   {technology_stack joined by ", "}
Responsibilities:
  • {responsibility 1}
  • {responsibility 2}
```

---

## File Storage Convention

```
uploads/
└── {employee_id}/
    ├── original/
    │   └── {original_filename}.pdf/.docx
    └── generated/
        ├── resume_v1.docx
        ├── resume_v2.docx
        └── resume_v3.docx   ← current
```

`current_resume_path` in `resume_store` always points to the highest version file.

---

## Resume Version History

**Collection:** `resume_store`

```json
{
  "employee_id": "EMP001",
  "email": "employee@example.com",
  "current_version": 3,
  "current_resume_path": "uploads/EMP001/generated/resume_v3.docx",
  "versions": [
    { "version": 1, "file_path": "...resume_v1.docx", "generated_at": "2025-01-15T09:00:00", "trigger": "UPLOAD" },
    { "version": 2, "file_path": "...resume_v2.docx", "generated_at": "2025-02-24T09:30:00", "trigger": "MONTHLY_UPDATE" },
    { "version": 3, "file_path": "...resume_v3.docx", "generated_at": "2025-03-10T14:00:00", "trigger": "MANUAL_EDIT" }
  ]
}
```

---

## API Endpoints

### `GET /api/download-resume`
**Status:** Missing — needs implementation  
**File:** `backend/routes/routes.py`

**Query params:**
- `email=string`
- `format=docx|pdf` (default: `docx`)

**Behavior:**
1. Lookup `resume_store.current_resume_path` by email via `db_service.get_resume_path(email)`.
2. If `format=docx`: serve DOCX directly as `FileResponse`.
3. If `format=pdf`: convert DOCX → PDF using `docx2pdf` (or LibreOffice headless), serve result.
4. Set `Content-Disposition: attachment; filename="Resume_{name}.docx"`.

**Error cases:**
- Resume not yet generated → 404 with message "No resume found. Please upload your resume first."
- File missing on disk → 500 with logged error.

---

### `GET /api/resume-versions`
**Status:** Missing — needs implementation  
**File:** `backend/routes/routes.py`

**Query params:** `email=string`

**Response:**
```json
{
  "current_version": 3,
  "versions": [
    { "version": 1, "generated_at": "2025-01-15T09:00:00", "trigger": "UPLOAD" },
    { "version": 2, "generated_at": "2025-02-24T09:30:00", "trigger": "MONTHLY_UPDATE" },
    { "version": 3, "generated_at": "2025-03-10T14:00:00", "trigger": "MANUAL_EDIT" }
  ]
}
```

---

## Resume Completion Percentage

Calculated during ingestion and after every update. Stored in `employee_resume_data.resume_completion_percentage`.

**Scoring logic (suggested):**

| Section | Weight |
|---|---|
| Personal info complete (all 10 fields) | 20% |
| Professional summary present | 10% |
| At least 3 skills | 15% |
| At least 1 work experience entry | 25% |
| Education present | 10% |
| Certifications present | 10% |
| Achievements present | 10% |

Score is calculated as sum of weights for completed sections (0–100).

---

## PDF Generation (Missing)

**Status:** Not yet implemented  
**Recommended library:** `docx2pdf` (Windows/macOS) or `LibreOffice --headless` (Linux/cross-platform)

**Integration point:** `tools/resume_tool.py` — add `convert_docx_to_pdf(docx_path) -> str` function.

See [TODO](TODO_missing_implementations.md#p2-pdf-generation-from-docx).
