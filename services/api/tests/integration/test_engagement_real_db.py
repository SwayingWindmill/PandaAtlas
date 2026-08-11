from __future__ import annotations

import os
from collections.abc import Iterator
from datetime import UTC, date, datetime, timedelta
from uuid import UUID, uuid4

import psycopg
import pytest
from sqlalchemy import text

from app.db.session import configure_database, session_scope
from app.engagement.fan_games import FanGameRepository
from app.engagement.fan_library import FanLibraryRepository
from app.engagement.fan_memory import FanMemoryRepository
from app.engagement.models import (
    EngagementAccountUnavailableError,
    EngagementNotFoundError,
    PendingFollowOutcome,
    PendingFollowStatus,
)
from app.engagement.repository import EngagementRepository
from app.identity.models import AccountState, RequestIdentity


def _normalize_dsn(value: str) -> str:
    return value.replace("postgresql+psycopg://", "postgresql://", 1)


@pytest.fixture(scope="module")
def real_db_url() -> Iterator[str]:
    if os.getenv("RUN_REAL_DB_TESTS") != "1":
        pytest.skip("Set RUN_REAL_DB_TESTS=1 to run engagement database tests")
    value = os.getenv("REAL_DB_URL") or os.getenv("DATABASE_URL")
    if not value:
        pytest.skip("Set REAL_DB_URL or DATABASE_URL")
    configure_database(value)
    try:
        yield value
    finally:
        configure_database(None)


def _identity(
    account_id: UUID,
    *,
    state: AccountState = AccountState.ACTIVE,
) -> RequestIdentity:
    now = datetime.now(UTC)
    return RequestIdentity(
        account_id=account_id,
        email="engagement-test@example.invalid",
        session_id="engagement-real-db-test",
        state=state,
        roles=frozenset({"member"}),
        capabilities=frozenset({"account.session.read"}),
        authenticated_at=now,
        authentication_method="otp",
        issued_at=now,
        expires_at=now + timedelta(hours=1),
        assurance_level="aal1",
        recent_auth=True,
    )


def _create_account(database_url: str, account_id: UUID) -> tuple[str, str]:
    with psycopg.connect(_normalize_dsn(database_url)) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                insert into auth.users (
                  instance_id, id, aud, role, email, encrypted_password,
                  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                  created_at, updated_at
                ) values (
                  '00000000-0000-0000-0000-000000000000', %s, 'authenticated',
                  'authenticated', %s, '', now(), '{"provider":"email","providers":["email"]}',
                  '{}', now(), now()
                )
                """,
                (account_id, f"engagement-{account_id}@example.invalid"),
            )
            cursor.execute(
                """
                insert into identity.accounts (account_id, email)
                values (%s, %s)
                """,
                (account_id, f"engagement-{account_id}@example.invalid"),
            )
            cursor.execute("select id::text from public.pandas order by slug limit 2")
            panda_ids = tuple(str(row[0]) for row in cursor.fetchall())
            assert len(panda_ids) == 2
        connection.commit()
    return panda_ids[0], panda_ids[1]


def _scalar(database_url: str, sql: str, params: tuple[object, ...]) -> int:
    with psycopg.connect(_normalize_dsn(database_url)) as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql, params)
            return int(cursor.fetchone()[0])


def test_pending_follow_consent_passport_and_deletion(real_db_url: str) -> None:
    account_id = uuid4()
    panda_id, contribution_panda_id = _create_account(real_db_url, account_id)
    identity = _identity(account_id)
    correlation_id = uuid4()

    with session_scope() as session:
        assert session is not None
        repository = EngagementRepository(session)
        pending = repository.create_pending_intent(
            panda_id=panda_id,
            locale="zh",
            safe_return_path=f"/zh/atlas/{panda_id}",
            existing_handle=None,
            request_id=uuid4(),
            correlation_id=correlation_id,
        )
        assert pending.status is PendingFollowStatus.PENDING
        assert pending.panda_id == panda_id
        assert pending.safe_return_path.startswith("/zh/pandas/")
        assert "/atlas/" not in pending.safe_return_path
        assert len(pending.handle) >= 40
        assert len(pending.continuation_handle) >= 40

        result = repository.complete_pending_follow(
            identity=identity,
            handle=pending.handle,
            idempotency_key=f"complete-{uuid4()}",
            correlation_id=correlation_id,
        )
        assert result.outcome is PendingFollowOutcome.FOLLOWED
        assert result.follow_id is not None

        replay = repository.complete_pending_follow(
            identity=identity,
            handle=pending.handle,
            idempotency_key=f"replay-{uuid4()}",
            correlation_id=correlation_id,
        )
        assert replay.follow_id == result.follow_id
        assert replay.outcome is PendingFollowOutcome.FOLLOWED

        assert repository.get_passport(account_id)[0]["panda_id"] == panda_id
        contribution_event_id = uuid4()
        contribution = repository.record_passport_contribution(
            account_id=account_id,
            panda_id=contribution_panda_id,
            source_event_id=contribution_event_id,
            occurred_at=datetime.now(UTC),
            correlation_id=correlation_id,
        )
        assert contribution["relationship_state"] is None
        assert contribution["contribution_count"] == 1
        contribution_replay = repository.record_passport_contribution(
            account_id=account_id,
            panda_id=contribution_panda_id,
            source_event_id=contribution_event_id,
            occurred_at=datetime.now(UTC),
            correlation_id=correlation_id,
        )
        assert contribution_replay["contribution_count"] == 1
        assert (
            _scalar(
                real_db_url,
                "select count(*) from engagement.notification_preferences where account_id = %s",
                (account_id,),
            )
            == 0
        )

        preference = repository.set_notification_preference(
            identity=identity,
            category="major_activity",
            channel="email",
            enabled=True,
            idempotency_key=f"consent-{uuid4()}",
            correlation_id=correlation_id,
        )
        assert preference["enabled"] is True
        assert preference["version"] == 1

        unfollowed = repository.unfollow(
            identity=identity,
            panda_id=panda_id,
            idempotency_key=f"unfollow-{uuid4()}",
            correlation_id=correlation_id,
        )
        assert unfollowed["state"] == "inactive"
        rebuild_key = f"rebuild-{uuid4()}"
        rebuilt = repository.rebuild_passport(
            identity=identity,
            idempotency_key=rebuild_key,
            correlation_id=correlation_id,
        )
        rebuilt_replay = repository.rebuild_passport(
            identity=identity,
            idempotency_key=rebuild_key,
            correlation_id=correlation_id,
        )
        assert rebuilt_replay == rebuilt
        rebuilt_by_panda = {entry["panda_id"]: entry for entry in rebuilt}
        assert rebuilt_by_panda[panda_id]["relationship_state"] == "inactive"
        assert rebuilt_by_panda[contribution_panda_id]["relationship_state"] is None
        assert rebuilt_by_panda[contribution_panda_id]["contribution_count"] == 1

        session.execute(
            text(
                """
                insert into feed.account_state (account_id, last_viewed_at)
                values (:account_id, now())
                """
            ),
            {"account_id": account_id},
        )
        session.execute(
            text("update identity.accounts set state = 'deleting' where account_id = :account_id"),
            {"account_id": account_id},
        )
        session.commit()
        deletion_identity = _identity(account_id, state=AccountState.DELETING)
        deleted = repository.delete_private_data(
            identity=deletion_identity,
            idempotency_key=f"delete-{uuid4()}",
            reason="account-deletion-test",
            correlation_id=correlation_id,
        )
        assert deleted["follows_deleted"] == 1
        assert deleted["preferences_deleted"] == 1
        assert deleted["passport_entries_deleted"] == 2
        assert deleted["contribution_events_deleted"] == 1
        assert deleted["last_viewed_deleted"] == 1

    assert (
        _scalar(
            real_db_url,
            "select count(*) from feed.account_state where account_id = %s",
            (account_id,),
        )
        == 0
    )
    assert (
        _scalar(
            real_db_url,
            "select count(*) from engagement.follows where account_id = %s",
            (account_id,),
        )
        == 0
    )
    assert (
        _scalar(
            real_db_url,
            "select count(*) from engagement.passport_entries where account_id = %s",
            (account_id,),
        )
        == 0
    )
    assert (
        _scalar(
            real_db_url,
            "select count(*) from engagement.passport_contribution_events where account_id = %s",
            (account_id,),
        )
        == 0
    )
    assert (
        _scalar(
            real_db_url,
            (
                "select count(*) from engagement.follow_events "
                "where account_subject_hash = encode(digest(%s, 'sha256'), 'hex')"
            ),
            (str(account_id),),
        )
        == 2
    )


def test_completed_pending_follow_is_bound_to_completing_account(real_db_url: str) -> None:
    first_account_id = uuid4()
    second_account_id = uuid4()
    panda_id, _ = _create_account(real_db_url, first_account_id)
    _create_account(real_db_url, second_account_id)

    with session_scope() as session:
        assert session is not None
        repository = EngagementRepository(session)
        pending = repository.create_pending_intent(
            panda_id=panda_id,
            locale="en",
            safe_return_path="/en/my-pandas",
            existing_handle=None,
            request_id=uuid4(),
            correlation_id=uuid4(),
        )
        repository.complete_pending_follow(
            identity=_identity(first_account_id),
            handle=pending.handle,
            idempotency_key=f"first-completion-{uuid4()}",
            correlation_id=uuid4(),
        )
        with pytest.raises(EngagementNotFoundError):
            repository.complete_pending_follow(
                identity=_identity(second_account_id),
                handle=pending.handle,
                idempotency_key=f"second-completion-{uuid4()}",
                correlation_id=uuid4(),
            )


def test_pending_follow_cancel_and_expiry(real_db_url: str) -> None:
    account_id = uuid4()
    panda_id, _ = _create_account(real_db_url, account_id)
    identity = _identity(account_id)

    with session_scope() as session:
        assert session is not None
        repository = EngagementRepository(session, pending_ttl_seconds=60)
        cancelled = repository.create_pending_intent(
            panda_id=panda_id,
            locale="en",
            safe_return_path=f"/en/atlas/{panda_id}",
            existing_handle=None,
            request_id=uuid4(),
            correlation_id=uuid4(),
        )
        cancelled_row = repository.cancel_pending_intent(
            handle=cancelled.handle,
            idempotency_key=f"cancel-{uuid4()}",
            correlation_id=uuid4(),
        )
        assert cancelled_row["status"] == "cancelled"

        expired = repository.create_pending_intent(
            panda_id=panda_id,
            locale="en",
            safe_return_path=f"/en/atlas/{panda_id}",
            existing_handle=None,
            request_id=uuid4(),
            correlation_id=uuid4(),
        )
        session.execute(
            text(
                """
                update engagement.pending_follow_intents
                set created_at = now() - interval '2 hours',
                    expires_at = now() - interval '1 hour'
                where intent_id = :intent_id
                """
            ),
            {"intent_id": expired.intent_id},
        )
        session.commit()
        result = repository.complete_pending_follow(
            identity=identity,
            handle=expired.handle,
            idempotency_key=f"expired-{uuid4()}",
            correlation_id=uuid4(),
        )
        assert result.status is PendingFollowStatus.EXPIRED
        assert result.outcome is PendingFollowOutcome.INTENT_EXPIRED
        assert result.follow_id is None


def test_repository_rechecks_account_state_inside_write_transaction(real_db_url: str) -> None:
    account_id = uuid4()
    panda_id, _ = _create_account(real_db_url, account_id)
    identity = _identity(account_id)
    with psycopg.connect(_normalize_dsn(real_db_url)) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                "update identity.accounts set state = 'deleting' where account_id = %s",
                (account_id,),
            )
        connection.commit()

    with session_scope() as session:
        assert session is not None
        with pytest.raises(EngagementAccountUnavailableError):
            EngagementRepository(session).follow(
                identity=identity,
                panda_id=panda_id,
                idempotency_key=f"deleting-race-{uuid4()}",
                correlation_id=uuid4(),
            )


def test_fan_library_favorite_and_collection_lifecycle(real_db_url: str) -> None:
    account_id = uuid4()
    panda_id, second_panda_id = _create_account(real_db_url, account_id)
    identity = _identity(account_id)

    with session_scope() as session:
        assert session is not None
        library = FanLibraryRepository(session)

        favorite = library.favorite(
            identity=identity,
            panda_id=panda_id,
            idempotency_key=f"favorite-{uuid4()}",
            correlation_id=uuid4(),
        )
        assert favorite["panda_id"] == panda_id
        library.favorite(
            identity=identity,
            panda_id=second_panda_id,
            idempotency_key=f"favorite-{uuid4()}",
            correlation_id=uuid4(),
        )
        assert {item["panda_id"] for item in library.list_favorites(account_id)} == {
            panda_id,
            second_panda_id,
        }

        collection = library.create_collection(identity=identity, name="成都想见")
        collection_id = collection["collection_id"]
        assert collection["panda_ids"] == []

        collection = library.add_panda(
            identity=identity,
            collection_id=collection_id,
            panda_id=panda_id,
        )
        collection = library.add_panda(
            identity=identity,
            collection_id=collection_id,
            panda_id=second_panda_id,
        )
        assert collection["panda_ids"] == [panda_id, second_panda_id]

        collection = library.rename_collection(
            identity=identity,
            collection_id=collection_id,
            name="最喜欢",
        )
        assert collection["name"] == "最喜欢"

        collection = library.remove_panda(
            identity=identity,
            collection_id=collection_id,
            panda_id=second_panda_id,
        )
        assert collection["panda_ids"] == [panda_id]

        removed = library.unfavorite(
            identity=identity,
            panda_id=panda_id,
            idempotency_key=f"unfavorite-{uuid4()}",
            correlation_id=uuid4(),
        )
        assert removed["favorited"] is False
        assert [item["panda_id"] for item in library.list_favorites(account_id)] == [
            second_panda_id
        ]
        assert library.list_collections(account_id)[0]["panda_ids"] == []
        library.unfavorite(
            identity=identity,
            panda_id=second_panda_id,
            idempotency_key=f"unfavorite-{uuid4()}",
            correlation_id=uuid4(),
        )
        assert library.list_favorites(account_id) == []

        deleted_id = library.delete_collection(
            identity=identity,
            collection_id=collection_id,
        )
        assert deleted_id == collection_id
        assert library.list_collections(account_id) == []


def test_fan_memory_checkin_and_seen_panda_are_independent(real_db_url: str) -> None:
    account_id = uuid4()
    panda_id, _ = _create_account(real_db_url, account_id)
    identity = _identity(account_id)
    visited_on = date(2026, 8, 10)
    place_id = "place-fan-memory-real-db"

    with session_scope() as session:
        assert session is not None
        memory = FanMemoryRepository(session)

        checkin = memory.create_checkin(
            identity=identity,
            place_id=place_id,
            visited_on=visited_on,
            note="第一次来这里",
        )
        assert checkin["place_id"] == place_id
        assert memory.list_seen_pandas(account_id) == []

        seen = memory.save_seen_panda(
            identity=identity,
            panda_id=panda_id,
            seen_on=visited_on,
            place_id=None,
            note="亲眼见到",
        )
        assert seen["panda_id"] == panda_id
        assert seen["place_id"] is None
        assert len(memory.list_checkins(account_id)) == 1

        memory.delete_seen_panda(identity=identity, panda_id=panda_id)
        assert memory.list_seen_pandas(account_id) == []
        assert len(memory.list_checkins(account_id)) == 1

        memory.delete_checkin(identity=identity, checkin_id=checkin["checkin_id"])
        assert memory.list_checkins(account_id) == []


def test_guess_panda_attempt_history_is_private_and_server_computed(real_db_url: str) -> None:
    account_id = uuid4()
    target_panda_id, other_panda_id = _create_account(real_db_url, account_id)
    identity = _identity(account_id)

    with session_scope() as session:
        assert session is not None
        games = FanGameRepository(session)

        wrong = games.save_attempt(
            identity=identity,
            target_panda_id=target_panda_id,
            selected_panda_id=other_panda_id,
            public_release_version="2026.08.10-test",
        )
        assert wrong["correct"] is False

        correct = games.save_attempt(
            identity=identity,
            target_panda_id=target_panda_id,
            selected_panda_id=target_panda_id,
            public_release_version="2026.08.10-test",
        )
        assert correct["correct"] is True
        assert len(games.list_attempts(account_id)) == 2

        games.delete_attempt(identity=identity, attempt_id=wrong["attempt_id"])
        rows = games.list_attempts(account_id)
        assert len(rows) == 1
        assert rows[0]["attempt_id"] == correct["attempt_id"]
