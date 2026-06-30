# Auth & Core API — Backend

> Part of: [Backend Specs Index](INDEX.md)

---

## Application Entry Point

**File:** `backend/main.py`

```python
# Key responsibilities:
# 1. Create FastAPI app
# 2. Add CORS middleware (origins: frontend URL)
# 3. Include API router from routes.py
# 4. Lifespan: start monthly_scheduler on startup
```

**CORS config:**
- Allow origins: `http://localhost:5173` (Vite dev), production frontend URL
- Allow methods: `GET, POST, PUT, DELETE`
- Allow headers: `*`

---

## Authentication

### `POST /api/login`
**Status:** Implemented  
**File:** `backend/routes/routes.py`

**Design:** Email-only login — no password. Identity is confirmed by email existing in `employee_data`.

**Request:**
```json
{ "email": "string" }
```

**Behavior:**
1. Validate email format.
2. Query `employee_data` by email.
3. If not found → 401: `{ "detail": "Email not registered in the system" }`.
4. Determine role:
   - If `email` is in `settings.HR_EMAILS` list → `role = "HR"`.
   - Else if `department == "HR"` → `role = "HR"`.
   - Else → `role = "EMPLOYEE"`.
5. Write audit event: `LOGIN`.
6. Return user object.

**Response (200):**
```json
{
  "success": true,
  "role": "EMPLOYEE | HR",
  "employee_id": "EMP001",
  "name": "John Doe",
  "email": "john@example.com"
}
```

**Session handling:** Currently stateless — no server-side session token issued. Frontend stores user in `localStorage` via `AuthContext`. For production, consider issuing a JWT.

---

## Employee Profile Endpoints

### `GET /api/employee-profile`
**Status:** Implemented  
**File:** `backend/routes/routes.py`

**Query params:** `email=string`

**Behavior:**
1. Fetch `employee_data` by email → core fields.
2. Fetch `employee_resume_data` by email → full resume data.
3. Merge both documents.
4. Return combined profile.

**Response:** Full merged document (see `employee_resume_data` schema in [Architecture & Database](01_architecture_and_database.md)).

---

### `PUT /api/employee-profile`
**Status:** Implemented  
**File:** `backend/routes/routes.py`  
**Schema:** `backend/schemas/schemas.py` — `EmployeePayload`

**Request body:** Partial `EmployeePayload`. Only provided fields are updated.

**Special flag:**
- `regenerate_resume: bool` (default `false`) — if `true`, triggers `generate_resume_docx` after saving.

**Behavior:**
1. Validate payload via Pydantic.
2. Upsert `employee_data` (personal_info fields).
3. Upsert `employee_resume_data` (skills, experience, certs, etc.).
4. If `regenerate_resume=true`:
   - Call `generate_resume_docx(updated_data, new_path)`.
   - Increment version in `resume_store` with trigger `MANUAL_EDIT`.
5. Write audit event `PROFILE_UPDATED`.
6. Return updated profile.

**Response:**
```json
{ "success": true, "profile": { "...updated employee_resume_data..." } }
```

---

## Pydantic Schemas

**File:** `backend/schemas/schemas.py`

| Schema | Used by | Purpose |
|---|---|---|
| `LoginRequest` | `POST /api/login` | `email: str` |
| `LoginResponse` | `POST /api/login` | `success, role, employee_id, name, email` |
| `EmployeePayload` | `PUT /api/employee-profile` | Full profile update body |
| `PersonalInfo` | nested in EmployeePayload | Core identity fields |
| `WorkExperience` | nested list | Per-project data |
| `Education` | nested list | Degree + university |
| `CandidateSearchRequest` | `POST /api/search-candidates` | `query: str, email: str` |
| `ResumeStoreDocument` | internal | Maps to `resume_store` collection |
| `AuditEventDocument` | internal | Maps to `audit_data` collection |

---

## Health Check

### `GET /api/health`
**Status:** Implemented

**Response:**
```json
{ "status": "ok", "timestamp": "2025-06-29T09:21:00Z" }
```

Used by load balancer / uptime monitoring.

---

## Agent Runner Service

**File:** `backend/services/agent_runner.py`  
**Status:** Implemented

**Responsibilities:**
- Creates Google ADK `Runner` instance with configured agents.
- Manages `InMemorySessionService` (one session per `(user_id, session_id)` pair).
- Streams ADK events and extracts final text/JSON response.
- Wraps execution in OpenTelemetry span for tracing.

**Current gap:** `InMemorySessionService` means all sessions are lost on app restart. For production, replace with a MongoDB-backed or Redis-backed session service.

See [TODO](TODO_missing_implementations.md#p2-persistent-session-store).

---

## DB Service

**File:** `backend/services/db_service.py`  
**Status:** Implemented (core functions), several missing

### Implemented functions
| Function | Collection | Operation |
|---|---|---|
| `get_employee_by_email(email)` | `employee_data` | findOne |
| `upsert_employee_data(data)` | `employee_data` | updateOne + upsert |
| `save_employee_resume_data(data)` | `employee_resume_data` | updateOne + upsert |
| `get_resume_path(email)` | `resume_store` | findOne |
| `upsert_resume_path(email, path, version, trigger)` | `resume_store` | updateOne + push to versions[] |

### Missing functions (needed)
| Function | Purpose | Priority |
|---|---|---|
| `get_all_employees()` | Returns all `{email, name, employee_id}` for scheduler | P0 |
| `write_audit_event(event_dict)` | Inserts into `audit_data` | P0 |
| `get_skill_summary()` | Aggregation for HR skill racks | P1 |
| `get_skill_employees(skill)` | Employees with a given skill | P1 |
| `get_employees_paginated(filters, page, size)` | HR employee list with filters | P1 |
| `store_update_token(employee_id, token, expiry_days)` | Token persistence | P3 |
| `validate_update_token(token)` | Token lookup + expiry check | P3 |
| `consume_update_token(token)` | Mark token as used | P3 |

See [TODO](TODO_missing_implementations.md) for full priority breakdown.
