"""
Derive a draft skill profile from a parsed resume.

## Why this exists

Uploading a resume creates `employee_resume_data` and nothing else. The skill
profile is a separate form the employee has to open and fill in by hand, and
the numbers say how that goes: 251 of 258 people have never touched theirs
since the July seed, and three people uploaded resumes whose skill profile was
never created at all — leaving them invisible in the Employee List, the skill
racks and every talent search.

Confirming is a fundamentally easier act than authoring. Pre-filling turns a
blank form into "is this right? yes", which is the difference between a task
people do and one they postpone indefinitely.

## What it will and will not guess

Derivable from a resume with confidence:

    current_designation   most recent work_experience entry
    total_exp             the parsed total_experience

Inferred, and therefore a *suggestion*:

    current_skill         the canonical category most of their listed
                          technologies map onto

Never guessed:

    current_skill_exp     not present in a resume in any reliable form
    primary/secondary     ditto — fabricating these would be worse than
                          leaving them blank, because a wrong value looks
                          identical to a confirmed one

## The rule that keeps it safe

Only ever fills fields that are currently empty. Someone who set their skill
to "Java" because that is their project must not have it overwritten with
"Automation Testing" because their resume lists Selenium. That single rule is
the difference between this being helpful and being infuriating.
"""

from __future__ import annotations

import logging
from collections import Counter
from typing import Any, Optional

from constants.skill_categories import normalize_skill

logger = logging.getLogger(__name__)

# normalize_skill() returns these when it cannot place a value. Counting them
# would let unmatched noise win the vote, so they are excluded from the tally
# and only used if nothing else matched at all.
_FALLBACK_CATEGORIES = {"Other", "IT"}


def infer_current_skill(technical_skills: dict[str, list[str]] | None) -> Optional[str]:
    """The canonical category most of the person's technologies map onto.

    Resume categories are free text from whatever the LLM extracted
    ("Automation Tools", "Programming Languages"), so the *values* are mapped
    rather than the headings: Selenium, Playwright, Cucumber, JMeter and
    Postman all resolve to "Automation Testing", which wins the vote.
    """
    if not technical_skills:
        return None

    votes: Counter[str] = Counter()
    for values in technical_skills.values():
        for value in values or []:
            if not isinstance(value, str) or not value.strip():
                continue
            category = normalize_skill(value)
            if category not in _FALLBACK_CATEGORIES:
                votes[category] += 1

    if not votes:
        return None

    top, count = votes.most_common(1)[0]
    # A single mention is not a signal — someone listing "Docker" once among
    # twenty Java skills should not be filed under DevOps.
    if count < 2:
        return None
    return top


def latest_designation(work_experience: list[dict[str, Any]] | None) -> Optional[str]:
    """Designation from the most recent role.

    Resume designations are often shouted ("SENIOR SOFTWARE TEST ENGINEER"),
    so they are title-cased — the value is shown in the UI next to
    human-entered ones and would otherwise look broken.
    """
    if not work_experience:
        return None
    for entry in work_experience:
        designation = (entry or {}).get("designation")
        if isinstance(designation, str) and designation.strip():
            cleaned = designation.strip()
            # Leave mixed-case values alone; only fix all-caps.
            return cleaned.title() if cleaned.isupper() else cleaned
    return None


def derive_draft(resume: dict[str, Any]) -> dict[str, Any]:
    """Fields worth pre-filling. Absent keys mean "no confident guess"."""
    draft: dict[str, Any] = {}

    designation = latest_designation(resume.get("work_experience"))
    if designation:
        draft["current_designation"] = designation

    total = resume.get("total_experience")
    if isinstance(total, (int, float)) and total > 0:
        draft["total_exp"] = round(float(total), 1)

    skill = infer_current_skill(resume.get("technical_skills"))
    if skill:
        draft["current_skill"] = skill

    return draft


def fields_to_fill(
    draft: dict[str, Any], existing: dict[str, Any] | None
) -> dict[str, Any]:
    """Narrow a draft to fields the employee has not already set.

    This is the guard that makes pre-filling safe. Without it, every resume
    upload would silently overwrite deliberate choices — and someone who
    corrected their skill once, only to see it reverted, would stop trusting
    the tool entirely.
    """
    existing = existing or {}
    result = {}
    for key, value in draft.items():
        current = existing.get(key)
        is_empty = current is None or current == "" or current == 0
        if is_empty:
            result[key] = value
    return result
