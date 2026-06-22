"""Self-healing error recovery loop."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from core.circuit_breaker import CircuitBreaker
from core.dag_builder import DAGBuilder
from core.planner import KimiPlanner
from db.audit import write_recovery_entry
from models.dag import DAG, DAGStep
from models.events import (
    CircuitBreakerEvent,
    DAGPatchedEvent,
    DAGUpdatedEvent,
    EscalationRequiredEvent,
    RecoveryDecisionEvent,
    RecoveryStartedEvent,
    RecoveryStreamTokenEvent,
    WebSocketEvent,
)
from models.recovery import RecoveryAction, RecoveryDecision
from utils.logger import get_logger

logger = get_logger(__name__)


class RecoveryHandler:
    """Orchestrates Kimi-powered self-healing for failed DAG steps."""

    def __init__(
        self,
        planner: KimiPlanner,
        dag_builder: DAGBuilder,
    ) -> None:
        self._planner = planner
        self._dag_builder = dag_builder

    async def handle_failure(
        self,
        dag: DAG,
        failed_step: DAGStep,
        error: Exception,
        completed_results: dict[str, dict],
        available_tools: list[dict],
        circuit_breaker: CircuitBreaker,
        event_broadcaster: Callable[[WebSocketEvent], Awaitable[None]],
        stream_callback: Callable[[str], Awaitable[None]] | None = None,
    ) -> tuple[DAG, RecoveryAction]:
        """
        Attempt to recover from *error* on *failed_step*.

        Returns the (possibly modified) DAG and the :class:`RecoveryAction` taken.
        """
        step_id = failed_step.id
        error_message = str(error)

        # ── 1. Circuit breaker check ─────────────────────────────────────────
        if circuit_breaker.is_open(step_id):
            attempts = circuit_breaker.get_attempts(step_id)
            logger.warning(
                "Circuit breaker open — forcing escalation",
                step_id=step_id,
                attempts=attempts,
            )
            await event_broadcaster(
                CircuitBreakerEvent(
                    workflow_id=dag.workflow_id,
                    step_id=step_id,
                    recovery_attempts=attempts,
                    max_attempts=circuit_breaker._max_attempts,
                )
            )
            return dag, RecoveryAction.ESCALATE

        # ── 2. Record this attempt ───────────────────────────────────────────
        circuit_breaker.record_attempt(step_id)
        attempt_number = circuit_breaker.get_attempts(step_id)

        # ── 3. Broadcast recovery started ───────────────────────────────────
        error_context = (
            f"Step: {step_id} | Connector: {failed_step.connector} | "
            f"Tool: {failed_step.tool} | Error: {error_message}"
        )
        await event_broadcaster(
            RecoveryStartedEvent(
                workflow_id=dag.workflow_id,
                step_id=step_id,
                error_context=error_context,
            )
        )

        # ── 4. Build stream callback that also broadcasts tokens ─────────────
        async def _token_stream(token: str) -> None:
            await event_broadcaster(
                RecoveryStreamTokenEvent(workflow_id=dag.workflow_id, token=token)
            )
            if stream_callback:
                await stream_callback(token)

        # ── 5. Ask Kimi for a recovery decision ──────────────────────────────
        from models.dag import DAGStepStatus
        completed_steps = [
            sid for sid, step in dag.steps.items()
            if step.status == DAGStepStatus.SUCCESS
        ]
        decision: RecoveryDecision = await self._planner.plan_recovery(
            original_request=dag.original_user_request,
            original_dag=dag,
            failed_step=failed_step,
            error_message=error_message,
            completed_steps=completed_steps,
            available_tools=available_tools,
            stream_callback=_token_stream,
        )

        # ── 6. Broadcast decision ────────────────────────────────────────────
        await event_broadcaster(
            RecoveryDecisionEvent(
                workflow_id=dag.workflow_id,
                action=decision.action if isinstance(decision.action, str) else decision.action.value,
                reasoning=decision.reasoning,
            )
        )

        # Persist recovery log
        try:
            await write_recovery_entry(
                workflow_id=dag.workflow_id,
                step_id=step_id,
                attempt_number=attempt_number,
                error_message=error_message,
                kimi_reasoning=decision.reasoning,
                action_taken=decision.action if isinstance(decision.action, str) else decision.action.value,
            )
        except Exception as exc:
            logger.error("Recovery log write failed", error=str(exc))

        # ── 7. Apply decision ────────────────────────────────────────────────
        action_value = (
            decision.action if isinstance(decision.action, RecoveryAction)
            else RecoveryAction(decision.action)
        )

        if action_value == RecoveryAction.PATCH_DAG:
            return await self._apply_patch(dag, decision, event_broadcaster)

        if action_value == RecoveryAction.INSERT_STEPS:
            return await self._apply_insert(dag, decision, event_broadcaster)

        # ESCALATE
        await event_broadcaster(
            EscalationRequiredEvent(
                workflow_id=dag.workflow_id,
                step_id=step_id,
                user_message=decision.user_message or "Manual intervention required.",
            )
        )
        return dag, RecoveryAction.ESCALATE

    # ────────────────────────────────────────────────────────────────────────
    # Private helpers
    # ────────────────────────────────────────────────────────────────────────

    async def _apply_patch(
        self,
        dag: DAG,
        decision: RecoveryDecision,
        broadcaster: Callable[[WebSocketEvent], Awaitable[None]],
    ) -> tuple[DAG, RecoveryAction]:
        try:
            patch = decision.patch or {}
            step_id = patch.get("step_id", "")
            update_params = patch.get("update_params", {})
            dag = self._dag_builder.patch_step_params(dag, step_id, update_params)
            await broadcaster(
                DAGPatchedEvent(
                    workflow_id=dag.workflow_id,
                    step_id=step_id,
                    updated_params=update_params,
                )
            )
            logger.info("DAG patched", step_id=step_id)
            return dag, RecoveryAction.PATCH_DAG
        except Exception as exc:
            logger.error("Failed to apply DAG patch", error=str(exc))
            return dag, RecoveryAction.ESCALATE

    async def _apply_insert(
        self,
        dag: DAG,
        decision: RecoveryDecision,
        broadcaster: Callable[[WebSocketEvent], Awaitable[None]],
    ) -> tuple[DAG, RecoveryAction]:
        try:
            new_steps = decision.new_steps or []
            insert_before = decision.insert_before or ""
            dag = self._dag_builder.insert_steps_before(dag, new_steps, insert_before)
            await broadcaster(
                DAGUpdatedEvent(
                    workflow_id=dag.workflow_id,
                    new_steps=[s.model_dump() for s in new_steps],
                    insert_before=insert_before,
                )
            )
            logger.info("Steps inserted into DAG", count=len(new_steps))
            return dag, RecoveryAction.INSERT_STEPS
        except Exception as exc:
            logger.error("Failed to insert steps into DAG", error=str(exc))
            return dag, RecoveryAction.ESCALATE
