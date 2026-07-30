from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.review_moderation.models import (
    DecideReviewCaseCommand,
    RequestInformationCommand,
    ReviewDecisionOutcome,
    SourceVerificationOutcome,
    VerifySourceCommand,
)


def test_accepted_decision_requires_selected_assertions() -> None:
    with pytest.raises(ValidationError, match="selected assertion keys"):
        DecideReviewCaseCommand(
            idempotency_key="decision-123",
            expected_version=2,
            outcome=ReviewDecisionOutcome.ACCEPTED,
            user_visible_explanation="The reviewed contribution is supported by clean evidence.",
        )


def test_duplicate_decision_requires_explicit_review_case() -> None:
    with pytest.raises(ValidationError, match="duplicate ReviewCase"):
        DecideReviewCaseCommand(
            idempotency_key="decision-456",
            expected_version=2,
            outcome=ReviewDecisionOutcome.DUPLICATE,
            user_visible_explanation="This contribution duplicates an existing reviewed case.",
        )

    command = DecideReviewCaseCommand(
        idempotency_key="decision-789",
        expected_version=2,
        outcome=ReviewDecisionOutcome.DUPLICATE,
        user_visible_explanation="This contribution duplicates an existing reviewed case.",
        duplicate_of_review_case_id=uuid4(),
    )
    assert command.outcome is ReviewDecisionOutcome.DUPLICATE


def test_verified_source_requires_normalized_locator() -> None:
    with pytest.raises(ValidationError, match="normalized locator"):
        VerifySourceCommand(
            idempotency_key="verify-123",
            expected_version=3,
            outcome=SourceVerificationOutcome.VERIFIED,
            reason="Source identity and publication metadata were checked.",
        )


def test_information_request_keeps_visible_and_internal_copy_separate() -> None:
    command = RequestInformationCommand(
        idempotency_key="request-123",
        expected_version=4,
        requested_fields=["birth_date", "source page"],
        user_visible_message="Please provide a dated source page for the proposed birth date.",
        internal_note="Potential conflict with the current Archive record.",
    )

    assert command.user_visible_message.startswith("Please provide")
    assert command.internal_note == "Potential conflict with the current Archive record."
