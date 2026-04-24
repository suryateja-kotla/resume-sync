import logging

from services.db_service import get_all_employees
from services.email_service import EmailService

logger = logging.getLogger(__name__)


class SchedulerAgent:
    def __init__(self, email_service: EmailService, frontend_update_url: str) -> None:
        self._email_service = email_service
        self._frontend_update_url = frontend_update_url

    async def run_cycle(self) -> int:
        employees = await get_all_employees()
        if not employees:
            logger.info("No employees found for resume update email cycle.")
            return 0

        sent_count = 0
        for employee in employees:
            email = employee.get("email")
            name = employee.get("fullName") or "Team Member"
            if not email:
                logger.warning("Skipping employee without email: %s", employee)
                continue

            try:
                self._email_service.send_resume_update_prompt(
                    recipient_email=email,
                    recipient_name=name,
                    update_url=self._frontend_update_url,
                )
                sent_count += 1
            except Exception:
                logger.exception("Failed to send resume update prompt to %s", email)

        logger.info("Resume update emails sent: %s", sent_count)
        return sent_count
