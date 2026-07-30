from __future__ import annotations

from threading import Lock

from app.feed.models import FeedMetricsSnapshot


class FeedMetricsRegistry:
    """Process-local operational metrics; Feed reads never write business tables."""

    def __init__(self) -> None:
        self._lock = Lock()
        self._query_count = 0
        self._cursor_error_count = 0
        self._empty_feed_count = 0
        self._failed_page_load_count = 0
        self._maximum_query_latency_ms = 0.0
        self._maximum_projection_lag_seconds = 0.0

    def record_query(
        self,
        *,
        latency_ms: float,
        empty: bool,
        projection_lag_seconds: float,
    ) -> None:
        with self._lock:
            self._query_count += 1
            if empty:
                self._empty_feed_count += 1
            self._maximum_query_latency_ms = max(self._maximum_query_latency_ms, latency_ms)
            self._maximum_projection_lag_seconds = max(
                self._maximum_projection_lag_seconds,
                projection_lag_seconds,
            )

    def record_cursor_error(self) -> None:
        with self._lock:
            self._cursor_error_count += 1

    def record_failed_page_load(self) -> None:
        with self._lock:
            self._failed_page_load_count += 1

    def snapshot(self) -> FeedMetricsSnapshot:
        with self._lock:
            return FeedMetricsSnapshot(
                query_count=self._query_count,
                cursor_error_count=self._cursor_error_count,
                empty_feed_count=self._empty_feed_count,
                failed_page_load_count=self._failed_page_load_count,
                maximum_query_latency_ms=self._maximum_query_latency_ms,
                maximum_projection_lag_seconds=self._maximum_projection_lag_seconds,
            )


feed_metrics = FeedMetricsRegistry()
