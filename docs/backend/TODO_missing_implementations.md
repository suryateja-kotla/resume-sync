# TODO — Missing Backend Implementations

> Part of: [Backend Specs Index](INDEX.md)  
> Items are grouped by feature and ordered by priority: **P0** (blocks core flow) → **P3** (nice to have).

---

## P0 — Blocks Core User Flows

These are required for the application to work end-to-end.

---

### P0: Resume Download Endpoint

**What's missing:** No API endpoint for employees or HR to download the generated resume.

**Files to modify:**
- `backend/routes/routes.py` — add `GET /api/download-resume`
- `backend/services/db_service.py` — `get_resume_path(email)` already exists, just needs to be wired up

**What to implement:**
```python
@router.get("/download-resume")
async def download_resume(email: str, format: str = "docx"):
    path = await db_service.get_resume_path(email)
    if not path:
        raise HTTPException(404, "No resume found")
    if format == "pdf":
        pdf_path = convert_docx_to_pdf(path)   # see P2 below
        return FileResponse(pdf_path, media_type="application/pdf", filename="Resume.pdf")
    return FileResponse(path, media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document", filename="Resume.docx")
```

**Spec reference:** [Resume Generation](03_resume_generation.md#get-apidownload-resume)

---

### P0: Audit Write Operations

**What's missing:** `audit_data` collection schema is defined in `db/seed.py` but no function writes to it. Zero audit events are ever recorded.

**Files to modify:**
- `backend/services/db_service.py` — add `write_audit_event(event_dict)`
- `backend/routes/routes.py` — call `write_audit_event` after: login, resume upload, profile update, monthly update submission

**Function to add in `db_service.py`:**
```python
async def write_audit_event(employee_id: str, email: str, event_type: str, actor: str, payload: dict):
    event = {
        "event_id": str(uuid.uuid4()),
        "employee_id": employee_id,
        "email": email,
        "event_type": event_type,
        "actor": actor,
        "payload": payload,
        "timestamp": datetime.utcnow(),
        "ip_address": None
    }
    await db.audit_data.insert_one(event)
```

**Trigger points:**
| Route | Event Type |
|---|---|
| `POST /api/login` | `LOGIN` |
| `POST /api/upload-resume` | `RESUME_UPLOAD` |
| `PUT /api/employee-profile` | `PROFILE_UPDATED` |
| `POST /api/monthly-update` | `MONTHLY_UPDATE_SUBMITTED` |
| Scheduler email send | `EMAIL_SENT` |
| Resume regeneration | `RESUME_REGENERATED` |

**Spec reference:** [Architecture & Database](01_architecture_and_database.md#audit_data)

---

### P0: Monthly Update Endpoints

**What's missing:** No endpoints to validate the update token or accept the monthly update form submission. The scheduler sends emails with links but those links lead nowhere.

**Files to modify:**
- `backend/routes/routes.py` — add two endpoints
- `backend/services/db_service.py` — add token functions (see P3 below)

**Endpoints to add:**

`GET /api/monthly-update/verify-token?token={UUID}`
- Validate token exists + not expired + not already used
- Return pre-fill data for the form

`POST /api/monthly-update`
- Consume token
- Merge updates into `employee_resume_data`
- Regenerate resume DOCX
- Send confirmation email
- Write audit event

**Spec reference:** [Email & Scheduler](04_email_and_scheduler.md#monthly-update-api-endpoints)

---

## P1 — Required for HR Dashboard to Function

---

### P1: HR Skill Summary Endpoint

**What's missing:** No `GET /api/hr/skill-summary` endpoint. The HR dashboard Skill Racks view (cards with Java, .NET, Python headcount) cannot render without this.

**Files to modify:**
- `backend/routes/routes.py` — add endpoint
- `backend/services/db_service.py` — add `get_skill_summary()`

**Aggregation pipeline to implement:** See [HR Talent Search](05_hr_talent_search.md#get-apihrskill-summary) for the full pipeline.

---

### P1: HR Skill-Employees Endpoint

**What's missing:** No `GET /api/hr/skill-employees?skill=Java` endpoint. Clicking a skill rack card cannot show the employee list.

**Files to modify:**
- `backend/routes/routes.py` — add endpoint
- `backend/services/db_service.py` — add `get_skill_employees(skill: str)`

**Spec reference:** [HR Talent Search](05_hr_talent_search.md#get-apihrskill-employees)

---

### P1: HR Employee List Endpoint

**What's missing:** No `GET /api/hr/employees` endpoint for a paginated, filterable list of all employees.

**Files to modify:**
- `backend/routes/routes.py` — add endpoint
- `backend/services/db_service.py` — add `get_employees_paginated(filters, page, size)`

**Spec reference:** [HR Talent Search](05_hr_talent_search.md#get-apihremployees)

---

### P1: Confirmation Email After Monthly Update

**What's missing:** After an employee submits the monthly update form, no email is sent to confirm their resume was updated.

**Files to modify:**
- `backend/services/email_service.py` — add `send_confirmation_email(email, name)`
- `backend/templates/` — create `resume_update_confirmation.html`
- `backend/routes/routes.py` — call `send_confirmation_email` in `POST /api/monthly-update` handler

**Spec reference:** [Email & Scheduler](04_email_and_scheduler.md#send_confirmation_emailemail-name--missing)

---

### P1: Email HTML Template

**What's missing:** `backend/templates/resume_update_mail.html` is referenced in code but the file either doesn't exist or needs verification.

**File to create:** `backend/templates/resume_update_mail.html`

A working HTML template with:
- Employee name greeting
- Month/year context
- List of what to update
- CTA button linking to `{{ update_link }}`
- Expiry note

**Spec reference:** [Email & Scheduler](04_email_and_scheduler.md#email-template-html)

---

## P2 — Important Quality / Production-Readiness

---

### P2: PDF Generation from DOCX

**What's missing:** Resume download only supports DOCX. HR and employees may want PDF output.

**Files to modify:**
- `backend/tools/resume_tool.py` — add `convert_docx_to_pdf(docx_path: str) -> str`
- `backend/routes/routes.py` — wire into `GET /api/download-resume?format=pdf`

**Recommended approach:**
```python
# Windows/macOS:
from docx2pdf import convert
def convert_docx_to_pdf(docx_path: str) -> str:
    pdf_path = docx_path.replace(".docx", ".pdf")
    convert(docx_path, pdf_path)
    return pdf_path
```

**Dependency to add:** `docx2pdf` in `requirements.txt`

---

### P2: Persistent Session Store

**What's missing:** `agent_runner.py` uses `InMemorySessionService` from Google ADK. All agent sessions are lost when the server restarts, which causes the agent to lose context.

**Files to modify:**
- `backend/services/agent_runner.py` — replace `InMemorySessionService` with a MongoDB or Redis-backed session store

**Recommended approach:** Implement a custom session class that wraps a MongoDB collection, following the Google ADK `BaseSessionService` interface.

---

### P2: File Size and Type Validation

**What's missing:** The upload endpoint accepts any file. No server-side enforcement of 10 MB limit or MIME type check.

**Files to modify:**
- `backend/routes/routes.py` — add validation in `POST /api/upload-resume`

```python
ALLOWED_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword"
}
MAX_SIZE = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024

if file.content_type not in ALLOWED_TYPES:
    raise HTTPException(400, "Unsupported file type. Upload PDF or DOCX.")
content = await file.read()
if len(content) > MAX_SIZE:
    raise HTTPException(413, f"File exceeds {settings.MAX_UPLOAD_SIZE_MB} MB limit.")
```

---

### P2: Resume Version History Endpoint

**What's missing:** No `GET /api/resume-versions` endpoint. The frontend version history panel has nothing to call.

**Files to modify:**
- `backend/routes/routes.py` — add `GET /api/resume-versions?email=...`
- Response: list of `{ version, generated_at, trigger }` from `resume_store.versions[]`

**Spec reference:** [Resume Generation](03_resume_generation.md#get-apiresume-versions)

---

## P3 — Enhancements

---

### P3: Token Storage + Expiry for Monthly Update

**What's missing:** Monthly update tokens are generated in `scheduler_agent.py` but never stored to a database. If the server restarts, all tokens are lost and employee links become unverifiable.

**Files to modify:**
- `backend/services/db_service.py` — add `store_update_token`, `validate_update_token`, `consume_update_token`
- `backend/db/seed.py` — add `tokens` collection schema with `{ token, employee_id, email, created_at, expires_at, used, used_at }`

**Spec reference:** [Email & Scheduler](04_email_and_scheduler.md#token-management)

---

### P3: Excel Report Advanced Filters

**What's missing:** `GET /api/download-excel` is partially implemented. Advanced filters (date range, certification, role, location) are defined in the spec but not applied in the MongoDB query.

**Files to modify:**
- `backend/routes/routes.py` — build compound MongoDB filter from all query params
- `backend/tools/excel_tools.py` — add "Filters Applied" summary block to Excel header row

---

### P3: `get_all_employees` in db_service

**What's missing:** `scheduler_agent.py` needs to fetch all employees' emails and names, but `db_service` has no `get_all_employees()` function. The scheduler will fail at runtime.

**Files to modify:**
- `backend/services/db_service.py` — add:
```python
async def get_all_employees() -> list[dict]:
    cursor = db.employee_data.find({}, { "email": 1, "name": 1, "employee_id": 1, "_id": 0 })
    return await cursor.to_list(length=None)
```

---

## Summary Table

| ID | Feature | File(s) | Priority |
|---|---|---|---|
| 1 | Resume download endpoint (DOCX) | `routes.py`, `db_service.py` | P0 |
| 2 | Audit write operations | `db_service.py`, `routes.py` | P0 |
| 3 | Monthly update endpoints (verify + submit) | `routes.py`, `db_service.py` | P0 |
| 4 | HR skill summary endpoint | `routes.py`, `db_service.py` | P1 |
| 5 | HR skill-employees endpoint | `routes.py`, `db_service.py` | P1 |
| 6 | HR employee list endpoint | `routes.py`, `db_service.py` | P1 |
| 7 | Confirmation email | `email_service.py`, `templates/` | P1 |
| 8 | Email HTML template | `templates/resume_update_mail.html` | P1 |
| 9 | PDF generation from DOCX | `tools/resume_tool.py` | P2 |
| 10 | Persistent session store | `services/agent_runner.py` | P2 |
| 11 | File size + type validation | `routes.py` | P2 |
| 12 | Resume version history endpoint | `routes.py` | P2 |
| 13 | Token storage + expiry | `db_service.py`, `db/seed.py` | P3 |
| 14 | Excel advanced filters | `routes.py`, `tools/excel_tools.py` | P3 |
| 15 | `get_all_employees` in db_service | `db_service.py` | P3 |
