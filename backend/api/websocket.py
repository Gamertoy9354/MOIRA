"""WebSocket endpoint and memory-backed event broadcaster."""

from __future__ import annotations

import asyncio
import json
from typing import Dict, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from models.events import WebSocketEvent
from utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter()

# ---------------------------------------------------------------------------
# Memory-based pub/sub for local development
# ---------------------------------------------------------------------------

class MemoryBroadcaster:
    def __init__(self):
        # workflow_id -> set of queues
        self._subscribers: Dict[str, Set[asyncio.Queue]] = {}

    def subscribe(self, workflow_id: str) -> asyncio.Queue:
        if workflow_id not in self._subscribers:
            self._subscribers[workflow_id] = set()
        queue = asyncio.Queue()
        self._subscribers[workflow_id].add(queue)
        return queue

    def unsubscribe(self, workflow_id: str, queue: asyncio.Queue):
        if workflow_id in self._subscribers:
            self._subscribers[workflow_id].discard(queue)
            if not self._subscribers[workflow_id]:
                del self._subscribers[workflow_id]

    async def broadcast(self, event: WebSocketEvent):
        workflow_id = event.workflow_id
        if workflow_id in self._subscribers:
            payload = event.model_dump_json()
            for queue in self._subscribers[workflow_id]:
                await queue.put(payload)

    async def broadcast_dict(self, data: dict):
        """Broadcast a raw dict to the matching workflow_id AND _global channels."""
        payload = json.dumps(data)
        workflow_id = data.get("workflow_id", "_global")
        targets: set[asyncio.Queue] = set()
        if workflow_id in self._subscribers:
            targets.update(self._subscribers[workflow_id])
        # Also fan-out to the _global channel (catch-all for synthesis events)
        if "_global" in self._subscribers:
            targets.update(self._subscribers["_global"])
        for queue in targets:
            await queue.put(payload)


_broadcaster = MemoryBroadcaster()


async def broadcast_event(event: WebSocketEvent) -> None:
    """Publish a typed WebSocket event to the in-memory broadcaster."""
    try:
        await _broadcaster.broadcast(event)
    except Exception as exc:
        logger.error("Failed to broadcast event", error=str(exc), event_type=event.event_type)


async def broadcast_raw(data: dict) -> None:
    """Publish a raw dict event (used by synthesis engine and other non-typed events)."""
    try:
        await _broadcaster.broadcast_dict(data)
    except Exception as exc:
        logger.error("Failed to broadcast raw event", error=str(exc))


# ---------------------------------------------------------------------------
# WebSocket endpoint — subscribes and forwards messages to the client
# ---------------------------------------------------------------------------

@router.websocket("/ws/{workflow_id}")
async def workflow_websocket(websocket: WebSocket, workflow_id: str) -> None:
    """Forward in-memory messages to the connected WebSocket client."""
    await websocket.accept()
    logger.info("WebSocket connected", workflow_id=workflow_id)

    queue = _broadcaster.subscribe(workflow_id)

    try:
        while True:
            data = await queue.get()
            try:
                await websocket.send_text(data)
            except WebSocketDisconnect:
                break
            except Exception as exc:
                logger.warning("WebSocket send error", error=str(exc))
                break
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected", workflow_id=workflow_id)
    except Exception as exc:
        logger.error("WebSocket error", workflow_id=workflow_id, error=str(exc))
    finally:
        _broadcaster.unsubscribe(workflow_id, queue)
        logger.info("WebSocket cleanup done", workflow_id=workflow_id)
