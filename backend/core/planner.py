"""Kimi K2.5 planning brain via NVIDIA NIM API."""

from __future__ import annotations

import json
import re
from collections.abc import Awaitable, Callable
from typing import Any

from openai import AsyncOpenAI

from models.dag import DAG, DAGStep
from models.recovery import RecoveryAction, RecoveryDecision
from utils.config import get_settings
from utils.logger import get_logger

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# System prompts
# ---------------------------------------------------------------------------

_PLANNING_SYSTEM = """You are a workflow decomposition engine for an Agentic MCP Gateway system.
Your job is to analyze a natural language workflow description and decompose
it into a precise execution plan as a directed acyclic graph (DAG).

You will be given:
1. A natural language workflow description from a developer
2. A complete list of available MCP tools across all connected services

IMPORTANT context about already built-in/pre-made services:
The system already has complete built-in connectors for the following services. NEVER invent custom connectors or tools if these cover the requirement:
- github: Covers all GitHub operations (e.g. creating issues, pull requests, list repos, committing code).
- sheets: Covers all Google Sheets read, write, append, and formatting operations.
- jira: Covers all Jira ticket operations (e.g. creating/updating issues, transitions).
- slack: Covers all Slack messaging, alerts, and posting operations.
- database: Covers all internal incident tracking database operations.

Do not plan steps using custom services if these standard services are available. Always map tasks to the existing tools provided in the available tools list.

Your task is to produce a valid JSON execution plan. Follow these rules exactly:

RULE 1: Every step must use exactly one tool from the available tools list.
Do not invent tools. Only use tools that exist in the provided list.

RULE 2: The depends_on field must list step IDs that must complete BEFORE
this step can run. Steps with empty depends_on arrays run first.
If two steps have no dependency between them, leave depends_on empty on both
so they run in parallel.

RULE 3: Use the template syntax {{step_N.output.field_name}} to reference
output from a previous step in the params of a later step. For example,
if step_0 creates a branch and returns {branch_name: "hotfix/bug-123"},
then step_1 can use {{step_0.output.branch_name}} in its params.

RULE 4: Mark sensitive: true for any step that modifies production systems,
sends external communications, deletes data, or pushes code.

RULE 5: Set on_failure to "retry" for transient operations, "skip" for
optional steps, and "abort" for critical steps where failure means the
entire workflow cannot continue.

RULE 6: Return ONLY valid JSON. No explanation, no markdown, no backticks.
The JSON must be parseable by Python's json.loads() directly.

OUTPUT FORMAT:
{
  "name": "short_snake_case_workflow_name",
  "steps": [
    {
      "id": "step_0",
      "description": "one sentence description of what this step does",
      "connector": "connector_name",
      "tool": "tool_name",
      "params": {
        "param_name": "param_value_or_template"
      },
      "depends_on": [],
      "sensitive": false,
      "on_failure": "retry"
    }
  ]
}"""

_RECOVERY_SYSTEM = """You are the error recovery brain for an Agentic MCP Gateway.
A workflow step has failed. Your job is to diagnose the failure and decide
the best recovery action.

You will be given:
1. The original user workflow request
2. The full execution plan (DAG) that was being executed
3. Which steps completed successfully before the failure
4. The exact step that failed with its parameters and error message
5. All available MCP tools

You must choose exactly one recovery action:

ACTION: patch_dag
Use this when the step failed due to wrong parameters that you can fix.
Examples: wrong branch name, wrong sheet ID, typo in a parameter.
You must provide the corrected parameters.

ACTION: insert_steps
Use this when the step failed because a prerequisite action was not done.
Examples: trying to push to a repo that doesn't exist yet, writing to a
sheet that hasn't been created, referencing a resource that needs to be
created first.
You must provide the new steps to insert before the failing step.

ACTION: escalate
Use this when the failure requires human intervention or special permissions
that the system cannot resolve automatically.
Examples: private repository with no credentials, protected branch requiring
admin override, API quota exceeded requiring billing action.
You must provide a clear human-readable explanation.

Return ONLY valid JSON. No markdown. No explanation outside the JSON.

OUTPUT FORMAT for patch_dag:
{
  "action": "patch_dag",
  "reasoning": "explanation of why the step failed and what you changed",
  "patch": {
    "step_id": "step_N",
    "update_params": {
      "param_to_fix": "corrected_value"
    }
  }
}

OUTPUT FORMAT for insert_steps:
{
  "action": "insert_steps",
  "reasoning": "explanation of what prerequisite was missing",
  "new_steps": [
    {
      "id": "step_Na",
      "description": "description",
      "connector": "connector_name",
      "tool": "tool_name",
      "params": {},
      "depends_on": [],
      "sensitive": false,
      "on_failure": "retry"
    }
  ],
  "insert_before": "step_N"
}

OUTPUT FORMAT for escalate:
{
  "action": "escalate",
  "reasoning": "technical explanation of why this cannot be auto-resolved",
  "user_message": "plain English message for the developer explaining what access or action is needed to continue",
  "can_skip": false
}"""


def _extract_json(text: str) -> str:
    """Strip markdown fences and extract raw JSON from model output."""
    # Remove ```json ... ``` or ``` ... ```
    text = re.sub(r"```(?:json)?\s*", "", text)
    text = re.sub(r"```", "", text)
    return text.strip()


class KimiPlanner:
    """LLM planning brain — routes to the configured AI provider via llm_router."""

    def __init__(self, model_id: str | None = None, provider: str | None = None) -> None:
        from core.llm_router import get_llm_client
        self._client, self._model = get_llm_client(provider=provider, model_id=model_id)

    # -----------------------------------------------------------------------
    # Workflow Planning
    # -----------------------------------------------------------------------

    async def plan_workflow(
        self,
        user_request: str,
        available_tools: list[dict],
        workflow_id: str,
    ) -> dict:
        """Decompose *user_request* into a DAG dict using the configured model."""
        # Compact tool list — only name, connector, description, required params
        # Cuts prompt from ~2200 tokens down to ~400 tokens
        compact = [
            {
                "connector": t.get("connector"),
                "tool": t.get("name"),
                "description": t.get("description"),
                "required_params": t.get("parameters", {}).get("required", []),
                "all_params": list(t.get("parameters", {}).get("properties", {}).keys()),
            }
            for t in available_tools
        ]
        tools_json = json.dumps(compact, separators=(',', ':'))

        # Inject known defaults so the LLM never hallucinates repo/channel names
        settings = get_settings()
        context_hints = []
        if settings.github_default_repo_owner:
            context_hints.append(f"- Default GitHub repo owner: {settings.github_default_repo_owner}")
            context_hints.append(f"- Default GitHub repo: {settings.github_default_repo_owner}/mcp-gateway")
        if settings.slack_default_channel:
            context_hints.append(f"- Default Slack channel ID to use: {settings.slack_default_channel} (ALWAYS use this exact ID, never invent channel IDs)")
        if settings.jira_default_project:
            context_hints.append(f"- Default Jira project key: {settings.jira_default_project} (use this when user doesn't specify a project)")
        if settings.jira_base_url:
            context_hints.append(f"- Jira site: {settings.jira_base_url}")
        if settings.google_audit_spreadsheet_id:
            context_hints.append(f"- Google Sheets audit spreadsheet ID: {settings.google_audit_spreadsheet_id} (use this as spreadsheet_id for all sheets operations)")
        hints_block = ("\n\nContext defaults (use these when the user doesn't specify):\n" + "\n".join(context_hints)) if context_hints else ""

        user_message = (
            f"Workflow request:\n{user_request}{hints_block}\n\n"
            f"Available tools:\n{tools_json}"
        )

        logger.info("Planning workflow with Kimi", workflow_id=workflow_id)
        response = await self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": _PLANNING_SYSTEM},
                {"role": "user", "content": user_message},
            ],
            temperature=0.1,
            top_p=0.8,
            max_tokens=1024,
        )

        raw = response.choices[0].message.content or ""
        logger.debug("Kimi raw planning response", raw=raw[:500])

        try:
            plan = json.loads(_extract_json(raw))
        except json.JSONDecodeError as exc:
            raise ValueError(f"Kimi returned invalid JSON: {exc}\nRaw: {raw[:300]}") from exc

        self._validate_plan(plan, available_tools)
        return plan

    # -----------------------------------------------------------------------
    # Error Recovery Planning
    # -----------------------------------------------------------------------

    async def plan_recovery(
        self,
        original_request: str,
        original_dag: DAG,
        failed_step: DAGStep,
        error_message: str,
        completed_steps: list[str],
        available_tools: list[dict],
        stream_callback: Callable[[str], Awaitable[None]] | None = None,
    ) -> RecoveryDecision:
        """Ask Kimi to diagnose a failure and return a :class:`RecoveryDecision`."""
        dag_summary = {
            sid: {
                "description": s.description,
                "connector": s.connector,
                "tool": s.tool,
                "params": s.params,
                "status": s.status if isinstance(s.status, str) else s.status.value,
                "depends_on": s.depends_on,
            }
            for sid, s in original_dag.steps.items()
        }

        user_message = (
            f"Original user request:\n{original_request}\n\n"
            f"DAG:\n{json.dumps(dag_summary, indent=2)}\n\n"
            f"Completed steps: {completed_steps}\n\n"
            f"Failed step ID: {failed_step.id}\n"
            f"Failed step connector: {failed_step.connector}\n"
            f"Failed step tool: {failed_step.tool}\n"
            f"Failed step params: {json.dumps(failed_step.params, indent=2)}\n"
            f"Error: {error_message}\n\n"
            f"Available tools:\n{json.dumps(available_tools, indent=2)}"
        )

        logger.info(
            "Recovery planning with Kimi",
            step_id=failed_step.id,
            error=error_message[:120],
        )

        full_text = ""

        if stream_callback:
            # Streaming mode
            stream = await self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": _RECOVERY_SYSTEM},
                    {"role": "user", "content": user_message},
                ],
                temperature=0.1,
                top_p=0.8,
                max_tokens=2048,
                stream=True,
            )
            async for chunk in stream:
                token = chunk.choices[0].delta.content or ""
                if token:
                    full_text += token
                    await stream_callback(token)
        else:
            response = await self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": _RECOVERY_SYSTEM},
                    {"role": "user", "content": user_message},
                ],
                temperature=0.1,
                top_p=0.8,
                max_tokens=2048,
            )
            full_text = response.choices[0].message.content or ""

        logger.debug("Kimi recovery raw response", raw=full_text[:500])

        try:
            data = json.loads(_extract_json(full_text))
        except json.JSONDecodeError as exc:
            logger.error("Kimi recovery JSON parse error", error=str(exc), raw=full_text[:300])
            # Fallback: escalate
            return RecoveryDecision(
                action=RecoveryAction.ESCALATE,
                reasoning=f"Kimi response was not valid JSON: {exc}",
                user_message="Recovery LLM returned an unparseable response. Manual intervention required.",
                can_skip=False,
            )

        return self._parse_recovery_decision(data, available_tools)

    # -----------------------------------------------------------------------
    # Internal validators
    # -----------------------------------------------------------------------

    def _validate_plan(self, plan: dict, available_tools: list[dict]) -> None:
        """Check tool names and depends_on references."""
        tool_map: dict[str, set[str]] = {}
        for t in available_tools:
            connector = t.get("connector", "")
            name = t.get("name", "")
            tool_map.setdefault(connector, set()).add(name)

        step_ids = {s["id"] for s in plan.get("steps", [])}

        for step in plan.get("steps", []):
            connector = step.get("connector", "")
            tool = step.get("tool", "")
            # Soft validation — warn only (planner may be creative with naming)
            if connector in tool_map and tool not in tool_map[connector]:
                logger.warning(
                    "Planned step uses unknown tool",
                    connector=connector,
                    tool=tool,
                    step_id=step.get("id"),
                )
            for dep in step.get("depends_on", []):
                if dep not in step_ids:
                    raise ValueError(
                        f"Step '{step['id']}' depends_on '{dep}' which doesn't exist"
                    )

    def _parse_recovery_decision(
        self, data: dict, available_tools: list[dict]
    ) -> RecoveryDecision:
        action_str = data.get("action", "escalate")
        try:
            action = RecoveryAction(action_str)
        except ValueError:
            action = RecoveryAction.ESCALATE

        new_steps: list[DAGStep] | None = None
        if action == RecoveryAction.INSERT_STEPS and data.get("new_steps"):
            from models.dag import DAGStepStatus
            new_steps = [
                DAGStep(
                    id=s["id"],
                    description=s.get("description", ""),
                    connector=s["connector"],
                    tool=s["tool"],
                    params=s.get("params", {}),
                    depends_on=s.get("depends_on", []),
                    sensitive=s.get("sensitive", False),
                    on_failure=s.get("on_failure", "retry"),
                    status=DAGStepStatus.PENDING,
                )
                for s in data["new_steps"]
            ]

        return RecoveryDecision(
            action=action,
            reasoning=data.get("reasoning", ""),
            patch=data.get("patch"),
            new_steps=new_steps,
            insert_before=data.get("insert_before"),
            user_message=data.get("user_message"),
            can_skip=data.get("can_skip", False),
        )

    # -----------------------------------------------------------------------
    # Utility — collect all tools across connectors
    # -----------------------------------------------------------------------

    @staticmethod
    async def collect_tools(
        connector_registry: dict[str, Any],
    ) -> list[dict]:
        """Return flat list of tool dicts, each annotated with connector name."""
        all_tools: list[dict] = []
        for connector_name, connector in connector_registry.items():
            try:
                tools = await connector.list_tools()
                for t in tools:
                    all_tools.append({**t, "connector": connector_name})
            except Exception as exc:
                logger.error(
                    "Failed to list tools from connector",
                    connector=connector_name,
                    error=str(exc),
                )
        return all_tools
