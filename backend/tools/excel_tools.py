import json
import os
import datetime
import pandas as pd
import logging

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

        def create_hyperlink(path):
            if not path or pd.isna(path):
                return "N/A"
            return '=HYPERLINK("{}", "Open Resume")'.format(path.replace("/", "\\"))

        if "resume_path" in df.columns:
            df["clickable_resume"] = df["resume_path"].apply(create_hyperlink)
            df = df.drop(columns=["resume_path"])

        filename = (
            f"Talent_Search_{datetime.datetime.now().strftime('%Y-%m-%d_%H%M%S')}.xlsx"
        )
        full_path = os.path.join(_OUTPUT_DIR, filename)

        writer = pd.ExcelWriter(full_path, engine="xlsxwriter")
        df.to_excel(writer, index=False, sheet_name="Search Results")
        writer.close()
        return {
            "status": "success",
            "saved_location": full_path,
            "message": "Excel report generated.",
        }

    except Exception as e:
        logger.error(f"kavya Error generating Excel: {str(e)}")
        return {"status": "error", "message": str(e)}
