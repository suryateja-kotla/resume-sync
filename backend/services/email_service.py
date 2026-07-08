import logging
import smtplib
from email.message import EmailMessage
from pathlib import Path

from config.email_config import Settings

logger = logging.getLogger(__name__)


class EmailService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def send_resume_update_prompt(
        self,
        recipient_email: str,
        recipient_name: str,
        update_url: str,
    ) -> None:
        subject = "Want to update your resume?"
        html_body = self._generate_update_prompt_html(recipient_name, update_url)

        if self._settings.email_delivery_mode.lower() == "smtp":
            self._send_smtp_message(recipient_email, subject, html_body)
            return

        # Console mode is useful for development and verification.
        logger.info(
            "Email delivery mode is console. Email to %s would be sent with subject %s.",
            recipient_email,
            subject,
        )
        logger.debug("Email HTML content for %s: %s", recipient_email, html_body)

    def send_new_employee_invite(
        self,
        recipient_email: str,
        recipient_name: str,
        update_url: str,
    ) -> None:
        subject = "Welcome! Please upload your resume"
        html_body = self._generate_invite_html(recipient_name, update_url)

        if self._settings.email_delivery_mode.lower() == "smtp":
            self._send_smtp_message(recipient_email, subject, html_body)
            return

        # Console mode is useful for development and verification.
        logger.info(
            "Email delivery mode is console. Invite email to %s would be sent with subject %s.",
            recipient_email,
            subject,
        )
        logger.debug("Email HTML content for %s: %s", recipient_email, html_body)

    def send_password_reset(
        self,
        recipient_email: str,
        recipient_name: str,
        reset_url: str,
        expires_minutes: int = 30,
    ) -> None:
        subject = "Reset your ResumeSync password"
        html_body = self._generate_password_reset_html(
            recipient_name, reset_url, expires_minutes
        )
        if self._settings.email_delivery_mode.lower() == "smtp":
            self._send_smtp_message(recipient_email, subject, html_body)
            return
        logger.info(
            "Console mode — password reset email to %s, reset_url: %s",
            recipient_email, reset_url,
        )

    def _generate_password_reset_html(
        self, name: str, reset_url: str, expires_minutes: int
    ) -> str:
        template_path = (
            Path(__file__).parent.parent / "templates" / "password_reset_mail.html"
        )
        return template_path.read_text().format(
            name=name, reset_url=reset_url, expires_minutes=expires_minutes
        )

    def _generate_update_prompt_html(self, name: str, update_url: str) -> str:
        """Load and render the resume update email template."""
        template_path = (
            Path(__file__).parent.parent / "templates" / "resume_update_mail.html"
        )
        template_content = template_path.read_text()
        return template_content.format(name=name, update_url=update_url)

    def _generate_invite_html(self, name: str, update_url: str) -> str:
        """Load and render the new-employee onboarding invite email template."""
        template_path = (
            Path(__file__).parent.parent
            / "templates"
            / "new_employee_invite_mail.html"
        )
        template_content = template_path.read_text()
        return template_content.format(name=name, update_url=update_url)

    def _send_smtp_message(
        self, recipient: str, subject: str, html: str = None
    ) -> None:
        message = EmailMessage()
        message["From"] = self._settings.smtp_sender
        message["To"] = recipient
        message["Subject"] = subject
        message.set_content(html, subtype="html")

        if self._settings.smtp_use_ssl:
            with smtplib.SMTP_SSL(
                host=self._settings.smtp_host, port=self._settings.smtp_port
            ) as client:
                self._maybe_authenticate(client)
                client.send_message(message)
            return

        with smtplib.SMTP(
            host=self._settings.smtp_host, port=self._settings.smtp_port
        ) as client:
            if self._settings.smtp_use_tls:
                client.starttls()
            self._maybe_authenticate(client)
            client.send_message(message)

    def _maybe_authenticate(self, client: smtplib.SMTP) -> None:
        if self._settings.smtp_username and self._settings.smtp_password:
            client.login(self._settings.smtp_username, self._settings.smtp_password)
