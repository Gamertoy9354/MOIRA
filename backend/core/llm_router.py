"""LLM Router — unified provider abstraction for all 4 AI providers.

Supported providers:
  - nvidia    : NVIDIA NIM (default, existing)
  - groq      : Groq Cloud  (llama-3.3-70b-versatile)
  - openrouter: OpenRouter  (any model, e.g. meta-llama/llama-3.3-70b-instruct:free)
  - lmstudio  : LM Studio   (local OpenAI-compatible server, any model)

All four use the OpenAI-compatible API via AsyncOpenAI.
"""

from __future__ import annotations

from openai import AsyncOpenAI

from utils.config import get_settings
from utils.logger import get_logger

logger = get_logger(__name__)

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


def get_llm_client(
    provider: str | None = None,
    model_id: str | None = None,
) -> tuple[AsyncOpenAI, str]:
    """Return (AsyncOpenAI client, model_name) for the requested provider.

    Args:
        provider: One of "nvidia", "groq", "openrouter", "lmstudio".
                  If None, uses settings.active_provider.
        model_id: Override model name. If None, uses per-provider default or settings value.

    Returns:
        Tuple of (AsyncOpenAI, model_name_str)
    """
    settings = get_settings()
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
        # LM Studio doesn't enforce API keys but AsyncOpenAI requires a non-empty string
        api_key = settings.lmstudio_api_key or "lm-studio"
        model = model_id or settings.lmstudio_model or _DEFAULT_MODELS["lmstudio"]

    else:
        logger.warning("Unknown provider, falling back to NVIDIA NIM", provider=provider)
        base_url = settings.nvidia_base_url or _PROVIDER_URLS["nvidia"]
        api_key = settings.nvidia_api_key or "no-key"
        model = model_id or settings.nvidia_model or _DEFAULT_MODELS["nvidia"]

    logger.info("LLM router resolved", provider=provider, model=model, base_url=base_url)

    client = AsyncOpenAI(
        api_key=api_key,
        base_url=base_url,
        timeout=90.0,
        max_retries=1,
    )
    return client, model
