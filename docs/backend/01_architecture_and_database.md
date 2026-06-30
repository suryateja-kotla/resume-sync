# Architecture & Database — Backend

> Part of: [Backend Specs Index](INDEX.md)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FastAPI Application                         │
│  /api/*  routes  │  CORS Middleware  │  Lifespan (scheduler start)  │
└────────────────────────────┬────────────────────────────────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
   ┌──────▼──────┐   ┌───────▼──────┐   ┌──────▼──────────┐
   │  REST Layer │   │  Agent Layer │   │  Scheduler Layer │
   │  routes.py  │   │  Google ADK  │   │  monthly_sched.  │
   └──────┬──────┘   └───────┬──────┘   └──────┬──────────┘
          │                  │                  │
          │         ┌────────┴────────┐         │
          │         │   root_agent    │         │
          │         │  (orchestrator) │         │
          │         └───────┬─────────┘         │
          │         ┌───────┴─────────┐         │
          │   ┌─────▼──────┐  ┌───────▼──────┐  │
          │   │ingestion_  │  │ query_agent  │  │
          │   │  agent     │  │(talent srch) │  │
          │   └─────┬──────┘  └───────┬──────┘  │
          │         │                 │          │
   ┌──────▼─────────▼─────────────────▼──────────▼──────┐
   │                   Services Layer                     │
   │   db_service  │  agent_runner  │  email_service      │
   └──────────────────────┬─────────────────────────────┘
                          │
   ┌──────────────────────▼─────────────────────────────┐
   │                   MongoDB                           │
   │  employee_data │ employee_resume_data │ resume_store │
   │  audit_data                                         │
   └─────────────────────────────────────────────────────┘
```

**Entry point:** `backend/main.py`  
**Framework:** FastAPI + Uvicorn  
**AI layer:** Google ADK with Gemini 2.5 Flash  
**Database:** MongoDB via Motor (async driver)  
**MCP:** FastMCP for MongoDB tool execution inside agents

---

## Layer Responsibilities

| Layer | Files | Responsibility |
|---|---|---|
| REST Layer | `routes/routes.py` | HTTP request handling, validation, response shaping |
| Agent Layer | `agents/`, `instructions/` | AI orchestration, resume parsing, talent search |
| Scheduler Layer | `scheduler/` | Monthly timed email dispatch |
| Services Layer | `services/` | DB access, agent runner, email |
| Tools Layer | `tools/` | Document parsing, generation, Excel export |
| Config | `config/email_config.py` | All environment settings |
| Observability | `observability/tracer.py` | OpenTelemetry + Langfuse tracing |

---

## MongoDB Collections

### `employee_data`
Core employee identity, role, and bench status. Updated on login, profile edit, and monthly update.

```json
{
  "employee_id": "string (unique)",
  "name": "string",
  "email": "string (unique, indexed)",
  "mobile": "string",
  "designation": "string",
  "department": "string",
  "current_role": "string",
  "location": "string",
  "bench_status": "enum: BENCH | PROJECT",
  "joining_date": "date-string (YYYY-MM-DD)",
  "total_experience": "number (years)",
  "relevant_experience": "number (years)",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

**Indexes:** `email` (unique), `employee_id` (unique), `bench_status`, `department`

---

### `employee_resume_data`
Full structured resume data extracted from uploaded resume. Includes denormalized `search_tags` for fast talent queries.

```json
{
  "employee_id": "string",
  "email": "string",
  "personal_info": {
    "name": "string",
    "email": "string",
    "mobile": "string",
    "designation": "string",
    "department": "string",
    "current_role": "string",
    "location": "string",
    "total_experience": "number",
    "relevant_experience": "number",
    "joining_date": "string"
  },
  "professional_summary": "string",
  "skills": [
    {
      "category": "string (e.g. Programming Languages)",
      "name": "string (e.g. Python)",
      "proficiency": "enum: Beginner | Intermediate | Advanced | Expert",
      "years_of_experience": "number"
    }
  ],
  "work_experience": [
    {
      "project_name": "string",
      "client_name": "string",
      "role": "string",
      "domain": "string",
      "start_date": "string",
      "end_date": "string | null",
      "duration": "string",
      "team_size": "number",
      "technology_stack": ["string"],
      "responsibilities": ["string"]
    }
  ],
  "education": [
    {
      "degree": "string",
      "university": "string",
      "graduation_year": "number"
    }
  ],
  "certifications": [
    {
      "name": "string",
      "provider": "string",
      "completion_date": "string"
    }
  ],
  "achievements": ["string"],
  "interests": ["string"],
  "search_tags": ["string"],
  "resume_completion_percentage": "number (0–100)",
  "version": "number (integer, starts at 1)",
  "last_updated": "datetime",
  "created_at": "datetime"
}
```

**Indexes:** `email` (unique), `employee_id` (unique), `search_tags` (multikey), `skills.name`

---

### `resume_store`
Tracks generated resume file paths with full version history.

```json
{
  "employee_id": "string",
  "email": "string",
  "current_version": "number",
  "current_resume_path": "string (absolute file path)",
  "versions": [
    {
      "version": "number",
      "file_path": "string",
      "generated_at": "datetime",
      "trigger": "enum: UPLOAD | MONTHLY_UPDATE | MANUAL_EDIT"
    }
  ],
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

---

### `audit_data`
Immutable event log. Written on every significant action. Never updated — only appended.

```json
{
  "event_id": "string (UUID)",
  "employee_id": "string",
  "email": "string",
  "event_type": "enum: RESUME_UPLOAD | RESUME_REGENERATED | PROFILE_UPDATED | MONTHLY_UPDATE_SUBMITTED | EMAIL_SENT | LOGIN",
  "actor": "string (employee_id or 'SYSTEM')",
  "payload": "object (diff or context)",
  "timestamp": "datetime",
  "ip_address": "string | null"
}
```

**Note:** `audit_data` collection schema is defined in `db/seed.py` but write operations are not yet implemented in `db_service.py`. See [TODO](TODO_missing_implementations.md).

---

## Backend File Structure

```
backend/
├── main.py
├── requirements.txt
├── agents/
│   ├── root_agent.py
│   ├── ingestion_agent.py
│   └── query_agent.py
├── instructions/
│   ├── root_agent_instruction.py
│   ├── ingestion_agent_instruction.py
│   ├── query_agent_instruction.py
│   └── extraction_instruction.py
├── routes/
│   └── routes.py
├── services/
│   ├── db_service.py
│   ├── agent_runner.py
│   └── email_service.py
├── tools/
│   ├── resume_tool.py
│   ├── docx_tools.py
│   ├── excel_tools.py
│   └── normalizer.py
├── schemas/
│   └── schemas.py
├── db/
│   └── seed.py
├── scheduler/
│   ├── monthly_scheduler.py
│   └── scheduler_agent.py
├── config/
│   └── email_config.py
├── observability/
│   └── tracer.py
├── mongo_mcp/
│   ├── mongo_mcp_server.py
│   └── mcp_toolsets.py
└── templates/
    └── resume_update_mail.html
```
