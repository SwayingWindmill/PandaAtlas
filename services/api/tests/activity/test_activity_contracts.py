from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.activity.models import (
    ActivityAction,
    ActivityImportance,
    ActivitySourceEvent,
    ActivityType,
    ArchiveActivityDescriptor,
    EditorialAnnouncementCommand,
    activity_id_for,
    decode_activity_cursor,
    encode_activity_cursor,
)
from app.activity.repository import ActivityRepository
from app.identity.models import AccountState, RequestIdentity


def _content(**overrides: object) -> dict[str, object]:
    content: dict[str, object] = {
        "activity_type": ActivityType.PANDA_BIRTH,
        "targets": [{"target_type": "panda", "target_id": "panda-001"}],
        "occurred_at": datetime(2026, 7, 1, 8, 0, tzinfo=UTC),
        "localization_key": "activity.panda.birth",
        "localization_version": 1,
        "localized_snapshots": [
            {"locale": "zh-CN", "title": "熊猫出生", "summary": "一只熊猫幼崽出生。"},
            {"locale": "en", "title": "Panda born", "summary": "A panda cub was born."},
        ],
    }
    content.update(overrides)
    return content


def _source_event(**overrides: object) -> ActivitySourceEvent:
    values: dict[str, object] = {
        **_content(),
        "event_id": uuid4(),
        "source_type": "archive.release",
        "source_id": "panda:panda-001:birth",
        "source_version": 1,
        "action": ActivityAction.PUBLISH,
        "published_at": datetime(2026, 7, 2, 8, 0, tzinfo=UTC),
        "correlation_id": uuid4(),
    }
    values.update(overrides)
    return ActivitySourceEvent.model_validate(values)


def _editorial_command(**overrides: object) -> EditorialAnnouncementCommand:
    values: dict[str, object] = {
        **_content(
            activity_type=ActivityType.EDITORIAL_ANNOUNCEMENT,
            localization_key="activity.editorial.announcement",
        ),
        "command_id": uuid4(),
        "source_id": "editorial:announcement-001",
        "correlation_id": uuid4(),
        "reason": "Reviewed editorial publication",
    }
    values.update(overrides)
    return EditorialAnnouncementCommand.model_validate(values)


def _actor(
    *capabilities: str,
    state: AccountState = AccountState.ACTIVE,
) -> RequestIdentity:
    now = datetime.now(UTC)
    return RequestIdentity(
        account_id=uuid4(),
        email="activity-test@example.invalid",
        session_id="activity-contract-test",
        state=state,
        roles=frozenset(),
        capabilities=frozenset(capabilities),
        authenticated_at=now,
        authentication_method="otp",
        issued_at=now,
        expires_at=now + timedelta(hours=1),
        assurance_level="aal1",
        recent_auth=True,
    )


def test_activity_type_owns_default_importance_and_deterministic_identity() -> None:
    first = _source_event()
    second = first.model_copy(update={"event_id": uuid4()})

    assert first.effective_importance == ActivityImportance.CRITICAL
    assert activity_id_for(first) == activity_id_for(second)


def test_activity_contract_rejects_private_or_unreviewed_fields() -> None:
    with pytest.raises(ValidationError):
        ActivitySourceEvent.model_validate(
            {
                **_source_event().model_dump(mode="json"),
                "contributor_email": "private@example.com",
            }
        )

    with pytest.raises(ValidationError, match="Simplified Chinese"):
        _source_event(
            localized_snapshots=[
                {"locale": "en", "title": "Panda born", "summary": "A cub was born."}
            ]
        )


def test_importance_override_requires_recorded_reason() -> None:
    with pytest.raises(ValidationError, match="recorded reason"):
        _source_event(importance=ActivityImportance.ORDINARY)

    event = _source_event(
        importance=ActivityImportance.ORDINARY,
        importance_override_reason="Reviewed low-impact historical backfill",
    )
    assert event.effective_importance == ActivityImportance.ORDINARY


def test_archive_descriptor_cannot_impersonate_editorial_distribution() -> None:
    with pytest.raises(ValidationError, match="sitewide"):
        ArchiveActivityDescriptor.model_validate(
            {**_content(), "source_id": "panda:panda-001:birth", "sitewide": True}
        )

    with pytest.raises(ValidationError, match="editorial announcements"):
        ArchiveActivityDescriptor.model_validate(
            {
                **_content(activity_type=ActivityType.EDITORIAL_ANNOUNCEMENT),
                "source_id": "editorial:announcement-1",
            }
        )


def test_correction_and_retraction_are_explicit() -> None:
    with pytest.raises(ValidationError, match="archive.profile_corrected"):
        _source_event(action=ActivityAction.CORRECTION)

    with pytest.raises(ValidationError, match="public-safe reason"):
        _source_event(action=ActivityAction.RETRACTION, source_version=2)


def test_activity_cursor_round_trips_stable_order_key() -> None:
    published_at = datetime.now(UTC).replace(microsecond=123456)
    activity_id = uuid4()
    cursor = encode_activity_cursor(published_at, activity_id)

    decoded_at, decoded_id = decode_activity_cursor(cursor)
    assert decoded_at == published_at
    assert decoded_id == activity_id

    with pytest.raises(ValueError, match="invalid Activity cursor"):
        decode_activity_cursor("not-a-cursor")


def test_pin_window_must_be_bounded() -> None:
    start = datetime.now(UTC)
    with pytest.raises(ValidationError, match="after starts_at"):
        _source_event(
            pin={"starts_at": start, "ends_at": start - timedelta(seconds=1), "reason": "bad"}
        )

    with pytest.raises(ValidationError, match="sitewide Activity must be public"):
        _editorial_command(sitewide=True, visibility="unlisted")

    with pytest.raises(ValidationError, match="pinned Activity must be public"):
        _editorial_command(
            visibility="unlisted",
            pin={
                "starts_at": start,
                "ends_at": start + timedelta(hours=1),
                "reason": "not publicly visible",
            },
        )


def test_editorial_command_requires_scoped_active_capabilities() -> None:
    repository = ActivityRepository(object())  # type: ignore[arg-type]

    with pytest.raises(PermissionError, match="active accounts"):
        repository.publish_editorial(
            _editorial_command(),
            _actor(
                "activity.editorial.publish",
                "activity.sitewide.publish",
                "activity.pin.manage",
                state=AccountState.SUSPENDED,
            ),
        )

    with pytest.raises(PermissionError, match="publication capability"):
        repository.publish_editorial(_editorial_command(), _actor())

    with pytest.raises(PermissionError, match="Sitewide"):
        repository.publish_editorial(
            _editorial_command(sitewide=True),
            _actor("activity.editorial.publish"),
        )

    pin_start = datetime.now(UTC)
    with pytest.raises(PermissionError, match="pin capability"):
        repository.publish_editorial(
            _editorial_command(
                pin={
                    "starts_at": pin_start,
                    "ends_at": pin_start + timedelta(hours=1),
                    "reason": "Reviewed temporary pin",
                }
            ),
            _actor("activity.editorial.publish"),
        )
