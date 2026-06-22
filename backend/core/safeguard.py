"""MCP SafeGuard — three-layer firewall for every tool call."""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime
from typing import TYPE_CHECKING, Any, Literal

from pydantic import BaseModel

from db.audit import write_audit_entry
from utils.logger import get_logger

if TYPE_CHECKING:
    from connectors.base import MCPConnector

logger = get_logger(__name__)

# -----------------------------------------------------------------------
# Result & audit models
# -----------------------------------------------------------------------

class AuditEntry(BaseModel):
    timestamp: datetime
    workflow_id: str
    step_id: str
    connector: str
    tool: str
    params_hash: str
    result: str
    layer: int | None
    reason: str


class SafeGuardResult(BaseModel):
    allowed: bool
    action: Literal["allow", "block", "require_approval", "route_to_recovery"]
    reason: str
    layer: int | None = None
    audit_entry: AuditEntry


# -----------------------------------------------------------------------
# SafeGuard
# -----------------------------------------------------------------------

class MCPSafeGuard:
    """Three-layer firewall that inspects every MCP tool call."""

    # Layer 2 default policy rules — evaluated in order; first match wins
    _DEFAULT_POLICIES: list[dict[str, Any]] = [
        {
            "connector": "github",
            "tool": "push_file",
            "condition": lambda p: p.get("branch") in ("main", "master"),
            "action": "require_approval",
            "reason": "Pushing directly to protected branch requires human approval",
        },
        {
            "connector": "slack",
            "tool": "send_message",
            "condition": lambda p: str(p.get("channel", "")).startswith("ext-"),
            "action": "require_approval",
            "reason": "Sending to external Slack channels requires human approval",
        },
        {
            "connector": "*",
            "tool": "*delete*",
            "condition": lambda _: True,
            "action": "require_approval",
            "reason": "Delete operations require human approval",
        },
        {
            "connector": "*",
            "tool": "*destroy*",
            "condition": lambda _: True,
            "action": "block",
            "reason": "Destroy operations are unconditionally blocked",
        },
    ]

    # SQL injection pattern (basic heuristic)
    _SQL_INJECTION_RE = re.compile(
        r"(union\s+select|drop\s+table|insert\s+into|delete\s+from"
        r"|exec\s*\(|xp_cmdshell|; ?--)",
        re.IGNORECASE,
    )

    # Shell injection pattern
    _SHELL_INJECTION_RE = re.compile(
        r"(\$\(|`[^`]+`|&&|\|\||;[\s]*(?:rm|wget|curl|bash|sh|python))",
        re.IGNORECASE,
    )

    def __init__(self, connector_registry: dict[str, "MCPConnector"]) -> None:
        self._registry = connector_registry
        self._recent_calls: list[AuditEntry] = []  # in-memory ring buffer

    # -----------------------------------------------------------------------
    # Public API
    # -----------------------------------------------------------------------

    async def check(
        self,
        connector: str,
        tool: str,
        params: dict,
        step_id: str,
        workflow_id: str,
        connector_instance: "MCPConnector",
    ) -> SafeGuardResult:
        """Run all three layers; write audit entry; return result."""

        params_hash = self._hash_params(params)

        # Layer 1 — perimeter
        result = self._check_perimeter(connector, tool, connector_instance)
        layer = 1 if result else None

        # Layer 2 — policies
        if result is None:
            result = self._check_policies(connector, tool, params, workflow_id)
            layer = 2 if result else None

        # Layer 3 — anomaly detection
        if result is None:
            result = self._check_anomalies(connector, tool, params, self._recent_calls)
            layer = 3 if result else None

        # All layers passed → allow
        if result is None:
            result_str = "allowed"
            reason = "All SafeGuard layers passed"
            action: Literal["allow", "block", "require_approval", "route_to_recovery"] = "allow"
            allowed = True
        else:
            result_str = result["action"]
            reason = result["reason"]
            action = result["action"]  # type: ignore
            allowed = action == "allow"

        audit_entry = AuditEntry(
            timestamp=datetime.utcnow(),
            workflow_id=workflow_id,
            step_id=step_id,
            connector=connector,
            tool=tool,
            params_hash=params_hash,
            result=result_str,
            layer=layer,
            reason=reason,
        )

        # Persist audit record
        try:
            await write_audit_entry(
                workflow_id=workflow_id,
                step_id=step_id,
                connector=connector,
                tool=tool,
                params=params,
                safeguard_result=result_str,
                safeguard_layer=layer,
                safeguard_reason=reason,
                executed=(action == "allow"),
            )
        except Exception as exc:
            logger.error("Audit write failed", error=str(exc))

        # Append to in-memory recent-calls ring buffer (keep last 1000)
        self._recent_calls.append(audit_entry)
        if len(self._recent_calls) > 1000:
            self._recent_calls = self._recent_calls[-1000:]

        sg_result = SafeGuardResult(
            allowed=allowed,
            action=action,
            reason=reason,
            layer=layer,
            audit_entry=audit_entry,
        )
        logger.info(
            "SafeGuard decision",
            connector=connector,
            tool=tool,
            action=action,
            layer=layer,
        )
        return sg_result

    # -----------------------------------------------------------------------
    # Layer 1 — Perimeter check
    # -----------------------------------------------------------------------

    def _check_perimeter(
        self,
        connector: str,
        tool: str,
        connector_instance: "MCPConnector",
    ) -> dict | None:
        if connector not in self._registry:
            return {"action": "block", "reason": f"Connector '{connector}' is not registered"}

        # Check that connector instance matches registry
        registered = self._registry[connector]
        if registered.get_connector_name() != connector:
            return {"action": "block", "reason": "Connector name mismatch in registry"}

        return None  # pass

    # -----------------------------------------------------------------------
    # Layer 2 — Policy rules
    # -----------------------------------------------------------------------

    def _check_policies(
        self,
        connector: str,
        tool: str,
        params: dict,
        workflow_id: str,
    ) -> dict | None:
        for rule in self._DEFAULT_POLICIES:
            # Connector match
            rc = rule["connector"]
            if rc != "*" and rc != connector:
                continue
            # Tool match (supports glob * prefix/suffix)
            rt: str = rule["tool"]
            if rt != "*":
                if rt.startswith("*") and rt.endswith("*"):
                    if rt[1:-1] not in tool:
                        continue
                elif rt.startswith("*"):
                    if not tool.endswith(rt[1:]):
                        continue
                elif rt.endswith("*"):
                    if not tool.startswith(rt[:-1]):
                        continue
                elif rt != tool:
                    continue
            # Condition evaluation
            try:
                if rule["condition"](params):
                    return {"action": rule["action"], "reason": rule["reason"]}
            except Exception as exc:
                logger.warning("Policy condition evaluation error", error=str(exc))
        return None

    # -----------------------------------------------------------------------
    # Layer 3 — Anomaly detection
    # -----------------------------------------------------------------------

    def _check_anomalies(
        self,
        connector: str,
        tool: str,
        params: dict,
        recent_calls: list[AuditEntry],
    ) -> dict | None:
        from datetime import timedelta

        now = datetime.utcnow()
        window = now - timedelta(seconds=60)

        # Rule A: same tool called > 10 times in last 60s
        recent_tool_calls = [
            e for e in recent_calls
            if e.connector == connector
            and e.tool == tool
            and e.timestamp >= window
        ]
        if len(recent_tool_calls) >= 10:
            return {
                "action": "require_approval",
                "reason": f"Anomaly: '{connector}.{tool}' called {len(recent_tool_calls)} times in 60s",
            }

        # Rule B: payload too large (> 50 KB)
        payload_size = len(json.dumps(params, default=str).encode())
        if payload_size > 50_000:
            return {
                "action": "require_approval",
                "reason": f"Anomaly: params payload is {payload_size} bytes (> 50 KB)",
            }

        # Rule C: SQL injection
        flat_str = json.dumps(params, default=str)
        if self._SQL_INJECTION_RE.search(flat_str):
            return {
                "action": "block",
                "reason": "Anomaly: params contain SQL injection pattern",
            }

        # Rule D: shell injection
        if self._SHELL_INJECTION_RE.search(flat_str):
            return {
                "action": "block",
                "reason": "Anomaly: params contain shell injection pattern",
            }

        return None

    # -----------------------------------------------------------------------
    # Helpers
    # -----------------------------------------------------------------------

    @staticmethod
    def _hash_params(params: dict) -> str:
        raw = json.dumps(params, sort_keys=True, default=str)
        return hashlib.sha256(raw.encode()).hexdigest()
