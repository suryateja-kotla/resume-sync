import json
import os
import datetime
import pandas as pd
import logging

logger = logging.getLogger(__name__)

_OUTPUT_DIR = os.getenv("EXCEL_OUTPUT_DIR", "output_excels")
_BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "http://localhost:8000")


def create_talent_excel(employee_data_json: str) -> dict:
    """
    Generates an Excel report containing employee IDs and clickable resume links.
    """
    try:
        if isinstance(employee_data_json, str):
            clean_json = (
                employee_data_json.replace("```json", "").replace("```", "").strip()
            )
            data = json.loads(clean_json)
        else:
            data = employee_data_json

        df = pd.DataFrame(data)

        if df.empty:
            return json.dumps({"status": "error", "message": "No data provided."})

        os.makedirs(_OUTPUT_DIR, exist_ok=True)

        has_resume_links = "resume_path" in df.columns and "Employee ID" in df.columns
        resume_paths = df["resume_path"] if has_resume_links else None
        employee_ids = df["Employee ID"] if has_resume_links else None
        if has_resume_links:
            # Leave a plain placeholder column for the DataFrame write; the
            # real clickable hyperlink is added afterwards via write_url(),
            # which produces an actual Excel hyperlink object — a literal
            # "=HYPERLINK(...)" string written through pandas is just inert
            # text, not a working link.
            df = df.drop(columns=["resume_path"])
            df["Resume"] = resume_paths.apply(
                lambda p: "Open Resume" if p and not pd.isna(p) else "N/A"
            )

        filename = (
            f"Talent_Search_{datetime.datetime.now().strftime('%Y-%m-%d_%H%M%S')}.xlsx"
        )
        full_path = os.path.join(_OUTPUT_DIR, filename)

        writer = pd.ExcelWriter(full_path, engine="xlsxwriter")
        df.to_excel(writer, index=False, sheet_name="Search Results")

        worksheet = writer.sheets["Search Results"]

        # Auto-size each column to its widest cell (header or data), so
        # names/emails don't render truncated behind Excel's fixed default
        # column width. xlsxwriter has no native auto-fit, so width is
        # computed from the actual string lengths written to the sheet.
        for col_idx, col_name in enumerate(df.columns):
            max_content_len = df[col_name].astype(str).map(len).max()
            header_len = len(str(col_name))
            width = max(max_content_len, header_len, 10) + 2  # padding
            worksheet.set_column(col_idx, col_idx, min(width, 60))

        if has_resume_links:
            workbook = writer.book
            link_format = workbook.add_format(
                {"font_color": "blue", "underline": 1}
            )
            resume_col = df.columns.get_loc("Resume")
            for row_idx, (blob_name, employee_id) in enumerate(zip(resume_paths, employee_ids), start=1):  # +1 for header row
                if blob_name and not pd.isna(blob_name) and employee_id and not pd.isna(employee_id):
                    # Link points at our own backend, which proxies the file
                    # from GCS — not a GCS signed URL, since generating one
                    # requires a signing-capable (service account) credential
                    # we don't currently have. The backend 404s cleanly for
                    # records that still hold a pre-migration local file path.
                    url = f"{_BACKEND_BASE_URL}/api/hr/resume-file/{employee_id}"
                    worksheet.write_url(
                        row_idx, resume_col, url,
                        cell_format=link_format, string="Open Resume",
                    )

        writer.close()
        return {
            "status": "success",
            "saved_location": full_path,
            "message": "Excel report generated.",
        }

    except Exception as e:
        logger.error(f"kavya Error generating Excel: {str(e)}")
        return {"status": "error", "message": str(e)}
