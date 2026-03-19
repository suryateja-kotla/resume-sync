# tools/normalizer.py
"""
ResumeNormalizer
----------------
Converts an EmployeePayload (Pydantic model) into the flat dict
that DocxTool.generate_resume() expects.

Keeping this separate means both the Ingestion Agent and any
future batch-processing script can reuse the same normalization logic.
"""

from schemas.schemas import EmployeePayload


class ResumeNormalizer:

    @staticmethod
    def normalize(payload: EmployeePayload) -> dict:
        """
        Maps EmployeePayload → template placeholder dict.

        Returns:
            {"status": "success", "data": <normalized_dict>}
            {"status": "error",   "message": <reason>}
        """
        try:
            normalized = {}

            normalized["FULL_NAME"] = payload.personal_info.full_name
            normalized["SUMMARY"] = payload.profile_summary

            normalized["SKILLS"] = [
                {"SKILL_CATEGORY": category, "SKILL_VALUES": ", ".join(values)}
                for category, values in payload.technical_skills.items()
            ]

            normalized["EXPERIENCES"] = []
            for exp in payload.work_experience:
                normalized["EXPERIENCES"].append(
                    {
                        "DESIGNATION": exp.designation,
                        "COMPANY_NAME": exp.company.name,
                        "COMPANY_DESCRIPTION": exp.company.description or "",
                        "DURATION": exp.duration,
                        "PROJECT_NAME": exp.project.name,
                        "CLIENT": exp.project.client,
                        "ROLE": exp.project.role or exp.designation,
                        "ENVIRONMENT": ", ".join(exp.project.environment),
                        "PROJECT_DETAILS": exp.project.project_description,
                        "RESPONSIBILITIES_BLOCK": exp.project.responsibilities,
                    }
                )

            normalized["EDUCATION"] = [
                {
                    "SL_NO": idx + 1,
                    "YEAR": edu.year or "",
                    "INSTITUTE": edu.institution,
                    "STREAM": edu.stream,
                    "PERCENTAGE": str(edu.cgpa),
                }
                for idx, edu in enumerate(payload.education)
            ]

            normalized["CERTIFICATIONS"] = payload.certifications or []
            normalized["ACHIEVEMENTS"] = payload.achievements or []
            normalized["INTERESTS"] = payload.interests or []

            return {"status": "success", "data": normalized}

        except Exception as e:
            return {"status": "error", "message": str(e)}
