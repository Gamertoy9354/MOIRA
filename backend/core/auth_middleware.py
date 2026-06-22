"""JWT authentication middleware for MOIRA multi-tenant backend.

Validates Supabase JWT tokens (supporting both symmetric HS256 and asymmetric ES256)
and injects user_id into request state. Public routes bypass validation.
"""
from __future__ import annotations

import os
import time
from typing import Callable

import httpx
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from jose import jwt, JWTError
from starlette.middleware.base import BaseHTTPMiddleware
from utils.logger import get_logger

logger = get_logger(__name__)

# Routes that don't require authentication
PUBLIC_ROUTES = {
    "/health",
    "/docs",
    "/openapi.json",
    "/redoc",
    "/api/v1/auth/callback",
}

PUBLIC_PREFIXES = ()

_jwks_cache = None
_jwks_cache_time = 0
_CACHE_EXPIRY = 300  # 5 minutes


async def get_supabase_jwk(kid: str) -> dict | None:
    """Fetch the JWKS from Supabase and return the key matching the given kid."""
    global _jwks_cache, _jwks_cache_time
    now = time.time()

    # 1. Check in-memory cache
    if _jwks_cache and (now - _jwks_cache_time < _CACHE_EXPIRY):
        for key in _jwks_cache.get("keys", []):
            if key.get("kid") == kid:
                return key

    # 2. Fetch fresh JWKS from Supabase
    from utils.config import get_settings
    settings = get_settings()
    supabase_url = settings.supabase_url or os.getenv("SUPABASE_URL", "")
    # Use anon key or service role key as apikey header
    supabase_key = (
        settings.supabase_service_role_key
        or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        or os.getenv("SUPABASE_KEY", "")
    )

    if not supabase_url:
        logger.warning("SUPABASE_URL is not set — cannot fetch JWKS")
        return None

    jwks_url = f"{supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
    headers = {}
    if supabase_key:
        headers["apikey"] = supabase_key

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(jwks_url, headers=headers, timeout=5.0)
            if resp.status_code == 200:
                _jwks_cache = resp.json()
                _jwks_cache_time = now
                logger.info("Successfully fetched JWKS from Supabase", kid=kid)
                for key in _jwks_cache.get("keys", []):
                    if key.get("kid") == kid:
                        return key
            else:
                logger.warning(
                    "Supabase JWKS request failed",
                    status=resp.status_code,
                    body=resp.text,
                )
    except Exception as e:
        logger.warning(f"Exception fetching JWKS from Supabase: {e}")

    # Fallback to older cache key if present
    if _jwks_cache:
        for key in _jwks_cache.get("keys", []):
            if key.get("kid") == kid:
                return key

    return None


class AuthMiddleware(BaseHTTPMiddleware):
    """Supabase JWT verification middleware supporting HS256 and ES256."""

    def __init__(self, app, jwt_secret: str):
        super().__init__(app)
        self.jwt_secret = jwt_secret

    async def dispatch(self, request: Request, call_next: Callable):
        path = request.url.path

        # Allow public routes
        if path in PUBLIC_ROUTES:
            return await call_next(request)
        for prefix in PUBLIC_PREFIXES:
            if path.startswith(prefix):
                return await call_next(request)

        # OPTIONS pre-flight — always allow
        if request.method == "OPTIONS":
            return await call_next(request)

        # Check if we are running in mock mode
        from utils.config import get_settings
        settings = get_settings()
        supabase_url = settings.supabase_url or os.getenv("SUPABASE_URL", "")
        supabase_key = (
            settings.supabase_service_role_key
            or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
            or os.getenv("SUPABASE_KEY", "")
        )
        is_mock = (
            not supabase_url
            or not supabase_key
            or "YOUR_SUPABASE" in supabase_key
        )

        # Extract Bearer token
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            if is_mock:
                request.state.user_id = "dev-user-1234"
                request.state.user_email = "developer@moira.sinaai.in"
            else:
                request.state.user_id = None
                request.state.user_email = None
            return await call_next(request)

        token = auth_header.split(" ", 1)[1]

        # Dev bypass token
        if token == "dev-access-token" or is_mock:
            request.state.user_id = "dev-user-1234"
            request.state.user_email = "developer@moira.sinaai.in"
            return await call_next(request)

        try:
            # 1. Parse token header to identify algorithm
            header = jwt.get_unverified_header(token)
            alg = header.get("alg")

            if alg == "ES256":
                # Asymmetric verification via JWKS
                kid = header.get("kid")
                if not kid:
                    raise JWTError("Missing kid in ES256 token header")

                jwk = await get_supabase_jwk(kid)
                if not jwk:
                    raise JWTError("Matching public key not found in Supabase JWKS")

                payload = jwt.decode(
                    token,
                    jwk,
                    algorithms=["ES256"],
                    options={"verify_aud": False},
                )
            else:
                # Fallback to HS256 symmetric verification
                if not self.jwt_secret or "YOUR_SUPABASE" in self.jwt_secret:
                    raise JWTError(
                        "SUPABASE_JWT_SECRET is not configured for symmetric verification"
                    )
                payload = jwt.decode(
                    token,
                    self.jwt_secret,
                    algorithms=["HS256"],
                    options={"verify_aud": False},
                )

            request.state.user_id = payload.get("sub")
            request.state.user_email = payload.get("email")
        except JWTError as e:
            logger.warning("JWT verification failed", error=str(e))
            return JSONResponse(
                status_code=401,
                content={
                    "detail": f"Invalid or expired token — fate has no patience for forgeries. Error: {e}"
                },
            )

        return await call_next(request)


async def require_auth(request: Request) -> str:
    """Dependency: raises 401 if request has no authenticated user."""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="Authentication required — identify yourself to MOIRA.",
        )

    # In production mode, user_id must be a valid UUID
    from utils.config import get_settings

    settings = get_settings()
    supabase_url = settings.supabase_url or os.getenv("SUPABASE_URL", "")
    supabase_key = (
        settings.supabase_service_role_key
        or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    )
    is_mock = (
        not supabase_url
        or not supabase_key
        or "YOUR_SUPABASE" in supabase_key
    )

    if not is_mock:
        import uuid

        try:
            uuid.UUID(str(user_id))
        except ValueError:
            raise HTTPException(
                status_code=401,
                detail=f"Invalid user ID format: '{user_id}' is not a valid UUID. If this is production, please ensure SUPABASE_JWT_SECRET is configured in the backend environment variables.",
            )

    from core.llm_router import load_user_ai_config

    await load_user_ai_config(user_id)
    return user_id
