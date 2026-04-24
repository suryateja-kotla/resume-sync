from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Resume Sync Backend"
    api_prefix: str = "/api/v1"
    frontend_update_url: str = "http://localhost:4200/employee-dashboard"
    backend_base_url: str = "http://localhost:8000"

    scheduler_run_day: int = 24
    scheduler_run_hour: int = 9
    scheduler_run_minute: int = 21

    smtp_host: str = "localhost"
    smtp_port: int = 1025
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_sender: str = "noreply@resume-sync.local"
    smtp_use_tls: bool = False
    smtp_use_ssl: bool = False
    email_delivery_mode: str = Field(default="console", description="console or smtp")

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )


settings = Settings()
