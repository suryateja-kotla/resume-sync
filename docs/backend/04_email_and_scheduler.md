# Email & Monthly Scheduler — Backend

> Part of: [Backend Specs Index](INDEX.md)

---

## Overview

Every month the system automatically:
1. Triggers the scheduler at a configured date/time (IST).
2. Fetches all employees from MongoDB.
3. Generates a secure one-time update token per employee.
4. Sends a resume update reminder email with a tokenized link.
5. Employee clicks the link, fills the update form, submits.
6. System applies updates, regenerates resume, sends confirmation email.

---

## Monthly Update End-to-End Flow

```
[Scheduler fires — e.g., 24th of month, 9:21 AM IST]
        │
        ▼
SchedulerAgent.run()
        │
        ├─ db_service.get_all_employees() → [{ email, name, employee_id }]
        │
        └─ For each employee:
              ├─ Generate UUID token
              ├─ Store token in DB (tokens collection, 30-day expiry)
              ├─ Build link: {FRONTEND_URL}/monthly-update?token={UUID}
              └─ email_service.send_resume_update_email(email, name, link)
                        │
                        ├─ SMTP mode  → sends real email via SMTP
                        └─ CONSOLE mode → prints to stdout (dev)

[Employee clicks link in email]
        │
        ▼
GET /api/monthly-update/verify-token?token={UUID}
        │
        ├─ Validate token exists + not expired + not already used
        └─ Return { valid: true, employee: { name, email } }

[Employee submits update form]
        │
        ▼
POST /api/monthly-update
        │
        ├─ Validate + consume token (mark used)
        ├─ Apply updates to employee_resume_data
        ├─ Increment version in resume_store
        ├─ Re-run generate_resume_docx(updated_data, new_path)
        ├─ email_service.send_confirmation_email(email, name)
        └─ Write audit event: MONTHLY_UPDATE_SUBMITTED
```

---

## Scheduler

### `monthly_scheduler.py`
**File:** `backend/scheduler/monthly_scheduler.py`  
**Status:** Implemented

**Library:** `asyncio` event loop with custom scheduling logic (or `APScheduler AsyncIOScheduler`).  
**Timezone:** `Asia/Kolkata` (IST).

**Configuration (from `config/email_config.py`):**
```python
SCHEDULER_DAY    = 24    # Day of month
SCHEDULER_HOUR   = 9     # 9 AM IST
SCHEDULER_MINUTE = 21    # :21
```

**Startup:** Registered in FastAPI `lifespan` context manager in `main.py`. Starts when the app boots.

**How it fires:**
1. On startup, calculates next fire time for the configured day/hour/minute.
2. Waits using `asyncio.sleep(seconds_until_fire)`.
3. Calls `SchedulerAgent.run()`.
4. Resets and waits for next month.

---

### `scheduler_agent.py` — `SchedulerAgent`
**File:** `backend/scheduler/scheduler_agent.py`  
**Status:** Implemented

**`SchedulerAgent.run()` steps:**
1. Call `db_service.get_all_employees()` → list of `{ email, name, employee_id }`.
2. For each employee:
   - Generate `token = str(uuid.uuid4())`.
   - Store token: `db_service.store_update_token(employee_id, token, expiry_days=30)`.
   - Build URL: `f"{settings.FRONTEND_URL}/monthly-update?token={token}"`.
   - Call `email_service.send_resume_update_email(email, name, url)`.
3. Write single audit event: `{ event_type: EMAIL_SENT, actor: SYSTEM, payload: { count: N } }`.

---

## Email Service

**File:** `backend/services/email_service.py`  
**Status:** Implemented (core), confirmation email missing

### Modes

| Mode | Config value | Behavior |
|---|---|---|
| Production | `EMAIL_MODE=smtp` | Sends via SMTP using SMTP credentials |
| Development | `EMAIL_MODE=console` | Prints email body to stdout, no actual send |

### Functions

#### `send_resume_update_email(email, name, update_link)` — Implemented
Sends the monthly reminder email.

**Subject:** `[Action Required] Update Your Resume — {Month} {Year}`

**Body (HTML template):** `backend/templates/resume_update_mail.html`

Template variables:
- `{{ name }}` — employee name
- `{{ update_link }}` — one-time tokenized URL
- `{{ month }}` — current month name
- `{{ year }}` — current year
- `{{ deadline }}` — last day of month

---

#### `send_confirmation_email(email, name)` — Missing
Sent after employee successfully submits the monthly update form.

**Subject:** `Your Resume Has Been Updated — {Month} {Year}`

**Body:** Simple confirmation message with download link.

Template to create: `backend/templates/resume_update_confirmation.html`

See [TODO](TODO_missing_implementations.md#p1-confirmation-email-after-update).

---

## Email Configuration

**File:** `backend/config/email_config.py` — `Settings`

```python
EMAIL_MODE: Literal["smtp", "console"]   # "console" for dev
SMTP_HOST: str                            # e.g., "smtp.gmail.com"
SMTP_PORT: int                            # 587 (TLS) or 465 (SSL)
SMTP_USER: str                            # sender email
SMTP_PASSWORD: str                        # app password or secret
FROM_EMAIL: str                           # display sender address
FRONTEND_URL: str                         # base URL for update links
SCHEDULER_DAY: int
SCHEDULER_HOUR: int
SCHEDULER_MINUTE: int
```

---

## Token Management

**Status:** Partially implemented (token generation in scheduler_agent, storage not yet persisted)

### Proposed `tokens` collection schema
```json
{
  "token": "string (UUID, unique indexed)",
  "employee_id": "string",
  "email": "string",
  "created_at": "datetime",
  "expires_at": "datetime",
  "used": "boolean",
  "used_at": "datetime | null"
}
```

### db_service functions needed
- `store_update_token(employee_id, token, expiry_days)` — insert into `tokens`
- `validate_update_token(token)` → `{ valid: bool, employee_id, email }` — check exists, not expired, not used
- `consume_update_token(token)` — set `used=true`, `used_at=now()`

See [TODO](TODO_missing_implementations.md#p3-token-storage--expiry).

---

## Monthly Update API Endpoints

### `GET /api/monthly-update/verify-token`
**Status:** Missing  
**File:** `backend/routes/routes.py`

**Query params:** `token=string`

**Behavior:**
1. Call `db_service.validate_update_token(token)`.
2. If invalid or expired: return `{ valid: false, reason: "expired | not_found | already_used" }`.
3. If valid: return `{ valid: true, employee: { name, email, current_role, skills[] } }` (pre-fill data for form).

---

### `POST /api/monthly-update`
**Status:** Missing  
**File:** `backend/routes/routes.py`

**Request body:**
```json
{
  "token": "string",
  "updates": {
    "current_role": "string",
    "new_skills": [{ "category": "string", "name": "string" }],
    "new_certifications": [{ "name": "string", "provider": "string", "completion_date": "string" }],
    "current_project": {
      "project_name": "string",
      "client_name": "string",
      "role": "string",
      "start_date": "string",
      "technology_stack": ["string"],
      "responsibilities": ["string"],
      "domain": "string"
    },
    "achievements": ["string"],
    "technology_stack": ["string"]
  }
}
```

**Behavior:**
1. Validate token via `db_service.validate_update_token(token)`.
2. Consume token: `db_service.consume_update_token(token)`.
3. Merge `updates` into existing `employee_resume_data`:
   - Append new skills (deduplicate via normalizer).
   - Append new certifications.
   - Add current_project to `work_experience[]` or update existing open-ended entry.
   - Append achievements.
   - Update `current_role` in `employee_data`.
4. Call `generate_resume_docx(updated_data, new_path)` → new version file.
5. Call `db_service.upsert_resume_path(email, path, version+1, "MONTHLY_UPDATE")`.
6. Call `email_service.send_confirmation_email(email, name)`.
7. Write audit event: `MONTHLY_UPDATE_SUBMITTED`.
8. Return `{ success: true, version: N, message: "Resume updated successfully" }`.

---

## Email Template (HTML)

**File:** `backend/templates/resume_update_mail.html`  
**Status:** Needs to be created/verified

```html
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
  <h2>Hi {{ name }},</h2>
  <p>It's time for your monthly resume update for <strong>{{ month }} {{ year }}</strong>.</p>
  <p>Please review and update your:</p>
  <ul>
    <li>Current Role & Project</li>
    <li>New Skills & Technologies</li>
    <li>New Certifications</li>
    <li>Achievements this month</li>
  </ul>
  <a href="{{ update_link }}"
     style="background:#0066cc;color:white;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;">
    Update My Resume
  </a>
  <p style="color:#888;font-size:12px;">This link expires in 30 days. Contact HR if you need assistance.</p>
</body>
</html>
```
