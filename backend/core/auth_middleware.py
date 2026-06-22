"""JWT authentication middleware for MOIRA multi-tenant backend.

Validates Supabase JWT tokens and injects user_id into request state.
Public routes bypass validation.
"""
from __future__ import annotations

import os
from typing import Callable

from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from jose import jwt, JWTError
from starlette.middleware.base import BaseHTTPMiddleware

# Routes that don't require authentication
PUBLIC_ROUTES = {
    "/health",
    "/docs",
    "/openapi.json",
    "/redoc",
    "/api/v1/auth/callback",
}

PUBLIC_PREFIXES = ()


class AuthMiddleware(BaseHTTPMiddleware):
    """Supabase JWT verification middleware."""

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

        # Determine if we should fallback to dev mode
        is_dev = not self.jwt_secret or "YOUR_SUPABASE" in self.jwt_secret

        # Extract Bearer token
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            if is_dev:
                request.state.user_id = "dev-user-1234"
                request.state.user_email = "developer@moira.sinaai.in"
            else:
                request.state.user_id = None
                request.state.user_email = None
            return await call_next(request)

        token = auth_header.split(" ", 1)[1]

        # Dev bypass token
        if token == "dev-access-token" or not self.jwt_secret or "YOUR_SUPABASE" in self.jwt_secret:
            request.state.user_id = "dev-user-1234"
            request.state.user_email = "developer@moira.sinaai.in"
            return await call_next(request)

        try:
            payload = jwt.decode(
                token,
                self.jwt_secret,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
            request.state.user_id = payload.get("sub")
            request.state.user_email = payload.get("email")
        except JWTError:
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid or expired token — fate has no patience for forgeries."},
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
    import os
    settings = get_settings()
    supabase_url = settings.supabase_url or os.getenv("SUPABASE_URL", "")
    supabase_key = settings.supabase_service_role_key or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    is_mock = not supabase_url or not supabase_key or "YOUR_SUPABASE" in supabase_key
    
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
