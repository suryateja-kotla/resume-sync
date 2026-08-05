"""
Run-once bookkeeping for scheduled jobs.

Scheduled work is triggered over HTTP, and HTTP triggers can arrive more than
once: Cloud Scheduler retries on timeout, a deploy can overlap a run, someone
can press the button twice. For the directory sync that is harmless — it is
idempotent. For the monthly email it is not: a second run mails ~280 real
employees a duplicate.

So a completed run is recorded against a *period key*, and a second attempt in
the same period is refused. `force=True` overrides, for the case where a run
genuinely needs repeating.

The record is written **after** the job completes, not before. A crashed run
therefore leaves no marker and can be retried — the failure mode we want is
"might run twice after a crash", not "silently never runs again".
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from pymongo.errors import PyMongoError

from services.db_service import db

logger = logging.getLogger(__name__)

col_job_runs = db["job_runs"]

MONTHLY_EMAIL = "monthly_email"
DIRECTORY_SYNC = "directory_sync"


def month_key(now: datetime | None = None) -> str:
    """Period key for the monthly cycle, e.g. '2026-08'."""
    return (now or datetime.now(timezone.utc)).strftime("%Y-%m")


def day_key(now: datetime | None = None) -> str:
    """Period key for daily jobs, e.g. '2026-08-03'."""
    return (now or datetime.now(timezone.utc)).strftime("%Y-%m-%d")


async def already_ran(job: str, period: str) -> Optional[dict[str, Any]]:
    """The completion record for this job+period, or None."""
    try:
        return await col_job_runs.find_one(
            {"job": job, "period": period}, {"_id": 0}
        )
    except PyMongoError as exc:
        # Fail *open* deliberately, and only for this check: if the bookkeeping
        # store is unreachable we would rather risk a duplicate than block a
        # cycle entirely. The alternative silently skips a month.
        logger.error("already_ran(%s, %s) failed: %s", job, period, exc)
        return None


async def record_run(job: str, period: str, summary: dict[str, Any]) -> None:
    """Mark a job complete for a period. Called only on success."""
    try:
        await col_job_runs.update_one(
            {"job": job, "period": period},
            {"$set": {
                "job": job,
                "period": period,
                "completed_at": datetime.now(timezone.utc),
                "summary": summary,
            }},
            upsert=True,
        )
    except PyMongoError as exc:
        logger.error("record_run(%s, %s) failed: %s", job, period, exc)


async def last_run(job: str) -> Optional[dict[str, Any]]:
    """Most recent completion of a job, for status reporting."""
    try:
        rows = await col_job_runs.find({"job": job}, {"_id": 0}).sort(
            "completed_at", -1
        ).limit(1).to_list(length=1)
        return rows[0] if rows else None
    except PyMongoError as exc:
        logger.error("last_run(%s) failed: %s", job, exc)
        return None
