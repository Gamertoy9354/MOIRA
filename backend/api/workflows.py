"""REST API endpoints for workflow management."""

from __future__ import annotations

import asyncio
import uuid
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException

from api.websocket import broadcast_event, broadcast_raw
from connectors.github import GitHubConnector
from connectors.slack import SlackConnector
from connectors.sheets import GoogleSheetsConnector
from connectors.database import DatabaseConnector
from connectors.jira import JiraConnector
from core.circuit_breaker import CircuitBreaker
from core.connector_registry import get_registry
from core.context_resolver import ContextResolver
from core.dag_builder import DAGBuilder
from core.dag_executor import DAGExecutor
from core.planner import KimiPlanner
from core.recovery import RecoveryHandler
from core.safeguard import MCPSafeGuard
from core.tool_gap_detector import ToolGapDetector
from core.tool_synthesizer import ToolSynthesizer
from core.guide_generator import GuideGenerator
from db.audit import get_audit_log, get_workflow, write_workflow, update_workflow_status
from db.connection import get_pool
from models.dag import DAGStep
from models.events import HumanApprovalResponseEvent, WorkflowCompletedEvent
from models.workflow import ApprovalRequest, CreateWorkflowRequest
from utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/v1")

# ---------------------------------------------------------------------------
# In-memory state (per-process; use Redis for multi-instance production)
# ---------------------------------------------------------------------------
# Maps workflow_id → asyncio.Event signaling approval decision
_approval_events: dict[str, asyncio.Event] = {}
# Maps workflow_id → dict[step_id] → bool (approved?)
_approval_decisions: dict[str, dict[str, bool]] = {}
# Maps workflow_id → DAG (live execution state)
_active_dags: dict[str, Any] = {}
# Set of workflow IDs that have been killed by the user
_killed_workflows: set[str] = set()
# Set of workflow IDs that are currently paused
_paused_workflows: set[str] = set()


def is_workflow_killed(workflow_id: str) -> bool:
    """Return True if the user has requested this workflow be killed."""
    return workflow_id in _killed_workflows


def is_workflow_paused(workflow_id: str) -> bool:
    """Return True if the user has paused this workflow."""
    return workflow_id in _paused_workflows

# ---------------------------------------------------------------------------
# Connector registry — use the singleton from ConnectorRegistry
# Falls back to a plain dict if the bootstrap hasn't run yet (e.g. tests).
# ---------------------------------------------------------------------------

def _get_live_registry() -> dict:
    """Return the live ConnectorRegistry as a plain dict (backward-compat)."""
    try:
        return get_registry().as_dict()
    except Exception:
        return {
            "github": GitHubConnector(),
            "slack": SlackConnector(),
            "sheets": GoogleSheetsConnector(),
            "database": DatabaseConnector(),
            "jira": JiraConnector(),
        }


# For backward-compat: keep the module-level _registry pointing at the
# singleton dict so that Google Sheets helpers still work at import time.
class RegistryProxy(dict):
    """Dynamic dict proxy to the live ConnectorRegistry."""
    def get(self, key, default=None):
        return _get_live_registry().get(key, default)
    def __getitem__(self, key):
        return _get_live_registry()[key]
    def __contains__(self, key):
        return key in _get_live_registry()
    def __len__(self):
        return len(_get_live_registry())
    def __iter__(self):
        return iter(_get_live_registry())
    def keys(self):
        return _get_live_registry().keys()
    def values(self):
        return _get_live_registry().values()
    def items(self):
        return _get_live_registry().items()

_registry = RegistryProxy()

# Initialize Google Sheets audit tab on startup (best-effort)
async def _init_sheets_audit_tab() -> None:
    """Ensure the enterprise audit header exists in the first tab without clearing existing data."""
    try:
        from utils.config import get_settings as _gs
        sid = _gs().google_audit_spreadsheet_id
        if not sid:
            return
        sheets = _get_live_registry().get("sheets")
        if not sheets:
            return
        
        # Dynamically get the first tab's title
        try:
            sheet_name = await sheets.get_first_sheet_title(sid)
        except Exception as exc:
            logger.warning("Could not get first sheet title", error=str(exc))
            sheet_name = "Sheet1"
            
        sheet_id = await sheets.get_sheet_id(sid, sheet_name)
        
        # Check if the header already exists
        try:
            range_prefix = f"'{sheet_name}'" if " " in sheet_name else sheet_name
            result = await sheets.invoke("read_range", {
                "spreadsheet_id": sid,
                "range_notation": f"{range_prefix}!A2:B2"
            })
            if result.get("values") and len(result["values"]) > 0:
                logger.info("Audit sheet already initialized, preserving data", sheet_name=sheet_name)
                return  # already initialized, skip to preserve data
        except Exception:
            pass
            
        # Write and format headers
        await _ensure_audit_header(sheets, sid, sheet_name, sheet_id)
        logger.info("Audit Log sheet initialized with enterprise header", sheet_name=sheet_name)
    except Exception as exc:
        logger.warning("Could not init Audit Log sheet", error=str(exc))

# ---------------------------------------------------------------------------
# Approval gate — used by DAGExecutor
# ---------------------------------------------------------------------------

async def _approval_gate(workflow_id: str, step: DAGStep) -> bool:
    """Block until a human posts to the approve endpoint."""
    event_key = f"{workflow_id}:{step.id}"
    event = asyncio.Event()
    _approval_events[event_key] = event
    _approval_decisions.setdefault(workflow_id, {})[step.id] = False

    # Wait up to 10 minutes for a human decision
    try:
        await asyncio.wait_for(event.wait(), timeout=600)
    except asyncio.TimeoutError:
        logger.warning("Approval timed out", workflow_id=workflow_id, step_id=step.id)
        return False
    finally:
        _approval_events.pop(event_key, None)

    return _approval_decisions.get(workflow_id, {}).get(step.id, False)


async def _synthesis_approval_gate(workflow_id: str, service: str, reasoning: str, suggested_tools: list[str]) -> bool:
    """Block until the user approves or denies tool synthesis."""
    event_key = f"{workflow_id}:synthesis_{service}"
    event = asyncio.Event()
    _approval_events[event_key] = event
    _approval_decisions.setdefault(workflow_id, {})[f"synthesis_{service}"] = False

    # Broadcast a synthesis approval request event!
    await broadcast_raw({
        "event_type": "synthesis_approval_requested",
        "workflow_id": workflow_id,
        "service": service,
        "reason": reasoning,
        "suggested_tools": suggested_tools,
    })

    # Wait up to 10 minutes for a human decision
    try:
        await asyncio.wait_for(event.wait(), timeout=600)
    except asyncio.TimeoutError:
        logger.warning("Synthesis approval timed out", workflow_id=workflow_id, service=service)
        return False
    finally:
        _approval_events.pop(event_key, None)

    return _approval_decisions.get(workflow_id, {}).get(f"synthesis_{service}", False)


# ---------------------------------------------------------------------------
# Google Sheets audit writer — enterprise flat-table format
# ---------------------------------------------------------------------------

_AUDIT_COLS = [
    "Timestamp (UTC)", "Workflow ID", "Workflow Status", "User Request",
    "Step #", "Step ID", "Description", "Connector", "Tool",
    "Step Status", "Latency (ms)", "Started At", "Completed At", "Error",
]
_NUM_COLS = len(_AUDIT_COLS)  # 14
_COL_WIDTHS = [160, 240, 110, 280, 55, 120, 220, 100, 140, 100, 90, 160, 160, 300]


def _c(r: float, g: float, b: float) -> dict:
    return {"red": r, "green": g, "blue": b}


_STATUS_BG = {
    "success": _c(0.85, 0.97, 0.87), "failed": _c(0.99, 0.87, 0.87),
    "circuit_broken": _c(0.99, 0.87, 0.87), "recovering": _c(1.00, 0.95, 0.80),
    "running": _c(0.85, 0.92, 1.00), "pending": _c(0.95, 0.95, 0.95),
}
_STATUS_FG = {
    "success": _c(0.07, 0.53, 0.18), "failed": _c(0.72, 0.07, 0.07),
    "circuit_broken": _c(0.72, 0.07, 0.07), "recovering": _c(0.60, 0.35, 0.00),
    "running": _c(0.07, 0.30, 0.72), "pending": _c(0.40, 0.40, 0.40),
}
_WF_FG = {
    "completed": _c(0.07, 0.53, 0.18), "failed": _c(0.72, 0.07, 0.07),
    "running": _c(0.07, 0.30, 0.72),
}


async def _ensure_audit_header(sheets, sid: str, sheet_name: str, sheet_id: int) -> None:
    """Write and format the two frozen header rows."""
    # For sheet names with spaces, wrap in single quotes
    range_prefix = f"'{sheet_name}'" if " " in sheet_name else sheet_name
    await sheets.write_range(sid, f"{range_prefix}!A1:N1", [
        ["MCP GATEWAY — WORKFLOW AUDIT LOG  ·  All actions are immutably recorded"] + [""] * (_NUM_COLS - 1)
    ])
    await sheets.write_range(sid, f"{range_prefix}!A2:N2", [_AUDIT_COLS])
    await sheets.batch_format(sid, [
        # Title banner
        {"repeatCell": {
            "range": {"sheetId": sheet_id, "startRowIndex": 0, "endRowIndex": 1,
                      "startColumnIndex": 0, "endColumnIndex": _NUM_COLS},
            "cell": {"userEnteredFormat": {
                "backgroundColor": _c(0.07, 0.09, 0.20),
                "textFormat": {"foregroundColor": _c(1, 1, 1), "bold": True, "fontSize": 13, "fontFamily": "Arial"},
                "horizontalAlignment": "LEFT", "verticalAlignment": "MIDDLE",
            }},
            "fields": "userEnteredFormat",
        }},
        {"mergeCells": {
            "range": {"sheetId": sheet_id, "startRowIndex": 0, "endRowIndex": 1,
                      "startColumnIndex": 0, "endColumnIndex": _NUM_COLS},
            "mergeType": "MERGE_ALL",
        }},
        {"updateDimensionProperties": {
            "range": {"sheetId": sheet_id, "dimension": "ROWS", "startIndex": 0, "endIndex": 1},
            "properties": {"pixelSize": 44}, "fields": "pixelSize",
        }},
        # Column header row
        {"repeatCell": {
            "range": {"sheetId": sheet_id, "startRowIndex": 1, "endRowIndex": 2,
                      "startColumnIndex": 0, "endColumnIndex": _NUM_COLS},
            "cell": {"userEnteredFormat": {
                "backgroundColor": _c(0.18, 0.24, 0.42),
                "textFormat": {"foregroundColor": _c(1, 1, 1), "bold": True, "fontSize": 10, "fontFamily": "Arial"},
                "horizontalAlignment": "CENTER", "verticalAlignment": "MIDDLE",
            }},
            "fields": "userEnteredFormat",
        }},
        {"updateDimensionProperties": {
            "range": {"sheetId": sheet_id, "dimension": "ROWS", "startIndex": 1, "endIndex": 2},
            "properties": {"pixelSize": 32}, "fields": "pixelSize",
        }},
        # Freeze 2 rows
        {"updateSheetProperties": {
            "properties": {"sheetId": sheet_id, "gridProperties": {"frozenRowCount": 2}},
            "fields": "gridProperties.frozenRowCount",
        }},
        # Column widths
        *[{"updateDimensionProperties": {
            "range": {"sheetId": sheet_id, "dimension": "COLUMNS", "startIndex": i, "endIndex": i + 1},
            "properties": {"pixelSize": w}, "fields": "pixelSize",
        }} for i, w in enumerate(_COL_WIDTHS)],
    ])





async def _get_next_data_row(sheets, sid: str, sheet_name: str) -> int:
    """Return 0-based index of next empty row (data starts after 2 header rows)."""
    try:
        range_prefix = f"'{sheet_name}'" if " " in sheet_name else sheet_name
        result = await sheets.invoke("read_range", {"range_notation": f"{range_prefix}!A:A"})
        return max(len(result.get("values", [])), 2)
    except Exception:
        return 2


async def _write_workflow_to_sheets(workflow_id: str, user_request: str, dag: Any) -> None:
    """
    Write one flat row per step into the enterprise audit table.
    Columns A–N: Timestamp | Workflow ID | Workflow Status | User Request |
                 Step # | Step ID | Description | Connector | Tool |
                 Step Status | Latency (ms) | Started At | Completed At | Error
    """
    from datetime import datetime as dt
    from utils.config import get_settings as _gs

    sheets = _get_live_registry().get("sheets")
    if not sheets:
        return
    sid = _gs().google_audit_spreadsheet_id
    if not sid:
        return

    try:
        sheet_name = await sheets.get_first_sheet_title(sid)
    except Exception:
        sheet_name = "Sheet1"
    now_utc = dt.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    wf_status = dag.status if isinstance(dag.status, str) else dag.status.value
    steps = list(dag.steps.values())
    short_id = workflow_id[:8].upper()

    rows = []
    for i, s in enumerate(steps, start=1):
        step_status = s.status if isinstance(s.status, str) else s.status.value
        latency = str(int((s.completed_at - s.started_at).total_seconds() * 1000)) if s.started_at and s.completed_at else ""
        rows.append([
            f"'{now_utc}", short_id, wf_status.upper(), user_request[:120],
            i, s.id, (s.description or "")[:100],
            s.connector, s.tool, step_status.upper(),
            latency,
            f"'{s.started_at.strftime('%Y-%m-%d %H:%M:%S')}" if s.started_at else "",
            f"'{s.completed_at.strftime('%Y-%m-%d %H:%M:%S')}" if s.completed_at else "",
            (s.error or "")[:200],
        ])

    if not rows:
        return

    next_row = await _get_next_data_row(sheets, sid, sheet_name)
    start_1based = next_row + 1
    range_prefix = f"'{sheet_name}'" if " " in sheet_name else sheet_name
    await sheets.write_range(sid, f"{range_prefix}!A{start_1based}:N{start_1based + len(rows) - 1}", rows)

    try:
        sheet_id = await sheets.get_sheet_id(sid, sheet_name)
        fmt = []
        for i, (row_data, step) in enumerate(zip(rows, steps)):
            ri = next_row + i
            st = (step.status if isinstance(step.status, str) else step.status.value).lower()
            wf_st = wf_status.lower()
            row_bg = _c(1, 1, 1) if i % 2 == 0 else _c(0.97, 0.97, 0.99)
            # Base row
            fmt.append({"repeatCell": {
                "range": {"sheetId": sheet_id, "startRowIndex": ri, "endRowIndex": ri + 1,
                          "startColumnIndex": 0, "endColumnIndex": _NUM_COLS},
                "cell": {"userEnteredFormat": {
                    "backgroundColor": row_bg,
                    "textFormat": {"fontSize": 9, "fontFamily": "Arial", "foregroundColor": _c(0.15, 0.15, 0.15)},
                    "verticalAlignment": "MIDDLE",
                }},
                "fields": "userEnteredFormat",
            }})
            # Workflow Status col (C=2) coloured text
            fmt.append({"repeatCell": {
                "range": {"sheetId": sheet_id, "startRowIndex": ri, "endRowIndex": ri + 1,
                          "startColumnIndex": 2, "endColumnIndex": 3},
                "cell": {"userEnteredFormat": {
                    "textFormat": {"bold": True, "fontSize": 9,
                                   "foregroundColor": _WF_FG.get(wf_st, _c(0.2, 0.2, 0.2))},
                    "horizontalAlignment": "CENTER",
                }},
                "fields": "userEnteredFormat(textFormat,horizontalAlignment)",
            }})
            # Step Status col (J=9) coloured badge
            fmt.append({"repeatCell": {
                "range": {"sheetId": sheet_id, "startRowIndex": ri, "endRowIndex": ri + 1,
                          "startColumnIndex": 9, "endColumnIndex": 10},
                "cell": {"userEnteredFormat": {
                    "backgroundColor": _STATUS_BG.get(st, _c(0.95, 0.95, 0.95)),
                    "textFormat": {"bold": True, "fontSize": 9,
                                   "foregroundColor": _STATUS_FG.get(st, _c(0.2, 0.2, 0.2))},
                    "horizontalAlignment": "CENTER",
                }},
                "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
            }})
            # Step # col (E=4) centered bold
            fmt.append({"repeatCell": {
                "range": {"sheetId": sheet_id, "startRowIndex": ri, "endRowIndex": ri + 1,
                          "startColumnIndex": 4, "endColumnIndex": 5},
                "cell": {"userEnteredFormat": {
                    "horizontalAlignment": "CENTER",
                    "textFormat": {"bold": True, "fontSize": 9},
                }},
                "fields": "userEnteredFormat(horizontalAlignment,textFormat)",
            }})
            # Latency col (K=10) monospace right-aligned
            fmt.append({"repeatCell": {
                "range": {"sheetId": sheet_id, "startRowIndex": ri, "endRowIndex": ri + 1,
                          "startColumnIndex": 10, "endColumnIndex": 11},
                "cell": {"userEnteredFormat": {
                    "horizontalAlignment": "RIGHT",
                    "textFormat": {"fontFamily": "Courier New", "fontSize": 9},
                }},
                "fields": "userEnteredFormat(horizontalAlignment,textFormat)",
            }})
            fmt.append({"updateDimensionProperties": {
                "range": {"sheetId": sheet_id, "dimension": "ROWS",
                          "startIndex": ri, "endIndex": ri + 1},
                "properties": {"pixelSize": 26}, "fields": "pixelSize",
            }})

        # Bottom border under the whole block
        fmt.append({"updateBorders": {
            "range": {"sheetId": sheet_id, "startRowIndex": next_row,
                      "endRowIndex": next_row + len(rows),
                      "startColumnIndex": 0, "endColumnIndex": _NUM_COLS},
            "bottom": {"style": "SOLID_MEDIUM", "color": _c(0.18, 0.24, 0.42)},
            "innerHorizontal": {"style": "SOLID", "color": _c(0.88, 0.88, 0.92)},
            "innerVertical": {"style": "SOLID", "color": _c(0.88, 0.88, 0.92)},
            "left": {"style": "SOLID", "color": _c(0.88, 0.88, 0.92)},
            "right": {"style": "SOLID", "color": _c(0.88, 0.88, 0.92)},
        }})

        await sheets.batch_format(sid, fmt)
        logger.info("Audit rows written", workflow_id=workflow_id, rows=len(rows))
    except Exception as exc:
        logger.warning("Sheets formatting failed (data still written)", error=str(exc))


# ---------------------------------------------------------------------------
# Background execution task
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Credential-wait gate — blocks until the user submits creds via the UI
# ---------------------------------------------------------------------------

# Maps workflow_id -> asyncio.Event signaling that credentials have been saved
_credential_events: dict[str, asyncio.Event] = {}


def _get_or_create_credential_event(workflow_id: str) -> asyncio.Event:
    if workflow_id not in _credential_events:
        _credential_events[workflow_id] = asyncio.Event()
    return _credential_events[workflow_id]


async def _wait_for_credentials(workflow_id: str, timeout: float = 300.0) -> bool:
    """Block until credentials_saved is signalled for this workflow."""
    event = _get_or_create_credential_event(workflow_id)
    try:
        await asyncio.wait_for(event.wait(), timeout=timeout)
        return True
    except asyncio.TimeoutError:
        logger.warning("Credential wait timed out", workflow_id=workflow_id)
        return False
    finally:
        _credential_events.pop(workflow_id, None)


def signal_credentials_saved(workflow_id: str) -> None:
    """Called by the credentials endpoint to unblock the waiting workflow."""
    event = _get_or_create_credential_event(workflow_id)
    event.set()


# ---------------------------------------------------------------------------
# Background execution task
# ---------------------------------------------------------------------------

async def _run_workflow(workflow_id: str, user_request: str, model_id: str | None = None, disabled_tools: list[str] | None = None, provider: str | None = None) -> None:
    # Small delay to allow the frontend WebSocket to connect before we start
    # broadcasting events. Without this, workflow_started fires before the
    # client has subscribed and the DAG init is lost.
    await asyncio.sleep(0.5)
    try:
        # ── Use the live ConnectorRegistry (includes any synthesized connectors) ──
        live_reg_dict = _get_live_registry()
        reg_obj = get_registry()

        planner = KimiPlanner(model_id=model_id, provider=provider)
        dag_builder = DAGBuilder()
        circuit_breaker = CircuitBreaker()
        context_resolver = ContextResolver()

        # ── Step 1: Tool Gap Detection ──────────────────────────────────────
        detector = ToolGapDetector(registry=reg_obj, model_id=model_id, disabled_tools=disabled_tools, provider=provider)
        gap_report = await detector.analyze(user_request, workflow_id)

        # Emit tool_gap_detected event (always, so frontend knows coverage)
        await broadcast_raw({
            "event_type": "tool_gap_detected",
            "workflow_id": workflow_id,
            "gap_count": len(gap_report.gaps),
            "gaps": [g.to_dict() for g in gap_report.gaps],
            "covered_intents": gap_report.covered_intents,
            "synthesis_required": gap_report.synthesis_required,
            # Flatten first gap for the frontend panel
            "service": gap_report.gaps[0].suggested_service if gap_report.gaps else None,
            "reason": gap_report.gaps[0].reasoning if gap_report.gaps else None,
            "suggested_tools": [g.suggested_tool_name for g in gap_report.gaps],
        })

        # ── Step 2: Tool Synthesis (if gaps exist) ──────────────────────────
        if gap_report.synthesis_required:
            # Wait for user approval
            approved = await _synthesis_approval_gate(
                workflow_id,
                gap_report.gaps[0].suggested_service,
                gap_report.gaps[0].reasoning,
                [g.suggested_tool_name for g in gap_report.gaps]
            )
            if not approved:
                logger.info("Tool synthesis rejected by user", workflow_id=workflow_id)
                raise Exception("Workflow execution stopped: Tool synthesis rejected by user.")

            synthesizer = ToolSynthesizer(
                registry=reg_obj,
                broadcast=broadcast_event,
                model_id=model_id,
            )
            synthesized_services = await synthesizer.synthesize_all(
                gap_report.gaps, workflow_id
            )

            if synthesized_services:
                any_creds_needed = False
                # ── Step 2a: Generate developer guides ──────────────────────
                guide_gen = GuideGenerator(model_id=model_id)
                for svc in synthesized_services:
                    connector = reg_obj.get(svc)
                    creds = []
                    db_row = None
                    try:
                        from db.connection import get_pool as _gp
                        pool = await _gp()
                        if pool:
                            async with pool.acquire() as conn:
                                db_row = await conn.fetchrow(
                                    "SELECT required_credentials FROM synthesized_tools WHERE service_name = $1",
                                    svc,
                                )
                        if db_row:
                            import json as _json
                            creds = _json.loads(db_row["required_credentials"] or "[]")
                    except Exception:
                        pass
                        
                    if creds:
                        any_creds_needed = True
                        
                    tool_names = []
                    if connector:
                        try:
                            tool_names = [t["name"] for t in await connector.list_tools()]
                        except Exception:
                            pass
                    await guide_gen.generate(
                        service_name=svc,
                        tool_names=tool_names,
                        required_credentials=creds,
                        workflow_id=workflow_id,
                        broadcast=broadcast_event,
                    )

                # ── Step 2b: Wait for developer to enter credentials ─────────
                # The credential_required WS event already fired from synthesizer.
                # Block here until the /credentials endpoint signals us.
                if any_creds_needed:
                    logger.info(
                        "Waiting for developer credentials before DAG planning",
                        workflow_id=workflow_id,
                    )
                    cred_received = await _wait_for_credentials(workflow_id, timeout=600.0)
                    if not cred_received:
                        logger.warning(
                            "Credential timeout — proceeding with potentially missing creds",
                            workflow_id=workflow_id,
                        )

                # Refresh registry dict after creds are in
                live_reg_dict = _get_live_registry()

        # ── Step 3: Normal DAG Planning ─────────────────────────────────────
        available_tools = await KimiPlanner.collect_tools(live_reg_dict)
        if disabled_tools:
            available_tools = [t for t in available_tools if f"{t.get('connector')}.{t.get('name')}" not in disabled_tools]
        plan = await asyncio.wait_for(
            planner.plan_workflow(user_request, available_tools, workflow_id),
            timeout=180.0
        )

        dag = dag_builder.build(plan, workflow_id, user_request, live_reg_dict)
        _active_dags[workflow_id] = dag

        safeguard = MCPSafeGuard(live_reg_dict)
        recovery_handler = RecoveryHandler(planner, dag_builder)

        executor = DAGExecutor(
            connector_registry=live_reg_dict,
            safeguard=safeguard,
            recovery_handler=recovery_handler,
            circuit_breaker=circuit_breaker,
            context_resolver=context_resolver,
            event_broadcaster=broadcast_event,
            approval_gate=lambda wid, step: _approval_gate(workflow_id, step),
            available_tools=available_tools,
        )

        final_dag = await executor.execute(dag)
        _active_dags[workflow_id] = final_dag

        await update_workflow_status(
            workflow_id=workflow_id,
            status=final_dag.status if isinstance(final_dag.status, str) else final_dag.status.value,
            dag=final_dag.model_dump(),
        )

        # Auto-write audit to Google Sheets
        try:
            await _write_workflow_to_sheets(workflow_id, user_request, final_dag)
        except Exception as exc:
            logger.warning("Sheets audit write failed (non-critical)", error=str(exc))

    except Exception as exc:
        logger.error("Workflow execution failed", workflow_id=workflow_id, error=str(exc))
        await update_workflow_status(workflow_id=workflow_id, status="failed")
        # Broadcast a failure event so the frontend stops spinning
        try:
            from models.events import EscalationRequiredEvent
            await broadcast_event(
                EscalationRequiredEvent(
                    workflow_id=workflow_id,
                    step_id="planner",
                    user_message=f"Workflow failed: {str(exc) or 'LLM timed out. Please try again.'}",
                )
            )
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/workflows", status_code=202)
async def create_workflow(
    body: CreateWorkflowRequest,
    background_tasks: BackgroundTasks,
) -> dict:
    """Create and immediately start executing a workflow."""
    workflow_id = str(uuid.uuid4())
    await write_workflow(workflow_id, body.user_request, "pending")

    background_tasks.add_task(_run_workflow, workflow_id, body.user_request, body.model_id, body.disabled_tools, body.provider)

    logger.info("Workflow created", workflow_id=workflow_id)
    return {"workflow_id": workflow_id, "status": "pending", "message": "Workflow started"}


async def _run_workflow_retry(workflow_id: str) -> None:
    try:
        dag = _active_dags.get(workflow_id)
        if not dag:
            return

        # Restrict failed steps back to PENDING
        from models.dag import DAGStepStatus
        for step in dag.steps.values():
            if step.status in (DAGStepStatus.FAILED, DAGStepStatus.CIRCUIT_BROKEN, DAGStepStatus.BLOCKED):
                step.status = DAGStepStatus.PENDING
                step.error = None

        planner = KimiPlanner()
        dag_builder = DAGBuilder()
        circuit_breaker = CircuitBreaker()
        context_resolver = ContextResolver()

        available_tools = await KimiPlanner.collect_tools(_registry)
        safeguard = MCPSafeGuard(_registry)
        recovery_handler = RecoveryHandler(planner, dag_builder)

        executor = DAGExecutor(
            connector_registry=_registry,
            safeguard=safeguard,
            recovery_handler=recovery_handler,
            circuit_breaker=circuit_breaker,
            context_resolver=context_resolver,
            event_broadcaster=broadcast_event,
            approval_gate=lambda wid, step: _approval_gate(workflow_id, step),
            available_tools=available_tools,
        )

        for step in dag.steps.values():
            if step.status == DAGStepStatus.SUCCESS and step.output:
                executor._completed_results[step.id] = step.output

        final_dag = await executor.execute(dag)
        _active_dags[workflow_id] = final_dag

        await update_workflow_status(
            workflow_id=workflow_id,
            status=final_dag.status if isinstance(final_dag.status, str) else final_dag.status.value,
            dag=final_dag.model_dump(),
        )
    except Exception as exc:
        logger.error("Workflow retry failed", workflow_id=workflow_id, error=str(exc))
        await update_workflow_status(workflow_id=workflow_id, status="failed")


@router.post("/workflows/{workflow_id}/retry", status_code=202)
async def retry_workflow(
    workflow_id: str,
    background_tasks: BackgroundTasks,
) -> dict:
    """Retry a failed workflow directly from memory."""
    if workflow_id not in _active_dags:
        raise HTTPException(status_code=404, detail="Workflow not completely in-memory")
    
    background_tasks.add_task(_run_workflow_retry, workflow_id)
    return {"message": "Retrying workflow", "workflow_id": workflow_id}


@router.delete("/workflows/{workflow_id}", status_code=200)
async def kill_workflow(workflow_id: str) -> dict:
    """Immediately terminate a running workflow."""
    _killed_workflows.add(workflow_id)
    _paused_workflows.discard(workflow_id)  # un-pause if paused

    # Mark as failed in audit
    await update_workflow_status(workflow_id=workflow_id, status="failed")

    # Broadcast kill event
    await broadcast_raw({
        "event_type": "workflow_killed",
        "workflow_id": workflow_id,
        "message": "Workflow terminated by user.",
    })

    logger.info("Workflow killed by user", workflow_id=workflow_id)
    return {"workflow_id": workflow_id, "status": "killed"}


@router.post("/workflows/{workflow_id}/pause", status_code=200)
async def pause_workflow(workflow_id: str) -> dict:
    """Pause a running workflow — it will stop after the current step."""
    _paused_workflows.add(workflow_id)
    await broadcast_raw({
        "event_type": "workflow_paused",
        "workflow_id": workflow_id,
    })
    logger.info("Workflow paused by user", workflow_id=workflow_id)
    return {"workflow_id": workflow_id, "status": "paused"}


@router.post("/workflows/{workflow_id}/resume", status_code=200)
async def resume_workflow(workflow_id: str) -> dict:
    """Resume a paused workflow."""
    _paused_workflows.discard(workflow_id)
    await broadcast_raw({
        "event_type": "workflow_resumed",
        "workflow_id": workflow_id,
    })
    logger.info("Workflow resumed by user", workflow_id=workflow_id)
    return {"workflow_id": workflow_id, "status": "running"}


@router.get("/workflows/{workflow_id}")
async def get_workflow_state(workflow_id: str) -> dict:
    """Return current workflow state including live DAG."""
    # Check in-memory first (most up-to-date during execution)
    if workflow_id in _active_dags:
        dag = _active_dags[workflow_id]
        return {"workflow_id": workflow_id, "status": dag.status, "dag": dag.model_dump()}

    # Fall back to database
    row = await get_workflow(workflow_id)
    if not row:
        raise HTTPException(status_code=404, detail=f"Workflow {workflow_id} not found")
    return dict(row)


@router.post("/workflows/{workflow_id}/approve")
async def approve_step(workflow_id: str, body: ApprovalRequest) -> dict:
    """Resolve a pending human approval gate."""
    event_key = f"{workflow_id}:{body.step_id}"
    event = _approval_events.get(event_key)

    if not event:
        raise HTTPException(
            status_code=404,
            detail=f"No pending approval for step '{body.step_id}' in workflow '{workflow_id}'",
        )

    # Record decision and signal the waiting coroutine
    _approval_decisions.setdefault(workflow_id, {})[body.step_id] = body.approved
    event.set()

    await broadcast_event(
        HumanApprovalResponseEvent(
            workflow_id=workflow_id,
            step_id=body.step_id,
            approved=body.approved,
            approver=body.approver,
        )
    )

    return {
        "workflow_id": workflow_id,
        "step_id": body.step_id,
        "approved": body.approved,
        "approver": body.approver,
    }


@router.get("/workflows/{workflow_id}/audit")
async def get_workflow_audit(workflow_id: str) -> dict:
    """Return the full audit log for a workflow."""
    entries = await get_audit_log(workflow_id)
    # Serialize datetime values
    for e in entries:
        for k, v in e.items():
            if hasattr(v, "isoformat"):
                e[k] = v.isoformat()
    return {"workflow_id": workflow_id, "audit_log": entries, "total": len(entries)}


@router.get("/workflows")
async def list_all_workflows() -> dict:
    """Return all workflows (in-memory + DB)."""
    from db.audit import _memory_store
    workflows = []

    # In-memory (includes active and recently completed)
    for wf_id, wf in _memory_store["workflows"].items():
        dag = _active_dags.get(wf_id)
        created = wf.get("updated_at", "")
        entry = {
            "id": wf_id,
            "user_request": wf.get("user_request", ""),
            "status": wf.get("status", "unknown"),
            "created_at": created.isoformat() if hasattr(created, "isoformat") else str(created),
            "steps": [],
        }
        if dag:
            for s in dag.steps.values():
                latency = None
                if s.started_at and s.completed_at:
                    latency = int((s.completed_at - s.started_at).total_seconds() * 1000)
                entry["steps"].append({
                    "id": s.id,
                    "description": s.description,
                    "connector": s.connector,
                    "tool": s.tool,
                    "status": s.status,
                    "error": s.error,
                    "started_at": s.started_at.isoformat() if s.started_at else None,
                    "completed_at": s.completed_at.isoformat() if s.completed_at else None,
                    "latency_ms": latency,
                })
        workflows.append(entry)

    # Also check DB if available
    pool = await get_pool()
    if pool:
        try:
            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    "SELECT id, user_request, status, created_at FROM workflows ORDER BY created_at DESC LIMIT 100"
                )
                mem_ids = {w["id"] for w in workflows}
                for row in rows:
                    if str(row["id"]) not in mem_ids:
                        workflows.append({
                            "id": str(row["id"]),
                            "user_request": row["user_request"],
                            "status": row["status"],
                            "created_at": row["created_at"].isoformat() if row["created_at"] else "",
                            "steps": [],
                        })
        except Exception:
            pass
    else:
        try:
            from db.redis_db import is_redis_available, redis_list_workflows
            if await is_redis_available():
                redis_wfs = await redis_list_workflows()
                mem_ids = {w["id"] for w in workflows}
                for row in redis_wfs:
                    if str(row["id"]) not in mem_ids:
                        workflows.append({
                            "id": str(row["id"]),
                            "user_request": row["user_request"],
                            "status": row["status"],
                            "created_at": row["created_at"].isoformat() if hasattr(row["created_at"], "isoformat") else str(row["created_at"]),
                            "steps": [],
                        })
        except Exception:
            pass

    workflows.sort(key=lambda w: w.get("created_at", ""), reverse=True)
    return {"workflows": workflows, "total": len(workflows)}


@router.get("/tools")
async def list_tools() -> dict:
    """Return all available MCP tools across all connectors."""
    all_tools = await KimiPlanner.collect_tools(_registry)
    return {"tools": all_tools, "total": len(all_tools)}


@router.post("/admin/reset-audit-sheet")
async def reset_audit_sheet() -> dict:
    """Force-clear the Audit Log sheet and reinitialize with the correct header."""
    try:
        from utils.config import get_settings as _gs
        sid = _gs().google_audit_spreadsheet_id
        if not sid:
            return {"error": "No spreadsheet ID configured"}
        sheets = _get_live_registry().get("sheets")
        if not sheets:
            return {"error": "Sheets connector not available"}
        try:
            sheet_name = await sheets.get_first_sheet_title(sid)
        except Exception:
            sheet_name = "Sheet1"
        sheet_id = await sheets.get_sheet_id(sid, sheet_name)
        # Clear using batchUpdate
        await sheets.batch_format(sid, [{
            "updateCells": {
                "range": {
                    "sheetId": sheet_id,
                    "startRowIndex": 0,
                    "endRowIndex": 1000,
                    "startColumnIndex": 0,
                    "endColumnIndex": 26,
                },
                "fields": "userEnteredValue",
            }
        }])
        await _ensure_audit_header(sheets, sid, sheet_name, sheet_id)
        logger.info("Audit Log sheet manually reset")
        return {"message": "Audit Log sheet cleared and reinitialized", "spreadsheet_id": sid}
    except Exception as exc:
        logger.error("Failed to reset audit sheet", error=str(exc))
        return {"error": str(exc)}
