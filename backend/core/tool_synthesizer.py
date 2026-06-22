"""Tool Synthesizer — Kimi K2.5 generates complete MCP connector code.

For each ToolGap, this engine:
  1. Builds a structured prompt with base class + example connector source.
  2. Asks Kimi to return a valid Python MCPConnector subclass as JSON.
  3. Validates with ast.parse() and the SafeGuard code scanner.
  4. Writes to disk under backend/connectors/synthesized/{service}.py
  5. Hot-loads the new connector into the ConnectorRegistry without restart.
  6. Persists metadata in the synthesized_tools DB table.
  7. Emits WebSocket events throughout the process.
  8. Pauses for credential input BEFORE resuming the DAG planner.
"""

from __future__ import annotations

import ast
import inspect
import json
import re
import time
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any

from openai import AsyncOpenAI

from core.connector_registry import ConnectorRegistry, SynthesizedToolRecord
from core.tool_gap_detector import ToolGap
from utils.config import get_settings
from utils.logger import get_logger

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Dangerous patterns the SafeGuard scanner will reject
# ---------------------------------------------------------------------------

_FORBIDDEN_PATTERNS = [
    r"\bsubprocess\b",
    r"\beval\s*\(",
    r"\bexec\s*\(",
    r"\bos\.system\s*\(",
    r"\b__import__\s*\(",
    r"\bos\.popen\s*\(",
    r"\bshutil\.rmtree\b",
    r"\bopen\s*\([^)]{0,120}['\"]w['\"]",   # file write outside sandbox
]

_HARDCODED_CRED_RE = re.compile(
    r"(AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|xoxb-\d+-\S+|ghp_[A-Za-z0-9]{36})",
    re.IGNORECASE,
)


def _safety_scan(code: str) -> tuple[bool, list[str]]:
    """Return (is_safe, blocked_patterns)."""
    blocked: list[str] = []
    for pattern in _FORBIDDEN_PATTERNS:
        if re.search(pattern, code):
            blocked.append(pattern)
    if _HARDCODED_CRED_RE.search(code):
        blocked.append("hardcoded_credential_string")
    return len(blocked) == 0, blocked


# ---------------------------------------------------------------------------
# Synthesis system prompt
# ---------------------------------------------------------------------------

def _build_synthesis_prompt(
    gap: ToolGap,
    base_source: str,
    example_source: str,
) -> str:
    return f"""You are a senior Python engineer specializing in building MCP (Model Context Protocol) connector plugins.

Your task is to generate a complete, production-ready Python connector class for the service described below.

## Target Service
Intent: {gap.intent}
Service: {gap.suggested_service}
Primary tool: {gap.suggested_tool_name}
Reasoning: {gap.reasoning}

## Abstract Base Class (you MUST subclass MCPConnector)
```python
{base_source}
```

## Reference Connector (follow this exact pattern)
```python
{example_source}
```

## Requirements
1. Create a class named {gap.suggested_service.title().replace('_','')}Connector(MCPConnector)
2. Implement get_connector_name(), get_scoped_permissions(), list_tools(), invoke()
3. list_tools() MUST return a list of tool dicts matching the reference format
4. Use httpx.AsyncClient for all HTTP calls (it is already in requirements.txt)
5. Read all credentials dynamically at call-time using the get_credential(env_var_name) helper imported from utils.config (e.g. `from utils.config import get_credential` and then call `get_credential("VAR_NAME")`) — NEVER use os.environ.get() directly and NEVER hardcode secrets
6. Handle 401/403 → MCPPermissionError, 404 → MCPNotFoundError, 429 → MCPRateLimitError, 5xx → MCPTransientError

## Output Format
You MUST return EXACTLY TWO MARKDOWN BLOCKS. No other explanatory text.

First, the complete Python code block:
```python
# your connector implementation here...
```

Second, the structural metadata block:
```json
{{
  "connector_class_name": "SendGridConnector",
  "service_name": "{gap.suggested_service}",
  "tools": [
    {{
      "name": "send_email",
      "description": "Sends a transactional email via SendGrid API",
      "input_schema": {{
        "to": {{"type": "string", "required": true}},
        "subject": {{"type": "string", "required": true}},
        "body": {{"type": "string", "required": true}}
      }},
      "required_env_vars": ["SENDGRID_API_KEY"],
      "api_endpoint": "https://api.sendgrid.com/v3/mail/send",
      "http_method": "POST",
      "auth_type": "Bearer"
    }}
  ],
  "required_credentials": [
    {{
      "env_var": "SENDGRID_API_KEY",
      "display_name": "SendGrid API Key",
      "description": "Your SendGrid secret API key",
      "how_to_get": "Step by step: 1. Log in to sendgrid.com 2. Go to Settings > API Keys 3. Click Create API Key",
      "url": "https://app.sendgrid.com/settings/api_keys",
      "is_secret": true
    }}
  ]
}}
```"""


# ---------------------------------------------------------------------------
# Main synthesizer
# ---------------------------------------------------------------------------

class ToolSynthesizer:
    """Generates, validates, persists, and hot-loads new MCP connectors."""

    def __init__(
        self,
        registry: ConnectorRegistry,
        broadcast: Callable[[Any], Awaitable[None]] | None = None,
        model_id: str | None = None,
    ) -> None:
        from core.llm_router import get_llm_client
        self._registry = registry
        self._broadcast = broadcast
        self._client, self._model = get_llm_client(model_id=model_id)
        self._synth_dir = Path(__file__).parent.parent / "connectors" / "synthesized"
        self._synth_dir.mkdir(parents=True, exist_ok=True)
        self._guides_dir = Path(__file__).parent.parent / "guides"
        self._guides_dir.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    async def synthesize_all(
        self,
        gaps: list[ToolGap],
        workflow_id: str,
        user_id: str | None = None,
    ) -> list[str]:
        """Synthesize connectors for every gap. Returns list of synthesized service names."""
        synthesized: list[str] = []
        for gap in gaps:
            try:
                service = await self.synthesize_one(gap, workflow_id, user_id=user_id)
                if service:
                    synthesized.append(service)
            except Exception as exc:
                logger.error(
                    "Synthesis failed for gap",
                    service=gap.suggested_service,
                    error=str(exc),
                )
        return synthesized

    async def synthesize_one(
        self,
        gap: ToolGap,
        workflow_id: str,
        user_id: str | None = None,
    ) -> str | None:
        """
        Full synthesis pipeline for one gap.
        Returns service_name on success, None on failure.
        """
        if user_id:
            clean_user_id = user_id.replace("-", "_")
            gap.suggested_service = f"{gap.suggested_service}_{clean_user_id}"
        service = gap.suggested_service

        # ── Already synthesized? Skip. ──────────────────────────────────
        if self._registry.is_registered(service):
            logger.info("Service already registered — skipping synthesis", service=service)
            return service

        disk_path = self._synth_dir / f"{service}.py"
        if disk_path.exists():
            logger.info("Connector file already exists on disk — hot-loading", service=service)
            await self._hot_load_existing(service, disk_path)
            return service

        # ── Emit synthesis_started ──────────────────────────────────────
        await self._emit({
            "event_type": "tool_synthesis_started",
            "workflow_id": workflow_id,
            "service": service,
            "intent": gap.intent,
            "kimi_prompt_preview": gap.intent[:200],
        })

        # ── Build prompt ────────────────────────────────────────────────
        base_source = self._read_base_source()
        example_source = self._read_example_source()
        prompt = _build_synthesis_prompt(gap, base_source, example_source)

        # ── Call Kimi (streaming for live code preview) ─────────────────
        raw_response = ""
        streamed_code = ""
        _in_python_fence = False
        _code_buffer = ""
        _EMIT_EVERY = 20  # emit every N chars of code content
        try:
            stream = await self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": "You are a Python connector code generator. Return only valid JSON as instructed."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.15,
                top_p=0.85,
                max_tokens=4096,
                stream=True,
            )
            async for chunk in stream:
                token = chunk.choices[0].delta.content or ""
                if not token:
                    continue
                raw_response += token

                # Track whether we're inside the ```python ... ``` block
                if not _in_python_fence:
                    streamed_code += token
                    if "```python" in streamed_code:
                        _in_python_fence = True
                        # Strip everything up to and including the fence marker
                        streamed_code = streamed_code.split("```python", 1)[1]
                else:
                    # Check if this token closes the fence
                    if "```" in token:
                        _in_python_fence = False
                        # Flush remaining buffer before fence closes
                        before_fence = token.split("```")[0]
                        if before_fence:
                            _code_buffer += before_fence
                            await self._emit({
                                "event_type": "tool_synthesis_streaming",
                                "workflow_id": workflow_id,
                                "service": service,
                                "code_chunk": _code_buffer,
                            })
                            _code_buffer = ""
                    else:
                        streamed_code += token
                        _code_buffer += token
                        # Emit every _EMIT_EVERY chars or on a newline for smooth rendering
                        if len(_code_buffer) >= _EMIT_EVERY or "\n" in _code_buffer:
                            await self._emit({
                                "event_type": "tool_synthesis_streaming",
                                "workflow_id": workflow_id,
                                "service": service,
                                "code_chunk": _code_buffer,
                            })
                            _code_buffer = ""
        except Exception as exc:
            logger.error("Kimi synthesis API call failed", error=str(exc))
            await self._emit_blocked(workflow_id, service, f"LLM API error: {exc}", [])
            return None

        # ── Parse markdown response ─────────────────────────────────────────
        with open("debug_last_kimi_response.txt", "w", encoding="utf-8") as _log_f:
            _log_f.write(raw_response)
            
        kimi_data = self._parse_kimi_response(raw_response)
        if kimi_data is None:
            logger.error("Failed to parse Kimi output exactly")
            await self._emit_blocked(workflow_id, service, "Kimi returned unparseable syntax/JSON", [])
            return None

        python_code: str = kimi_data.get("python_code", "")
        connector_class_name: str = kimi_data.get("connector_class_name", f"{service.title()}Connector")
        tools_meta: list[dict] = kimi_data.get("tools", [])
        required_creds: list[dict] = kimi_data.get("required_credentials", [])

        # ── Syntax validation ───────────────────────────────────────────
        valid, corrected_code = await self._validate_syntax(python_code, gap, prompt)
        if not valid:
            await self._emit_blocked(
                workflow_id, service,
                "Generated Python code has invalid syntax after 2 attempts",
                ["invalid_syntax"],
            )
            return None
        python_code = corrected_code  # may be the corrected version

        # ── Safety scan ─────────────────────────────────────────────────
        is_safe, blocked_patterns = _safety_scan(python_code)
        if not is_safe:
            await self._emit_blocked(workflow_id, service, "Safety scan failed", blocked_patterns)
            await self._persist_db(
                service, connector_class_name, str(disk_path),
                tools_meta, required_creds, prompt, raw_response,
                {"blocked_patterns": blocked_patterns}, False, workflow_id,
                user_id=user_id,
            )
            return None

        # ── Write to disk ───────────────────────────────────────────────
        disk_path.write_text(python_code, encoding="utf-8")
        logger.info("Synthesized connector written to disk", path=str(disk_path))

        # ── Hot-load ────────────────────────────────────────────────────
        try:
            instance = self._registry.hot_load(str(disk_path), connector_class_name)
            loaded_tools = await instance.list_tools()
            tool_names = [t["name"] for t in loaded_tools]

            record = SynthesizedToolRecord(
                service_name=service,
                connector_class_name=connector_class_name,
                file_path=str(disk_path),
                tool_names=tool_names,
            )
            self._registry.register_synthesized(instance, record)
        except Exception as exc:
            logger.error("Hot-load failed", error=str(exc))
            await self._emit_blocked(workflow_id, service, f"Hot-load failed: {exc}", [])
            return None

        # ── Persist DB ──────────────────────────────────────────────────
        await self._persist_db(
            service, connector_class_name, str(disk_path),
            tools_meta, required_creds, prompt, raw_response,
            {"passed": True}, True, workflow_id,
            user_id=user_id,
        )

        # ── Emit tool_synthesized ───────────────────────────────────────
        await self._emit({
            "event_type": "tool_synthesized",
            "workflow_id": workflow_id,
            "service": service,
            "tools": tool_names,
            "file_path": str(disk_path),
            "guide_available": False,  # guide is generated separately
        })

        # ── Emit credential_required (pause DAG until user provides creds) ──
        if required_creds:
            cred_keys = [c["env_var"] for c in required_creds]
            await self._emit({
                "event_type": "credential_required",
                "workflow_id": workflow_id,
                "service": service,
                "credentials_needed": cred_keys,
                "required_credentials": required_creds,
                "guide_available": True,
            })

        logger.info("Tool synthesis complete", service=service)
        return service

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    async def _validate_syntax(
        self,
        code: str,
        gap: ToolGap,
        original_prompt: str,
    ) -> tuple[bool, str]:
        """Try to parse; on failure send back to Kimi for one correction."""
        try:
            ast.parse(code)
            return True, code
        except SyntaxError as exc:
            logger.warning("Syntax error in generated code — asking Kimi to fix", error=str(exc))

        # One correction attempt
        correction_prompt = (
            f"{original_prompt}\n\n"
            f"The previous Python code had this syntax error:\n{exc}\n\n"
            "Please return corrected valid JSON with fixed python_code."
        )
        try:
            response = await self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": "You are a code fixer. Output exact markdown format requested earlier."},
                    {"role": "user", "content": correction_prompt},
                ],
                temperature=0.1,
                max_tokens=4096,
            )
            raw2 = response.choices[0].message.content or ""
            data2 = self._parse_kimi_response(raw2)
            if data2:
                code2 = data2.get("python_code", "")
                ast.parse(code2)
                return True, code2
        except Exception as exc2:
            logger.error("Second attempt also failed", error=str(exc2))

        return False, code

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _parse_kimi_response(self, raw: str) -> dict | None:
        """Extracts python and JSON blocks from markdown explicitly to avoid JSON escape nightmares."""
        import copy
        
        # 1. Grab python code
        py_match = re.search(r"```python\s*(.*?)\s*```", raw, re.DOTALL)
        if not py_match:
            # Fallback if no block name
            py_match = re.search(r"```\s*(import.*?)\s*```", raw, re.DOTALL)
            
        python_code = py_match.group(1).strip() if py_match else ""
        
        # 2. Grab JSON code
        json_match = re.search(r"```json\s*(.*?)\s*```", raw, re.DOTALL)
        json_str = ""
        if json_match:
            json_str = json_match.group(1).strip()
        else:
            # Maybe it just output raw json?
            start = raw.find('{')
            end = raw.rfind('}')
            if start != -1 and end != -1 and end > start:
                json_str = raw[start:end+1]
                
        if not python_code or not json_str:
            return None

        import json
        try:
            data = json.loads(json_str)
            data["python_code"] = python_code
            return data
        except json.JSONDecodeError as exc:
            logger.error("JSON extraction succeeded but parsing failed", error=str(exc), json_snippet=json_str[:150])
            return None

    @staticmethod
    def _read_base_source() -> str:
        path = Path(__file__).parent.parent / "connectors" / "base.py"
        return path.read_text(encoding="utf-8")

    @staticmethod
    def _read_example_source() -> str:
        path = Path(__file__).parent.parent / "connectors" / "github.py"
        return path.read_text(encoding="utf-8")

    async def _hot_load_existing(self, service: str, path: Path) -> None:
        """Load a connector that already exists on disk but isn't in the registry."""
        source = path.read_text(encoding="utf-8")
        m = re.search(r"class\s+(\w+Connector)\s*\(", source)
        if not m:
            return
        class_name = m.group(1)
        try:
            instance = self._registry.hot_load(str(path), class_name)
            tools = await instance.list_tools()
            record = SynthesizedToolRecord(
                service_name=service,
                connector_class_name=class_name,
                file_path=str(path),
                tool_names=[t["name"] for t in tools],
            )
            self._registry.register_synthesized(instance, record)
        except Exception as exc:
            logger.error("Failed to hot-load existing connector", error=str(exc))

    async def _emit(self, data: dict) -> None:
        if self._broadcast:
            try:
                # Build a minimal event-compatible dict
                from models.events import WebSocketEvent
                # We use broadcast_event which accepts any BaseModel — send raw dict via custom path
                await self._broadcast_raw(data)
            except Exception as exc:
                logger.warning("Failed to emit synthesis event", error=str(exc))

    async def _broadcast_raw(self, data: dict) -> None:
        """Push raw dict through the WebSocket broadcast channel."""
        if not self._broadcast:
            return
        try:
            from api.websocket import broadcast_raw
            await broadcast_raw(data)
        except Exception:
            # Fallback: try direct broadcast
            try:
                await self._broadcast(data)  # type: ignore[arg-type]
            except Exception:
                pass

    async def _emit_blocked(
        self,
        workflow_id: str,
        service: str,
        reason: str,
        blocked_patterns: list[str],
    ) -> None:
        await self._emit({
            "event_type": "tool_synthesis_blocked",
            "workflow_id": workflow_id,
            "service": service,
            "reason": reason,
            "blocked_patterns": blocked_patterns,
        })

    async def _persist_db(
        self,
        service_name: str,
        class_name: str,
        file_path: str,
        tools: list[dict],
        credentials: list[dict],
        prompt: str,
        raw_response: str,
        safety_result: dict,
        validation_passed: bool,
        workflow_id: str,
        user_id: str | None = None,
    ) -> None:
        try:
            from db.connection import get_pool
            pool = await get_pool()
            if not pool:
                from db.redis_db import is_redis_available, redis_write_synthesized_tool
                if await is_redis_available():
                    await redis_write_synthesized_tool(
                        service_name=service_name,
                        connector_class_name=class_name,
                        file_path=file_path,
                        tools=tools,
                        required_credentials=credentials,
                        synthesis_prompt=prompt,
                        raw_kimi_response=raw_response,
                        safety_scan_result=safety_result,
                        validation_passed=validation_passed,
                        workflow_id=workflow_id,
                        user_id=user_id,
                    )
                    logger.info("Synthesized tool persisted to Redis", service=service_name)
                return
            async with pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO synthesized_tools (
                        service_name, connector_class_name, file_path,
                        tools, required_credentials,
                        synthesis_prompt, raw_kimi_response,
                        safety_scan_result, validation_passed,
                        created_by_workflow_id, user_id
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::uuid, $11)
                    ON CONFLICT (service_name) DO UPDATE SET
                        connector_class_name = EXCLUDED.connector_class_name,
                        file_path = EXCLUDED.file_path,
                        tools = EXCLUDED.tools,
                        required_credentials = EXCLUDED.required_credentials,
                        synthesis_prompt = EXCLUDED.synthesis_prompt,
                        raw_kimi_response = EXCLUDED.raw_kimi_response,
                        safety_scan_result = EXCLUDED.safety_scan_result,
                        validation_passed = EXCLUDED.validation_passed,
                        user_id = EXCLUDED.user_id
                    """,
                    service_name,
                    class_name,
                    file_path,
                    json.dumps(tools),
                    json.dumps(credentials),
                    prompt[:10000],
                    raw_response[:20000],
                    json.dumps(safety_result),
                    validation_passed,
                    workflow_id if workflow_id else None,
                    user_id,
                )
            logger.info("Synthesized tool persisted to DB", service=service_name)
        except Exception as exc:
            logger.error("DB persist failed (non-critical)", error=str(exc))
