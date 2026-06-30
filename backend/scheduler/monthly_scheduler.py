import asyncio
import logging
import calendar
from collections.abc import Awaitable, Callable
from datetime import datetime
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")
logger = logging.getLogger(__name__)


class MonthlyScheduler:
    def __init__(
        self,
        job: Callable[[], Awaitable[int]],
        run_day: int,
        run_hour: int,
        run_minute: int,
        ) -> None:
        self._job = job
        self._run_day = run_day
        self._run_hour = run_hour
        self._run_minute = run_minute
        self._task: asyncio.Task[None] | None = None
        self._stop_event = asyncio.Event()

    def start(self) -> None:
        if self._task and not self._task.done():
            return
        self._stop_event.clear()
        self._task = asyncio.create_task(self._runner(), name="monthly-scheduler")
        logger.info("Monthly scheduler started.")

    async def stop(self) -> None:
        if not self._task:
            return
        self._stop_event.set()
        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass
        logger.info("Monthly scheduler stopped.")

    async def run_once(self) -> int:
        return await self._job()

    async def _runner(self) -> None:
        while not self._stop_event.is_set():
            now = datetime.now(IST)
            next_run = self._compute_next_monthly_run(now)
            delay = max(0.0, (next_run - now).total_seconds())

            logger.info("Next scheduler run at %s (in %.1f seconds)", next_run, delay)

            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=delay)
                break
            except asyncio.TimeoutError:
                pass

            if self._stop_event.is_set():
                break

            try:
                sent_count = await self._job()
                logger.info("Scheduler cycle completed. Emails queued: %s", sent_count)
            except Exception:
                logger.exception("Scheduler cycle failed.")

    def _compute_next_monthly_run(self, now: datetime) -> datetime:
        if now.tzinfo is None:
            now = now.replace(tzinfo=IST)

        year = now.year
        month = now.month

        last_day = calendar.monthrange(year, month)[1]
        day = min(self._run_day, last_day)

        candidate = datetime(
            year=year,
            month=month,
            day=day,
            hour=self._run_hour,
            minute=self._run_minute,
            tzinfo=IST,
        )

        if candidate <= now:
            if month == 12:
                year += 1
                month = 1
            else:
                month += 1

            last_day = calendar.monthrange(year, month)[1]
            day = min(self._run_day, last_day)
            candidate = datetime(
                year=year,
                month=month,
                day=day,
                hour=self._run_hour,
                minute=self._run_minute,
                tzinfo=IST,
            )

        return candidate
