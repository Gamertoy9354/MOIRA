"""Context resolver — replaces {{step_N.output.field}} templates in params."""

from __future__ import annotations

import re
from typing import Any


_TEMPLATE_RE = re.compile(r"\{\{(step_\w+)\.output\.([\w.]+)\}\}")


class ContextResolutionError(Exception):
    """Raised when a template reference cannot be resolved."""


class ContextResolver:
    """Resolves ``{{step_N.output.field}}`` template strings in step params."""

    def resolve(
        self,
        params: dict[str, Any],
        completed_results: dict[str, dict],
    ) -> dict[str, Any]:
        """
        Return a new params dict with all template strings replaced by their
        actual values from *completed_results*.

        Parameters
        ----------
        params:
            The raw params dict (possibly containing template strings).
        completed_results:
            Map of step_id → output dict for every successfully completed step.
        """
        return self._resolve_value(params, completed_results)  # type: ignore

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _resolve_value(self, value: Any, completed_results: dict[str, dict]) -> Any:
        """Recursively resolve templates in any JSON-compatible value."""
        if isinstance(value, str):
            return self._resolve_string(value, completed_results)
        if isinstance(value, dict):
            return {k: self._resolve_value(v, completed_results) for k, v in value.items()}
        if isinstance(value, list):
            return [self._resolve_value(item, completed_results) for item in value]
        return value

    def _resolve_string(self, text: str, completed_results: dict[str, dict]) -> Any:
        """Replace all template occurrences in a string.

        If the *entire* string is a single template (e.g. ``"{{step_0.output.id}}"``),
        return the resolved value directly (preserving type). Otherwise return
        a string with substitutions performed.
        """
        # Check for a single whole-string template — return typed value
        sole_match = _TEMPLATE_RE.fullmatch(text)
        if sole_match:
            return self._lookup(sole_match.group(1), sole_match.group(2), completed_results)

        # Mixed string — substitute each occurrence and keep as str
        def replacer(m: re.Match) -> str:
            val = self._lookup(m.group(1), m.group(2), completed_results)
            return str(val)

        return _TEMPLATE_RE.sub(replacer, text)

    def _lookup(
        self,
        step_id: str,
        field_path: str,
        completed_results: dict[str, dict],
    ) -> Any:
        """Navigate dot-notation field_path in step output."""
        if step_id not in completed_results:
            raise ContextResolutionError(
                f"Template references '{step_id}' but that step has not completed yet. "
                f"Completed steps: {list(completed_results.keys())}"
            )
        value: Any = completed_results[step_id]
        for part in field_path.split("."):
            if not isinstance(value, dict) or part not in value:
                raise ContextResolutionError(
                    f"Field '{part}' not found in output of '{step_id}'. "
                    f"Available keys: {list(value.keys()) if isinstance(value, dict) else type(value).__name__}"
                )
            value = value[part]
        return value
