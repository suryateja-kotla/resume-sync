import json
import os
import datetime
import urllib.parse
import pandas as pd
import logging

logger = logging.getLogger(__name__)

_OUTPUT_DIR = os.getenv("EXCEL_OUTPUT_DIR", "output_excels")
_FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:4200")


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
        names = df["Name"] if has_resume_links and "Name" in df.columns else None
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
            name_values = names if names is not None else [None] * len(df)
            for row_idx, (blob_name, employee_id, name) in enumerate(
                zip(resume_paths, employee_ids, name_values), start=1
            ):  # +1 for header row
                if blob_name and not pd.isna(blob_name) and employee_id and not pd.isna(employee_id):
                    # Link points at the frontend's in-browser resume viewer,
                    # not the raw backend file endpoint — that endpoint sends
                    # Content-Disposition: attachment, which makes browsers
                    # show their native "Open/Save" download prompt instead
                    # of just showing the resume. The viewer page fetches the
                    # same bytes through axios and renders them inline with
                    # docx-preview, so clicking the link opens the resume
                    # directly with no extra confirmation step.
                    query = f"?name={urllib.parse.quote(str(name))}" if name and not pd.isna(name) else ""
                    url = f"{_FRONTEND_BASE_URL}/hr/resume/{employee_id}{query}"
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
