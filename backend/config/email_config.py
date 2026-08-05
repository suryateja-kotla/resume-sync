from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App settings unrelated to identity.

    The SMTP fields that used to live here are gone: mail is sent through
    Microsoft Graph now, which authenticates with the app registration rather
    than a mailbox password. Sender and delivery mode live in
    config/entra_config.py alongside the credentials they depend on.
    """

    app_name: str = "Sync-Folio"
    api_prefix: str = "/api/v1"
    frontend_update_url: str = "http://localhost:4200/employee-dashboard"
    backend_base_url: str = "http://localhost:8000"

    scheduler_run_day: int = 24
    scheduler_run_hour: int = 9
    scheduler_run_minute: int = 21

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )


settings = Settings()
