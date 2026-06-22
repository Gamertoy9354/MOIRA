"""Abstract MCP Connector base class and exception hierarchy."""

from __future__ import annotations

from abc import ABC, abstractmethod


# ---------------------------------------------------------------------------
# Exception hierarchy
# ---------------------------------------------------------------------------

class MCPToolError(Exception):
    """General tool execution failure."""

    def __init__(self, message: str, error_code: str | None = None) -> None:
        super().__init__(message)
        self.error_code = error_code


class MCPPermissionError(MCPToolError):
    """Authentication or authorisation failure (HTTP 401/403)."""


class MCPNotFoundError(MCPToolError):
    """Resource not found (HTTP 404)."""


class MCPRateLimitError(MCPToolError):
    """Rate-limited by upstream API (HTTP 429)."""


class MCPTransientError(MCPToolError):
    """Temporary failure that is safe to retry (HTTP 500/502/503)."""


# ---------------------------------------------------------------------------
# Abstract base connector
# ---------------------------------------------------------------------------

class MCPConnector(ABC):
    """Abstract base class that every MCP connector must implement."""

    @abstractmethod
    async def list_tools(self) -> list[dict]:
        """
        Return the list of tool definitions exposed by this connector.

        Each dict must have:
          - name: str
          - description: str
          - parameters: dict  (JSON Schema object)
          - sensitive: bool
        """

    @abstractmethod
    async def invoke(self, tool_name: str, params: dict) -> dict:
        """
        Execute the named tool with the given params.

        Raises:
            MCPToolError: on general failure
            MCPPermissionError: on auth failure
            MCPNotFoundError: if the tool or resource doesn't exist
            MCPRateLimitError: when upstream rate-limits us
            MCPTransientError: on temporary upstream failure
        """

    @abstractmethod
    def get_connector_name(self) -> str:
        """Return the canonical connector name, e.g. ``'github'``."""

    @abstractmethod
    def get_scoped_permissions(self) -> list[str]:
        """
        Return the list of permission strings this connector holds.
        Used by SafeGuard Layer 1 for permission checking.
        """
