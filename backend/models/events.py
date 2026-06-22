"""WebSocket event models for real-time streaming."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class WebSocketEvent(BaseModel):
    event_type: str
    workflow_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    model_config = {"use_enum_values": True}


class WorkflowStartedEvent(WebSocketEvent):
    event_type: str = "workflow_started"
    dag: dict[str, Any]  # Serialized full DAG


class StepStartedEvent(WebSocketEvent):
    event_type: str = "step_started"
    step_id: str
    connector: str
    tool: str
    resolved_params: dict[str, Any]


class StepCompletedEvent(WebSocketEvent):
    event_type: str = "step_completed"
    step_id: str
    output: dict[str, Any]
    latency_ms: float


class StepFailedEvent(WebSocketEvent):
    event_type: str = "step_failed"
    step_id: str
    error: str
    attempt_number: int


class StepsParallelEvent(WebSocketEvent):
    event_type: str = "steps_parallel"
    step_ids: list[str]


class RecoveryStartedEvent(WebSocketEvent):
    event_type: str = "recovery_started"
    step_id: str
    error_context: str


class RecoveryStreamTokenEvent(WebSocketEvent):
    event_type: str = "recovery_stream_token"
    token: str


class RecoveryDecisionEvent(WebSocketEvent):
    event_type: str = "recovery_decision"
    action: str
    reasoning: str


class DAGPatchedEvent(WebSocketEvent):
    event_type: str = "dag_patched"
    step_id: str
    updated_params: dict[str, Any]


class DAGUpdatedEvent(WebSocketEvent):
    event_type: str = "dag_updated"
    new_steps: list[dict[str, Any]]
    insert_before: str


class StepRetryingEvent(WebSocketEvent):
    event_type: str = "step_retrying"
    step_id: str
    attempt_number: int


class EscalationRequiredEvent(WebSocketEvent):
    event_type: str = "escalation_required"
    step_id: str
    user_message: str


class CircuitBreakerEvent(WebSocketEvent):
    event_type: str = "circuit_breaker"
    step_id: str
    recovery_attempts: int
    max_attempts: int


class HumanApprovalRequestedEvent(WebSocketEvent):
    event_type: str = "human_approval_requested"
    step_id: str
    connector: str
    tool: str
    params: dict[str, Any]
    reason: str


class HumanApprovalResponseEvent(WebSocketEvent):
    event_type: str = "human_approval_response"
    step_id: str
    approved: bool
    approver: str


class WorkflowCompletedEvent(WebSocketEvent):
    event_type: str = "workflow_completed"
    total_duration_ms: float
    step_count: int
    summary: str


class AuditLogEvent(WebSocketEvent):
    event_type: str = "audit_log"
    connector: str
    tool: str
    params_hash: str
    safeguard_result: str
    user_id: str | None = None
