from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parents[2]
_PROJECT_DIR = _BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # Root .env is shared with Docker Compose; backend/.env can override it.
        env_file=(_PROJECT_DIR / ".env", _BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "sqlite:///./data/app.db"
    environment: str = "development"
    cors_origins: list[str] = ["http://localhost:5173"]

    # Authentication is mandatory: the app refuses to start without these.
    auth_username: str = ""
    auth_password: SecretStr = SecretStr("")
    auth_session_ttl_minutes: int = 720
    auth_session_idle_minutes: int = 60
    # Defaults to True in production. Only disable when serving over plain HTTP.
    auth_cookie_secure: bool | None = None
    auth_max_login_attempts: int = 5
    auth_login_window_seconds: int = 300

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def cookie_secure(self) -> bool:
        if self.auth_cookie_secure is not None:
            return self.auth_cookie_secure
        return self.is_production


settings = Settings()
