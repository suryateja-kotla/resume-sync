import logging

from services.db_service import (
    get_monthly_email_recipients,
    mark_prompt_sent,
)
from services.email_content import Group, classify
from services.email_service import EmailService

logger = logging.getLogger(__name__)


class SchedulerAgent:
    """The resume/skill prompt cycle.

    Recipients come from get_monthly_email_recipients(), which reads the
    Entra-synced user_accounts collection rather than every row in
    employee_skill_summary. That filters out two groups this used to mail:

      - people who cannot sign in at all (guests, interns, disabled accounts),
        who have no way to action the prompt
      - the non-technical support functions (HR, TM, TA, Finance, IT,
        Operations, Business Development, Management, Support), who have no
        technical resume to keep current. MMS Technical Writers are
        deliberately still included, as is anyone in client delivery.

    ## One cycle, three messages

    Each recipient is classified by what they actually have, and gets copy
    matching what they will see when they click:

      COMPLETE    resume + skill profile  -> review and refresh
      NO_RESUME   nothing                 -> welcome, upload first
      NO_PROFILE  resume, no profile      -> finish the skill profile

    Sending one "update your resume" message to all of them meant 33 people
    who had never uploaded anything were told to *update* a resume, then
    landed on a blank upload screen.

    ## Launch mode

    `launch=True` sends the one-off announcement instead — same three-way
    split, but leading with what SyncFolio is, since most recipients have
    never heard of it.
    """

    def __init__(self, email_service: EmailService, frontend_update_url: str) -> None:
        self._email_service = email_service
        self._frontend_update_url = frontend_update_url

    async def run_cycle(self, launch: bool = False, period: str | None = None) -> int:
        recipients = await get_monthly_email_recipients()
        if not recipients:
            # An empty list most likely means the Entra directory sync has not
            # populated user_accounts yet, rather than that nobody qualifies —
            # so warn rather than reporting a quiet, successful no-op.
            logger.warning(
                "No recipients for the resume update cycle — has the Entra "
                "directory sync run?"
            )
            return 0

        sent_ids: list[str] = []
        counts = {g: 0 for g in Group}

        for person in recipients:
            email = person.get("email")
            if not email:
                logger.warning("Skipping recipient without an email: %s", person)
                continue

            group = classify(
                has_resume=person.get("has_resume", False),
                has_skill_profile=person.get("has_skill_profile", False),
            )

            try:
                await self._email_service.send_profile_prompt(
                    recipient_email=email,
                    recipient_name=person.get("fullName") or "Team Member",
                    employee_id=person.get("employeeId"),
                    group=group,
                    update_url=self._frontend_update_url,
                    launch=launch,
                    period=period,
                )
            except Exception:
                # One bad address must not stop the remaining ~277.
                logger.exception("Failed to send prompt to %s", email)
                continue

            counts[group] += 1
            if person.get("employeeId"):
                sent_ids.append(person["employeeId"])

        # Only after a successful send — a failed delivery should not start
        # someone's response clock, or they would show as "No Response" for an
        # email they never received.
        marked = await mark_prompt_sent(sent_ids)

        logger.info(
            "%s cycle complete: %s sent (%s complete, %s no-resume, %s no-profile); "
            "%s prompt timestamps recorded",
            "Launch" if launch else "Monthly",
            len(sent_ids),
            counts[Group.COMPLETE],
            counts[Group.NO_RESUME],
            counts[Group.NO_PROFILE],
            marked,
        )
        return len(sent_ids)
