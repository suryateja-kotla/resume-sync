import json
import os
import datetime
import pandas as pd
import logging
from services.gcs_service import get_signed_url

logger = logging.getLogger(__name__)

_OUTPUT_DIR = os.getenv("EXCEL_OUTPUT_DIR", "output_excels")


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

        has_resume_links = "resume_path" in df.columns
        resume_paths = df["resume_path"] if has_resume_links else None
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

        if has_resume_links:
            workbook = writer.book
            worksheet = writer.sheets["Search Results"]
            link_format = workbook.add_format(
                {"font_color": "blue", "underline": 1}
            )
            resume_col = df.columns.get_loc("Resume")
            for row_idx, blob_name in enumerate(resume_paths, start=1):  # +1 for header row
                if blob_name and not pd.isna(blob_name):
                    try:
                        # Signed URL valid for 7 days — long enough for HR to
                        # revisit a downloaded report without re-generating it,
                        # short enough that a leaked report doesn't leak resumes forever.
                        url = get_signed_url(blob_name, expires_in_minutes=7 * 24 * 60)
                        worksheet.write_url(
                            row_idx, resume_col, url,
                            cell_format=link_format, string="Open Resume",
                        )
                    except Exception as e:
                        logger.warning(f"Failed to sign URL for {blob_name}: {e}")
                        worksheet.write(row_idx, resume_col, "Link unavailable")

        writer.close()
        return {
            "status": "success",
            "saved_location": full_path,
            "message": "Excel report generated.",
        }

    except Exception as e:
        logger.error(f"kavya Error generating Excel: {str(e)}")
        return {"status": "error", "message": str(e)}
