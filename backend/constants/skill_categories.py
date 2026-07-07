"""Canonical skill categories for the HR Skill Dashboard.

employee_skill_summary.current_skill is restricted to exactly one of
SKILL_CATEGORIES, selected via a dropdown in the UI. normalize_skill() maps
free-text / legacy values (e.g. from resumes, or values typed directly
against the API) onto this fixed list so skill racks stay clean and
comparable across employees, instead of fragmenting into near-duplicate
combinations like "C#/.NET" vs ".NET/C#" vs "DevOps(AWS)" vs "DevOps(GCP)".
"""

SKILL_CATEGORIES = [
    "React",
    "Angular",
    ".NET",
    "Java",
    "Automation Testing",
    "PO",
    "DevOps",
    "AI",
    "IT",
    "PHP & Laravel",
    "Data Engineering",
    "UI/UX",
    "Java Full Stack",
    "Technical Writing",
    ".NET Full Stack",
    "Data Analysis",
    "BA",
    "Other",
]

# Ordered (canonical_label, [keyword triggers]); first rule that matches wins.
# Keep more specific labels (e.g. "Java Full Stack") above their generic
# counterpart ("Java"), and backend frameworks above frontend ones, so a
# compound mention like "Java / Spring Boot / Angular" resolves to the
# backend-lead bucket ("Java") rather than the supporting frontend tech.
_SKILL_KEYWORD_RULES: list[tuple[str, list[str]]] = [
    ("Java Full Stack", ["java full stack", "java fullstack"]),
    (".NET Full Stack", [".net full stack", ".net fullstack", "dotnet full stack", "dotnet fullstack"]),
    ("PHP & Laravel", ["php", "laravel"]),
    ("Data Engineering", ["data engineering", "data engineer", "etl", "data pipeline"]),
    ("Data Analysis", ["data analysis", "data analyst", "data visualization"]),
    ("UI/UX", ["ui/ux", "ui-ux", "ux design", "ui design", "user experience"]),
    ("Technical Writing", ["technical writing", "tech writer", "technical writer", "documentation specialist"]),
    ("Automation Testing", [
        "automation testing", "manual testing", "qa automation", "selenium",
        "bdd", "playwright", "test engineer", "sdet", "qa engineer", "appium",
    ]),
    ("DevOps", ["devops"]),
    ("AI", ["artificial intelligence", "machine learning", "genai", "llm", " ai ", " ai/"]),
    ("BA", ["business analyst", " ba "]),
    ("PO", ["product owner", " po "]),
    (".NET", [".net", "dotnet", "c#"]),
    ("Java", ["java", "spring boot", "spring", "j2ee"]),
    ("React", ["react"]),
    ("Angular", ["angular"]),
    ("IT", ["it support", "information technology", "helpdesk", "service desk"]),
]


def normalize_skill(raw: str) -> str:
    """Map a free-text or legacy skill string onto one of SKILL_CATEGORIES.

    e.g. "DevOps(AWS)" and "DevOps(GCP)" both resolve to "DevOps";
    "C#/.NET" resolves to ".NET". Falls back to "IT" — the most general
    catch-all category — if nothing matches.
    """
    if not raw or not raw.strip():
        return "Other"

    cleaned = raw.strip()

    # Exact match against the canonical list short-circuits keyword matching
    # (covers the normal case where the UI dropdown already sent a valid value).
    for label in SKILL_CATEGORIES:
        if cleaned.lower() == label.lower():
            return label

    lowered = f" {cleaned.lower()} "
    for label, keywords in _SKILL_KEYWORD_RULES:
        if any(kw in lowered for kw in keywords):
            return label

    return "Other"
