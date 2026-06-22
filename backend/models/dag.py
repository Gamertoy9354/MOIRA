"""DAG models for workflow execution planning."""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field


class DAGStepStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    BLOCKED = "blocked"
    AWAITING_APPROVAL = "awaiting_approval"
    RECOVERING = "recovering"
    SKIPPED = "skipped"
    CIRCUIT_BROKEN = "circuit_broken"


class DAGStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    RECOVERING = "recovering"
    AWAITING_APPROVAL = "awaiting_approval"


class DAGStep(BaseModel):
    id: str
    description: str
    connector: str
    tool: str
    params: dict[str, Any] = Field(default_factory=dict)
    depends_on: list[str] = Field(default_factory=list)
    sensitive: bool = False
    on_failure: Literal["retry", "skip", "abort"] = "retry"
    status: DAGStepStatus = DAGStepStatus.PENDING
    output: dict[str, Any] | None = None
    error: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    recovery_attempts: int = 0

    model_config = {"use_enum_values": True, "validate_assignment": True}


class DAG(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workflow_id: str
    name: str
    steps: dict[str, DAGStep] = Field(default_factory=dict)
    original_user_request: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    status: DAGStatus = DAGStatus.PENDING

    model_config = {"use_enum_values": True, "validate_assignment": True}
