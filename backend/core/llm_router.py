"""LLM Router — unified provider abstraction for all 4 AI providers.

Supported providers:
  - nvidia    : NVIDIA NIM (default, existing)
  - groq      : Groq Cloud  (llama-3.3-70b-versatile)
  - openrouter: OpenRouter  (any model, e.g. meta-llama/llama-3.3-70b-instruct:free)
  - lmstudio  : LM Studio   (local OpenAI-compatible server, any model)

All four use the OpenAI-compatible API via AsyncOpenAI.
"""

from __future__ import annotations

import contextvars
import json
import os
import httpx
from openai import AsyncOpenAI

from utils.config import get_settings
from utils.logger import get_logger

logger = get_logger(__name__)

# ContextVar to store user-specific AI settings
# Format: {"provider": str, "api_key": str, "model": str | None}
user_ai_config = contextvars.ContextVar("user_ai_config", default=None)

# Provider base URLs
_PROVIDER_URLS: dict[str, str] = {
    "nvidia":     "https://integrate.api.nvidia.com/v1",
    "groq":       "https://api.groq.com/openai/v1",
    "openrouter": "https://openrouter.ai/api/v1",
    "lmstudio":   "http://localhost:1234/v1",  # overridden by settings
}

# Default models per provider
_DEFAULT_MODELS: dict[str, str] = {
    "nvidia":     "meta/llama-3.3-70b-instruct",
    "groq":       "llama-3.3-70b-versatile",
    "openrouter": "meta-llama/llama-3.3-70b-instruct:free",
    "lmstudio":   "local-model",
}


async def load_user_ai_config(user_id: str) -> None:
    """Fetch user's custom AI API configuration and set it in the ContextVar."""
    settings = get_settings()
    
    # Determine if we are in mock mode
    supabase_url = settings.supabase_url or os.getenv("SUPABASE_URL", "")
    supabase_key = settings.supabase_service_role_key or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    is_mock = not supabase_url or not supabase_key or "YOUR_SUPABASE" in supabase_key or os.getenv("DEBUG", "true").lower() == "true"
    
    config_data = {}
    
    if is_mock:
        # Read from local mock DB file
        mock_db_file = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scratch_db.json")
        if os.path.exists(mock_db_file):
            try:
                with open(mock_db_file, "r", encoding="utf-8") as f:
                    db = json.load(f)
                    configs = db.get("configs", {})
                    user_configs = configs.get("dev-user-id") or configs.get(user_id) or {}
                    ai_connector = user_configs.get("ai")
                    if ai_connector and ai_connector.get("is_configured"):
                        config_data = {
                            "ACTIVE_PROVIDER": os.getenv("ACTIVE_PROVIDER"),
                            "AI_API_KEY": os.getenv("AI_API_KEY") or os.getenv("NVIDIA_API_KEY"),
                            "AI_MODEL": os.getenv("AI_MODEL")
                        }
            except Exception as e:
                logger.warning("Failed to load user AI config from mock DB", error=str(e))
    else:
        # Read from Supabase production DB
        try:
            headers = {
                "apikey": supabase_key,
                "Authorization": f"Bearer {supabase_key}",
                "Content-Type": "application/json",
            }
            async with httpx.AsyncClient() as client:
                # 1. Resolve profile ID
                profile_resp = await client.get(
                    f"{supabase_url}/rest/v1/user_profiles",
                    headers=headers,
                    params={"supabase_uid": f"eq.{user_id}", "select": "id"},
                    timeout=5.0
                )
                if profile_resp.status_code == 200:
                    profiles = profile_resp.json()
                    if profiles:
                        profile_id = profiles[0]["id"]
                        # 2. Get the custom ai connector config
                        config_resp = await client.get(
                            f"{supabase_url}/rest/v1/user_env_configs",
                            headers=headers,
                            params={"user_id": f"eq.{profile_id}", "connector_name": "eq.ai", "select": "config_data"},
                            timeout=5.0
                        )
                        if config_resp.status_code == 200:
                            configs = config_resp.json()
                            if configs:
                                config_data = configs[0].get("config_data", {})
        except Exception as e:
            logger.warning("Failed to fetch user AI config from Supabase", error=str(e))

    if config_data:
        provider = config_data.get("ACTIVE_PROVIDER", "").lower().strip()
        api_key = config_data.get("AI_API_KEY", "")
        model = config_data.get("AI_MODEL", "")
        
        if provider and api_key:
            user_ai_config.set({
                "provider": provider,
                "api_key": api_key,
                "model": model or None
            })
            logger.info("ContextVar user_ai_config set successfully", provider=provider, model=model)


def get_llm_client(
    provider: str | None = None,
    model_id: str | None = None,
) -> tuple[AsyncOpenAI, str]:
    """Return (AsyncOpenAI client, model_name) for the requested provider.

    Checks user_ai_config ContextVar first for user-provided credentials.
    Falls back to settings/global configs.
    """
    settings = get_settings()
    custom_cfg = user_ai_config.get()

    if custom_cfg:
        # Use user-specific custom AI config
        provider = custom_cfg.get("provider") or provider
        api_key = custom_cfg.get("api_key")
        model = model_id or custom_cfg.get("model")

        # Determine base url based on provider
        if provider == "nvidia":
            base_url = settings.nvidia_base_url or _PROVIDER_URLS["nvidia"]
            model = model or settings.nvidia_model or _DEFAULT_MODELS["nvidia"]
        elif provider == "groq":
            base_url = _PROVIDER_URLS["groq"]
            model = model or settings.groq_model or _DEFAULT_MODELS["groq"]
        elif provider == "openrouter":
            base_url = settings.openrouter_base_url or _PROVIDER_URLS["openrouter"]
            model = model or settings.openrouter_model or _DEFAULT_MODELS["openrouter"]
        elif provider == "lmstudio":
            base_url = settings.lmstudio_base_url or _PROVIDER_URLS["lmstudio"]
            model = model or settings.lmstudio_model or _DEFAULT_MODELS["lmstudio"]
        else:
            base_url = _PROVIDER_URLS.get(provider, "https://integrate.api.nvidia.com/v1")
            model = model or _DEFAULT_MODELS.get(provider, "meta/llama-3.3-70b-instruct")
            
        logger.info("Using user custom AI configuration", provider=provider, model=model, base_url=base_url)
    else:
        # Fallback to host/global configuration
        provider = (provider or settings.active_provider or "nvidia").lower().strip()

        if provider == "nvidia":
            base_url = settings.nvidia_base_url or _PROVIDER_URLS["nvidia"]
            api_key = settings.nvidia_api_key or "no-key"
            model = model_id or settings.nvidia_model or _DEFAULT_MODELS["nvidia"]

        elif provider == "groq":
            base_url = _PROVIDER_URLS["groq"]
            api_key = settings.groq_api_key or "no-key"
            model = model_id or settings.groq_model or _DEFAULT_MODELS["groq"]

        elif provider == "openrouter":
            base_url = settings.openrouter_base_url or _PROVIDER_URLS["openrouter"]
            api_key = settings.openrouter_api_key or "no-key"
            model = model_id or settings.openrouter_model or _DEFAULT_MODELS["openrouter"]

        elif provider == "lmstudio":
            base_url = settings.lmstudio_base_url or _PROVIDER_URLS["lmstudio"]
            api_key = settings.lmstudio_api_key or "lm-studio"
            model = model_id or settings.lmstudio_model or _DEFAULT_MODELS["lmstudio"]

        else:
            logger.warning("Unknown provider, falling back to NVIDIA NIM", provider=provider)
            base_url = settings.nvidia_base_url or _PROVIDER_URLS["nvidia"]
            api_key = settings.nvidia_api_key or "no-key"
            model = model_id or settings.nvidia_model or _DEFAULT_MODELS["nvidia"]

        logger.info("Using system-wide AI configuration", provider=provider, model=model, base_url=base_url)

    client = AsyncOpenAI(
        api_key=api_key,
        base_url=base_url,
        timeout=90.0,
        max_retries=1,
    )
    return client, model
