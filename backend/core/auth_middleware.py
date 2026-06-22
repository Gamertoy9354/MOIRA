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

PUBLIC_PREFIXES = ("/api/v1/auth/",)


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
        is_dev = not self.jwt_secret or "YOUR_SUPABASE" in self.jwt_secret or os.getenv("DEBUG", "true").lower() == "true"

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


def require_auth(request: Request) -> str:
    """Dependency: raises 401 if request has no authenticated user."""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="Authentication required — identify yourself to MOIRA.",
        )
    return user_id
