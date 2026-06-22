"""Internal PostgreSQL MCP Connector — incident management via asyncpg."""

from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Any

from connectors.base import MCPConnector, MCPNotFoundError, MCPToolError
from db.connection import get_pool
from utils.logger import get_logger

logger = get_logger(__name__)


class DatabaseConnector(MCPConnector):
    """Connector that exposes internal incident management via MCP tools."""

    def get_connector_name(self) -> str:
        return "database"

    def get_scoped_permissions(self) -> list[str]:
        return ["database:read", "database:write"]

    async def list_tools(self) -> list[dict]:
        return [
            {
                "name": "log_incident",
                "description": "Log a new incident in the internal tracker",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "severity": {"type": "string", "enum": ["LOW", "MEDIUM", "HIGH", "CRITICAL"]},
                        "status": {"type": "string"},
                        "details": {"type": "object"},
                    },
                    "required": ["title", "severity", "status"],
                },
                "sensitive": False,
            },
            {
                "name": "get_incident",
                "description": "Get a specific incident by ID",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "incident_id": {"type": "string"},
                    },
                    "required": ["incident_id"],
                },
                "sensitive": False,
            },
            {
                "name": "update_incident_status",
                "description": "Update the status of an existing incident",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "incident_id": {"type": "string"},
                        "status": {"type": "string"},
                        "notes": {"type": "string"},
                    },
                    "required": ["incident_id", "status"],
                },
                "sensitive": False,
            },
            {
                "name": "list_incidents",
                "description": "List incidents with optional status filter",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "status": {"type": "string"},
                        "limit": {"type": "integer", "default": 20},
                    },
                },
                "sensitive": False,
            },
        ]

    async def invoke(self, tool_name: str, params: dict) -> dict:
        dispatch = {
            "log_incident": self._log_incident,
            "get_incident": self._get_incident,
            "update_incident_status": self._update_incident_status,
            "list_incidents": self._list_incidents,
        }
        if tool_name not in dispatch:
            raise MCPNotFoundError(f"Database connector has no tool '{tool_name}'")
        return await dispatch[tool_name](params)

    # ------------------------------------------------------------------
    # Ensure incidents table exists (lazy DDL)
    # ------------------------------------------------------------------

    async def _ensure_table(self) -> None:
        pool = await get_pool()
        if not pool:
            from db.redis_db import is_redis_available
            if await is_redis_available():
                return
            raise MCPToolError("Database connector: no database pool or Redis available")
        async with pool.acquire() as conn:
            await conn.execute(
                """
                CREATE TABLE IF NOT EXISTS incidents (
                    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    title       TEXT NOT NULL,
                    severity    VARCHAR(20) NOT NULL,
                    status      VARCHAR(50) NOT NULL,
                    details     JSONB,
                    notes       TEXT,
                    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )

    # ------------------------------------------------------------------
    # Tool implementations
    # ------------------------------------------------------------------

    async def _log_incident(self, params: dict) -> dict:
        await self._ensure_table()
        incident_id = str(uuid.uuid4())
        details = params.get("details", {})
        now = datetime.utcnow()
        pool = await get_pool()
        if not pool:
            from db.redis_db import is_redis_available, redis_log_incident
            if await is_redis_available():
                await redis_log_incident(incident_id, params["title"], params["severity"], params["status"], details, now, now)
                return {"incident_id": incident_id, "created_at": now.isoformat()}
            raise MCPToolError("Database connector: no database pool available")
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO incidents (id, title, severity, status, details, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $6)
                """,
                incident_id,
                params["title"],
                params["severity"],
                params["status"],
                json.dumps(details),
                now,
            )
        return {"incident_id": incident_id, "created_at": now.isoformat()}

    async def _get_incident(self, params: dict) -> dict:
        await self._ensure_table()
        pool = await get_pool()
        if not pool:
            from db.redis_db import is_redis_available, redis_get_incident
            if await is_redis_available():
                row = await redis_get_incident(params["incident_id"])
                if not row:
                    raise MCPNotFoundError(f"Incident {params['incident_id']} not found")
                return row
            raise MCPToolError("Database connector: no database pool available")
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM incidents WHERE id = $1", params["incident_id"]
            )
        if not row:
            raise MCPNotFoundError(f"Incident {params['incident_id']} not found")
        return dict(row)

    async def _update_incident_status(self, params: dict) -> dict:
        await self._ensure_table()
        now = datetime.utcnow()
        pool = await get_pool()
        if not pool:
            from db.redis_db import is_redis_available, redis_update_incident_status
            if await is_redis_available():
                success = await redis_update_incident_status(params["incident_id"], params["status"], params.get("notes"), now)
                if not success:
                    raise MCPNotFoundError(f"Incident {params['incident_id']} not found")
                return {
                    "incident_id": params["incident_id"],
                    "status": params["status"],
                    "updated_at": now.isoformat(),
                }
            raise MCPToolError("Database connector: no database pool available")
        async with pool.acquire() as conn:
            result = await conn.execute(
                """
                UPDATE incidents
                SET status = $2, notes = COALESCE($3, notes), updated_at = $4
                WHERE id = $1
                """,
                params["incident_id"],
                params["status"],
                params.get("notes"),
                now,
            )
        if result == "UPDATE 0":
            raise MCPNotFoundError(f"Incident {params['incident_id']} not found")
        return {
            "incident_id": params["incident_id"],
            "status": params["status"],
            "updated_at": now.isoformat(),
        }

    async def _list_incidents(self, params: dict) -> dict:
        await self._ensure_table()
        limit = params.get("limit", 20)
        pool = await get_pool()
        if not pool:
            from db.redis_db import is_redis_available, redis_list_incidents
            if await is_redis_available():
                incidents = await redis_list_incidents(params.get("status"), limit)
                return {"incidents": incidents, "total": len(incidents)}
            raise MCPToolError("Database connector: no database pool available")
        async with pool.acquire() as conn:
            if status := params.get("status"):
                rows = await conn.fetch(
                    "SELECT * FROM incidents WHERE status=$1 ORDER BY created_at DESC LIMIT $2",
                    status, limit,
                )
            else:
                rows = await conn.fetch(
                    "SELECT * FROM incidents ORDER BY created_at DESC LIMIT $1", limit
                )
        incidents = [dict(r) for r in rows]
        return {"incidents": incidents, "total": len(incidents)}
