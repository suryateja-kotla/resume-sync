"""
Dump resumes to MongoDB using the manually-filled Pending_Resume_Mapping Excel
in output_excels/.

The Excel has two columns: Folder Name (fill) and File Name (fill).
Folder names in the Excel don't always match disk (e.g. "PO" -> "BA",
"Automation Testing" -> "Testing", "AI" -> "Python" etc.), so we build
a flat name->path index of every DOCX on disk and match by filename only.

Run:
    cd backend
    python db/dump_from_output_excel.py --dry-run    # show what would be dumped, no writes
    python db/dump_from_output_excel.py              # dump to MongoDB
"""

import asyncio
import os
import sys
import argparse
from pathlib import Path
from datetime import datetime, timezone

import openpyxl
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()
sys.path.insert(0, str(Path(__file__).parent.parent))
from db.seed_mock_resumes import parse_docx, upsert_resume_data

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME   = os.getenv("MONGO_DB_NAME", "resume_sync_db")

RESUMES_DIR  = Path(
    r"C:\Users\LENOVO\OneDrive - Sails Software Solutions Pvt Ltd"
    r"\resumes_sails\Sails Resumes"
)
EXCEL_PATH   = Path(__file__).parent.parent / "output_excels" / "Pending_Resume_Mapping_20260707_124403.xlsx"
EXCEL_SOURCE = Path(__file__).parent.parent / "excel_data" / "Book 1.xlsx"
OUTPUT_DIR   = Path(__file__).parent.parent / "output_excels"


# ── Build flat index: lower(filename) -> absolute Path ────────────────────────

def build_file_index(resumes_dir: Path) -> dict[str, Path]:
    index: dict[str, Path] = {}
    for fpath in resumes_dir.rglob("*.docx"):
        key = fpath.name.lower()
        # Keep the first match (avoids duplicates from versioned copies)
        if key not in index:
            index[key] = fpath
    return index


# ── Load total_exp from Book1 ──────────────────────────────────────────────────

def load_exp_map() -> dict[str, float]:
    wb = openpyxl.load_workbook(EXCEL_SOURCE)
    ws = wb.active
    exp_map: dict[str, float] = {}
    for row in list(ws.iter_rows(values_only=True))[1:]:
        emp_id = row[1]
        if not emp_id or not str(emp_id).strip().upper().startswith("SS"):
            continue
        try:
            exp = float(str(row[23] or "0").replace("+", "").split()[0])
        except Exception:
            exp = 0.0
        exp_map[str(emp_id).strip()] = exp
    return exp_map


# ── Parse experience string from Excel ────────────────────────────────────────

def parse_exp(raw) -> float:
    if raw is None:
        return 0.0
    s = str(raw).lower().replace("+", "").strip()
    # "4 yrs 10 months" -> extract first number
    import re
    m = re.search(r"(\d+\.?\d*)", s)
    return float(m.group(1)) if m else 0.0


# ── Main ──────────────────────────────────────────────────────────────────────

async def run(dry_run: bool):
    client = AsyncIOMotorClient(MONGO_URI, serverSelectionTimeoutMS=15000)
    db     = client[DB_NAME]

    already_in_db: set[str] = set(await db.employee_resume_data.distinct("employee_id"))
    print(f"Already in DB: {len(already_in_db)} employees")

    file_index = build_file_index(RESUMES_DIR)
    print(f"DOCX files indexed: {len(file_index)}")

    exp_map = load_exp_map()

    # Read mapping Excel
    wb  = openpyxl.load_workbook(EXCEL_PATH)
    ws  = wb["Fill Resume Mapping"]
    rows = list(ws.iter_rows(values_only=True))[1:]  # skip header

    print(f"\nRows in Excel: {len(rows)}")
    print("=" * 70)

    results = []   # (emp_id, name, status, note, fpath_or_none)

    for row in rows:
        emp_id, name, email, desig, skill, exp_raw, folder, fname = row
        if not emp_id:
            continue
        emp_id = str(emp_id).strip()
        name   = str(name or "").strip()
        email  = str(email or "").strip().lower()

        # Skip rows with no file mapping
        if not fname:
            results.append((emp_id, name, "NO_MAPPING", "folder/file not filled in Excel", None))
            continue

        # Skip if already in DB
        if emp_id in already_in_db:
            results.append((emp_id, name, "SKIP_EXISTS", "already has resume in DB", None))
            continue

        # Find file on disk by name (case-insensitive)
        fpath = file_index.get(str(fname).lower())
        if fpath is None:
            results.append((emp_id, name, "FILE_NOT_FOUND", f"{fname}", None))
            continue

        results.append((emp_id, name, "READY", str(fpath), fpath))

    # Print plan
    ready       = [r for r in results if r[2] == "READY"]
    skip_exists = [r for r in results if r[2] == "SKIP_EXISTS"]
    no_map      = [r for r in results if r[2] == "NO_MAPPING"]
    not_found   = [r for r in results if r[2] == "FILE_NOT_FOUND"]

    print(f"READY to dump:      {len(ready)}")
    print(f"Skip (in DB):       {len(skip_exists)}")
    print(f"No mapping in Excel:{len(no_map)}")
    print(f"File not on disk:   {len(not_found)}")

    if not_found:
        print("\nFiles not found on disk:")
        for r in not_found:
            print(f"  {r[0]:<8} {r[1][:35]:<35} -> {r[3]}")

    if no_map:
        print("\nEmployees with no file mapping (need manual filling in Excel):")
        for r in no_map:
            print(f"  {r[0]:<8} {r[1]}")

    print()

    if dry_run:
        print("--dry-run: no DB writes. Employees that would be dumped:")
        for r in ready:
            print(f"  {r[0]:<8} {r[1][:40]:<40} -> {Path(r[3]).name}")
        return

    if not ready:
        print("Nothing to dump.")
        return

    print(f"Dumping {len(ready)} employees...\n")
    success = errors = 0

    for emp_id, name, _, fpath_str, fpath in ready:
        # Fetch email from DB skill_summary (more reliable than Excel)
        in_excel = await db.employee_skill_summary.find_one({"employee_id": emp_id})
        if not in_excel:
            print(f"  [NO-EXCEL]  {emp_id} | {name} — not in skill_summary, skipping")
            errors += 1
            continue

        email     = in_excel.get("email", "")
        total_exp = exp_map.get(emp_id, 0.0)

        try:
            parsed = parse_docx(fpath)
        except Exception as e:
            print(f"  [PARSE-ERR] {emp_id} | {fpath.name}: {e}")
            errors += 1
            continue

        try:
            await upsert_resume_data(db, emp_id, email, parsed, total_exp)
        except Exception as e:
            print(f"  [DB-ERR]    {emp_id}: {e}")
            errors += 1
            continue

        await db.resume_store.update_one(
            {"employee_id": emp_id},
            {"$set": {
                "employee_id":     emp_id,
                "resume_path":     str(fpath),
                "last_updated_at": datetime.now(timezone.utc),
            }},
            upsert=True,
        )

        if not await db.employee_data.find_one({"employeeId": emp_id}):
            await db.employee_data.update_one(
                {"employeeId": emp_id},
                {"$setOnInsert": {
                    "employeeId":        emp_id,
                    "fullName":          name,
                    "email":             email,
                    "role":              "EMPLOYEE",
                    "status":            "Active",
                    "isOnBench":         False,
                    "lastProfileUpdate": datetime.now(timezone.utc),
                }},
                upsert=True,
            )

        print(f"  OK  {emp_id:<8} {name[:40]:<40} | {fpath.name[:45]}")
        success += 1
        already_in_db.add(emp_id)

    print(f"\n{'='*70}")
    print(f"Done — success: {success}, errors: {errors}")
    total = await db.employee_resume_data.count_documents({})
    print(f"Total employees with resume in DB: {total}")

    # ── Regenerate the output Excel with updated remaining list ───────────────
    print("\nRegenerating Pending_Resume_Mapping with updated status...")

    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter

    dumped_ids: set[str] = set(await db.employee_resume_data.distinct("employee_id"))

    wb_book1 = openpyxl.load_workbook(EXCEL_SOURCE)
    ws_book1 = wb_book1.active

    remaining = []
    for row in list(ws_book1.iter_rows(values_only=True))[1:]:
        eid = row[1]
        if not eid or not str(eid).strip().upper().startswith("SS"):
            continue
        eid = str(eid).strip()
        if eid not in dumped_ids:
            remaining.append({
                "Employee ID":      eid,
                "Employee Name":    str(row[2] or "").strip(),
                "Email":            str(row[4] or "").strip(),
                "Designation":      row[7],
                "Current Skill":    row[16],
                "Experience":       row[23],
                "Folder Name (fill)": "",
                "File Name (fill)":   "",
            })

    # Build available files sheet
    all_files = sorted(RESUMES_DIR.rglob("*.docx"), key=lambda x: x.parent.name + x.name)

    thin   = Side(style="thin", color="CCCCCC")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)

    wb_out = openpyxl.Workbook()

    # Sheet 1: Fill Resume Mapping
    ws_map = wb_out.active
    ws_map.title = "Fill Resume Mapping"

    hdr = ["Employee ID", "Employee Name", "Email", "Designation",
           "Current Skill", "Experience", "Folder Name (fill)", "File Name (fill)"]
    ws_map.append(hdr)
    for cell in ws_map[1]:
        cell.font      = Font(bold=True, color="FFFFFF", size=11)
        cell.fill      = PatternFill("solid", fgColor="1F4E79")
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border    = border
    ws_map.row_dimensions[1].height = 26

    fill_odd  = PatternFill("solid", fgColor="EEF3FB")
    fill_even = PatternFill("solid", fgColor="FFFFFF")

    for i, emp in enumerate(remaining, 1):
        ws_map.append([emp[h] for h in hdr])
        fill = fill_odd if i % 2 == 1 else fill_even
        for cell in ws_map[ws_map.max_row]:
            cell.fill      = fill
            cell.border    = border
            cell.alignment = Alignment(vertical="center")

    col_widths = [12, 32, 36, 26, 22, 12, 22, 50]
    for i, w in enumerate(col_widths, 1):
        ws_map.column_dimensions[get_column_letter(i)].width = w
    ws_map.freeze_panes = "A2"

    # Sheet 2: Available Folders & Files
    ws_files = wb_out.create_sheet("Available Folders & Files")
    ws_files.append(["Folder Name", "File Name"])
    for cell in ws_files[1]:
        cell.font      = Font(bold=True, color="FFFFFF")
        cell.fill      = PatternFill("solid", fgColor="1F4E79")
        cell.alignment = Alignment(horizontal="center")
        cell.border    = border

    prev_folder = None
    for f in all_files:
        rel   = f.relative_to(RESUMES_DIR)
        parts = rel.parts
        top   = parts[0]
        if top != prev_folder:
            ws_files.append([top, f.name])
            prev_folder = top
        else:
            ws_files.append([None, f.name])

    ws_files.column_dimensions["A"].width = 28
    ws_files.column_dimensions["B"].width = 65

    # Sheet 3: Summary
    ws_sum = wb_out.create_sheet("Summary")
    ws_sum.column_dimensions["A"].width = 48
    ws_sum.column_dimensions["B"].width = 10
    summary_rows = [
        ("Metric", "Count"),
        ("Total SS employees in Book 1.xlsx",         "~263"),
        ("Employees WITH resume in DB (after this run)", len(dumped_ids)),
        ("Employees STILL without resume (this sheet)", len(remaining)),
        ("Dumped in this run",                           success),
    ]
    for i, (lbl, val) in enumerate(summary_rows, 1):
        ws_sum.cell(i, 1, lbl)
        ws_sum.cell(i, 2, val)
        if i == 1:
            ws_sum.cell(i, 1).font = Font(bold=True)
            ws_sum.cell(i, 2).font = Font(bold=True)

    ts       = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path = OUTPUT_DIR / f"Pending_Resume_Mapping_{ts}.xlsx"
    OUTPUT_DIR.mkdir(exist_ok=True)
    wb_out.save(out_path)
    print(f"Updated Excel saved: {out_path}")
    print(f"Employees still without resume: {len(remaining)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true",
                        help="Show what would be dumped — no DB writes")
    args = parser.parse_args()
    asyncio.run(run(dry_run=args.dry_run))
