"""Connectors package."""
from .base import MCPConnector, MCPToolError, MCPPermissionError, MCPNotFoundError, MCPRateLimitError, MCPTransientError
from .github import GitHubConnector
from .slack import SlackConnector
from .sheets import GoogleSheetsConnector
from .database import DatabaseConnector

__all__ = [
    "MCPConnector",
    "MCPToolError", "MCPPermissionError", "MCPNotFoundError", "MCPRateLimitError", "MCPTransientError",
    "GitHubConnector", "SlackConnector", "GoogleSheetsConnector", "DatabaseConnector",
]
