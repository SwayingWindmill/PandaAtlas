from __future__ import annotations

import json
import os
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from sqlalchemy import text

from app.db.session import configure_database, session_scope
from app.feed.models import FeedAttribution, FeedLastViewedCommand
from app.feed.repository import FeedConflictError, FeedRepository
from app.identity.models import AccountState, RequestIdentity


@pytest.fixture(scope="module")
def real_db_url() -> Iterator[str]:
    if os.getenv("RUN_REAL_DB_TESTS") != "1":
        pytest.skip("Set RUN_REAL_DB_TESTS=1 to run Feed database tests")
    value = os.getenv("REAL_DB_URL") or os.getenv("DATABASE_URL")
    if not value:
        pytest.skip("Set REAL_DB_URL or DATABASE_URL")
    configure_database(value)
    try:
        yield value
    finally:
        configure_database(None)


@pytest.fixture(autouse=True)
def clean_feed_state(real_db_url: str) -> Iterator[None]:
    _ = real_db_url

    def clear() -> None:
        with session_scope() as session:
            assert session is not None
            session.execute(
                text(
                    """
                    truncate table
                      activity.targets,
                      activity.projection_receipts,
                      activity.items,
                      feed.last_viewed_events,
                      feed.account_state
                    cascade
                    """
                )
            )
            session.execute(text("delete from engagement.follows"))
            session.execute(
                text(
                    """
                    delete from integration.outbox_events
                    where event_type = 'feed.last_viewed.marked'
                       or event_type like 'archive.activity.%'
                       or event_type like 'editorial.activity.%'
                       or event_type like 'activity.item.%'
                    """
                )
            )
            session.commit()

    clear()
    try:
        yield
    finally:
        clear()


def _identity(account_id: UUID, *, state: AccountState = AccountState.ACTIVE) -> RequestIdentity:
    now = datetime.now(UTC)
    return RequestIdentity(
        account_id=account_id,
        email=f"feed-{account_id}@example.invalid",
        session_id="feed-real-db-test",
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


def _insert_account(session: object, account_id: UUID) -> None:
    email = f"feed-{account_id}@example.invalid"
    session.execute(
        text(
            """
            insert into auth.users (
              instance_id, id, aud, role, email, encrypted_password,
              email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
              created_at, updated_at
            ) values (
              '00000000-0000-0000-0000-000000000000', :account_id,
              'authenticated', 'authenticated', :email, '', now(),
              '{"provider":"email","providers":["email"]}'::jsonb,
              '{}'::jsonb, now(), now()
            )
            """
        ),
        {"account_id": account_id, "email": email},
    )
    session.execute(
        text("insert into identity.accounts (account_id, email) values (:account_id, :email)"),
        {"account_id": account_id, "email": email},
    )


def _insert_follow(
    session: object,
    *,
    account_id: UUID,
    panda_id: str,
    followed_at: datetime,
) -> UUID:
    follow_id = uuid4()
    session.execute(
        text(
            """
            insert into engagement.follows (
              follow_id, account_id, panda_id, state,
              first_followed_at, followed_at, version, updated_at
            ) values (
              :follow_id, :account_id, :panda_id, 'active',
              :followed_at, :followed_at, 1, :followed_at
            )
            """
        ),
        {
            "follow_id": follow_id,
            "account_id": account_id,
            "panda_id": panda_id,
            "followed_at": followed_at,
        },
    )
    return follow_id


def _insert_activity(
    session: object,
    *,
    target_id: str,
    published_at: datetime,
    title: str,
    source_id: str,
    activity_type: str = "panda.named",
    retraction_state: str = "active",
    sitewide: bool = False,
    pin: bool = False,
) -> UUID:
    activity_id = uuid4()
    source_event_id = uuid4()
    retracted_at = published_at + timedelta(minutes=1) if retraction_state == "retracted" else None
    retraction_reason = "Public source was withdrawn." if retraction_state == "retracted" else None
    pin_starts_at = published_at - timedelta(days=1) if pin else None
    pin_ends_at = published_at + timedelta(days=30) if pin else None
    pin_reason = "Reviewed Feed placement" if pin else None
    importance = "ordinary" if activity_type == "editorial.announcement" else "important"
    snapshots = [
        {"locale": "zh-CN", "title": title, "summary": f"{title}的公开摘要。"},
        {"locale": "en", "title": title, "summary": f"Public summary for {title}."},
    ]
    session.execute(
        text(
            """
            insert into activity.items (
              activity_id, source_type, source_id, source_version, source_event_id,
              activity_type, importance, importance_override_reason, visibility,
              sitewide, notification_eligible, occurred_at, occurred_precision,
              occurred_end_at, published_at, updated_at, localization_key,
              localization_version, localized_snapshots, media, provenance,
              pin_starts_at, pin_ends_at, pin_reason, retraction_state,
              retracted_at, retraction_reason, correction_activity_id, is_backfill
            ) values (
              :activity_id, 'archive.release', :source_id, 1, :source_event_id,
              :activity_type, :importance, null, 'public',
              :sitewide, true, :published_at, 'exact',
              null, :published_at, :published_at, 'activity.test.feed',
              1, cast(:localized_snapshots as jsonb), null, '{}'::jsonb,
              :pin_starts_at, :pin_ends_at, :pin_reason, :retraction_state,
              :retracted_at, :retraction_reason, null, false
            )
            """
        ),
        {
            "activity_id": activity_id,
            "source_id": source_id,
            "source_event_id": source_event_id,
            "activity_type": activity_type,
            "importance": importance,
            "sitewide": sitewide,
            "published_at": published_at,
            "localized_snapshots": json.dumps(snapshots, ensure_ascii=False),
            "pin_starts_at": pin_starts_at,
            "pin_ends_at": pin_ends_at,
            "pin_reason": pin_reason,
            "retraction_state": retraction_state,
            "retracted_at": retracted_at,
            "retraction_reason": retraction_reason,
        },
    )
    session.execute(
        text(
            """
            insert into activity.targets (activity_id, target_type, target_id)
            values (:activity_id, 'panda', :target_id)
            """
        ),
        {"activity_id": activity_id, "target_id": target_id},
    )
    return activity_id


def test_personalized_feed_query_cursor_and_explicit_view_state(real_db_url: str) -> None:
    _ = real_db_url
    account_id = uuid4()
    now = datetime.now(UTC).replace(microsecond=0)
    followed_at = now - timedelta(days=10)
    deleted_target_id = str(uuid4())
    correlation_id = uuid4()

    with session_scope() as session:
        assert session is not None
        panda_ids = [
            str(value)
            for value in session.execute(
                text("select id from public.pandas order by slug limit 2")
            ).scalars()
        ]
        followed_panda_id, unrelated_panda_id = panda_ids
        _insert_account(session, account_id)
        followed_follow_id = _insert_follow(
            session,
            account_id=account_id,
            panda_id=followed_panda_id,
            followed_at=followed_at,
        )
        _insert_follow(
            session,
            account_id=account_id,
            panda_id=deleted_target_id,
            followed_at=followed_at,
        )

        history_id = _insert_activity(
            session,
            target_id=followed_panda_id,
            published_at=followed_at - timedelta(days=30),
            title="History within ninety days",
            source_id=f"feed:history:{uuid4().hex}",
        )
        too_old_id = _insert_activity(
            session,
            target_id=followed_panda_id,
            published_at=followed_at - timedelta(days=91),
            title="History outside ninety days",
            source_id=f"feed:old:{uuid4().hex}",
        )
        current_id = _insert_activity(
            session,
            target_id=followed_panda_id,
            published_at=now - timedelta(days=2),
            title="Current followed activity",
            source_id=f"feed:current:{uuid4().hex}",
        )
        corrected_original_id = _insert_activity(
            session,
            target_id=followed_panda_id,
            published_at=now - timedelta(days=4),
            title="Original corrected activity",
            source_id=f"feed:corrected-original:{uuid4().hex}",
        )
        correction_id = _insert_activity(
            session,
            target_id=followed_panda_id,
            published_at=now - timedelta(days=3),
            title="Explicit correction activity",
            source_id=f"feed:correction:{uuid4().hex}",
            activity_type="archive.profile_corrected",
        )
        session.execute(
            text(
                """
                update activity.items
                set retraction_state = 'corrected',
                    correction_activity_id = :correction_activity_id
                where activity_id = :activity_id
                """
            ),
            {
                "activity_id": corrected_original_id,
                "correction_activity_id": correction_id,
            },
        )
        retracted_id = _insert_activity(
            session,
            target_id=followed_panda_id,
            published_at=now - timedelta(days=1),
            title="Retracted followed activity",
            source_id=f"feed:retracted:{uuid4().hex}",
            retraction_state="retracted",
        )
        session.execute(
            text(
                """
                update activity.items
                set media = cast(:media as jsonb),
                    provenance = cast(:provenance as jsonb)
                where activity_id = :activity_id
                """
            ),
            {
                "activity_id": retracted_id,
                "media": json.dumps(
                    {
                        "asset_id": "00000000-0000-4000-8000-000000000183",
                        "variant": "profile",
                        "alt_text": "withdrawn",
                    }
                ),
                "provenance": json.dumps(
                    {"public_reference_ids": ["withdrawn-source"]}
                ),
            },
        )
        deleted_target_activity_id = _insert_activity(
            session,
            target_id=deleted_target_id,
            published_at=now - timedelta(hours=12),
            title="Deleted target activity",
            source_id=f"feed:deleted-target:{uuid4().hex}",
        )
        pin_id = _insert_activity(
            session,
            target_id=unrelated_panda_id,
            published_at=now - timedelta(hours=6),
            title="Sitewide pinned activity",
            source_id=f"feed:pin:{uuid4().hex}",
            activity_type="editorial.announcement",
            sitewide=True,
            pin=True,
        )
        session.commit()

        repository = FeedRepository(session, cursor_signing_key="unit-test-feed-signing-key-value")
        state_count_before = int(
            session.execute(text("select count(*) from feed.account_state")).scalar_one()
        )
        first_page = repository.list_feed(_identity(account_id), page_size=2, now=now)
        state_count_after = int(
            session.execute(text("select count(*) from feed.account_state")).scalar_one()
        )
        assert state_count_after == state_count_before
        assert first_page.next_cursor is not None
        assert [item.activity.activity_id for item in first_page.items] == [
            pin_id,
            deleted_target_activity_id,
        ]
        assert first_page.items[0].attribution is FeedAttribution.PINNED
        assert first_page.items[0].is_pinned is True
        assert first_page.items[1].deleted_target_ids == [deleted_target_id]

        second_page = repository.list_feed(
            _identity(account_id),
            page_size=10,
            cursor=first_page.next_cursor,
            now=now,
        )
        second_ids = [item.activity.activity_id for item in second_page.items]
        assert second_ids == [retracted_id, current_id, correction_id, history_id]
        assert corrected_original_id not in second_ids
        assert too_old_id not in second_ids
        assert second_page.items[-1].attribution is FeedAttribution.HISTORY
        assert second_page.items[0].activity.retraction_state.value == "retracted"
        assert second_page.items[0].activity.localized_snapshots[0].title == "动态已撤回"
        assert second_page.items[0].activity.media is None
        assert second_page.items[0].activity.provenance.public_reference_ids == []
        assert set(second_ids).isdisjoint(
            {item.activity.activity_id for item in first_page.items}
        )

        public_page = repository.list_public_activity(followed_panda_id, page_size=10)
        assert [item.activity_id for item in public_page.items] == [
            retracted_id,
            current_id,
            correction_id,
            history_id,
            too_old_id,
        ]
        assert corrected_original_id not in {
            item.activity_id for item in public_page.items
        }

        viewed_at = first_page.items[0].activity.published_at
        command = FeedLastViewedCommand(
            idempotency_key="v" * 255,
            viewed_through_at=viewed_at,
        )
        first_state = repository.mark_last_viewed(
            _identity(account_id),
            command,
            correlation_id=correlation_id,
        )
        replay_state = repository.mark_last_viewed(
            _identity(account_id),
            command,
            correlation_id=correlation_id,
        )
        assert replay_state.version == first_state.version == 1
        assert replay_state.last_viewed_at == viewed_at
        with pytest.raises(FeedConflictError, match="another mark-last-viewed"):
            repository.mark_last_viewed(
                _identity(account_id),
                command.model_copy(update={"viewed_through_at": viewed_at - timedelta(seconds=1)}),
                correlation_id=correlation_id,
            )
        session.rollback()

        after_view = repository.list_feed(_identity(account_id), page_size=10, now=now)
        assert all(not item.is_new for item in after_view.items)

        session.execute(
            text(
                """
                update engagement.follows
                set state = 'inactive', unfollowed_at = :now, version = version + 1
                where follow_id = :follow_id
                """
            ),
            {"now": now, "follow_id": followed_follow_id},
        )
        session.commit()
        after_unfollow = repository.list_feed(_identity(account_id), page_size=20, now=now)
        after_unfollow_ids = {item.activity.activity_id for item in after_unfollow.items}
        assert current_id not in after_unfollow_ids
        assert history_id not in after_unfollow_ids
        assert retracted_id not in after_unfollow_ids
        assert correction_id not in after_unfollow_ids
        assert pin_id in after_unfollow_ids
        assert deleted_target_activity_id in after_unfollow_ids
