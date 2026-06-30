# Observability & Configuration — Backend

> Part of: [Backend Specs Index](INDEX.md)

---

## Configuration

**File:** `backend/config/email_config.py`  
**Class:** `Settings` (Pydantic BaseSettings)  
**Loading:** From environment variables / `.env` file at project root.

### All Settings

| Variable | Type | Default | Purpose |
|---|---|---|---|
| `MONGO_URI` | str | — | MongoDB connection string |
| `DB_NAME` | str | — | MongoDB database name |
| `GEMINI_API_KEY` | str | — | Google Gemini API key for AI extraction |
| `EMAIL_MODE` | `"smtp" \| "console"` | `"console"` | Email delivery mode |
| `SMTP_HOST` | str | — | SMTP server hostname |
| `SMTP_PORT` | int | `587` | SMTP port (587 = TLS, 465 = SSL) |
| `SMTP_USER` | str | — | SMTP login email |
| `SMTP_PASSWORD` | str | — | SMTP password / app password |
| `FROM_EMAIL` | str | — | Sender display email |
| `SCHEDULER_DAY` | int | `24` | Day of month to fire scheduler |
| `SCHEDULER_HOUR` | int | `9` | Hour (24h, IST) to fire scheduler |
| `SCHEDULER_MINUTE` | int | `21` | Minute to fire scheduler |
| `FRONTEND_URL` | str | `http://localhost:5173` | Base URL for email links |
| `HR_EMAILS` | `list[str]` | `[]` | Emails with HR role |
| `MAX_UPLOAD_SIZE_MB` | int | `10` | Max allowed resume upload size |
| `GENERATED_RESUME_DIR` | str | `uploads/` | Root dir for generated DOCX files |

### `.env` file template
```env
MONGO_URI=mongodb://localhost:27017
DB_NAME=resume_sync
GEMINI_API_KEY=your-gemini-key-here

EMAIL_MODE=console
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=no-reply@yourorg.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=no-reply@yourorg.com

SCHEDULER_DAY=24
SCHEDULER_HOUR=9
SCHEDULER_MINUTE=21

FRONTEND_URL=http://localhost:5173
HR_EMAILS=["hr@yourorg.com","admin@yourorg.com"]
MAX_UPLOAD_SIZE_MB=10
GENERATED_RESUME_DIR=uploads
```

---

## Observability

**File:** `backend/observability/tracer.py`  
**Status:** Implemented (referenced in agent_runner)

### Stack
- **OpenTelemetry SDK** — standard trace/span instrumentation
- **Langfuse exporter** — LLM-specific observability (token counts, model, latency per call)

### What is traced

| Span Name | Wraps | Attributes |
|---|---|---|
| `agent_runner.run` | Full agent invocation | `employee_id`, `action_type`, `session_id` |
| `extract_resume` | Gemini extraction call | `file_type`, `token_count`, `duration_ms` |
| `generate_resume_docx` | DOCX generation | `employee_id`, `version`, `duration_ms` |
| `db.upsert_employee` | MongoDB write | `collection`, `operation` |

### Langfuse trace attributes
- `model` — `gemini-2.5-flash`
- `input_tokens` — prompt token count
- `output_tokens` — completion token count
- `latency_ms` — end-to-end LLM call duration
- `employee_id` — for filtering traces per employee

### Setup requirements
Langfuse credentials must be set in environment:
```env
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_HOST=https://cloud.langfuse.com
```

---

## MCP MongoDB Server

**File:** `backend/mongo_mcp/mongo_mcp_server.py`  
**Status:** Implemented

Runs a FastMCP server that exposes MongoDB operations as callable tools to agents. The `query_agent` uses this to execute `find`, `aggregate`, and `count_documents` without importing pymongo directly.

### Toolsets

**File:** `backend/mongo_mcp/mcp_toolsets.py`

| Toolset | Used by | Collections accessible |
|---|---|---|
| `query_agent_toolset` | `query_agent` | `employee_data`, `employee_resume_data` |
| `ingestion_agent_toolset` | `ingestion_agent` | `employee_data`, `employee_resume_data`, `resume_store` |

---

## Database Seeding

**File:** `backend/db/seed.py`

- Creates 4 MongoDB collections with strict JSON schema validation.
- Seeds 14 test employees with realistic data.
- Run manually: `python backend/db/seed.py`

**Collections created:** `employee_data`, `employee_resume_data`, `resume_store`, `audit_data`

---

## Logging

No structured logging library is currently configured. Recommended additions for production:

```python
import logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s"
)
```

Key log points to add:
- Resume upload received (file name, size, employee)
- Agent invocation start/end
- Scheduler fire time
- Email send success/failure per employee
- DB write success/failure
