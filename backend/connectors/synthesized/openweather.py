"""OpenWeather MCP Connector — wraps OpenWeather API."""
from __future__ import annotations
import os
import httpx
from connectors.base import (
    MCPConnector,
    MCPNotFoundError,
    MCPPermissionError,
    MCPRateLimitError,
    MCPToolError,
    MCPTransientError,
)
from typing import Any, Dict

_OPENWEATHER_BASE = "https://api.openweathermap.org/data/2.5"

class OpenweatherConnector(MCPConnector):
    """Connector that exposes OpenWeather operations as MCP tools."""

    def __init__(self) -> None:
        self._api_key = os.environ.get("OPENWEATHER_API_KEY")
        self._headers = {
            "Accept": "application/json",
        }

    # ------------------------------------------------------------------
    # MCPConnector interface
    # ------------------------------------------------------------------
    def get_connector_name(self) -> str:
        return "openweather"

    def get_scoped_permissions(self) -> list[str]:
        return [
            "openweather:read",
        ]

    async def list_tools(self) -> list[Dict]:
        return [
            {
                "name": "get_weather",
                "description": "Get the current weather for a location",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "location": {"type": "string", "description": "City or location name"},
                        "units": {"type": "string", "enum": ["metric", "imperial"], "default": "metric"},
                    },
                    "required": ["location"],
                },
                "sensitive": False,
            },
        ]

    async def invoke(self, tool_name: str, params: Dict) -> Dict:
        dispatch = {
            "get_weather": self._get_weather,
        }
        if tool_name not in dispatch:
            raise MCPNotFoundError(f"OpenWeather connector has no tool '{tool_name}'")
        return await dispatch[tool_name](params)

    # ------------------------------------------------------------------
    # Internal HTTP helper
    # ------------------------------------------------------------------
    async def _request(self, method: str, path: str, **kwargs: Any) -> Dict:
        url = f"{_OPENWEATHER_BASE}{path}"
        async with httpx.AsyncClient(headers=self._headers, timeout=30) as client:
            resp = await client.request(method, url, **kwargs)
            if resp.status_code == 401 or resp.status_code == 403:
                raise MCPPermissionError(
                    f"OpenWeather auth error {resp.status_code}: {resp.text}",
                    error_code=str(resp.status_code),
                )
            if resp.status_code == 404:
                raise MCPNotFoundError(
                    f"OpenWeather resource not found: {path}",
                    error_code="404",
                )
            if resp.status_code == 429:
                raise MCPRateLimitError(
                    "OpenWeather API rate limit exceeded",
                    error_code="429",
                )
            if resp.status_code in (500, 502, 503):
                raise MCPTransientError(
                    f"OpenWeather transient error {resp.status_code}",
                    error_code=str(resp.status_code),
                )
            if not resp.is_success:
                raise MCPToolError(
                    f"OpenWeather API error {resp.status_code}: {resp.text}",
                    error_code=str(resp.status_code),
                )
            return resp.json() if resp.content else {}

    # ------------------------------------------------------------------
    # Tool implementations
    # ------------------------------------------------------------------
    async def _get_weather(self, params: Dict) -> Dict:
        location = params["location"]
        units = params.get("units", "metric")
        query: Dict[str, Any] = {
            "q": location,
            "units": units,
            "appid": self._api_key,
        }
        data = await self._request("GET", "/weather", params=query)
        return {
            "location": data["name"],
            "weather": data["weather"][0]["description"],
            "temperature": data["main"]["temp"],
            "humidity": data["main"]["humidity"],
            "wind_speed": data["wind"]["speed"],
        }