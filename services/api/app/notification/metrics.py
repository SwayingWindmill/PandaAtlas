from __future__ import annotations

from collections import Counter
from threading import Lock

from app.notification.models import NotificationMetricsSnapshot


class NotificationMetricsRegistry:
    def __init__(self) -> None:
        self._lock = Lock()
        self._intent_created_count = 0
        self._suppression_counts: Counter[str] = Counter()
        self._maximum_intent_latency_seconds = 0.0
        self._retraction_count = 0
        self._state_inconsistency_count = 0

    def record_intents(self, count: int, *, latency_seconds: float) -> None:
        with self._lock:
            self._intent_created_count += count
            self._maximum_intent_latency_seconds = max(
                self._maximum_intent_latency_seconds,
                max(0.0, latency_seconds),
            )

    def record_suppression(self, reason: str, count: int = 1) -> None:
        with self._lock:
            self._suppression_counts[reason] += count

    def record_retraction(self, count: int) -> None:
        with self._lock:
            self._retraction_count += count

    def record_state_inconsistency(self) -> None:
        with self._lock:
            self._state_inconsistency_count += 1

    def snapshot(self, *, unread_count: int) -> NotificationMetricsSnapshot:
        with self._lock:
            return NotificationMetricsSnapshot(
                intent_created_count=self._intent_created_count,
                suppression_counts=dict(self._suppression_counts),
                unread_count=unread_count,
                maximum_intent_latency_seconds=self._maximum_intent_latency_seconds,
                retraction_count=self._retraction_count,
                state_inconsistency_count=self._state_inconsistency_count,
            )


notification_metrics = NotificationMetricsRegistry()
