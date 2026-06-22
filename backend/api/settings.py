"""Settings API — save environment variables and hot-reload them without restart."""

from __future__ import annotations

import os
from pathlib import Path
import httpx

from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel

from core.auth_middleware import require_auth
from utils.config import reload_settings
from utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/v1/settings")

# Absolute path to the project root .env file
_ENV_PATH = Path(__file__).parent.parent.parent / ".env"

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


def _supa_headers() -> dict:
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def _is_mock_mode() -> bool:
    return not SUPABASE_URL or not SUPABASE_SERVICE_KEY or "YOUR_SUPABASE" in SUPABASE_SERVICE_KEY or os.getenv("DEBUG", "true").lower() == "true"


class EnvUpdateRequest(BaseModel):
    """Map of env var keys → values to set."""
    values: dict[str, str]


def partition_values(values: dict[str, str]) -> dict[str, dict[str, str]]:
    # Uppercase all incoming keys for easier partitioning
    upper_values = {k.upper(): str(v) for k, v in values.items()}
    
    partitions = {
        "github": {},
        "slack": {},
        "jira": {},
        "sheets": {},
        "ai": {},
    }
    
    # Map github
    for k in ["GITHUB_TOKEN", "GITHUB_DEFAULT_REPO_OWNER"]:
        if k in upper_values:
            partitions["github"][k] = upper_values[k]
            
    # Map slack
    for k in ["SLACK_BOT_TOKEN", "SLACK_DEFAULT_CHANNEL"]:
        if k in upper_values:
            partitions["slack"][k] = upper_values[k]
            
    # Map jira
    for k in ["JIRA_BASE_URL", "JIRA_EMAIL", "JIRA_API_TOKEN", "JIRA_DEFAULT_PROJECT"]:
        if k in upper_values:
            partitions["jira"][k] = upper_values[k]
            
    # Map sheets
    for k in ["GOOGLE_SERVICE_ACCOUNT_JSON", "GOOGLE_AUDIT_SPREADSHEET_ID", "GOOGLE_SERVICE_ACCOUNT_B64", "GOOGLE_CLIENT_EMAIL", "GOOGLE_PRIVATE_KEY", "GOOGLE_PROJECT_ID"]:
        if k in upper_values:
            partitions["sheets"][k] = upper_values[k]
            
    # Map ai
    ai_keys = [
        "ACTIVE_PROVIDER",
        "NVIDIA_API_KEY", "NVIDIA_BASE_URL", "NVIDIA_MODEL",
        "GROQ_API_KEY", "GROQ_MODEL",
        "OPENROUTER_API_KEY", "OPENROUTER_BASE_URL", "OPENROUTER_MODEL",
        "LMSTUDIO_BASE_URL", "LMSTUDIO_MODEL", "LMSTUDIO_API_KEY"
    ]
    for k in ai_keys:
        if k in upper_values:
            partitions["ai"][k] = upper_values[k]
            
    # Dynamically set AI_API_KEY and AI_MODEL
    active = partitions["ai"].get("ACTIVE_PROVIDER", "nvidia").lower().strip()
    if active == "nvidia":
        partitions["ai"]["AI_API_KEY"] = partitions["ai"].get("NVIDIA_API_KEY", "")
        partitions["ai"]["AI_MODEL"] = partitions["ai"].get("NVIDIA_MODEL", "")
    elif active == "groq":
        partitions["ai"]["AI_API_KEY"] = partitions["ai"].get("GROQ_API_KEY", "")
        partitions["ai"]["AI_MODEL"] = partitions["ai"].get("GROQ_MODEL", "")
    elif active == "openrouter":
        partitions["ai"]["AI_API_KEY"] = partitions["ai"].get("OPENROUTER_API_KEY", "")
        partitions["ai"]["AI_MODEL"] = partitions["ai"].get("OPENROUTER_MODEL", "")
    elif active == "lmstudio":
        partitions["ai"]["AI_API_KEY"] = partitions["ai"].get("LMSTUDIO_API_KEY", "")
        partitions["ai"]["AI_MODEL"] = partitions["ai"].get("LMSTUDIO_MODEL", "")
        
    return partitions


@router.post("/env")
async def update_env(body: EnvUpdateRequest, user_id: str = Depends(require_auth)) -> dict:
    """
    Persist new env values to .env (mock mode) or partition and upsert to Supabase (prod mode).
    """
    updated_keys: list[str] = []
    errors: list[str] = []

    if _is_mock_mode():
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
            logger.info(".env file updated locally", keys=updated_keys)

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
    else:
        # ── Supabase Production Mode ───────────────────────────────────────────
        try:
            partitioned = partition_values(body.values)
            async with httpx.AsyncClient() as client:
                # 1. Resolve user profile ID
                profile_resp = await client.get(
                    f"{SUPABASE_URL}/rest/v1/user_profiles",
                    headers=_supa_headers(),
                    params={"supabase_uid": f"eq.{user_id}", "select": "id"},
                    timeout=5.0
                )
                profiles = profile_resp.json()
                if not profiles:
                    raise HTTPException(status_code=404, detail="Profile not found in database.")
                profile_id = profiles[0]["id"]

                # 2. Upsert partitioned configs
                for connector, config_data in partitioned.items():
                    if not config_data:
                        continue
                    resp = await client.post(
                        f"{SUPABASE_URL}/rest/v1/user_env_configs?on_conflict=user_id,connector_name",
                        headers={**_supa_headers(), "Prefer": "resolution=merge-duplicates,return=representation"},
                        json={
                            "user_id": profile_id,
                            "connector_name": connector,
                            "config_data": config_data,
                            "is_configured": True,
                        },
                        timeout=5.0
                    )
                    if resp.status_code not in (200, 201):
                        logger.warning("Failed to save config for connector", connector=connector, status=resp.status_code, body=resp.text)
                        errors.append(f"Failed to save {connector} configuration to database.")
                    else:
                        for k in config_data.keys():
                            updated_keys.append(k)

            # Invalidate the cache for this user
            from core.llm_router import invalidate_user_config_cache
            invalidate_user_config_cache(user_id)

        except Exception as exc:
            msg = f"Database configuration update failed: {exc}"
            logger.warning(msg)
            errors.append(msg)

    return {
        "updated_keys": updated_keys,
        "env_file_updated": not any("Could not write" in e for e in errors) if _is_mock_mode() else False,
        "errors": errors,
        "message": "Settings saved and hot-reloaded successfully." if not errors else "Saved with warnings.",
    }


@router.get("/env")
async def get_env(user_id: str = Depends(require_auth)) -> dict:
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
        "google_client_email": s.google_client_email,
        "google_private_key": s.google_private_key,
        "google_project_id": s.google_project_id,
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
