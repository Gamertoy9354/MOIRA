"""Application configuration loaded from environment variables."""

from __future__ import annotations

import os
import contextvars

from dotenv import load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

user_credentials: contextvars.ContextVar[dict[str, any] | None] = contextvars.ContextVar("user_credentials", default=None)

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

    # ── Supabase ─────────────────────────────────────────────────────────────
    supabase_url: str = Field(default="")
    supabase_service_role_key: str = Field(default="")

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
    """Return singleton settings instance, with user-specific ContextVar overrides."""
    global _settings
    if _settings is None:
        _settings = Settings()
    
    try:
        custom = user_credentials.get()
        if custom:
            merged = _settings.model_dump()
            for k, v in custom.items():
                k_lower = k.lower().strip()
                if k_lower in merged and v is not None:
                    target_type = type(merged[k_lower])
                    if target_type is bool and isinstance(v, str):
                        merged[k_lower] = v.lower() in ("true", "1", "yes")
                    elif target_type is int and isinstance(v, str):
                        try:
                            merged[k_lower] = int(v)
                        except ValueError:
                            pass
                    else:
                        merged[k_lower] = v
            return Settings(**merged)
    except Exception:
        pass

    return _settings


def reload_settings() -> Settings:
    """Force re-read from os.environ and reset the singleton.

    Call this after hot-injecting new values via os.environ so that all
    subsequent get_settings() calls pick up the new values immediately.
    """
    global _settings
    _settings = Settings()
    return _settings


def get_credential(key: str, default: str | None = None) -> str | None:
    """Get a credential value, checking user-specific ContextVar overrides first."""
    try:
        custom = user_credentials.get()
        if custom and key.lower().strip() in custom:
            val = custom[key.lower().strip()]
            if val is not None:
                return str(val)
    except Exception:
        pass
    return os.environ.get(key, default)
