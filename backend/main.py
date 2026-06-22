"""FastAPI application entry point — MOIRA Fate Engine."""

from __future__ import annotations

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from api.websocket import router as ws_router
from api.workflows import router as wf_router, _init_sheets_audit_tab
from api.synthesized_tools import router as synth_router
from api.settings import router as settings_router
from api.chat import router as chat_router
from api.auth import router as auth_router
from core.auth_middleware import AuthMiddleware
from db.connection import close_pool, run_migrations
from utils.config import get_settings
from utils.logger import get_logger, setup_logging

settings = get_settings()
setup_logging(debug=settings.debug)
logger = get_logger(__name__)

# ── Allowed CORS Origins ─────────────────────────────────────────────────────
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://moira.sinaai.in",          # Production domain
    "https://www.moira.sinaai.in",
    "https://moira-backend-ly1o.onrender.com",  # Render backend URL
]
# Allow any additional origins from env (comma-separated)
extra_origins = os.getenv("EXTRA_ALLOWED_ORIGINS", "")
if extra_origins:
    ALLOWED_ORIGINS.extend([o.strip() for o in extra_origins.split(",") if o.strip()])


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown logic."""
    logger.info("MOIRA Fate Engine starting up")

    try:
        await run_migrations()
        logger.info("Database migrations applied")
    except Exception as exc:
        logger.warning("DB migration failed (continuing without DB)", error=str(exc))

    try:
        from core.connector_registry import bootstrap_registry
        registry = await bootstrap_registry()
        logger.info("ConnectorRegistry bootstrapped", total_connectors=len(registry.as_dict()))
    except Exception as exc:
        logger.warning("ConnectorRegistry bootstrap failed", error=str(exc))

    try:
        await _init_sheets_audit_tab()
    except Exception as exc:
        logger.warning("Sheets audit init failed", error=str(exc))

    yield

    await close_pool()
    try:
        from db.redis_db import close_redis
        await close_redis()
    except Exception:
        pass
    logger.info("MOIRA shut down cleanly")


app = FastAPI(
    title="MOIRA — Fate Engine",
    description="The ancient oracle intelligence powering your MCP workflow orchestration",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── JWT Auth Middleware ───────────────────────────────────────────────────────
jwt_secret = os.getenv("SUPABASE_JWT_SECRET", "")
if not jwt_secret or "YOUR_SUPABASE" in jwt_secret:
    logger.warning("SUPABASE_JWT_SECRET not set or placeholder — running in local dev/mock auth mode")
app.add_middleware(AuthMiddleware, jwt_secret=jwt_secret or "")

# ── Request Logger ────────────────────────────────────────────────────────────
from fastapi import Request

@app.middleware("http")
async def log_requests(request: Request, call_next):
    origin = request.headers.get("origin")
    logger.info("Incoming request", method=request.method, path=request.url.path, origin=origin)
    response = await call_next(request)
    logger.info("Request completed", status_code=response.status_code)
    return response

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router)           # /api/v1/auth/*
app.include_router(wf_router)
app.include_router(ws_router)
app.include_router(synth_router)          # /api/synthesized-tools/*
app.include_router(settings_router)       # /api/v1/settings/*
app.include_router(chat_router)           # /api/v1/chat

@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "moira-fate-engine", "version": "1.0.0"}

# ── Serve Frontend Static in Production ───────────────────────────────────────
# When deployed to Render, serve the built React app from backend
FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")
    logger.info("Serving frontend static files", path=str(FRONTEND_DIST))

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", settings.app_port))
    uvicorn.run(
        "main:app",
        host=settings.app_host,
        port=port,
        reload=False,
        log_level="debug" if settings.debug else "info",
    )
