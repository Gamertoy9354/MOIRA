"""Async DAG executor — heart of the MCP Gateway."""

from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable
from datetime import datetime

from connectors.base import (
    MCPConnector,
    MCPNotFoundError,
    MCPPermissionError,
    MCPRateLimitError,
    MCPToolError,
    MCPTransientError,
)
from core.circuit_breaker import CircuitBreaker
from core.context_resolver import ContextResolver
from core.recovery import RecoveryHandler
from core.safeguard import MCPSafeGuard
from models.dag import DAG, DAGStatus, DAGStep, DAGStepStatus
from models.events import (
    HumanApprovalRequestedEvent,
    StepCompletedEvent,
    StepFailedEvent,
    StepRetryingEvent,
    StepStartedEvent,
    StepsParallelEvent,
    WebSocketEvent,
    WorkflowCompletedEvent,
    WorkflowStartedEvent,
)
from models.recovery import RecoveryAction
from utils.config import get_settings
from utils.logger import get_logger

logger = get_logger(__name__)

# Imported lazily to avoid circular imports
def _is_killed(wf_id: str) -> bool:
    try:
        from api.workflows import is_workflow_killed
        return is_workflow_killed(wf_id)
    except Exception:
        return False


def _is_paused(wf_id: str) -> bool:
    try:
        from api.workflows import is_workflow_paused
        return is_workflow_paused(wf_id)
    except Exception:
        return False


class DAGExecutor:
    """Executes a DAG asynchronously with parallel step scheduling."""

    def __init__(
        self,
        connector_registry: dict[str, MCPConnector],
        safeguard: MCPSafeGuard,
        recovery_handler: RecoveryHandler,
        circuit_breaker: CircuitBreaker,
        context_resolver: ContextResolver,
        event_broadcaster: Callable[[WebSocketEvent], Awaitable[None]],
        approval_gate: Callable[[str, DAGStep], Awaitable[bool]],
        available_tools: list[dict] | None = None,
    ) -> None:
        self._registry = connector_registry
        self._safeguard = safeguard
        self._recovery = recovery_handler
        self._cb = circuit_breaker
        self._resolver = context_resolver
        self._broadcast = event_broadcaster
        self._approval_gate = approval_gate
        self._available_tools: list[dict] = available_tools or []

        cfg = get_settings()
        self._max_retries = cfg.max_retry_attempts
        self._backoff_base = cfg.retry_backoff_base

        # Shared mutable state (all accesses inside asyncio event loop)
        self._completed_results: dict[str, dict] = {}

    # -----------------------------------------------------------------------
    # Public entry point
    # -----------------------------------------------------------------------

    async def execute(self, dag: DAG) -> DAG:
        """Execute the full DAG and return it with final step statuses."""
        dag.status = DAGStatus.RUNNING
        workflow_start = time.monotonic()

        await self._broadcast(
            WorkflowStartedEvent(
                workflow_id=dag.workflow_id,
                dag=dag.model_dump(),
            )
        )

        logger.info("DAG execution started", workflow_id=dag.workflow_id, steps=len(dag.steps))

        while True:
            ready = self._get_ready_steps(dag)

            if not ready:
                # Detect deadlock or completion
                running = [s for s in dag.steps.values() if s.status == DAGStepStatus.RUNNING]
                if not running:
                    break  # Nothing running and nothing ready → done

                # Steps still running — wait a moment
                await asyncio.sleep(0.05)
                continue

            # ── Kill check — abort if user requested termination ────────
            if _is_killed(dag.workflow_id):
                logger.info("Workflow killed by user — aborting DAG", workflow_id=dag.workflow_id)
                for step in dag.steps.values():
                    if step.status in (DAGStepStatus.PENDING, DAGStepStatus.RUNNING):
                        step.status = DAGStepStatus.BLOCKED
                        step.error = "Workflow was terminated by user"
                dag.status = DAGStatus.FAILED
                break

            # ── Pause check — wait until unpaused or killed ─────────────
            while _is_paused(dag.workflow_id):
                if _is_killed(dag.workflow_id):
                    break
                await asyncio.sleep(1.0)

            # Broadcast parallel batch if > 1
            if len(ready) > 1:
                await self._broadcast(
                    StepsParallelEvent(
                        workflow_id=dag.workflow_id,
                        step_ids=[s.id for s in ready],
                    )
                )

            # Mark all ready steps as RUNNING before launching
            for step in ready:
                step.status = DAGStepStatus.RUNNING
                step.started_at = datetime.utcnow()

            # Launch all ready steps concurrently
            tasks = [
                asyncio.create_task(self._run_step(step, dag))
                for step in ready
            ]
            await asyncio.gather(*tasks, return_exceptions=True)

        # Determine final DAG status
        statuses = {s.status for s in dag.steps.values()}
        if any(s == DAGStepStatus.FAILED for s in statuses):
            dag.status = DAGStatus.FAILED
        else:
            dag.status = DAGStatus.COMPLETED

        elapsed_ms = (time.monotonic() - workflow_start) * 1000
        success_count = sum(1 for s in dag.steps.values() if s.status == DAGStepStatus.SUCCESS)

        await self._broadcast(
            WorkflowCompletedEvent(
                workflow_id=dag.workflow_id,
                total_duration_ms=elapsed_ms,
                step_count=len(dag.steps),
                summary=(
                    f"Workflow {dag.status}: {success_count}/{len(dag.steps)} steps succeeded "
                    f"in {elapsed_ms:.0f}ms"
                ),
            )
        )
        logger.info(
            "DAG execution finished",
            workflow_id=dag.workflow_id,
            status=dag.status,
            elapsed_ms=elapsed_ms,
        )
        return dag

    # -----------------------------------------------------------------------
    # Scheduling helpers
    # -----------------------------------------------------------------------

    def _get_ready_steps(self, dag: DAG) -> list[DAGStep]:
        """Return steps whose all dependencies are SUCCESS and are still PENDING."""
        terminal = {
            DAGStepStatus.SUCCESS,
            DAGStepStatus.FAILED,
            DAGStepStatus.SKIPPED,
            DAGStepStatus.BLOCKED,
            DAGStepStatus.CIRCUIT_BROKEN,
        }

        ready: list[DAGStep] = []
        for step in dag.steps.values():
            if step.status != DAGStepStatus.PENDING:
                continue
            deps_done = all(
                dag.steps[dep].status in terminal
                for dep in step.depends_on
                if dep in dag.steps
            )
            deps_success = all(
                dag.steps[dep].status == DAGStepStatus.SUCCESS
                for dep in step.depends_on
                if dep in dag.steps
            )
            if deps_done and deps_success:
                ready.append(step)
            elif deps_done and not deps_success:
                # A dependency failed/blocked → propagate
                step.status = DAGStepStatus.BLOCKED
                step.error = "Blocked because a dependency did not succeed"

        return ready

    # -----------------------------------------------------------------------
    # Step execution pipeline
    # -----------------------------------------------------------------------

    async def _run_step(self, step: DAGStep, dag: DAG) -> None:
        """Full pipeline for a single step."""
        step_start = time.monotonic()

        try:
            # 1. Resolve template params
            resolved_params = self._resolver.resolve(step.params, self._completed_results)
        except Exception as exc:
            step.status = DAGStepStatus.FAILED
            step.error = f"Context resolution failed: {exc}"
            step.completed_at = datetime.utcnow()
            await self._broadcast(
                StepFailedEvent(
                    workflow_id=dag.workflow_id,
                    step_id=step.id,
                    error=step.error,
                    attempt_number=1,
                )
            )
            return

        await self._broadcast(
            StepStartedEvent(
                workflow_id=dag.workflow_id,
                step_id=step.id,
                connector=step.connector,
                tool=step.tool,
                resolved_params=resolved_params,
            )
        )

        # 2. Get connector
        connector = self._registry.get(step.connector)
        if connector is None:
            step.status = DAGStepStatus.FAILED
            step.error = f"Connector '{step.connector}' not found in registry"
            step.completed_at = datetime.utcnow()
            await self._broadcast(
                StepFailedEvent(
                    workflow_id=dag.workflow_id,
                    step_id=step.id,
                    error=step.error,
                    attempt_number=1,
                )
            )
            return

        # 2.5 Ensure the tool is actually allowed (not disabled)
        if self._available_tools:
            tool_allowed = False
            for t in self._available_tools:
                if t.get("connector") == step.connector and t.get("name") == step.tool:
                    tool_allowed = True
                    break
            
            if not tool_allowed:
                step.status = DAGStepStatus.FAILED
                step.error = f"Tool '{step.connector}.{step.tool}' is disabled by user settings or hallucinated."
                step.completed_at = datetime.utcnow()
                await self._broadcast(
                    StepFailedEvent(
                        workflow_id=dag.workflow_id,
                        step_id=step.id,
                        error=step.error,
                        attempt_number=1,
                    )
                )
                return

        # 3. SafeGuard check
        sg_result = await self._safeguard.check(
            connector=step.connector,
            tool=step.tool,
            params=resolved_params,
            step_id=step.id,
            workflow_id=dag.workflow_id,
            connector_instance=connector,
        )

        if sg_result.action == "block":
            step.status = DAGStepStatus.BLOCKED
            step.error = f"SafeGuard blocked: {sg_result.reason}"
            step.completed_at = datetime.utcnow()
            await self._broadcast(
                StepFailedEvent(
                    workflow_id=dag.workflow_id,
                    step_id=step.id,
                    error=step.error,
                    attempt_number=1,
                )
            )
            return

        if sg_result.action == "require_approval":
            step.status = DAGStepStatus.AWAITING_APPROVAL
            await self._broadcast(
                HumanApprovalRequestedEvent(
                    workflow_id=dag.workflow_id,
                    step_id=step.id,
                    connector=step.connector,
                    tool=step.tool,
                    params=resolved_params,
                    reason=sg_result.reason,
                )
            )
            approved = await self._approval_gate(dag.workflow_id, step)
            if not approved:
                step.status = DAGStepStatus.BLOCKED
                step.error = "Human rejected this step"
                step.completed_at = datetime.utcnow()
                await self._broadcast(
                    StepFailedEvent(
                        workflow_id=dag.workflow_id,
                        step_id=step.id,
                        error=step.error,
                        attempt_number=1,
                    )
                )
                return
            step.status = DAGStepStatus.RUNNING

        # 4. Execute with retry
        try:
            output = await self._execute_with_retry(connector, step.tool, resolved_params, step, dag)
            step.status = DAGStepStatus.SUCCESS
            step.output = output
            step.completed_at = datetime.utcnow()
            self._completed_results[step.id] = output
            self._cb.reset(step.id)

            latency_ms = (time.monotonic() - step_start) * 1000
            await self._broadcast(
                StepCompletedEvent(
                    workflow_id=dag.workflow_id,
                    step_id=step.id,
                    output=output,
                    latency_ms=latency_ms,
                )
            )

        except Exception as error:
            step.status = DAGStepStatus.RECOVERING
            step.error = str(error)

            await self._broadcast(
                StepFailedEvent(
                    workflow_id=dag.workflow_id,
                    step_id=step.id,
                    error=str(error),
                    attempt_number=1,
                )
            )

            # 5. Recovery loop
            updated_dag, recovery_action = await self._recovery.handle_failure(
                dag=dag,
                failed_step=step,
                error=error,
                completed_results=self._completed_results,
                available_tools=self._available_tools,
                circuit_breaker=self._cb,
                event_broadcaster=self._broadcast,
            )
            # Merge updated steps back
            dag.steps.update(updated_dag.steps)

            if recovery_action in (RecoveryAction.PATCH_DAG, RecoveryAction.INSERT_STEPS):
                # Reset so the executor loop picks it up again
                step.status = DAGStepStatus.PENDING
                step.error = None
            else:
                # ESCALATE
                if step.on_failure == "skip":
                    step.status = DAGStepStatus.SKIPPED
                elif step.on_failure == "abort":
                    dag.status = DAGStatus.FAILED
                    step.status = DAGStepStatus.CIRCUIT_BROKEN
                else:
                    step.status = DAGStepStatus.CIRCUIT_BROKEN

            step.completed_at = datetime.utcnow()

    # -----------------------------------------------------------------------
    # Retry with exponential back-off
    # -----------------------------------------------------------------------

    async def _execute_with_retry(
        self,
        connector: MCPConnector,
        tool: str,
        params: dict,
        step: DAGStep,
        dag: DAG,
    ) -> dict:
        """Invoke *tool* with *params*, retrying transient errors up to max."""
        transient_types = (MCPTransientError, MCPRateLimitError)
        fatal_types = (MCPPermissionError, MCPNotFoundError)

        last_exc: Exception = RuntimeError("No attempts made")

        for attempt in range(1, self._max_retries + 1):
            try:
                return await connector.invoke(tool, params)
            except fatal_types as exc:
                raise  # Do not retry auth/not-found errors
            except transient_types as exc:
                last_exc = exc
                if attempt < self._max_retries:
                    backoff = self._backoff_base ** attempt
                    logger.warning(
                        "Transient error — will retry",
                        step_id=step.id,
                        attempt=attempt,
                        backoff_s=backoff,
                        error=str(exc),
                    )
                    await self._broadcast(
                        StepRetryingEvent(
                            workflow_id=dag.workflow_id,
                            step_id=step.id,
                            attempt_number=attempt,
                        )
                    )
                    await asyncio.sleep(backoff)
            except MCPToolError as exc:
                raise  # Non-transient MCP error — no retry

        raise last_exc
