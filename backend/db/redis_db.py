"""Redis database fallback implementation for MCP Gateway."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Optional
import redis.asyncio as aioredis

from utils.config import get_settings
from utils.logger import get_logger

logger = get_logger(__name__)

_redis_client: aioredis.Redis | None = None


def get_redis_client() -> aioredis.Redis | None:
    """Return singleton Redis client instance, or None if connection fails."""
    global _redis_client
    if _redis_client is None:
        try:
            settings = get_settings()
            _redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)
            logger.info("Redis client initialized", url=settings.redis_url)
        except Exception as e:
            logger.error("Failed to initialize Redis client", error=str(e))
            return None
    return _redis_client


async def is_redis_available() -> bool:
    """Return True if Redis connection is active and responsive."""
    client = get_redis_client()
    if not client:
        return False
    try:
        await client.ping()
        return True
    except Exception:
        return False


async def close_redis() -> None:
    """Gracefully close the Redis client connection pool."""
    global _redis_client
    if _redis_client is not None:
        await _redis_client.aclose()
        _redis_client = None
        logger.info("Redis client connection closed")


# ── Workflows ─────────────────────────────────────────────────────────────

async def redis_write_workflow(
    workflow_id: str,
    user_request: str,
    status: str,
    dag: dict[str, Any] | None = None,
    user_id: str | None = None,
) -> None:
    """Upsert a workflow record in Redis."""
    client = get_redis_client()
    if not client:
        return

    key = f"workflow:{workflow_id}"
    existing_raw = await client.get(key)
    created_at = datetime.utcnow().isoformat()
    if existing_raw:
        try:
            existing = json.loads(existing_raw)
            created_at = existing.get("created_at", created_at)
        except Exception:
            pass

    wf_data = {
        "id": workflow_id,
        "user_request": user_request,
        "status": status,
        "dag": dag,
        "user_id": user_id,
        "created_at": created_at,
        "updated_at": datetime.utcnow().isoformat(),
    }
    await client.set(key, json.dumps(wf_data))
    await client.sadd("workflows:all", workflow_id)


async def redis_update_workflow_status(
    workflow_id: str,
    status: str,
    dag: dict[str, Any] | None = None,
) -> None:
    """Update workflow status in Redis."""
    client = get_redis_client()
    if not client:
        return

    key = f"workflow:{workflow_id}"
    raw = await client.get(key)
    if raw:
        try:
            wf_data = json.loads(raw)
            wf_data["status"] = status
            if dag is not None:
                wf_data["dag"] = dag
            wf_data["updated_at"] = datetime.utcnow().isoformat()
            await client.set(key, json.dumps(wf_data))
        except Exception as e:
            logger.error("Failed to update workflow status in Redis", error=str(e))


async def redis_get_workflow(workflow_id: str) -> dict[str, Any] | None:
    """Fetch workflow record by ID from Redis."""
    client = get_redis_client()
    if not client:
        return None

    key = f"workflow:{workflow_id}"
    raw = await client.get(key)
    if raw:
        try:
            data = json.loads(raw)
            if data.get("created_at"):
                data["created_at"] = datetime.fromisoformat(data["created_at"])
            if data.get("updated_at"):
                data["updated_at"] = datetime.fromisoformat(data["updated_at"])
            return data
        except Exception:
            return None
    return None


async def redis_list_workflows(user_id: str | None = None) -> list[dict[str, Any]]:
    """List all workflows from Redis, sorted descending by created_at."""
    client = get_redis_client()
    if not client:
        return []

    workflow_ids = await client.smembers("workflows:all")
    workflows = []
    for wf_id in workflow_ids:
        wf = await redis_get_workflow(wf_id)
        if wf:
            if user_id is None or wf.get("user_id") == user_id:
                workflows.append(wf)

    workflows.sort(key=lambda w: w.get("created_at") or datetime.min, reverse=True)
    return workflows


# ── Audit Log ─────────────────────────────────────────────────────────────

async def redis_write_audit_entry(
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
    """Record an audit entry in Redis."""
    client = get_redis_client()
    if not client:
        return

    entry = {
        "workflow_id": workflow_id,
        "step_id": step_id,
        "connector": connector,
        "tool": tool,
        "params_hash": None,  # Optional hash field
        "safeguard_result": safeguard_result,
        "safeguard_layer": safeguard_layer,
        "safeguard_reason": safeguard_reason,
        "executed": executed,
        "created_at": datetime.utcnow().isoformat(),
    }
    key = f"audit_log:{workflow_id}"
    await client.rpush(key, json.dumps(entry))


async def redis_get_audit_log(workflow_id: str) -> list[dict[str, Any]]:
    """Retrieve audit entries for a workflow from Redis."""
    client = get_redis_client()
    if not client:
        return []

    key = f"audit_log:{workflow_id}"
    raw_list = await client.lrange(key, 0, -1)
    entries = []
    for raw in raw_list:
        try:
            entry = json.loads(raw)
            if entry.get("created_at"):
                entry["created_at"] = datetime.fromisoformat(entry["created_at"])
            entries.append(entry)
        except Exception:
            pass
    return entries


# ── Recovery Log ──────────────────────────────────────────────────────────

async def redis_write_recovery_entry(
    workflow_id: str,
    step_id: str,
    attempt_number: int,
    error_message: str,
    kimi_reasoning: str,
    action_taken: str,
) -> None:
    """Record a recovery attempt in Redis."""
    client = get_redis_client()
    if not client:
        return

    entry = {
        "workflow_id": workflow_id,
        "step_id": step_id,
        "attempt_number": attempt_number,
        "error_message": error_message,
        "kimi_reasoning": kimi_reasoning,
        "action_taken": action_taken,
        "created_at": datetime.utcnow().isoformat(),
    }
    key = f"recovery_log:{workflow_id}"
    await client.rpush(key, json.dumps(entry))


# ── Synthesized Tools ─────────────────────────────────────────────────────

async def redis_write_synthesized_tool(
    service_name: str,
    connector_class_name: str,
    file_path: str,
    tools: list[dict[str, Any]],
    required_credentials: list[dict[str, Any]],
    synthesis_prompt: str,
    raw_kimi_response: str,
    safety_scan_result: dict[str, Any],
    validation_passed: bool,
    workflow_id: str | None = None,
    user_id: str | None = None,
) -> None:
    """Upsert a synthesized tool record in Redis."""
    client = get_redis_client()
    if not client:
        return

    key = f"synthesized_tool:{service_name}"
    existing_raw = await client.get(key)
    created_at = datetime.utcnow().isoformat()
    times_used = 0
    guide_md_path = None
    guide_json_path = None

    if existing_raw:
        try:
            existing = json.loads(existing_raw)
            created_at = existing.get("created_at", created_at)
            times_used = existing.get("times_used", 0)
            guide_md_path = existing.get("guide_md_path")
            guide_json_path = existing.get("guide_json_path")
        except Exception:
            pass

    tool_data = {
        "service_name": service_name,
        "connector_class_name": connector_class_name,
        "file_path": file_path,
        "tools": tools,
        "required_credentials": required_credentials,
        "synthesis_prompt": synthesis_prompt,
        "raw_kimi_response": raw_kimi_response,
        "safety_scan_result": safety_scan_result,
        "validation_passed": validation_passed,
        "created_by_workflow_id": workflow_id,
        "user_id": user_id,
        "created_at": created_at,
        "times_used": times_used,
        "guide_md_path": guide_md_path,
        "guide_json_path": guide_json_path,
    }
    await client.set(key, json.dumps(tool_data))
    await client.sadd("synthesized_tools:all", service_name)


async def redis_update_synthesized_tool_guide(
    service_name: str,
    md_path: str,
    json_path: str,
) -> None:
    """Update guide paths for a synthesized tool in Redis."""
    client = get_redis_client()
    if not client:
        return

    key = f"synthesized_tool:{service_name}"
    raw = await client.get(key)
    if raw:
        try:
            tool_data = json.loads(raw)
            tool_data["guide_md_path"] = md_path
            tool_data["guide_json_path"] = json_path
            await client.set(key, json.dumps(tool_data))
        except Exception as e:
            logger.error("Failed to update guide paths in Redis", error=str(e))


async def redis_get_synthesized_tool(service_name: str) -> dict[str, Any] | None:
    """Fetch synthesized tool record from Redis."""
    client = get_redis_client()
    if not client:
        return None

    key = f"synthesized_tool:{service_name}"
    raw = await client.get(key)
    if raw:
        try:
            data = json.loads(raw)
            if data.get("created_at"):
                data["created_at"] = datetime.fromisoformat(data["created_at"])
            return data
        except Exception:
            return None
    return None


async def redis_list_synthesized_tools(user_id: str | None = None) -> list[dict[str, Any]]:
    """List all synthesized tools from Redis, sorted by created_at DESC."""
    client = get_redis_client()
    if not client:
        return []

    services = await client.smembers("synthesized_tools:all")
    tools = []
    for service in services:
        t = await redis_get_synthesized_tool(service)
        if t:
            if user_id is None or t.get("user_id") == user_id:
                tools.append(t)
    tools.sort(key=lambda t: t.get("created_at") or datetime.min, reverse=True)
    return tools


async def redis_delete_synthesized_tool(service_name: str) -> None:
    """Delete a synthesized tool record from Redis."""
    client = get_redis_client()
    if not client:
        return

    await client.delete(f"synthesized_tool:{service_name}")
    await client.srem("synthesized_tools:all", service_name)


# ── Incidents (Database Connector) ────────────────────────────────────────

async def redis_log_incident(
    incident_id: str,
    title: str,
    severity: str,
    status: str,
    details: dict[str, Any],
    created_at: datetime,
    updated_at: datetime,
) -> None:
    """Log a new incident in Redis."""
    client = get_redis_client()
    if not client:
        return

    incident_data = {
        "id": incident_id,
        "title": title,
        "severity": severity,
        "status": status,
        "details": details,
        "created_at": created_at.isoformat(),
        "updated_at": updated_at.isoformat(),
        "notes": None,
    }
    await client.set(f"incident:{incident_id}", json.dumps(incident_data))
    await client.sadd("incidents:all", incident_id)


async def redis_get_incident(incident_id: str) -> dict[str, Any] | None:
    """Fetch a specific incident from Redis."""
    client = get_redis_client()
    if not client:
        return None

    raw = await client.get(f"incident:{incident_id}")
    if raw:
        try:
            data = json.loads(raw)
            if data.get("created_at"):
                data["created_at"] = datetime.fromisoformat(data["created_at"])
            if data.get("updated_at"):
                data["updated_at"] = datetime.fromisoformat(data["updated_at"])
            return data
        except Exception:
            return None
    return None


async def redis_update_incident_status(
    incident_id: str,
    status: str,
    notes: str | None,
    updated_at: datetime,
) -> bool:
    """Update status and notes of an incident in Redis."""
    client = get_redis_client()
    if not client:
        return False

    key = f"incident:{incident_id}"
    raw = await client.get(key)
    if raw:
        try:
            data = json.loads(raw)
            data["status"] = status
            if notes is not None:
                data["notes"] = notes
            data["updated_at"] = updated_at.isoformat()
            await client.set(key, json.dumps(data))
            return True
        except Exception:
            return False
    return False


async def redis_list_incidents(
    status: str | None = None,
    limit: int = 20,
) -> list[dict[str, Any]]:
    """List incidents from Redis, optionally filtered, sorted by created_at DESC."""
    client = get_redis_client()
    if not client:
        return []

    incident_ids = await client.smembers("incidents:all")
    incidents = []
    for inc_id in incident_ids:
        inc = await redis_get_incident(inc_id)
        if inc:
            if status is None or inc.get("status") == status:
                incidents.append(inc)

    incidents.sort(key=lambda i: i.get("created_at") or datetime.min, reverse=True)
    return incidents[:limit]
