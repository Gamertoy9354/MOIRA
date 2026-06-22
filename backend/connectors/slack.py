"""Slack MCP Connector — wraps Slack Web API."""

from __future__ import annotations

from typing import Any

import httpx

from connectors.base import (
    MCPConnector,
    MCPNotFoundError,
    MCPPermissionError,
    MCPRateLimitError,
    MCPToolError,
    MCPTransientError,
)
from utils.config import get_settings
from utils.logger import get_logger

logger = get_logger(__name__)

_SLACK_BASE = "https://slack.com/api"


class SlackConnector(MCPConnector):
    """Connector that exposes Slack operations as MCP tools."""

    def __init__(self) -> None:
        settings = get_settings()
        self._token = settings.slack_bot_token
        self._headers = {
            "Authorization": f"Bearer {self._token}",
            "Content-Type": "application/json",
        }

    def get_connector_name(self) -> str:
        return "slack"

    def get_scoped_permissions(self) -> list[str]:
        return [
            "slack:read",
            "slack:write",
            "slack:channels",
            "slack:messages",
        ]

    async def list_tools(self) -> list[dict]:
        return [
            {
                "name": "send_message",
                "description": "Send a message to a Slack channel",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "channel": {"type": "string"},
                        "message": {"type": "string"},
                        "thread_ts": {"type": "string"},
                    },
                    "required": ["channel", "message"],
                },
                "sensitive": False,
            },
            {
                "name": "list_channels",
                "description": "List all Slack channels",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "exclude_archived": {"type": "boolean", "default": True},
                    },
                },
                "sensitive": False,
            },
            {
                "name": "get_channel_history",
                "description": "Get recent messages from a Slack channel",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "channel": {"type": "string"},
                        "limit": {"type": "integer", "default": 10},
                    },
                    "required": ["channel"],
                },
                "sensitive": False,
            },
            {
                "name": "set_channel_topic",
                "description": "Set the topic of a Slack channel",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "channel": {"type": "string"},
                        "topic": {"type": "string"},
                    },
                    "required": ["channel", "topic"],
                },
                "sensitive": True,
            },
        ]

    async def invoke(self, tool_name: str, params: dict) -> dict:
        dispatch = {
            "send_message": self._send_message,
            "list_channels": self._list_channels,
            "get_channel_history": self._get_channel_history,
            "set_channel_topic": self._set_channel_topic,
        }
        if tool_name not in dispatch:
            raise MCPNotFoundError(f"Slack connector has no tool '{tool_name}'")
        return await dispatch[tool_name](params)

    # ------------------------------------------------------------------
    # Internal HTTP helper
    # ------------------------------------------------------------------

    async def _request(self, method_path: str, payload: dict) -> dict:
        url = f"{_SLACK_BASE}/{method_path}"
        async with httpx.AsyncClient(headers=self._headers, timeout=30) as client:
            resp = await client.post(url, json=payload)

        if resp.status_code == 429:
            raise MCPRateLimitError("Slack API rate limit exceeded", error_code="429")
        if resp.status_code in (500, 502, 503):
            raise MCPTransientError(f"Slack transient error {resp.status_code}", error_code=str(resp.status_code))
        if not resp.is_success:
            raise MCPToolError(f"Slack HTTP error {resp.status_code}: {resp.text}", error_code=str(resp.status_code))

        data = resp.json()
        if not data.get("ok"):
            error = data.get("error", "unknown_error")
            if error in ("invalid_auth", "not_authed", "account_inactive", "token_revoked"):
                raise MCPPermissionError(f"Slack auth error: {error}", error_code=error)
            if error == "channel_not_found":
                raise MCPNotFoundError(f"Slack channel not found", error_code=error)
            raise MCPToolError(f"Slack API error: {error}", error_code=error)
        return data

    # ------------------------------------------------------------------
    # Tool implementations
    # ------------------------------------------------------------------

    async def _send_message(self, params: dict) -> dict:
        payload: dict[str, Any] = {
            "channel": params["channel"],
            "text": params["message"],
        }
        if thread_ts := params.get("thread_ts"):
            payload["thread_ts"] = thread_ts

        data = await self._request("chat.postMessage", payload)
        return {
            "message_ts": data["ts"],
            "channel": data["channel"],
            "message": params["message"],
        }

    async def _list_channels(self, params: dict) -> dict:
        exclude_archived = params.get("exclude_archived", True)
        data = await self._request("conversations.list", {"exclude_archived": exclude_archived, "limit": 200})
        return {
            "channels": [
                {
                    "id": ch["id"],
                    "name": ch["name"],
                    "is_private": ch["is_private"],
                    "member_count": ch.get("num_members", 0),
                }
                for ch in data.get("channels", [])
            ]
        }

    async def _get_channel_history(self, params: dict) -> dict:
        data = await self._request(
            "conversations.history",
            {"channel": params["channel"], "limit": params.get("limit", 10)},
        )
        return {
            "messages": [
                {
                    "ts": m["ts"],
                    "user": m.get("user", "bot"),
                    "text": m.get("text", ""),
                    "reactions": m.get("reactions", []),
                }
                for m in data.get("messages", [])
            ]
        }

    async def _set_channel_topic(self, params: dict) -> dict:
        from datetime import datetime
        data = await self._request(
            "conversations.setTopic",
            {"channel": params["channel"], "topic": params["topic"]},
        )
        return {
            "channel": params["channel"],
            "topic": params["topic"],
            "updated_at": datetime.utcnow().isoformat(),
        }
