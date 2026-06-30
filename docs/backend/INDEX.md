# Backend Specs — Index

> Resume Management & Employee Skills Portal  
> Tech Stack: Python · FastAPI · Google ADK (Gemini 2.5 Flash) · MongoDB · FastMCP · OpenTelemetry

---

## Feature Specs

| File | Topic | Status |
|---|---|---|
| [01_architecture_and_database.md](01_architecture_and_database.md) | System architecture diagram, all 4 MongoDB collection schemas, layer responsibilities | Implemented |
| [02_resume_ingestion.md](02_resume_ingestion.md) | Resume upload API, ingestion agent, PDF/DOCX extraction, skill normalizer | Implemented |
| [03_resume_generation.md](03_resume_generation.md) | DOCX generation, org template sections, file storage, version history, PDF download | Partial |
| [04_email_and_scheduler.md](04_email_and_scheduler.md) | Monthly scheduler, scheduler agent, email service, token management, update form API | Partial |
| [05_hr_talent_search.md](05_hr_talent_search.md) | Query agent, conversational search, skill rack endpoints, Excel report | Partial |
| [06_auth_and_api.md](06_auth_and_api.md) | Login, employee profile GET/PUT, Pydantic schemas, agent runner, db_service | Implemented |
| [07_observability_and_config.md](07_observability_and_config.md) | All config settings, .env template, OpenTelemetry + Langfuse tracing, MCP server | Implemented |

---

## What Still Needs to Be Built

| File | Topic |
|---|---|
| [TODO_missing_implementations.md](TODO_missing_implementations.md) | All 15 missing features, grouped P0→P3, with exact files to modify and code snippets |

---

## Quick Priority Reference

| Priority | Count | Blocking |
|---|---|---|
| P0 | 3 items | Core flows broken without these (download, audit, monthly update) |
| P1 | 5 items | HR dashboard non-functional without these |
| P2 | 4 items | Production readiness (PDF, session store, validation, version history) |
| P3 | 3 items | Enhancements (token DB, Excel filters, db helper) |
