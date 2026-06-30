"""
Parses the 10 Sails-format DOCX resumes from mock_resumes_data/,
dumps full resume data into employee_resume_data collection,
and seeds the new employee_skill_summary collection with 7 fields:
  employee_id, name, current_designation, current_skill, total_exp, current_skill_exp, email
"""

import asyncio
import io
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from docx import Document
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGO_DB_NAME", "resume_sync_db")
MOCK_DIR = Path(__file__).parent.parent / "mock_resumes_data"

# ── Mapping: DOCX filename fragment → (employee_id, email) ──────────────────
FILE_EMPLOYEE_MAP = {
    "Dommaraju Thilakavathi":           ("EMP007", "thilakavathi.dommaraju@sailssoftware.com"),
    "Karthik Kumar Malapati":           ("EMP004", "karthikkumar.Malapati@sailssoftware.com"),
    "Kiran_Kumar_AVK":                  ("EMP009", "kirankumar.avk@sailssoftware.com"),
    "PavanKumarYele":                   ("EMP002", "pavankumar.yele@sailssoftware.com"),
    "Prathyusa Bobbala":                ("EMP006", "prathyusha.bobbala@sailssoftware.com"),
    "PreethiAbbireddy":                 ("EMP010", "saipreethi.abbireddy@sailssoftware.com"),
    "Rajarshee Roy":                    ("EMP008", "rajarshee.roy@sailssoftware.com"),
    "Sai Spandana Komati":              ("EMP003", "saispandana.Komati@sailssoftware.com"),
    "Subramanyam_Kanithi":              ("EMP005", "subramanyam.kanithi@sailssoftware.com"),
    "Uday Ganesh Kanteti":              ("EMP011", "udayganesh.kanteti@sailssoftware.com"),
}

# ── Skill summary metadata derived from resume inspection ───────────────────
# Fields: name, current_designation, current_skill, total_exp (years), current_skill_exp (years)
# Name is sourced directly here to avoid DOCX parsing ambiguity
SKILL_SUMMARY_DATA = {
    "EMP002": {
        "name":                "Pavan Kumar Yele",
        "current_designation": "Senior Software Test Engineer",
        "current_skill":       "Selenium / QA Automation",
        "total_exp":           5.0,
        "current_skill_exp":   5.0,
    },
    "EMP003": {
        "name":                "Sai Spandana Komati",
        "current_designation": "Senior QA Engineer",
        "current_skill":       "Selenium / BDD Testing",
        "total_exp":           8.0,
        "current_skill_exp":   8.0,
    },
    "EMP004": {
        "name":                "Karthik Kumar Malapati",
        "current_designation": "Test Engineer",
        "current_skill":       "Manual & Automation Testing",
        "total_exp":           8.0,
        "current_skill_exp":   8.0,
    },
    "EMP005": {
        "name":                "Subramanyam Kanithi",
        "current_designation": "Software Engineer",
        "current_skill":       "Angular / TypeScript",
        "total_exp":           1.5,
        "current_skill_exp":   1.5,
    },
    "EMP006": {
        "name":                "Prathyusha Bobbala",
        "current_designation": "Senior Software Engineer",
        "current_skill":       ".NET / C#",
        "total_exp":           8.0,
        "current_skill_exp":   8.0,
    },
    "EMP007": {
        "name":                "Dommaraju Thilakavathi",
        "current_designation": "Trainee Software Engineer",
        "current_skill":       ".NET Core / C#",
        "total_exp":           0.5,
        "current_skill_exp":   0.5,
    },
    "EMP008": {
        "name":                "Rajarshee Roy",
        "current_designation": "Associate Software Engineer",
        "current_skill":       ".NET Core / C#",
        "total_exp":           1.5,
        "current_skill_exp":   1.5,
    },
    "EMP009": {
        "name":                "Kiran Kumar AVK",
        "current_designation": "Architect",
        "current_skill":       "Java / Spring Boot / GCP",
        "total_exp":           17.0,
        "current_skill_exp":   17.0,
    },
    "EMP010": {
        "name":                "Sai Preethi Abbireddy",
        "current_designation": "Lead Software Engineer",
        "current_skill":       "Java / Spring Boot / Angular",
        "total_exp":           7.0,
        "current_skill_exp":   7.0,
    },
    "EMP011": {
        "name":                "Uday Ganesh Kanteti",
        "current_designation": "Software Engineer (Sr. Associate Level)",
        "current_skill":       "Java / Spring Boot",
        "total_exp":           6.0,
        "current_skill_exp":   6.0,
    },
}


# ── DOCX Parsing helpers ─────────────────────────────────────────────────────

def _text(paragraphs):
    return [p.text.strip() for p in paragraphs if p.text.strip()]


def _section_text(lines, header):
    """Return lines between 'header' and the next all-caps/title section."""
    SECTION_HEADERS = {
        "Summary", "Summarry", "Profile", "Technical Skills", "Experience",
        "Education", "Certifications", "Skills & Abilities /Achievements",
        "Skills & Abilities/Achievements", "/Achievements", "Activities and Interests",
        "Declaration",
    }
    try:
        idx = next(i for i, l in enumerate(lines) if l.strip() in {header} | {h.lower() for h in SECTION_HEADERS} and l.strip() == header)
    except StopIteration:
        return []
    result = []
    for line in lines[idx + 1:]:
        if line.strip() in SECTION_HEADERS:
            break
        if line.strip():
            result.append(line.strip())
    return result


def _parse_tech_skills(doc):
    """Extract technical skills from the 2-column skill table."""
    skills = {}
    for table in doc.tables:
        rows = table.rows
        if not rows:
            continue
        first_cells = [c.text.strip() for c in rows[0].cells]
        # Skill tables have exactly 2 columns; first col is category name
        if len(first_cells) == 2 and first_cells[0] and first_cells[1]:
            looks_like_skill_table = any(
                kw in first_cells[0].lower()
                for kw in ("programming", "automation", "ci", "cloud", "version",
                           "api", "operating", "tech", "backend", "frontend",
                           "database", "framework", "tool", "management",
                           "container", "performance", "queue", "monitor",
                           "mobile", "test", "architecture", "stack")
            )
            if looks_like_skill_table:
                for row in rows:
                    cells = [c.text.strip() for c in row.cells]
                    if len(cells) == 2 and cells[0] and cells[1]:
                        category = cells[0]
                        vals = [v.strip() for v in re.split(r",\s*", cells[1]) if v.strip()]
                        if vals:
                            skills[category] = vals
    return skills


def _parse_projects(doc):
    """Extract work experience project blocks from tables (Project/Client/Role/Environment rows)."""
    projects = []
    exp_paragraphs = _text(doc.paragraphs)

    # Pull current company/role from paragraphs (pattern: "Title | Company | Date")
    designation = ""
    duration = ""
    company_name = ""
    for line in exp_paragraphs:
        m = re.match(r"^(.+?)\s*[|·]\s*(.+?)\s*[|·]\s*(.+)$", line)
        if m and any(kw in line.lower() for kw in ("engineer", "developer", "architect",
                                                     "analyst", "associate", "trainee",
                                                     "lead", "manager", "tester", "sdet",
                                                     "test")):
            designation = m.group(1).strip()
            company_name = m.group(2).strip()
            duration = m.group(3).strip()
            break  # first match = most recent role

    for table in doc.tables:
        rows_data = {}
        for row in table.rows:
            cells = [c.text.strip() for c in row.cells]
            if len(cells) >= 2 and cells[0] and cells[1]:
                rows_data[cells[0].lower()] = cells[1]

        project_key = rows_data.get("project") or rows_data.get("product")
        client_key  = rows_data.get("client")
        role_key    = rows_data.get("role")
        env_key     = rows_data.get("environment") or rows_data.get("tech stack") or rows_data.get("experience")

        if project_key and (client_key or role_key):
            env_list = [e.strip() for e in re.split(r",\s*|\n", env_key or "") if e.strip()]
            projects.append({
                "company":     {"name": company_name or "Sails Software Solutions"},
                "designation": role_key or designation or "",
                "duration":    duration or "",
                "project": {
                    "name":                project_key,
                    "client":              client_key or "Internal",
                    "role":                role_key or "",
                    "environment":         env_list,
                    "project_description": "",
                    "responsibilities":    [],
                },
            })
    return projects, designation, duration


def _parse_education(doc):
    """Extract education rows from the education table."""
    education = []
    for table in doc.tables:
        headers = [c.text.strip().lower() for c in table.rows[0].cells] if table.rows else []
        if any(h in ("institute", "institution", "stream", "year of passing") for h in headers):
            for row in table.rows[1:]:
                cells = [c.text.strip() for c in row.cells]
                if len(cells) < 3:
                    continue
                # Try to detect column order from headers
                year_idx  = next((i for i, h in enumerate(headers) if "year" in h), 0)
                inst_idx  = next((i for i, h in enumerate(headers) if "institute" in h or "institution" in h), 1)
                strm_idx  = next((i for i, h in enumerate(headers) if "stream" in h), 2)
                cgpa_idx  = next((i for i, h in enumerate(headers) if "cgpa" in h or "percent" in h), 3)

                if len(cells) > max(year_idx, inst_idx, strm_idx):
                    raw_cgpa = cells[cgpa_idx] if cgpa_idx < len(cells) else "0"
                    raw_cgpa = re.sub(r"[^\d.]", "", raw_cgpa.split()[0]) if raw_cgpa else "0"
                    try:
                        cgpa = float(raw_cgpa) if raw_cgpa else 0.0
                    except ValueError:
                        cgpa = 0.0
                    education.append({
                        "year":        cells[year_idx] if year_idx < len(cells) else None,
                        "institution": cells[inst_idx] if inst_idx < len(cells) else "",
                        "stream":      cells[strm_idx] if strm_idx < len(cells) else "",
                        "cgpa":        cgpa,
                    })
    return education


def _extract_name(doc):
    """Try to get name from first table (single-cell) or first paragraph."""
    for table in doc.tables:
        if table.rows:
            first_row_cells = [c.text.strip() for c in table.rows[0].cells]
            # A name table usually has 1-2 cells, first cell is full name (no | or digits)
            candidate = first_row_cells[0]
            if candidate and len(candidate.split()) <= 6 and not re.search(r"[\d@|]", candidate):
                # strip extra contact info if on same line
                name_only = candidate.split("\n")[0].strip()
                if name_only:
                    return name_only
    # Fallback: first paragraph without digits/symbols
    for para in doc.paragraphs:
        t = para.text.strip()
        if t and len(t.split()) <= 5 and not re.search(r"[\d@|]", t):
            return t
    return ""


def _extract_summary(doc):
    lines = _text(doc.paragraphs)
    for header in ("Summary", "Summarry", "Profile"):
        result = _section_text(lines, header)
        if result:
            return " ".join(result)
    return ""


def _extract_certifications(doc):
    lines = _text(doc.paragraphs)
    certs = _section_text(lines, "Certifications")
    result = []
    for c in certs:
        for item in re.split(r"\n|•", c):
            item = item.strip(" •–-")
            if item and len(item) > 5:
                result.append(item)
    return result


def _extract_achievements(doc):
    lines = _text(doc.paragraphs)
    for header in ("Skills & Abilities /Achievements", "Skills & Abilities/Achievements", "/Achievements"):
        ach = _section_text(lines, header)
        if ach:
            result = []
            for a in ach:
                for item in re.split(r"\n|•", a):
                    item = item.strip(" •–-")
                    if item and len(item) > 5:
                        result.append(item)
            return result
    return []


def parse_docx(path: Path) -> dict:
    doc = Document(str(path))

    name          = _extract_name(doc)
    summary       = _extract_summary(doc)
    tech_skills   = _parse_tech_skills(doc)
    projects, designation, duration = _parse_projects(doc)
    education     = _parse_education(doc)
    certifications = _extract_certifications(doc)
    achievements  = _extract_achievements(doc)

    search_tags = list({
        tag
        for vals in tech_skills.values()
        for tag in vals
    })

    return {
        "personal_info":  {"full_name": name},
        "profile_summary": summary,
        "technical_skills": tech_skills,
        "work_experience":  projects,
        "education":        education,
        "certifications":   certifications,
        "achievements":     achievements,
        "interests":        [],
        "search_tags":      search_tags,
    }


def resolve_employee(filename: str):
    """Match a filename to (employee_id, email) from FILE_EMPLOYEE_MAP."""
    for key, val in FILE_EMPLOYEE_MAP.items():
        if key.lower().replace("_", " ") in filename.lower().replace("_", " "):
            return val
    return None, None


# ── Database operations ──────────────────────────────────────────────────────

async def create_skill_summary_collection(db):
    existing = await db.list_collection_names()
    if "employee_skill_summary" not in existing:
        await db.create_collection(
            "employee_skill_summary",
            validator={
                "$jsonSchema": {
                    "bsonType": "object",
                    "required": ["employee_id", "name", "current_designation",
                                 "current_skill", "total_exp", "current_skill_exp"],
                    "properties": {
                        "employee_id":          {"bsonType": "string"},
                        "name":                 {"bsonType": "string"},
                        "email":                {"bsonType": ["string", "null"]},
                        "current_designation":  {"bsonType": "string"},
                        "current_skill":        {"bsonType": "string"},
                        "total_exp":            {"bsonType": ["double", "int", "decimal"]},
                        "current_skill_exp":    {"bsonType": ["double", "int", "decimal"]},
                        "updated_at":           {"bsonType": "date"},
                    },
                }
            },
        )
        await db.employee_skill_summary.create_index("employee_id", unique=True)
        print("  Created collection: employee_skill_summary")
    else:
        print("  Collection employee_skill_summary already exists — skipping creation")


async def upsert_resume_data(db, employee_id: str, email: str, parsed: dict, total_exp: float):
    doc = {
        **parsed,
        "employee_id":     employee_id,
        "email":           email,
        "total_experience": int(total_exp),
        "updated_at":      datetime.now(timezone.utc),
    }
    result = await db.employee_resume_data.update_one(
        {"employee_id": employee_id},
        {"$set": doc},
        upsert=True,
    )
    return result.upserted_id is not None


async def upsert_skill_summary(db, employee_id: str, email: str):
    meta = SKILL_SUMMARY_DATA.get(employee_id)
    if not meta:
        print(f"  [WARN] No skill summary metadata for {employee_id}, skipping.")
        return

    doc = {
        "employee_id":         employee_id,
        "name":                meta["name"],
        "email":               email,
        "current_designation": meta["current_designation"],
        "current_skill":       meta["current_skill"],
        "total_exp":           meta["total_exp"],
        "current_skill_exp":   meta["current_skill_exp"],
        "updated_at":          datetime.now(timezone.utc),
    }
    await db.employee_skill_summary.update_one(
        {"employee_id": employee_id},
        {"$set": doc},
        upsert=True,
    )


# ── Main entry point ─────────────────────────────────────────────────────────

async def main():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]

    print(f"\nConnected to MongoDB: {DB_NAME}")
    print("=" * 60)

    # Step 1: Create employee_skill_summary collection
    print("\n[1] Setting up employee_skill_summary collection...")
    await create_skill_summary_collection(db)

    # Step 2: Process each DOCX file
    docx_files = sorted(MOCK_DIR.glob("*.docx"))
    if not docx_files:
        print(f"\n[ERROR] No DOCX files found in {MOCK_DIR}")
        sys.exit(1)

    print(f"\n[2] Processing {len(docx_files)} DOCX files from {MOCK_DIR.name}/\n")

    success_count = 0
    for docx_path in docx_files:
        fname = docx_path.name
        employee_id, email = resolve_employee(fname)

        if not employee_id:
            print(f"  [SKIP] Could not map file to employee: {fname}")
            continue

        print(f"  Processing: {fname}")
        print(f"    Matched to {employee_id} ({email})")

        try:
            parsed = parse_docx(docx_path)
        except Exception as e:
            print(f"    [ERROR] Failed to parse DOCX: {e}")
            continue

        name = parsed["personal_info"]["full_name"] or fname.split("_")[0]
        total_exp = SKILL_SUMMARY_DATA.get(employee_id, {}).get("total_exp", 0)

        # Upsert into employee_resume_data
        try:
            is_new = await upsert_resume_data(db, employee_id, email, parsed, total_exp)
            action = "inserted" if is_new else "updated"
            print(f"    -- employee_resume_data: {action}")
        except Exception as e:
            print(f"    [ERROR] employee_resume_data write failed: {e}")

        # Upsert into employee_skill_summary
        try:
            await upsert_skill_summary(db, employee_id, email)
            print(f"    -- employee_skill_summary: upserted")
        except Exception as e:
            print(f"    [ERROR] employee_skill_summary write failed: {e}")

        success_count += 1
        print()

    # Step 3: Print verification
    print("=" * 60)
    print(f"[3] Verification — employee_skill_summary contents:\n")
    print(f"  {'ID':<8} {'Name':<35} {'Designation':<38} {'Skill':<30} {'Exp':>5} {'Skill Exp':>10}")
    print(f"  {'-'*8} {'-'*35} {'-'*38} {'-'*30} {'-'*5} {'-'*10}")

    cursor = db.employee_skill_summary.find({}, {"_id": 0}).sort("employee_id", 1)
    async for doc in cursor:
        print(
            f"  {doc['employee_id']:<8} "
            f"{doc['name']:<35} "
            f"{doc['current_designation']:<38} "
            f"{doc['current_skill']:<30} "
            f"{doc['total_exp']:>5} "
            f"{doc['current_skill_exp']:>10}"
        )

    print(f"\n  Total records: {await db.employee_skill_summary.count_documents({})}")
    print(f"\nDone. {success_count}/{len(docx_files)} files processed successfully.")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
