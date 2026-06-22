"""Google Sheets MCP Connector — wraps Sheets API v4 via service account."""

from __future__ import annotations

import base64
import json
from datetime import datetime, timedelta, timezone
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

_SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets"
_DRIVE_BASE = "https://www.googleapis.com/drive/v3"
_TOKEN_URL = "https://oauth2.googleapis.com/token"


_token_cache: dict[str, tuple[str, datetime]] = {}


class GoogleSheetsConnector(MCPConnector):
    """Connector that exposes Google Sheets operations as MCP tools."""

    def __init__(self) -> None:
        pass

    @property
    def service_account(self) -> dict:
        settings = get_settings()
        return self._load_service_account(settings)

    @property
    def default_spreadsheet_id(self) -> str:
        from utils.config import get_credential
        return get_credential("GOOGLE_AUDIT_SPREADSHEET_ID") or get_settings().google_audit_spreadsheet_id

    # ------------------------------------------------------------------
    # Service account helpers
    # ------------------------------------------------------------------

    def _load_service_account(self, settings: Any) -> dict:
        """Load service account JSON from env/settings fields or files."""
        from utils.config import get_credential
        client_email = get_credential("GOOGLE_CLIENT_EMAIL")
        private_key = get_credential("GOOGLE_PRIVATE_KEY")
        project_id = get_credential("GOOGLE_PROJECT_ID")

        if client_email and private_key:
            pk = private_key.replace("\\n", "\n")
            return {
                "type": "service_account",
                "project_id": project_id or "default-project",
                "private_key_id": "moira-custom-key",
                "private_key": pk,
                "client_email": client_email,
                "client_id": "1234567890",
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                "client_x509_cert_url": f"https://www.googleapis.com/robot/v1/metadata/x509/{client_email.replace('@', '%40')}"
            }

        if settings.google_service_account_b64:
            try:
                raw = base64.b64decode(settings.google_service_account_b64)
                return json.loads(raw)
            except Exception as exc:
                logger.error(f"Failed to decode GOOGLE_SERVICE_ACCOUNT_B64: {exc}")
                return {}
        if settings.google_service_account_json:
            try:
                with open(settings.google_service_account_json) as f:
                    return json.load(f)
            except Exception as exc:
                logger.error(f"Failed to load GOOGLE_SERVICE_ACCOUNT_JSON: {exc}")
                return {}
        # Return empty dict — connector will fail gracefully at call time
        logger.warning("No Google service account configured")
        return {}

    async def _ensure_token(self) -> str:
        """Obtain or refresh the OAuth2 access token."""
        sa_info = self.service_account
        if not sa_info:
            raise MCPPermissionError("Google Sheets: no service account configured")

        email = sa_info.get("client_email", "default")
        if email in _token_cache:
            tok, exp = _token_cache[email]
            if datetime.now(tz=timezone.utc) < exp:
                return tok

        try:
            import google.auth.transport.requests  # type: ignore
            import google.oauth2.service_account as sa  # type: ignore

            scopes = [
                "https://www.googleapis.com/auth/spreadsheets",
                "https://www.googleapis.com/auth/drive.readonly",
            ]
            creds = sa.Credentials.from_service_account_info(sa_info, scopes=scopes)
            request = google.auth.transport.requests.Request()
            creds.refresh(request)
            tok = creds.token
            exp = datetime.now(tz=timezone.utc) + timedelta(seconds=3500)
            _token_cache[email] = (tok, exp)
            return tok
        except Exception as exc:
            raise MCPPermissionError(f"Google Sheets token error: {exc}") from exc

    async def _headers(self) -> dict:
        token = await self._ensure_token()
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    async def _request(self, method: str, url: str, **kwargs: Any) -> dict:
        headers = await self._headers()
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.request(method, url, headers=headers, **kwargs)

        if resp.status_code in (401, 403):
            raise MCPPermissionError(f"Sheets auth error {resp.status_code}", error_code=str(resp.status_code))
        if resp.status_code == 404:
            raise MCPNotFoundError("Sheets resource not found", error_code="404")
        if resp.status_code == 429:
            raise MCPRateLimitError("Sheets API rate limit", error_code="429")
        if resp.status_code in (500, 502, 503):
            raise MCPTransientError(f"Sheets transient error {resp.status_code}", error_code=str(resp.status_code))
        if not resp.is_success:
            raise MCPToolError(f"Sheets API error {resp.status_code}: {resp.text}", error_code=str(resp.status_code))
        return resp.json() if resp.content else {}

    # ------------------------------------------------------------------
    # MCPConnector interface
    # ------------------------------------------------------------------

    def get_connector_name(self) -> str:
        return "sheets"

    def get_scoped_permissions(self) -> list[str]:
        return ["sheets:read", "sheets:write", "drive:read"]

    async def list_tools(self) -> list[dict]:
        return [
            {
                "name": "append_row",
                "description": "Append one or multiple rows of values to a Google Sheet",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "spreadsheet_id": {"type": "string"},
                        "sheet_name": {"type": "string", "default": "Sheet1"},
                        "values": {"type": "array"},
                    },
                    "required": ["spreadsheet_id", "values"],
                },
                "sensitive": False,
            },
            {
                "name": "read_range",
                "description": "Read a cell range from a Google Sheet",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "spreadsheet_id": {"type": "string"},
                        "range_notation": {"type": "string"},
                    },
                    "required": ["spreadsheet_id", "range_notation"],
                },
                "sensitive": False,
            },
            {
                "name": "update_cell",
                "description": "Update a single cell in a Google Sheet",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "spreadsheet_id": {"type": "string"},
                        "cell_notation": {"type": "string"},
                        "value": {},
                    },
                    "required": ["spreadsheet_id", "cell_notation", "value"],
                },
                "sensitive": False,
            },
            {
                "name": "create_spreadsheet",
                "description": "Create a new blank Google Spreadsheet",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"}
                    },
                    "required": ["title"],
                },
                "sensitive": False,
            },
            {
                "name": "find_spreadsheet_by_name",
                "description": "Find a spreadsheet ID by its name in Google Drive",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                    },
                    "required": ["name"],
                },
                "sensitive": False,
            },
        ]

    async def invoke(self, tool_name: str, params: dict) -> dict:
        dispatch = {
            "append_row": self._append_row,
            "read_range": self._read_range,
            "update_cell": self._update_cell,
            "find_spreadsheet_by_name": self._find_spreadsheet_by_name,
            "create_spreadsheet": self._create_spreadsheet,
        }
        if tool_name not in dispatch:
            raise MCPNotFoundError(f"Sheets connector has no tool '{tool_name}'")
        return await dispatch[tool_name](params)

    # ------------------------------------------------------------------
    # Tool implementations
    # ------------------------------------------------------------------

    async def _append_row(self, params: dict) -> dict:
        sid = params.get("spreadsheet_id") or self.default_spreadsheet_id
        if not sid:
            raise MCPToolError("No spreadsheet_id provided and no default configured")
        sheet = params.get("sheet_name", "Sheet1")
        values = params["values"]
        
        # Normalise whatever the LLM passes into a proper 2D array:
        # Case 1: flat list of scalars  ["a","b","c"]        → [["a","b","c"]]
        # Case 2: list of single-item lists [["a"],["b"]]    → [["a","b"]]  (LLM mistake)
        # Case 3: proper 2D array  [["a","b"],["c","d"]]     → as-is
        if isinstance(values, list) and len(values) > 0:
            if not isinstance(values[0], list):
                # Case 1 — flat row
                payload_values = [values]
            elif all(isinstance(r, list) and len(r) == 1 for r in values):
                # Case 2 — each item wrapped in its own list, flatten into one row
                payload_values = [[r[0] for r in values]]
            else:
                # Case 3 — already a proper 2D array
                payload_values = values
        else:
            payload_values = [[]] if not values else values

        url = f"{_SHEETS_BASE}/{sid}/values/{sheet}:append"
        data = await self._request(
            "POST", url,
            params={"valueInputOption": "USER_ENTERED"},
            json={"values": payload_values},
        )
        return {
            "updated_range": data.get("updates", {}).get("updatedRange", ""),
            "updated_rows": data.get("updates", {}).get("updatedRows", 1),
            "spreadsheet_id": sid,
        }

    async def _read_range(self, params: dict) -> dict:
        sid = params.get("spreadsheet_id") or self.default_spreadsheet_id
        if not sid:
            raise MCPToolError("No spreadsheet_id provided and no default configured")
        range_notation = params["range_notation"]
        url = f"{_SHEETS_BASE}/{sid}/values/{range_notation}"
        data = await self._request("GET", url)
        return {
            "values": data.get("values", []),
            "range": data.get("range", range_notation),
            "spreadsheet_id": sid,
        }

    async def _update_cell(self, params: dict) -> dict:
        sid = params.get("spreadsheet_id") or self.default_spreadsheet_id
        if not sid:
            raise MCPToolError("No spreadsheet_id provided and no default configured")
        cell = params["cell_notation"]
        value = params["value"]
        url = f"{_SHEETS_BASE}/{sid}/values/{cell}"
        data = await self._request(
            "PUT", url,
            params={"valueInputOption": "USER_ENTERED"},
            json={"values": [[value]]},
        )
        return {
            "updated_range": data.get("updatedRange", cell),
            "spreadsheet_id": sid,
        }

    async def _find_spreadsheet_by_name(self, params: dict) -> dict:
        name = params["name"]
        query = f"name='{name}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false"
        url = f"{_DRIVE_BASE}/files"
        data = await self._request("GET", url, params={"q": query, "fields": "files(id,name,webViewLink)"})
        files = data.get("files", [])
        if not files:
            raise MCPNotFoundError(f"Spreadsheet '{name}' not found in Drive")
        first = files[0]
        return {
            "spreadsheet_id": first["id"],
            "name": first["name"],
            "url": first.get("webViewLink", ""),
        }

    async def _create_spreadsheet(self, params: dict) -> dict:
        title = params["title"]
        data = await self._request("POST", _SHEETS_BASE, json={"properties": {"title": title}})
        return {"spreadsheet_id": data["spreadsheetId"], "spreadsheet_url": data["spreadsheetUrl"]}

    async def batch_format(self, spreadsheet_id: str, requests: list) -> dict:
        """Send a batchUpdate formatting request to the Sheets API."""
        sid = spreadsheet_id or self.default_spreadsheet_id
        url = f"{_SHEETS_BASE}/{sid}:batchUpdate"
        return await self._request("POST", url, json={"requests": requests})

    async def get_sheet_id(self, spreadsheet_id: str, sheet_name: str) -> int:
        """Return the numeric sheetId for a named tab."""
        sid = spreadsheet_id or self.default_spreadsheet_id
        url = f"{_SHEETS_BASE}/{sid}?fields=sheets.properties"
        data = await self._request("GET", url)
        for sheet in data.get("sheets", []):
            if sheet["properties"]["title"] == sheet_name:
                return sheet["properties"]["sheetId"]
        return 0

    async def get_first_sheet_title(self, spreadsheet_id: str) -> str:
        """Return the title of the first tab in the spreadsheet."""
        sid = spreadsheet_id or self.default_spreadsheet_id
        if not sid:
            return "Sheet1"
        url = f"{_SHEETS_BASE}/{sid}?fields=sheets.properties"
        data = await self._request("GET", url)
        sheets = data.get("sheets", [])
        if sheets:
            return sheets[0]["properties"]["title"]
        return "Sheet1"

    async def clear_range(self, spreadsheet_id: str, range_notation: str) -> dict:
        """Clear all values in a range."""
        sid = spreadsheet_id or self.default_spreadsheet_id
        # Use urllib.parse.quote to properly encode the range
        from urllib.parse import quote
        encoded_range = quote(range_notation, safe='')
        url = f"{_SHEETS_BASE}/{sid}/values/{encoded_range}:clear"
        return await self._request("POST", url)

    async def write_range(self, spreadsheet_id: str, range_notation: str, values: list) -> dict:
        """Write a 2D array of values to an exact range."""
        sid = spreadsheet_id or self.default_spreadsheet_id
        url = f"{_SHEETS_BASE}/{sid}/values/{range_notation}"
        return await self._request(
            "PUT", url,
            params={"valueInputOption": "USER_ENTERED"},
            json={"values": values},
        )
