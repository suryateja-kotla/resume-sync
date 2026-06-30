# HR Talent Search & Reporting — Backend

> Part of: [Backend Specs Index](INDEX.md)

---

## Overview

The HR portal has two query modes:
1. **Conversational search** — natural language query routed through `query_agent`.
2. **Structured endpoints** — REST APIs for skill racks, employee list, and Excel reports.

---

## Query Agent

**File:** `backend/agents/query_agent.py`  
**Framework:** Google ADK  
**Model:** Gemini 2.5 Flash  
**Instructions:** `backend/instructions/query_agent_instruction.py`  
**MCP toolset:** `backend/mongo_mcp/mcp_toolsets.py` — MongoDB `find`, `aggregate`, `count_documents`

### Search Strategies

| Intent | MongoDB Query Strategy |
|---|---|
| Skill-based | `{ search_tags: { $regex: "java", $options: "i" } }` |
| Role-based | `{ "personal_info.current_role": { $regex: "developer", $options: "i" } }` |
| Bench only | `{ bench_status: "BENCH" }` in `employee_data` |
| Multi-skill | `{ search_tags: { $all: ["java", "spring"] } }` |
| Experience filter | `{ "personal_info.total_experience": { $gte: 5 } }` |
| Combined | AND query across multiple fields |

### Agent instruction principles (from `query_agent_instruction.py`)
- Minimize number of MongoDB calls (prefer one compound query over multiple sequential calls).
- Always project only needed fields (avoid fetching full documents unnecessarily).
- Return results as a JSON array of candidate summaries.
- If no results, return empty array with explanation.

### Output shape from agent
```json
[
  {
    "employee_id": "EMP001",
    "name": "John Doe",
    "email": "john@example.com",
    "designation": "Senior Developer",
    "current_role": "Java Backend Developer",
    "total_experience": 7,
    "bench_status": "BENCH",
    "matching_skills": ["Java", "Spring Boot", "Microservices"]
  }
]
```

---

## MCP MongoDB Toolset

**File:** `backend/mongo_mcp/mcp_toolsets.py`  
**Server:** `backend/mongo_mcp/mongo_mcp_server.py`

The query_agent uses FastMCP to execute MongoDB operations as tool calls. This keeps DB logic inside the agent loop without direct pymongo imports in agent files.

**Available MCP tools for query_agent:**
- `find(collection, filter, projection, limit)` — basic document fetch
- `aggregate(collection, pipeline)` — aggregation pipeline
- `count_documents(collection, filter)` — headcount

---

## API Endpoints

### `POST /api/search-candidates`
**Status:** Implemented  
**File:** `backend/routes/routes.py`

**Request:**
```json
{ "query": "Java developers with 5+ years", "email": "hr@example.com" }
```

**Behavior:**
1. Pass `query` to `root_agent` via `agent_runner`.
2. Root agent detects talent search intent → delegates to `query_agent`.
3. Query agent builds MongoDB query → executes via MCP tools.
4. Returns structured candidate list.

**Response:**
```json
{
  "candidates": [ { "...candidate summary..." } ],
  "count": 8,
  "query_intent": "Java developers with >= 5 years experience"
}
```

---

### `GET /api/hr/skill-summary`
**Status:** Missing — needs implementation  
**File:** `backend/routes/routes.py`

**Purpose:** Powers the HR Skill Racks view. Returns headcount per skill.

**MongoDB aggregation:**
```javascript
db.employee_resume_data.aggregate([
  { $unwind: "$skills" },
  { $group: {
      _id: "$skills.name",
      category: { $first: "$skills.category" },
      employee_ids: { $addToSet: "$employee_id" }
  }},
  { $lookup: {
      from: "employee_data",
      localField: "employee_ids",
      foreignField: "employee_id",
      as: "emp_info"
  }},
  { $project: {
      skill: "$_id",
      category: 1,
      total_employees: { $size: "$employee_ids" },
      on_bench: { $size: { $filter: { input: "$emp_info", cond: { $eq: ["$$this.bench_status", "BENCH"] } } } },
      on_project: { $size: { $filter: { input: "$emp_info", cond: { $eq: ["$$this.bench_status", "PROJECT"] } } } }
  }},
  { $sort: { total_employees: -1 } }
])
```

**Response:**
```json
{
  "skills": [
    { "skill": "Java", "category": "Programming Languages", "total_employees": 18, "on_project": 14, "on_bench": 4 },
    { "skill": "Python", "category": "Programming Languages", "total_employees": 12, "on_project": 10, "on_bench": 2 }
  ]
}
```

---

### `GET /api/hr/skill-employees`
**Status:** Missing — needs implementation  
**File:** `backend/routes/routes.py`

**Purpose:** Returns all employees who have a specific skill. Triggered when HR clicks a skill rack card.

**Query params:** `skill=Java`

**MongoDB query:**
```javascript
db.employee_resume_data.find(
  { "skills.name": { $regex: "^Java$", $options: "i" } },
  { employee_id: 1, "personal_info.name": 1, "personal_info.current_role": 1,
    "personal_info.total_experience": 1, "skills.$": 1, "work_experience": { $slice: 1 } }
)
```

Then join with `employee_data` for `bench_status`.

**Response:**
```json
{
  "skill": "Java",
  "employees": [
    {
      "name": "John Doe",
      "employee_id": "EMP001",
      "current_role": "Java Backend Developer",
      "total_experience": 7,
      "skill_experience": 5,
      "bench_status": "BENCH",
      "current_project": "Project Alpha"
    }
  ]
}
```

---

### `GET /api/hr/employees`
**Status:** Missing — needs implementation  
**File:** `backend/routes/routes.py`

**Purpose:** Paginated list of all employees with optional filters.

**Query params:**
| Param | Type | Example |
|---|---|---|
| `page` | int | `1` |
| `page_size` | int | `20` |
| `skill` | string | `Java` |
| `department` | string | `Engineering` |
| `bench_status` | string | `BENCH` |
| `experience_min` | number | `3` |
| `experience_max` | number | `10` |

**Response:**
```json
{
  "total": 120,
  "page": 1,
  "page_size": 20,
  "results": [ { "...employee summary..." } ]
}
```

---

### `GET /api/download-excel`
**Status:** Implemented (partial — basic version, advanced filters missing)  
**File:** `backend/routes/routes.py`  
**Tool:** `backend/tools/excel_tools.py` — `create_talent_excel(candidates, filters)`

**Query params (all optional):**
- `skill`, `department`, `location`, `bench_status`
- `experience_min`, `experience_max`
- `role`, `certification`
- `date_from`, `date_to` (joining date range — `YYYY-MM-DD`)

**Behavior:**
1. Build MongoDB filter from query params.
2. Query `employee_resume_data` (joined with `employee_data` for bench_status).
3. Call `create_talent_excel(candidates, filters)`.
4. Return `StreamingResponse` with content-type `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
5. Filename: `TalentReport_{YYYY-MM-DD}.xlsx`.

**Excel columns:**
| Column | Source |
|---|---|
| Employee ID | `employee_id` |
| Name | `personal_info.name` |
| Email | `email` |
| Designation | `personal_info.designation` |
| Department | `personal_info.department` |
| Current Role | `personal_info.current_role` |
| Location | `personal_info.location` |
| Total Experience | `personal_info.total_experience` |
| Key Skills | `skills[]` joined by `, ` |
| Bench Status | `bench_status` |
| Joining Date | `personal_info.joining_date` |
| Last Updated | `last_updated` |
| Resume Link | Hyperlink to generated DOCX path |

---

## Excel Tool

**File:** `backend/tools/excel_tools.py`  
**Function:** `create_talent_excel(candidates: list[dict], filters: dict) -> bytes`

- Uses `xlsxwriter` to build the workbook in memory.
- Returns bytes stream (not written to disk).
- Applies org formatting: header row color, column widths, hyperlink style for Resume Link column.
- Sheet name: `"Talent Report"`.
- Includes a `Filters Applied` summary block at the top of the sheet.
