"""GitHub MCP Connector — wraps GitHub REST API v3."""

from __future__ import annotations

import base64
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

_GITHUB_BASE = "https://api.github.com"


class GitHubConnector(MCPConnector):
    """Connector that exposes GitHub operations as MCP tools."""

    def __init__(self) -> None:
        pass

    @property
    def token(self) -> str:
        return get_settings().github_token

    @property
    def default_owner(self) -> str:
        return get_settings().github_default_repo_owner

    @property
    def headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    # ------------------------------------------------------------------
    # MCPConnector interface
    # ------------------------------------------------------------------

    def get_connector_name(self) -> str:
        return "github"

    def get_scoped_permissions(self) -> list[str]:
        return [
            "github:read",
            "github:write",
            "github:issues",
            "github:branches",
            "github:push",
        ]

    async def list_tools(self) -> list[dict]:
        return [
            {
                "name": "get_repo_info",
                "description": "Get metadata about a GitHub repository",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "repo": {"type": "string", "description": "owner/repo format"},
                    },
                    "required": ["repo"],
                },
                "sensitive": False,
            },
            {
                "name": "create_branch",
                "description": "Create a new git branch in a repository",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "repo": {"type": "string"},
                        "branch_name": {"type": "string"},
                        "from_branch": {"type": "string", "default": "main"},
                    },
                    "required": ["repo", "branch_name"],
                },
                "sensitive": False,
            },
            {
                "name": "create_issue",
                "description": "Create a GitHub issue",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "repo": {"type": "string"},
                        "title": {"type": "string"},
                        "body": {"type": "string"},
                        "labels": {"type": "array", "items": {"type": "string"}},
                    },
                    "required": ["repo", "title", "body"],
                },
                "sensitive": False,
            },
            {
                "name": "list_issues",
                "description": "List issues in a repository",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "repo": {"type": "string"},
                        "state": {"type": "string", "enum": ["open", "closed", "all"], "default": "open"},
                        "labels": {"type": "array", "items": {"type": "string"}},
                    },
                    "required": ["repo"],
                },
                "sensitive": False,
            },
            {
                "name": "close_issue",
                "description": "Close a GitHub issue (destructive)",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "repo": {"type": "string"},
                        "issue_number": {"type": "integer"},
                        "comment": {"type": "string"},
                    },
                    "required": ["repo", "issue_number"],
                },
                "sensitive": True,
            },
            {
                "name": "push_file",
                "description": "Push (create or update) a file in a repository",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "repo": {"type": "string"},
                        "file_path": {"type": "string"},
                        "content": {"type": "string"},
                        "commit_message": {"type": "string"},
                        "branch": {"type": "string"},
                    },
                    "required": ["repo", "file_path", "content", "commit_message", "branch"],
                },
                "sensitive": True,
            },
        ]

    async def invoke(self, tool_name: str, params: dict) -> dict:
        dispatch = {
            "get_repo_info": self._get_repo_info,
            "create_branch": self._create_branch,
            "create_issue": self._create_issue,
            "list_issues": self._list_issues,
            "close_issue": self._close_issue,
            "push_file": self._push_file,
        }
        if tool_name not in dispatch:
            raise MCPNotFoundError(f"GitHub connector has no tool '{tool_name}'")
        return await dispatch[tool_name](params)

    # ------------------------------------------------------------------
    # Internal HTTP helper
    # ------------------------------------------------------------------

    async def _request(
        self,
        method: str,
        path: str,
        **kwargs: Any,
    ) -> dict:
        url = f"{_GITHUB_BASE}{path}"
        async with httpx.AsyncClient(headers=self.headers, timeout=30) as client:
            resp = await client.request(method, url, **kwargs)

        if resp.status_code == 401 or resp.status_code == 403:
            raise MCPPermissionError(
                f"GitHub auth error {resp.status_code}: {resp.text}",
                error_code=str(resp.status_code),
            )
        if resp.status_code == 404:
            raise MCPNotFoundError(
                f"GitHub resource not found: {path}",
                error_code="404",
            )
        if resp.status_code == 429:
            raise MCPRateLimitError(
                "GitHub API rate limit exceeded",
                error_code="429",
            )
        if resp.status_code in (500, 502, 503):
            raise MCPTransientError(
                f"GitHub transient error {resp.status_code}",
                error_code=str(resp.status_code),
            )
        if not resp.is_success:
            raise MCPToolError(
                f"GitHub API error {resp.status_code}: {resp.text}",
                error_code=str(resp.status_code),
            )
        return resp.json() if resp.content else {}

    # ------------------------------------------------------------------
    # Tool implementations
    # ------------------------------------------------------------------

    def _resolve_repo(self, repo: str) -> str:
        """Ensure repo format is owner/repo. Prepend default owner if missing."""
        if "/" not in repo and self.default_owner:
            return f"{self.default_owner}/{repo}"
        return repo

    async def _get_repo_info(self, params: dict) -> dict:
        repo = self._resolve_repo(params["repo"])
        data = await self._request("GET", f"/repos/{repo}")
        return {
            "name": data["name"],
            "full_name": data["full_name"],
            "default_branch": data["default_branch"],
            "private": data["private"],
            "stars": data["stargazers_count"],
            "language": data.get("language"),
        }

    async def _create_branch(self, params: dict) -> dict:
        repo = self._resolve_repo(params["repo"])
        branch_name = params["branch_name"]
        from_branch = params.get("from_branch", "main")

        # Get SHA of source branch
        ref_data = await self._request("GET", f"/repos/{repo}/git/ref/heads/{from_branch}")
        sha = ref_data["object"]["sha"]

        # Create new ref
        await self._request(
            "POST",
            f"/repos/{repo}/git/refs",
            json={"ref": f"refs/heads/{branch_name}", "sha": sha},
        )
        return {
            "branch_name": branch_name,
            "branch_url": f"https://github.com/{repo}/tree/{branch_name}",
            "sha": sha,
            "created_from": from_branch,
        }

    async def _create_issue(self, params: dict) -> dict:
        repo = self._resolve_repo(params["repo"])
        payload: dict[str, Any] = {
            "title": params["title"],
            "body": params.get("body", ""),
        }
        if labels := params.get("labels"):
            payload["labels"] = labels

        data = await self._request("POST", f"/repos/{repo}/issues", json=payload)
        return {
            "issue_number": data["number"],
            "issue_url": data["html_url"],
            "title": data["title"],
            "created_at": data["created_at"],
        }

    async def _list_issues(self, params: dict) -> dict:
        repo = self._resolve_repo(params["repo"])
        query: dict[str, Any] = {"state": params.get("state", "open"), "per_page": 50}
        if labels := params.get("labels"):
            query["labels"] = ",".join(labels)

        data = await self._request("GET", f"/repos/{repo}/issues", params=query)
        return {
            "issues": [
                {
                    "number": i["number"],
                    "title": i["title"],
                    "state": i["state"],
                    "url": i["html_url"],
                    "created_at": i["created_at"],
                }
                for i in data
                if "pull_request" not in i  # exclude PRs
            ]
        }

    async def _close_issue(self, params: dict) -> dict:
        repo = self._resolve_repo(params["repo"])
        issue_number = params["issue_number"]

        # Optionally add a comment before closing
        if comment := params.get("comment"):
            await self._request(
                "POST",
                f"/repos/{repo}/issues/{issue_number}/comments",
                json={"body": comment},
            )

        data = await self._request(
            "PATCH",
            f"/repos/{repo}/issues/{issue_number}",
            json={"state": "closed"},
        )
        return {"issue_number": data["number"], "closed_at": data["closed_at"]}

    async def _push_file(self, params: dict) -> dict:
        repo = self._resolve_repo(params["repo"])
        file_path = params["file_path"]
        content = params["content"]
        commit_message = params["commit_message"]
        branch = params["branch"]

        # Check if file already exists (to get current SHA)
        existing_sha: str | None = None
        try:
            existing = await self._request(
                "GET", f"/repos/{repo}/contents/{file_path}",
                params={"ref": branch},
            )
            existing_sha = existing.get("sha")
        except MCPNotFoundError:
            pass  # new file — no SHA needed

        encoded_content = base64.b64encode(content.encode()).decode()
        payload: dict[str, Any] = {
            "message": commit_message,
            "content": encoded_content,
            "branch": branch,
        }
        if existing_sha:
            payload["sha"] = existing_sha

        data = await self._request(
            "PUT",
            f"/repos/{repo}/contents/{file_path}",
            json=payload,
        )
        return {
            "commit_sha": data["commit"]["sha"],
            "file_url": data["content"]["html_url"],
            "branch": branch,
        }
