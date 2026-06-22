"""Application configuration loaded from environment variables."""

from __future__ import annotations

import os

from dotenv import load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

def find_env_file() -> str:
    if os.path.exists(".env"):
        return ".env"
    cur = os.path.abspath(os.path.dirname(__file__))
    while True:
        candidate = os.path.join(cur, ".env")
        if os.path.exists(candidate):
            return candidate
        parent = os.path.dirname(cur)
        if parent == cur:
            break
        cur = parent
    return ".env"

env_path = find_env_file()
load_dotenv(env_path)


class Settings(BaseSettings):
    # ── Active AI Provider ───────────────────────────────────────────────────
    # One of: nvidia | groq | openrouter | lmstudio
    active_provider: str = Field(default="nvidia")

    # ── NVIDIA NIM ───────────────────────────────────────────────────────────
    nvidia_api_key: str = Field(default="")
    nvidia_base_url: str = Field(default="https://integrate.api.nvidia.com/v1")
    nvidia_model: str = Field(default="meta/llama-3.3-70b-instruct")

    # ── Groq ─────────────────────────────────────────────────────────────────
    groq_api_key: str = Field(default="")
    groq_model: str = Field(default="llama-3.3-70b-versatile")

    # ── OpenRouter ───────────────────────────────────────────────────────────
    openrouter_api_key: str = Field(default="")
    openrouter_base_url: str = Field(default="https://openrouter.ai/api/v1")
    openrouter_model: str = Field(default="meta-llama/llama-3.3-70b-instruct:free")

    # ── LM Studio (local) ────────────────────────────────────────────────────
    lmstudio_base_url: str = Field(default="http://localhost:1234/v1")
    lmstudio_model: str = Field(default="local-model")
    lmstudio_api_key: str = Field(default="lm-studio")

    # ── Jira ─────────────────────────────────────────────────────────────────
    jira_base_url: str = Field(default="")
    jira_email: str = Field(default="")
    jira_api_token: str = Field(default="")
    jira_default_project: str = Field(default="SCRUM")

    # ── GitHub ───────────────────────────────────────────────────────────────
    github_token: str = Field(default="")
    github_default_repo_owner: str = Field(default="")

    # ── Slack ────────────────────────────────────────────────────────────────
    slack_bot_token: str = Field(default="")
    slack_default_channel: str = Field(default="#general")

    # ── Google Sheets ────────────────────────────────────────────────────────
    google_service_account_json: str = Field(default="")
    google_service_account_b64: str = Field(default="")
    google_audit_spreadsheet_id: str = Field(default="")

    # ── Database ─────────────────────────────────────────────────────────────
    database_url: str = Field(default="postgresql://postgres:postgres@localhost:5432/mcpgateway")
    postgres_user: str = Field(default="postgres")
    postgres_password: str = Field(default="postgres")
    postgres_db: str = Field(default="mcpgateway")

    # ── Redis ────────────────────────────────────────────────────────────────
    redis_url: str = Field(default="redis://localhost:6379")

    # ── App Config ───────────────────────────────────────────────────────────
    app_host: str = Field(default="0.0.0.0")
    app_port: int = Field(default=8000)
    debug: bool = Field(default=True)
    max_recovery_attempts: int = Field(default=3)
    max_retry_attempts: int = Field(default=3)
    retry_backoff_base: int = Field(default=2)

    model_config = SettingsConfigDict(
        env_file=env_path,
        case_sensitive=False,
        extra="ignore",
    )


_settings: Settings | None = None


def get_settings() -> Settings:
    """Return singleton settings instance."""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings


def reload_settings() -> Settings:
    """Force re-read from os.environ and reset the singleton.

    Call this after hot-injecting new values via os.environ so that all
    subsequent get_settings() calls pick up the new values immediately.
    """
    global _settings
    _settings = Settings()
    return _settings
