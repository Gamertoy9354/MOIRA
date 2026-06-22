"""Tool Gap Detector — identifies workflow intents that have no matching connector.

Before planning begins, this module asks Kimi K2.5 to extract all service
intents from the natural language request, then compares them against every
tool in the ConnectorRegistry.  Gaps trigger the Tool Synthesis Engine.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field

from openai import AsyncOpenAI

from core.connector_registry import ConnectorRegistry, ToolDefinition
from utils.config import get_settings
from utils.logger import get_logger

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

@dataclass
class ToolGap:
    intent: str               # e.g. "send email via SendGrid"
    suggested_service: str    # e.g. "sendgrid"
    suggested_tool_name: str  # e.g. "send_email"
    confidence: float         # 0.0 – 1.0
    reasoning: str

    def to_dict(self) -> dict:
        return {
            "intent": self.intent,
            "suggested_service": self.suggested_service,
            "suggested_tool_name": self.suggested_tool_name,
            "confidence": self.confidence,
            "reasoning": self.reasoning,
        }


@dataclass
class ToolGapReport:
    gaps: list[ToolGap]
    covered_intents: list[str]
    synthesis_required: bool

    def to_dict(self) -> dict:
        return {
            "gaps": [g.to_dict() for g in self.gaps],
            "covered_intents": self.covered_intents,
            "synthesis_required": self.synthesis_required,
        }


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

_GAP_SYSTEM = """You are a tool-gap analysis engine for an Agentic MCP Gateway.

Given a natural language workflow description and a list of currently available
connector tools, your job is to:
1. Extract all distinct SERVICE INTENTS from the workflow (e.g. "send an email",
   "post to Slack", "create a GitHub issue").
2. Map each intent to an available tool if one exists.
3. For any intent that has no matching tool, produce a gap entry.

IMPORTANT context about already built-in/pre-made services:
The system already has complete built-in connectors for the following services. NEVER suggest gaps for them:
- github: Covers all GitHub operations (e.g. creating issues, pull requests, list repos, committing code).
- sheets: Covers all Google Sheets read, write, append, and formatting operations.
- jira: Covers all Jira ticket operations (e.g. creating/updating issues, transitions).
- slack: Covers all Slack messaging, alerts, and posting operations.
- database: Covers all internal incident tracking database operations.

Do not suggest new synthesized connectors for any of these standard services. Always map them to the existing tools provided in the available tools list.

Return ONLY valid JSON — no markdown, no explanation outside the JSON.

OUTPUT FORMAT:
{
  "covered_intents": ["list of intents covered by existing tools"],
  "gaps": [
    {
      "intent": "send transactional email via SendGrid",
      "suggested_service": "sendgrid",
      "suggested_tool_name": "send_email",
      "confidence": 0.95,
      "reasoning": "User needs email sending; SendGrid is the mentioned service; no email connector exists"
    }
  ]
}

Rules:
- suggested_service must be a single lowercase snake_case identifier (e.g. sendgrid, twilio, stripe)
- suggested_tool_name must be a single lowercase snake_case function name
- confidence is a float 0.0-1.0 reflecting how certain you are a new tool is needed
- Only mark a gap if confidence >= 0.6
- If all intents are covered, return an empty gaps array
"""


def _extract_json(text: str) -> str:
    text = re.sub(r"```(?:json)?\s*", "", text)
    text = re.sub(r"```", "", text)
    return text.strip()


# ---------------------------------------------------------------------------
# Detector
# ---------------------------------------------------------------------------

class ToolGapDetector:
    """Analyses workflow descriptions for missing tools."""

    def __init__(self, registry: ConnectorRegistry, model_id: str | None = None, disabled_tools: list[str] | None = None, provider: str | None = None) -> None:
        from core.llm_router import get_llm_client
        self._registry = registry
        self.disabled_tools = disabled_tools or []
        self._client, self._model = get_llm_client(provider=provider, model_id=model_id)

    async def analyze(
        self,
        workflow_description: str,
        workflow_id: str,
    ) -> ToolGapReport:
        """Return a :class:`ToolGapReport` for the given workflow description."""
        all_tools: list[ToolDefinition] = await self._registry.list_all_tools()
        available_tools = [t for t in all_tools if f"{t.connector}.{t.name}" not in self.disabled_tools]

        compact = [
            {
                "connector": t.connector,
                "tool": t.name,
                "description": t.description,
            }
            for t in available_tools
        ]

        user_msg = (
            f"Workflow description:\n{workflow_description}\n\n"
            f"Available tools:\n{json.dumps(compact, separators=(',', ':'))}"
        )

        logger.info(
            "Running tool gap analysis",
            workflow_id=workflow_id,
            available_tool_count=len(available_tools),
        )

        try:
            response = await self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": _GAP_SYSTEM},
                    {"role": "user", "content": user_msg},
                ],
                temperature=0.1,
                top_p=0.8,
                max_tokens=1024,
            )
            raw = response.choices[0].message.content or "{}"
            data = json.loads(_extract_json(raw))
        except json.JSONDecodeError as exc:
            logger.warning("Tool gap JSON parse failed — proceeding without gap check", error=str(exc))
            # Safe fallback: assume no gaps if LLM produced bad format
            covered = [t.name for t in available_tools[:5]]
            return ToolGapReport(gaps=[], covered_intents=covered, synthesis_required=False)

        gaps: list[ToolGap] = []
        for g in data.get("gaps", []):
            raw_svc = g.get("suggested_service")
            if not raw_svc or str(raw_svc).strip().lower() in ("null", "none", "unknown"):
                logger.warning("Skipping gap with invalid service identifier", raw_svc=raw_svc)
                continue
            
            svc = str(raw_svc).lower().replace("-", "_").replace(" ", "_")
            # Skip if the service is already registered AND has at least one active tool
            if self._registry.is_registered(svc):
                has_active_tools = any(t.connector == svc for t in available_tools)
                if has_active_tools:
                    logger.info("Service already registered and active — skipping gap", service=svc)
                    continue
                else:
                    logger.info("Service is registered but all its tools are disabled — treating as gap to force re-synthesis", service=svc)
            gaps.append(ToolGap(
                intent=g.get("intent", ""),
                suggested_service=svc,
                suggested_tool_name=g.get("suggested_tool_name", "tool"),
                confidence=float(g.get("confidence", 0.7)),
                reasoning=g.get("reasoning", ""),
            ))

        report = ToolGapReport(
            gaps=gaps,
            covered_intents=data.get("covered_intents", []),
            synthesis_required=len(gaps) > 0,
        )

        logger.info(
            "Tool gap analysis complete",
            gap_count=len(gaps),
            synthesis_required=report.synthesis_required,
        )
        return report
