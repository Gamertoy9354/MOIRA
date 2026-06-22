"""DAG builder — validates and constructs a DAG from planner output."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from models.dag import DAG, DAGStep, DAGStatus, DAGStepStatus
from utils.logger import get_logger

if TYPE_CHECKING:
    from connectors.base import MCPConnector

logger = get_logger(__name__)


class DAGValidationError(Exception):
    """Raised when the planner output fails structural validation."""


class DAGCycleError(DAGValidationError):
    """Raised when a cycle is detected in the dependency graph."""


class DAGBuilder:
    """Validates and constructs a :class:`DAG` from raw planner output."""

    def build(
        self,
        planner_output: dict,
        workflow_id: str,
        original_request: str,
        connector_registry: dict[str, "MCPConnector"],
    ) -> DAG:
        """Build and fully validate a ``DAG`` from ``planner_output``."""
        raw_steps: list[dict] = planner_output.get("steps", [])
        name: str = planner_output.get("name", "unnamed_workflow")

        if not raw_steps:
            raise DAGValidationError("Planner returned zero steps")

        # Collect all step IDs for reference validation
        step_ids = {s["id"] for s in raw_steps}

        # 1 — Check for duplicate IDs
        if len(step_ids) != len(raw_steps):
            raise DAGValidationError("Planner output contains duplicate step IDs")

        # 2 — Validate depends_on references
        for s in raw_steps:
            for dep in s.get("depends_on", []):
                if dep not in step_ids:
                    raise DAGValidationError(
                        f"Step '{s['id']}' depends_on '{dep}' which does not exist"
                    )

        # 3 — Build step objects
        steps: dict[str, DAGStep] = {}
        for s in raw_steps:
            steps[s["id"]] = DAGStep(
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

        # 4 — Cycle detection
        self._assert_no_cycles(steps)

        # 5 — Connector/tool validation (warn only if registry has limited info)
        for step in steps.values():
            if step.connector not in connector_registry:
                logger.warning(
                    "Connector not registered; step will likely fail at runtime",
                    connector=step.connector,
                    step_id=step.id,
                )

        dag = DAG(
            id=str(uuid.uuid4()),
            workflow_id=workflow_id,
            name=name,
            steps=steps,
            original_user_request=original_request,
            created_at=datetime.utcnow(),
            status=DAGStatus.PENDING,
        )
        logger.info("DAG built", workflow_id=workflow_id, step_count=len(steps))
        return dag

    # ------------------------------------------------------------------
    # Mutation helpers (used by recovery)
    # ------------------------------------------------------------------

    def insert_steps_before(
        self,
        dag: DAG,
        new_steps: list[DAGStep],
        insert_before_id: str,
    ) -> DAG:
        """Insert *new_steps* before *insert_before_id* in the DAG."""
        if insert_before_id not in dag.steps:
            raise DAGValidationError(
                f"insert_before target '{insert_before_id}' not found in DAG"
            )

        # Add new steps
        for step in new_steps:
            dag.steps[step.id] = step

        # Update the target step to depend on the last new step
        last_new_id = new_steps[-1].id
        target = dag.steps[insert_before_id]
        if last_new_id not in target.depends_on:
            target.depends_on.append(last_new_id)

        # Re-validate
        self._assert_no_cycles(dag.steps)
        logger.info(
            "Steps inserted into DAG",
            count=len(new_steps),
            insert_before=insert_before_id,
        )
        return dag

    def patch_step_params(
        self,
        dag: DAG,
        step_id: str,
        updated_params: dict,
    ) -> DAG:
        """Update params of *step_id* and reset it to PENDING for retry."""
        if step_id not in dag.steps:
            raise DAGValidationError(f"Step '{step_id}' not found in DAG")

        step = dag.steps[step_id]
        step.params.update(updated_params)
        step.status = DAGStepStatus.PENDING
        step.error = None
        step.output = None
        step.started_at = None
        step.completed_at = None

        logger.info("Step params patched", step_id=step_id, updated_params=updated_params)
        return dag

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _assert_no_cycles(self, steps: dict[str, DAGStep]) -> None:
        """DFS-based cycle detection; raises ``DAGCycleError`` if cycle found."""
        WHITE, GRAY, BLACK = 0, 1, 2
        color: dict[str, int] = {sid: WHITE for sid in steps}

        def dfs(node_id: str) -> None:
            color[node_id] = GRAY
            for dep in steps[node_id].depends_on:
                if dep not in color:
                    continue  # already warned about missing deps
                if color[dep] == GRAY:
                    raise DAGCycleError(
                        f"Cycle detected: step '{node_id}' depends on '{dep}' "
                        f"which is already in the current DFS path"
                    )
                if color[dep] == WHITE:
                    dfs(dep)
            color[node_id] = BLACK

        for sid in list(steps.keys()):
            if color[sid] == WHITE:
                dfs(sid)
