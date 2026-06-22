"""Workflow models for top-level workflow management."""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class WorkflowStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    RECOVERING = "recovering"
    AWAITING_APPROVAL = "awaiting_approval"


class Workflow(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_request: str
    status: WorkflowStatus = WorkflowStatus.PENDING
    dag: dict[str, Any] | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: datetime | None = None

    model_config = {"use_enum_values": True}


class CreateWorkflowRequest(BaseModel):
    user_request: str
    model_id: str | None = None
    provider: str | None = None   # Override active AI provider for this workflow
    disabled_tools: list[str] = Field(default_factory=list)

    model_config = {"protected_namespaces": ()}


class ApprovalRequest(BaseModel):
    step_id: str
    approved: bool
    approver: str = "human"
