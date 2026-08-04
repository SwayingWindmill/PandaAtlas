from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.review_moderation.sanction_models import (
    AppealDecisionOutcome,
    DecideAppealCommand,
    IssueSanctionCommand,
    OpenAppealCommand,
    SanctionKind,
    SanctionScope,
)


def test_sanction_command_requires_matching_explicit_scope() -> None:
    now = datetime.now(UTC)
    command = IssueSanctionCommand(
        idempotency_key="sanction-command-1",
        expected_version=1,
        kind=SanctionKind.SUBMISSION_RESTRICTED,
        scope=SanctionScope.SUBMISSION,
        reason_code="repeat_spam",
        internal_explanation="Repeated abusive submissions after a prior warning.",
        user_visible_explanation=(
            "Submitting changes is temporarily unavailable because of repeated abuse."
        ),
        starts_at=now,
        ends_at=now + timedelta(hours=24),
    )

    assert command.scope is SanctionScope.SUBMISSION

    with pytest.raises(ValidationError, match="scope does not match sanction kind"):
        IssueSanctionCommand(
            **{
                **command.model_dump(),
                "scope": SanctionScope.ATTACHMENT,
                "idempotency_key": "sanction-command-2",
            }
        )


def test_sanction_command_rejects_invalid_time_window() -> None:
    now = datetime.now(UTC)
    with pytest.raises(ValidationError, match="ends_at must be after starts_at"):
        IssueSanctionCommand(
            idempotency_key="sanction-command-3",
            expected_version=1,
            kind=SanctionKind.NOTIFICATION_RESTRICTED,
            scope=SanctionScope.NOTIFICATION,
            reason_code="delivery_abuse",
            internal_explanation="Notification channel abuse was confirmed.",
            user_visible_explanation="Optional notifications are temporarily unavailable.",
            starts_at=now,
            ends_at=now,
        )


def test_appeal_decision_requires_subject_version_when_overturned() -> None:
    base = {
        "idempotency_key": "appeal-decision-1",
        "expected_version": 2,
        "outcome": AppealDecisionOutcome.OVERTURNED,
        "internal_explanation": "The evidence does not support the original sanction.",
        "user_visible_explanation": "Your appeal was accepted and the restriction was removed.",
    }

    with pytest.raises(ValidationError, match="expected_subject_version"):
        DecideAppealCommand(**base)

    command = DecideAppealCommand(**base, expected_subject_version=4)
    assert command.expected_subject_version == 4


def test_open_appeal_requires_current_subject_version() -> None:
    command = OpenAppealCommand(
        idempotency_key="open-appeal-1",
        expected_version=3,
        sanction_id=uuid4(),
        user_statement="I believe the restriction was based on a mistaken duplicate report.",
    )

    assert command.expected_version == 3
