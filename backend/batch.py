import asyncio
import os
from tools.resume_tool import extract_resume, generate_resume_docx
from services.db_service import upsert_resume_path

async def process_single_resume(file_path: str, employee_id: str):
    print(f"⏳ [{employee_id}] Starting extraction...")
    try:
        # Step 1: Extract
        ext_res = await extract_resume(employee_id, file_path)
        if ext_res.get("status") == "error":
            print(f"❌ [{employee_id}] Failed Extraction: {ext_res.get('message')}")
            return employee_id, "Failed Extr.", ext_res.get("message")
        
        print(f"⚙️ [{employee_id}] Extraction complete. Generating DOCX...")

        # Step 2: Generate DOCX
        doc_res = await generate_resume_docx(employee_id)
        if doc_res.get("status") == "error":
            print(f"❌ [{employee_id}] Failed DOCX: {doc_res.get('message')}")
            return employee_id, "Failed DOCX", doc_res.get("message")

        resume_path = doc_res.get("resume_path")
        
        # Step 3: Save to DB
        up_res = await upsert_resume_path(employee_id, resume_path)
        if up_res.get("status") == "error":
            print(f"❌ [{employee_id}] Failed DB Update: {up_res.get('message')}")
            return employee_id, "Failed DB", up_res.get("message")

        print(f"✅ [{employee_id}] Successfully processed!")
        return employee_id, "Success", resume_path

    except Exception as e:
        print(f"🚨 [{employee_id}] Critical Error: {str(e)}")
        return employee_id, "Error", str(e)

async def main():
    folder_path = r"C:\Users\LENOVO\Downloads\resume-sync\backend\resumes_to_process"
    batch_size = 10

    if not os.path.exists(folder_path):
        os.makedirs(folder_path)
        print(f"Created '{folder_path}'. Please add PDF/DOCX files and re-run.")
        return

    files = [
        os.path.join(folder_path, f) for f in os.listdir(folder_path)
        if f.lower().endswith(('.pdf', '.docx'))
    ]

    if not files:
        print("📂 No resumes found in the folder. Please add some files.")
        return

    print(f"🚀 Found {len(files)} files to process. Starting batch job...\n")

    results = []
    
    for i in range(0, len(files), batch_size):
        batch = files[i:i + batch_size]
        print(f"--- Processing Batch {i//batch_size + 1} ({len(batch)} files) ---")
        tasks = []
        
        for file_path in batch:
            emp_id = os.path.splitext(os.path.basename(file_path))[0]
            tasks.append(process_single_resume(file_path, emp_id))
        
        batch_results = await asyncio.gather(*tasks)
        results.extend(batch_results)
        print("-" * 50)

    # Print final clear column-wise report
    print(f"\n{'EMPLOYEE ID':<20} | {'STATUS':<15} | {'PATH / ERROR DETAILS'}")
    print("=" * 80)
    for res in results:
        print(f"{res[0]:<20} | {res[1]:<15} | {res[2]}")

if __name__ == "__main__":
    asyncio.run(main())