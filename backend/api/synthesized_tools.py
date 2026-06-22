"""REST API — Synthesized Tools CRUD + credential injection + test runner."""

from __future__ import annotations

import json
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from core.connector_registry import get_registry
from utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/v1/synthesized-tools")


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class CredentialSubmitRequest(BaseModel):
    credentials: dict[str, str]
    workflow_id: str | None = None


class PreviewRequest(BaseModel):
    workflow_description: str


# ---------------------------------------------------------------------------
# Helper: read DB row
# ---------------------------------------------------------------------------

async def _get_db_row(service_name: str) -> dict | None:
    try:
        from db.connection import get_pool
        pool = await get_pool()
        if not pool:
            from db.redis_db import is_redis_available, redis_get_synthesized_tool
            if await is_redis_available():
                return await redis_get_synthesized_tool(service_name)
            return None
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM synthesized_tools WHERE service_name = $1",
                service_name,
            )
        return dict(row) if row else None
    except Exception:
        return None


async def _list_db_rows() -> list[dict]:
    try:
        from db.connection import get_pool
        pool = await get_pool()
        if not pool:
            from db.redis_db import is_redis_available, redis_list_synthesized_tools
            if await is_redis_available():
                rows = await redis_list_synthesized_tools()
                result = []
                for row in rows:
                    d = dict(row)
                    for k, v in d.items():
                        if hasattr(v, "isoformat"):
                            d[k] = v.isoformat()
                        elif hasattr(v, "__str__") and not isinstance(v, (str, int, float, bool, type(None))):
                            d[k] = str(v)
                    result.append(d)
                return result
            return []
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM synthesized_tools ORDER BY created_at DESC"
            )
        result = []
        for row in rows:
            d = dict(row)
            # Convert UUID / datetime to string for JSON
            for k, v in d.items():
                if hasattr(v, "isoformat"):
                    d[k] = v.isoformat()
                elif hasattr(v, "__str__") and not isinstance(v, (str, int, float, bool, type(None))):
                    d[k] = str(v)
            result.append(d)
        return result
    except Exception:
        return []


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("")
async def list_synthesized_tools() -> dict:
    """Return all synthesized tools — from DB if available, registry as fallback."""
    reg = get_registry()
    records = reg.get_synthesized_tools()

    # Enrich with DB data
    db_rows = await _list_db_rows()
    db_map = {r["service_name"]: r for r in db_rows}

    tools = []
    for rec in records:
        db = db_map.get(rec.service_name, {})
        tools.append({
            "service_name": rec.service_name,
            "connector_class_name": rec.connector_class_name,
            "file_path": rec.file_path,
            "tool_names": rec.tool_names,
            "tool_count": len(rec.tool_names),
            "times_used": db.get("times_used", 0),
            "created_at": db.get("created_at"),
            "validation_passed": db.get("validation_passed", True),
            "guide_available": bool(db.get("guide_json_path")),
        })

    # Include DB-only records that may not be in memory (e.g. failed hot-load)
    in_memory_names = {r.service_name for r in records}
    for row in db_rows:
        if row["service_name"] not in in_memory_names:
            tools.append({
                "service_name": row["service_name"],
                "connector_class_name": row.get("connector_class_name", ""),
                "file_path": row.get("file_path", ""),
                "tool_names": row.get("tools", []),
                "tool_count": len(row.get("tools", [])),
                "times_used": row.get("times_used", 0),
                "created_at": row.get("created_at"),
                "validation_passed": row.get("validation_passed", False),
                "guide_available": bool(row.get("guide_json_path")),
                "in_memory": False,
            })

    return {"synthesized_tools": tools, "total": len(tools)}


@router.get("/{service_name}")
async def get_synthesized_tool(service_name: str) -> dict:
    """Return detailed metadata for one synthesized tool."""
    reg = get_registry()
    connector = reg.get(service_name)
    db = await _get_db_row(service_name)

    if not connector and not db:
        raise HTTPException(status_code=404, detail=f"Tool '{service_name}' not found")

    tools_list = []
    if connector:
        try:
            tools_list = await connector.list_tools()
        except Exception:
            pass

    return {
        "service_name": service_name,
        "in_registry": connector is not None,
        "tools": tools_list,
        "db_record": db,
        "file_exists": Path(db["file_path"]).exists() if db and db.get("file_path") else False,
    }


@router.get("/{service_name}/guide")
async def get_setup_guide(service_name: str) -> dict:
    """Return the JSON setup guide for a synthesized tool."""
    db = await _get_db_row(service_name)
    if not db:
        raise HTTPException(status_code=404, detail=f"Tool '{service_name}' not found")

    guide_path = db.get("guide_json_path")
    if not guide_path or not Path(guide_path).exists():
        raise HTTPException(status_code=404, detail="Setup guide not yet generated for this tool")

    guide_data = json.loads(Path(guide_path).read_text(encoding="utf-8"))
    return {"service_name": service_name, "guide": guide_data}


@router.delete("/{service_name}")
async def delete_synthesized_tool(service_name: str) -> dict:
    """Remove a synthesized tool from disk, DB, and registry."""
    reg = get_registry()
    removed: list[str] = []

    # Remove from DB
    try:
        from db.connection import get_pool
        pool = await get_pool()
        if pool:
            db = await _get_db_row(service_name)
            if db:
                # Remove guide files
                for path_key in ("guide_md_path", "guide_json_path", "file_path"):
                    p = db.get(path_key)
                    if p and Path(p).exists():
                        Path(p).unlink()
                async with pool.acquire() as conn:
                    await conn.execute(
                        "DELETE FROM synthesized_tools WHERE service_name = $1",
                        service_name,
                    )
                removed.append("database")
        else:
            from db.redis_db import is_redis_available, redis_delete_synthesized_tool
            if await is_redis_available():
                db = await _get_db_row(service_name)
                if db:
                    # Remove guide files
                    for path_key in ("guide_md_path", "guide_json_path", "file_path"):
                        p = db.get(path_key)
                        if p and Path(p).exists():
                            Path(p).unlink()
                    await redis_delete_synthesized_tool(service_name)
                    removed.append("database")
    except Exception as exc:
        logger.error("DB delete failed", error=str(exc))

    # Remove from disk (if not already removed above)
    synth_dir = Path(__file__).parent.parent / "connectors" / "synthesized"
    connector_file = synth_dir / f"{service_name}.py"
    if connector_file.exists():
        connector_file.unlink()
        removed.append("disk")

    # Remove from registry
    if reg.unregister(service_name):
        removed.append("registry")

    if not removed:
        raise HTTPException(status_code=404, detail=f"Tool '{service_name}' not found anywhere")

    return {"service_name": service_name, "removed_from": removed}


@router.post("/preview")
async def preview_gaps(body: PreviewRequest) -> dict:
    """Dry-run gap detection — does NOT trigger synthesis."""
    from core.tool_gap_detector import ToolGapDetector
    reg = get_registry()
    detector = ToolGapDetector(reg)
    report = await detector.analyze(body.workflow_description, workflow_id="preview")
    return report.to_dict()


@router.post("/{service_name}/credentials")
async def submit_credentials(service_name: str, body: CredentialSubmitRequest) -> dict:
    """
    Accept credentials from the developer, write them to the .env file,
    reload them into the current process environment, and signal the
    workflow to resume.
    """
    env_path = Path(__file__).parent.parent.parent / ".env"
    lines = []
    if env_path.exists():
        lines = env_path.read_text(encoding="utf-8").splitlines()

    for env_key, env_val in body.credentials.items():
        os.environ[env_key] = env_val  # hot-inject into current process
        # Update or append to .env
        found = False
        for i, line in enumerate(lines):
            if line.startswith(f"{env_key}=") or line.startswith(f"{env_key} ="):
                lines[i] = f'{env_key}="{env_val}"'
                found = True
                break
        if not found:
            lines.append(f'{env_key}="{env_val}"')

    try:
        env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    except Exception as exc:
        logger.warning("Could not write .env file", error=str(exc))

    # Reload the connector with new env vars (re-instantiate)
    reg = get_registry()
    connector = reg.get(service_name)
    if connector:
        try:
            rec_list = [r for r in reg.get_synthesized_tools() if r.service_name == service_name]
            if rec_list:
                rec = rec_list[0]
                new_instance = reg.hot_load(rec.file_path, rec.connector_class_name)
                reg.register_synthesized(new_instance, rec)
        except Exception as exc:
            logger.warning("Connector reload after cred submit failed", error=str(exc))

    # Signal the workflow to resume via WebSocket event AND unblock the asyncio gate
    if body.workflow_id:
        try:
            from api.websocket import broadcast_raw
            await broadcast_raw({
                "event_type": "credentials_saved",
                "workflow_id": body.workflow_id,
                "service": service_name,
                "message": "Credentials saved — workflow resuming",
            })
        except Exception:
            pass

        # Unblock the _wait_for_credentials gate inside _run_workflow
        try:
            from api.workflows import signal_credentials_saved
            signal_credentials_saved(body.workflow_id)
        except Exception as exc:
            logger.warning("Could not signal credential gate", error=str(exc))

    return {
        "service": service_name,
        "saved_keys": list(body.credentials.keys()),
        "message": "Credentials saved and injected into environment.",
    }


@router.post("/{service_name}/test")
async def test_synthesized_tool(service_name: str) -> dict:
    """Run a basic connectivity check by listing tools from the connector."""
    reg = get_registry()
    connector = reg.get(service_name)
    if not connector:
        raise HTTPException(status_code=404, detail=f"Connector '{service_name}' not in registry")

    try:
        tools = await connector.list_tools()
        return {
            "service": service_name,
            "status": "ok",
            "tool_count": len(tools),
            "tools": [t["name"] for t in tools],
            "message": "Connector is live and responding.",
        }
    except Exception as exc:
        return {
            "service": service_name,
            "status": "error",
            "error": str(exc),
            "message": "Connector failed to respond. Check credentials.",
        }
