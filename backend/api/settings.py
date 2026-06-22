"""Settings API — save environment variables and hot-reload them without restart."""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

from utils.config import reload_settings
from utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/v1/settings")

# Absolute path to the project root .env file
_ENV_PATH = Path(__file__).parent.parent.parent / ".env"


class EnvUpdateRequest(BaseModel):
    """Map of env var keys → values to set."""
    values: dict[str, str]


@router.post("/env")
async def update_env(body: EnvUpdateRequest) -> dict:
    """
    Persist new env values to .env and hot-inject them into the running process.
    Reloads settings singleton and re-bootstraps affected connectors.
    """
    updated_keys: list[str] = []
    errors: list[str] = []

    # ── 1. Inject into os.environ immediately ──────────────────────────────
    for key, value in body.values.items():
        env_key = key.upper()
        os.environ[env_key] = str(value)
        updated_keys.append(env_key)

    # ── 2. Write / update .env file ────────────────────────────────────────
    try:
        lines: list[str] = []
        if _ENV_PATH.exists():
            lines = _ENV_PATH.read_text(encoding="utf-8").splitlines()

        for key, value in body.values.items():
            env_key = key.upper()
            found = False
            for i, line in enumerate(lines):
                stripped = line.strip()
                if stripped.startswith(f"{env_key}=") or stripped.startswith(f"{env_key} ="):
                    lines[i] = f'{env_key}="{value}"'
                    found = True
                    break
            if not found:
                lines.append(f'{env_key}="{value}"')

        _ENV_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
        logger.info(".env file updated", keys=updated_keys)

    except Exception as exc:
        msg = f"Could not write .env: {exc}"
        logger.warning(msg)
        errors.append(msg)

    # ── 3. Reset the settings singleton ────────────────────────────────────
    try:
        reload_settings()
    except Exception as exc:
        msg = f"Settings reload failed: {exc}"
        logger.warning(msg)
        errors.append(msg)

    # ── 4. Re-bootstrap connectors whose credentials may have changed ──────
    connector_keys = {
        "GITHUB_TOKEN", "GITHUB_DEFAULT_REPO_OWNER",
        "SLACK_BOT_TOKEN", "SLACK_DEFAULT_CHANNEL",
        "JIRA_BASE_URL", "JIRA_EMAIL", "JIRA_API_TOKEN", "JIRA_DEFAULT_PROJECT",
        "GOOGLE_SERVICE_ACCOUNT_JSON", "GOOGLE_AUDIT_SPREADSHEET_ID",
    }
    needs_reload = any(k in connector_keys for k in updated_keys)

    if needs_reload:
        try:
            from core.connector_registry import bootstrap_registry
            await bootstrap_registry(force=True)
            logger.info("ConnectorRegistry re-bootstrapped after credential update")
        except Exception as exc:
            msg = f"Connector re-bootstrap failed: {exc}"
            logger.warning(msg)
            errors.append(msg)

    return {
        "updated_keys": updated_keys,
        "env_file_updated": not any("Could not write" in e for e in errors),
        "errors": errors,
        "message": "Settings saved and hot-reloaded successfully." if not errors else "Saved with warnings.",
    }


@router.get("/env")
async def get_env() -> dict:
    """Return all current settings for UI display and editing."""
    from utils.config import get_settings
    s = get_settings()
    return {
        "active_provider": s.active_provider,
        "nvidia_api_key": s.nvidia_api_key,
        "nvidia_base_url": s.nvidia_base_url,
        "nvidia_model": s.nvidia_model,
        "groq_api_key": s.groq_api_key,
        "groq_model": s.groq_model,
        "openrouter_api_key": s.openrouter_api_key,
        "openrouter_base_url": s.openrouter_base_url,
        "openrouter_model": s.openrouter_model,
        "lmstudio_base_url": s.lmstudio_base_url,
        "lmstudio_model": s.lmstudio_model,
        "lmstudio_api_key": s.lmstudio_api_key,
        "github_token": s.github_token,
        "github_default_repo_owner": s.github_default_repo_owner,
        "jira_base_url": s.jira_base_url,
        "jira_email": s.jira_email,
        "jira_api_token": s.jira_api_token,
        "jira_default_project": s.jira_default_project,
        "slack_bot_token": s.slack_bot_token,
        "slack_default_channel": s.slack_default_channel,
        "google_service_account_json": s.google_service_account_json,
        "google_service_account_b64": s.google_service_account_b64,
        "google_audit_spreadsheet_id": s.google_audit_spreadsheet_id,
        "database_url": s.database_url,
        "redis_url": s.redis_url,
        "app_host": s.app_host,
        "app_port": str(s.app_port),
        "debug": str(s.debug).lower(),
        "max_recovery_attempts": str(s.max_recovery_attempts),
        "max_retry_attempts": str(s.max_retry_attempts),
        "retry_backoff_base": str(s.retry_backoff_base),
    }

