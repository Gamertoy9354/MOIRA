"""Audit log read/write functions using asyncpg."""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime
from typing import Any

from db.connection import get_pool
from db.redis_db import (
    is_redis_available,
    redis_write_audit_entry,
    redis_get_audit_log,
    redis_write_workflow,
    redis_update_workflow_status,
    redis_get_workflow,
    redis_write_recovery_entry,
)
from utils.logger import get_logger

logger = get_logger(__name__)


def _hash_params(params: dict[str, Any] | None) -> str:
    """Compute SHA-256 hash of tool parameters for audit logging."""
    if not params:
        return ""
    try:
        serialized = json.dumps(params, sort_keys=True, default=str)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()
    except Exception:
        return ""


# Internal memory store for ephemeral runs (No-DB fallback)
_memory_store = {
    "workflows": {},    # id -> dict
    "audit_log": [],    # list of dicts
    "recovery_log": [], # list of dicts
    "approval_log": [], # list of dicts
}


async def write_audit_entry(
    workflow_id: str,
    step_id: str,
    connector: str,
    tool: str,
    params: dict[str, Any],
    safeguard_result: str,
    safeguard_layer: int | None,
    safeguard_reason: str,
    executed: bool,
) -> None:
    """Record an audit entry (to DB if available, else to memory)."""
    pool = await get_pool()
    if not pool:
        if await is_redis_available():
            await redis_write_audit_entry(
                workflow_id=workflow_id,
                step_id=step_id,
                connector=connector,
                tool=tool,
                params=params,
                safeguard_result=safeguard_result,
                safeguard_layer=safeguard_layer,
                safeguard_reason=safeguard_reason,
                executed=executed,
            )
            return

        _memory_store["audit_log"].append({
            "workflow_id": workflow_id,
            "step_id": step_id,
            "connector": connector,
            "tool": tool,
            "safeguard_result": safeguard_result,
            "executed": executed,
            "created_at": datetime.utcnow()
        })
        return

    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO audit_log (
                id, workflow_id, step_id, connector, tool,
                params_hash, safeguard_result, safeguard_layer,
                safeguard_reason, executed, created_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
            """,
            str(uuid.uuid4()),
            workflow_id,
            step_id,
            connector,
            tool,
            _hash_params(params),
            safeguard_result,
            safeguard_layer,
            safeguard_reason,
            executed,
            datetime.utcnow(),
        )


async def get_audit_log(workflow_id: str) -> list[dict[str, Any]]:
    """Retrieve audit entries for a workflow."""
    pool = await get_pool()
    if not pool:
        if await is_redis_available():
            return await redis_get_audit_log(workflow_id)
        return [r for r in _memory_store["audit_log"] if r["workflow_id"] == workflow_id]

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM audit_log WHERE workflow_id = $1 ORDER BY created_at ASC",
            workflow_id,
        )
    return [dict(r) for r in rows]


async def write_workflow(
    workflow_id: str,
    user_request: str,
    status: str,
    dag: dict[str, Any] | None = None,
    user_id: str | None = None,
) -> None:
    """Upsert a workflow record."""
    pool = await get_pool()
    if not pool:
        if await is_redis_available():
            await redis_write_workflow(workflow_id, user_request, status, dag, user_id)
            return

        _memory_store["workflows"][workflow_id] = {
            "id": workflow_id,
            "user_request": user_request,
            "status": status,
            "dag": dag,
            "user_id": user_id,
            "updated_at": datetime.utcnow()
        }
        return

    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO workflows (id, user_request, status, dag, created_at, updated_at, user_id)
            VALUES ($1, $2, $3, $4, NOW(), NOW(), $5)
            ON CONFLICT (id) DO UPDATE
            SET status = $3, dag = $4, updated_at = NOW(), user_id = $5
            """,
            workflow_id,
            user_request,
            status,
            json.dumps(dag, default=str) if dag else None,
            user_id,
        )


async def update_workflow_status(
    workflow_id: str,
    status: str,
    dag: dict[str, Any] | None = None,
) -> None:
    """Update workflow status."""
    pool = await get_pool()
    if not pool:
        if await is_redis_available():
            await redis_update_workflow_status(workflow_id, status, dag)
            return

        if workflow_id in _memory_store["workflows"]:
            wf = _memory_store["workflows"][workflow_id]
            wf["status"] = status
            if dag is not None:
                wf["dag"] = dag
        return

    async with pool.acquire() as conn:
        if dag is not None:
            await conn.execute(
                "UPDATE workflows SET status=$2, dag=$3, updated_at=NOW() WHERE id=$1",
                workflow_id, status, json.dumps(dag, default=str),
            )
        else:
            await conn.execute(
                "UPDATE workflows SET status=$2, updated_at=NOW() WHERE id=$1",
                workflow_id, status,
            )


async def get_workflow(workflow_id: str) -> dict[str, Any] | None:
    """Fetch a workflow record by ID."""
    pool = await get_pool()
    if not pool:
        if await is_redis_available():
            return await redis_get_workflow(workflow_id)
        return _memory_store["workflows"].get(workflow_id)

    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM workflows WHERE id=$1", workflow_id)
    return dict(row) if row else None


async def write_recovery_entry(
    workflow_id: str,
    step_id: str,
    attempt_number: int,
    error_message: str,
    kimi_reasoning: str,
    action_taken: str,
) -> None:
    """Record a recovery attempt."""
    pool = await get_pool()
    if not pool:
        if await is_redis_available():
            await redis_write_recovery_entry(
                workflow_id=workflow_id,
                step_id=step_id,
                attempt_number=attempt_number,
                error_message=error_message,
                kimi_reasoning=kimi_reasoning,
                action_taken=action_taken,
            )
        return

    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO recovery_log (
                id, workflow_id, step_id, attempt_number,
                error_message, kimi_reasoning, action_taken, created_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            """,
            str(uuid.uuid4()),
            workflow_id,
            step_id,
            attempt_number,
            error_message,
            kimi_reasoning,
            action_taken,
            datetime.utcnow(),
        )
