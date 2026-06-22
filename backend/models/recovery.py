"""Recovery decision models for self-healing error recovery."""

from __future__ import annotations

from enum import Enum
from typing import TYPE_CHECKING, Any

from pydantic import BaseModel

if TYPE_CHECKING:
    from .dag import DAGStep


class RecoveryAction(str, Enum):
    PATCH_DAG = "patch_dag"
    INSERT_STEPS = "insert_steps"
    ESCALATE = "escalate"


class RecoveryDecision(BaseModel):
    action: RecoveryAction
    reasoning: str
    patch: dict[str, Any] | None = None           # {step_id, update_params}
    new_steps: list[Any] | None = None            # list[DAGStep]
    insert_before: str | None = None
    user_message: str | None = None
    can_skip: bool = False

    class Config:
        use_enum_values = True
