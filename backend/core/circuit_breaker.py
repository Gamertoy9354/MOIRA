"""Circuit breaker — prevents infinite recovery loops per step."""

from __future__ import annotations


class CircuitBreaker:
    """
    Tracks recovery attempts per step.

    An "open" circuit means the step has exhausted its recovery budget and
    must be escalated to the user without further retry.
    """

    def __init__(self, max_attempts: int = 3) -> None:
        self._max_attempts = max_attempts
        self._attempts: dict[str, int] = {}

    def record_attempt(self, step_id: str) -> None:
        """Increment the recovery counter for *step_id*."""
        self._attempts[step_id] = self._attempts.get(step_id, 0) + 1

    def is_open(self, step_id: str) -> bool:
        """Return ``True`` if this step has hit the max recovery attempts."""
        return self._attempts.get(step_id, 0) >= self._max_attempts

    def get_attempts(self, step_id: str) -> int:
        """Return the current recovery attempt count for *step_id*."""
        return self._attempts.get(step_id, 0)

    def reset(self, step_id: str) -> None:
        """Reset the counter when a step succeeds after recovery."""
        self._attempts.pop(step_id, None)
