from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from app.feed.metrics import FeedMetricsRegistry
from app.feed.models import (
    FeedCursorError,
    FeedLastViewedCommand,
    decode_feed_cursor,
    encode_feed_cursor,
)
from app.feed.repository import (
    FeedAccountUnavailableError,
    FeedConflictError,
    FeedRepository,
)
from app.identity.models import AccountState, RequestIdentity


def test_feed_cursor_is_deterministic_account_bound_and_tamper_evident() -> None:
    published_at = datetime(2026, 7, 30, 8, 0, tzinfo=UTC)
    activity_id = uuid4()
    account_id = uuid4()
    signing_key = "unit-test-key"

    first = encode_feed_cursor(
        published_at=published_at,
        activity_id=activity_id,
        scope=f"account:{account_id}",
        signing_key=signing_key,
    )
    second = encode_feed_cursor(
        published_at=published_at,
        activity_id=activity_id,
        scope=f"account:{account_id}",
        signing_key=signing_key,
    )

    assert first == second
    assert decode_feed_cursor(
        first,
        expected_scope=f"account:{account_id}",
        signing_key=signing_key,
    ) == (published_at, activity_id)

    with pytest.raises(FeedCursorError, match="scope"):
        decode_feed_cursor(
            first,
            expected_scope=f"account:{uuid4()}",
            signing_key=signing_key,
        )

    encoded_payload, encoded_signature = first.split(".", 1)
    replacement = "A" if encoded_signature[0] != "A" else "B"
    tampered = f"{encoded_payload}.{replacement}{encoded_signature[1:]}"
    with pytest.raises(FeedCursorError, match="invalid"):
        decode_feed_cursor(
            tampered,
            expected_scope=f"account:{account_id}",
            signing_key=signing_key,
        )



def _identity(state: AccountState) -> RequestIdentity:
    now = datetime.now(UTC)
    return RequestIdentity(
        account_id=uuid4(),
        email="feed-contract@example.invalid",
        session_id="feed-contract",
        state=state,
        roles=frozenset(),
        capabilities=frozenset(),
        authenticated_at=now,
        authentication_method="otp",
        issued_at=now,
        expires_at=now + timedelta(hours=1),
        assurance_level="aal1",
        recent_auth=True,
    )


def test_feed_rejects_blocked_accounts_before_database_access() -> None:
    repository = FeedRepository(object(), cursor_signing_key="unit-test-key")  # type: ignore[arg-type]
    with pytest.raises(FeedAccountUnavailableError, match="account state"):
        repository.list_feed(_identity(AccountState.SUSPENDED))


def test_mark_last_viewed_rejects_future_time_before_database_access() -> None:
    repository = FeedRepository(object(), cursor_signing_key="unit-test-key")  # type: ignore[arg-type]
    command = FeedLastViewedCommand(
        idempotency_key="future-view-command",
        viewed_through_at=datetime.now(UTC) + timedelta(hours=1),
    )
    with pytest.raises(FeedConflictError, match="cannot be in the future"):
        repository.mark_last_viewed(
            _identity(AccountState.ACTIVE),
            command,
            correlation_id=uuid4(),
        )



def test_feed_metrics_include_failed_page_loads() -> None:
    metrics = FeedMetricsRegistry()
    metrics.record_query(
        latency_ms=12.5,
        empty=True,
        projection_lag_seconds=3.0,
    )
    metrics.record_cursor_error()
    metrics.record_failed_page_load()

    snapshot = metrics.snapshot()
    assert snapshot.query_count == 1
    assert snapshot.empty_feed_count == 1
    assert snapshot.cursor_error_count == 1
    assert snapshot.failed_page_load_count == 1
    assert snapshot.maximum_query_latency_ms == 12.5
    assert snapshot.maximum_projection_lag_seconds == 3.0
