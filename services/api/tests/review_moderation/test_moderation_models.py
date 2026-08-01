from datetime import UTC, datetime, timedelta

import pytest
from pydantic import ValidationError

from app.review_moderation.moderation_models import (
    AppealDecisionOutcome,
    DecideAppealCommand,
    IssueModerationActionCommand,
    ModerationActionKind,
)


NOW = datetime(2026, 8, 1, 10, 0, tzinfo=UTC)


def test_issue_action_rejects_restoration_and_invalid_window() -> None:
    with pytest.raises(ValidationError, match="dedicated restore command"):
        IssueModerationActionCommand(
            idempotency_key="moderation-restoration-1",
            expected_version=1,
            kind=ModerationActionKind.RESTORATION,
            scope="submission",
            reason_code="operator.restore",
            internal_explanation="Restoration must use the dedicated command.",
            user_visible_explanation="Your restriction has been lifted.",
            starts_at=NOW,
        )

    with pytest.raises(ValidationError, match="ends_at must be after starts_at"):
        IssueModerationActionCommand(
            idempotency_key="moderation-window-1",
            expected_version=1,
            kind=ModerationActionKind.SUBMISSION_RESTRICTED,
            scope="submission",
            reason_code="review.freeze",
            internal_explanation="Temporary freeze while evidence is reviewed.",
            user_visible_explanation="Submissions are temporarily paused while we review evidence.",
            starts_at=NOW,
            ends_at=NOW,
        )


def test_modified_appeal_requires_complete_replacement_sanction() -> None:
    with pytest.raises(ValidationError, match="modified appeals require a replacement sanction"):
        DecideAppealCommand(
            idempotency_key="appeal-modified-1",
            expected_version=2,
            outcome=AppealDecisionOutcome.MODIFIED,
            reason_code="appeal.partial",
            internal_resolution="The original scope was broader than necessary.",
            user_visible_resolution="The restriction has been narrowed after review.",
        )

    command = DecideAppealCommand(
        idempotency_key="appeal-modified-2",
        expected_version=2,
        outcome=AppealDecisionOutcome.MODIFIED,
        reason_code="appeal.partial",
        internal_resolution="The original scope was broader than necessary.",
        user_visible_resolution="The restriction has been narrowed after review.",
        replacement_kind=ModerationActionKind.SUBMISSION_RESTRICTED,
        replacement_scope="submission",
        replacement_starts_at=NOW,
        replacement_ends_at=NOW + timedelta(hours=12),
    )

    assert command.replacement_kind is ModerationActionKind.SUBMISSION_RESTRICTED


def test_non_modified_appeal_rejects_replacement_payload() -> None:
    with pytest.raises(ValidationError, match="valid only for modified appeals"):
        DecideAppealCommand(
            idempotency_key="appeal-upheld-1",
            expected_version=2,
            outcome=AppealDecisionOutcome.UPHELD,
            reason_code="appeal.upheld",
            internal_resolution="The original decision remains proportionate.",
            user_visible_resolution="The original restriction remains in effect.",
            replacement_kind=ModerationActionKind.WARNING,
            replacement_scope="account",
            replacement_starts_at=NOW,
        )
