"""Jira MCP Connector — wraps Jira REST API v3."""

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


class JiraConnector(MCPConnector):
    """Connector that exposes Jira operations as MCP tools."""

    def __init__(self) -> None:
        settings = get_settings()
        self._base_url = settings.jira_base_url.rstrip("/")
        self._default_project = settings.jira_default_project
        # Basic auth: base64(email:api_token)
        creds = f"{settings.jira_email}:{settings.jira_api_token}"
        encoded = base64.b64encode(creds.encode()).decode()
        self._headers = {
            "Authorization": f"Basic {encoded}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    def get_connector_name(self) -> str:
        return "jira"

    def get_scoped_permissions(self) -> list[str]:
        return ["jira:read", "jira:write", "jira:issues", "jira:projects"]

    async def list_tools(self) -> list[dict]:
        return [
            {
                "name": "create_issue",
                "description": "Create a new Jira issue (bug, task, story, etc.)",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "project_key": {"type": "string", "description": "Jira project key, e.g. SCRUM"},
                        "summary": {"type": "string", "description": "Issue title/summary"},
                        "description": {"type": "string", "description": "Detailed description"},
                        "issue_type": {"type": "string", "enum": ["Story", "Task", "Bug", "Epic", "Subtask"], "default": "Story"},
                        "priority": {"type": "string", "enum": ["Highest", "High", "Medium", "Low", "Lowest"], "default": "Medium"},
                        "labels": {"type": "array", "items": {"type": "string"}},
                    },
                    "required": ["summary"],
                },
                "sensitive": False,
            },
            {
                "name": "get_issue",
                "description": "Get details of a specific Jira issue by key (e.g. SCRUM-1)",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "issue_key": {"type": "string", "description": "Issue key like SCRUM-1"},
                    },
                    "required": ["issue_key"],
                },
                "sensitive": False,
            },
            {
                "name": "list_issues",
                "description": "List issues in a Jira project with optional filters",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "project_key": {"type": "string"},
                        "status": {"type": "string", "description": "Filter by status: To Do, In Progress, Done"},
                        "issue_type": {"type": "string", "description": "Filter by type: Bug, Task, Story"},
                        "max_results": {"type": "integer", "default": 20},
                    },
                },
                "sensitive": False,
            },
            {
                "name": "update_issue_status",
                "description": "Transition a Jira issue to a new status (e.g. move to In Progress or Done)",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "issue_key": {"type": "string"},
                        "status": {"type": "string", "description": "Target status: To Do, In Progress, Done"},
                    },
                    "required": ["issue_key", "status"],
                },
                "sensitive": False,
            },
            {
                "name": "add_comment",
                "description": "Add a comment to an existing Jira issue",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "issue_key": {"type": "string"},
                        "comment": {"type": "string"},
                    },
                    "required": ["issue_key", "comment"],
                },
                "sensitive": False,
            },
            {
                "name": "assign_issue",
                "description": "Assign a Jira issue to a user by their account ID or email",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "issue_key": {"type": "string"},
                        "assignee_email": {"type": "string"},
                    },
                    "required": ["issue_key", "assignee_email"],
                },
                "sensitive": False,
            },
        ]

    async def invoke(self, tool_name: str, params: dict) -> dict:
        dispatch = {
            "create_issue": self._create_issue,
            "get_issue": self._get_issue,
            "list_issues": self._list_issues,
            "update_issue_status": self._update_issue_status,
            "add_comment": self._add_comment,
            "assign_issue": self._assign_issue,
        }
        if tool_name not in dispatch:
            raise MCPNotFoundError(f"Jira connector has no tool '{tool_name}'")
        return await dispatch[tool_name](params)

    # ------------------------------------------------------------------
    # Internal HTTP helper
    # ------------------------------------------------------------------

    async def _request(self, method: str, path: str, **kwargs: Any) -> dict:
        url = f"{self._base_url}/rest/api/3{path}"
        async with httpx.AsyncClient(headers=self._headers, timeout=30) as client:
            resp = await client.request(method, url, **kwargs)

        if resp.status_code in (401, 403):
            raise MCPPermissionError(f"Jira auth error {resp.status_code}: {resp.text}", error_code=str(resp.status_code))
        if resp.status_code == 404:
            raise MCPNotFoundError(f"Jira resource not found: {path}", error_code="404")
        if resp.status_code == 429:
            raise MCPRateLimitError("Jira API rate limit exceeded", error_code="429")
        if resp.status_code in (500, 502, 503):
            raise MCPTransientError(f"Jira transient error {resp.status_code}", error_code=str(resp.status_code))
        if not resp.is_success:
            raise MCPToolError(f"Jira API error {resp.status_code}: {resp.text[:200]}", error_code=str(resp.status_code))
        return resp.json() if resp.content else {}

    # ------------------------------------------------------------------
    # Tool implementations
    # ------------------------------------------------------------------

    async def _create_issue(self, params: dict) -> dict:
        project_key = params.get("project_key", self._default_project)
        priority = params.get("priority", "Medium")
        description_text = params.get("description", "")

        # Fetch valid issue types for this project and pick the best match
        requested_type = params.get("issue_type", "Task")
        try:
            meta = await self._request("GET", f"/issue/createmeta/{project_key}/issuetypes")
            valid_types = [t["name"] for t in meta.get("issueTypes", [])]
        except Exception:
            valid_types = []

        # Pick: exact match → "Bug"-like → "Task"-like → first available (never subtask)
        issue_type = requested_type
        if valid_types:
            # Filter out subtask types
            non_subtask = [t for t in valid_types if "sub" not in t.lower()]
            pool = non_subtask if non_subtask else valid_types
            lower_req = requested_type.lower()
            exact = next((t for t in pool if t.lower() == lower_req), None)
            if exact:
                issue_type = exact
            else:
                fallback = next((t for t in pool if "bug" in t.lower()), None) \
                        or next((t for t in pool if "task" in t.lower()), None) \
                        or next((t for t in pool if "story" in t.lower()), None) \
                        or pool[0]
                issue_type = fallback

        payload: dict[str, Any] = {
            "fields": {
                "project": {"key": project_key},
                "summary": params["summary"],
                "issuetype": {"name": issue_type},
                "priority": {"name": priority},
                "description": {
                    "type": "doc",
                    "version": 1,
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [{"type": "text", "text": description_text or params["summary"]}]
                        }
                    ]
                },
            }
        }

        if labels := params.get("labels"):
            payload["fields"]["labels"] = labels

        data = await self._request("POST", "/issue", json=payload)
        return {
            "issue_key": data["key"],
            "key": data["key"],          # alias so templates like {{step_0.output.key}} work
            "issue_id": data["id"],
            "issue_url": f"{self._base_url}/browse/{data['key']}",
            "summary": params["summary"],
            "project": project_key,
            "issue_type": issue_type,
        }

    async def _get_issue(self, params: dict) -> dict:
        issue_key = params["issue_key"]
        data = await self._request("GET", f"/issue/{issue_key}")
        fields = data.get("fields", {})
        return {
            "issue_key": data["key"],
            "summary": fields.get("summary", ""),
            "status": fields.get("status", {}).get("name", ""),
            "issue_type": fields.get("issuetype", {}).get("name", ""),
            "priority": fields.get("priority", {}).get("name", ""),
            "assignee": fields.get("assignee", {}).get("displayName", "Unassigned") if fields.get("assignee") else "Unassigned",
            "reporter": fields.get("reporter", {}).get("displayName", ""),
            "created": fields.get("created", ""),
            "updated": fields.get("updated", ""),
            "issue_url": f"{self._base_url}/browse/{data['key']}",
        }

    async def _list_issues(self, params: dict) -> dict:
        project_key = params.get("project_key", self._default_project)
        max_results = params.get("max_results", 20)

        jql_parts = [f"project = {project_key}"]
        if status := params.get("status"):
            jql_parts.append(f'status = "{status}"')
        if issue_type := params.get("issue_type"):
            jql_parts.append(f'issuetype = "{issue_type}"')

        jql = " AND ".join(jql_parts) + " ORDER BY created DESC"
        data = await self._request("GET", "/search/jql", params={"jql": jql, "maxResults": max_results, "fields": "summary,status,issuetype,priority,assignee"})

        issues = []
        for item in data.get("issues", []):
            f = item.get("fields", {})
            issues.append({
                "key": item["key"],
                "summary": f.get("summary", ""),
                "status": f.get("status", {}).get("name", ""),
                "type": f.get("issuetype", {}).get("name", ""),
                "priority": f.get("priority", {}).get("name", ""),
                "url": f"{self._base_url}/browse/{item['key']}",
            })

        return {"issues": issues, "total": data.get("total", len(issues)), "project": project_key}

    async def _update_issue_status(self, params: dict) -> dict:
        issue_key = params["issue_key"]
        target_status = params["status"].lower()

        # Get available transitions
        trans_data = await self._request("GET", f"/issue/{issue_key}/transitions")
        transitions = trans_data.get("transitions", [])

        # Find matching transition (case-insensitive)
        transition_id = None
        matched_name = ""
        for t in transitions:
            if t["to"]["name"].lower() == target_status or target_status in t["to"]["name"].lower():
                transition_id = t["id"]
                matched_name = t["to"]["name"]
                break

        if not transition_id:
            available = [t["to"]["name"] for t in transitions]
            raise MCPToolError(f"No transition to '{params['status']}' found. Available: {available}")

        await self._request("POST", f"/issue/{issue_key}/transitions", json={"transition": {"id": transition_id}})
        return {
            "issue_key": issue_key,
            "new_status": matched_name,
            "issue_url": f"{self._base_url}/browse/{issue_key}",
        }

    async def _add_comment(self, params: dict) -> dict:
        issue_key = params["issue_key"]
        comment_text = params["comment"]

        payload = {
            "body": {
                "type": "doc",
                "version": 1,
                "content": [
                    {
                        "type": "paragraph",
                        "content": [{"type": "text", "text": comment_text}]
                    }
                ]
            }
        }
        data = await self._request("POST", f"/issue/{issue_key}/comment", json=payload)
        return {
            "issue_key": issue_key,
            "comment_id": data.get("id", ""),
            "comment": comment_text,
            "issue_url": f"{self._base_url}/browse/{issue_key}",
        }

    async def _assign_issue(self, params: dict) -> dict:
        issue_key = params["issue_key"]
        assignee_email = params["assignee_email"]

        # Search for user by email
        users = await self._request("GET", "/user/search", params={"query": assignee_email})
        if not users:
            raise MCPNotFoundError(f"No Jira user found with email '{assignee_email}'")

        account_id = users[0]["accountId"]
        await self._request("PUT", f"/issue/{issue_key}/assignee", json={"accountId": account_id})
        return {
            "issue_key": issue_key,
            "assignee": users[0].get("displayName", assignee_email),
            "issue_url": f"{self._base_url}/browse/{issue_key}",
        }
