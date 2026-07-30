from __future__ import annotations

from uuid import uuid4

import pytest

from app.community_intake.journey_models import (
    AssertionDisposition,
    AssertionResultInput,
    ContributorStatus,
    ContributorSubmitCommand,
    ContributorUpdateDraftCommand,
    ProjectContributorStatusCommand,
    StructuredAssertionInput,
    StructuredClaimKind,
)
from app.community_intake.journey_repository import submission_etag
from app.community_intake.models import SourceKind, SubmittedSourceInput


def _assertion(
    *, source_locator: str = "https://example.invalid/source"
) -> StructuredAssertionInput:
    return StructuredAssertionInput(
        assertion_key="birth-date",
        kind=StructuredClaimKind.VITAL_EVENT,
        field_path="birth_date",
        proposed_value="2001-01-02",
        explanation="The institution record gives a different birth date.",
        source_locators=[source_locator],
    )


def test_structured_assertion_requires_nonempty_proposed_value() -> None:
    with pytest.raises(ValueError, match="proposed value must not be empty"):
        StructuredAssertionInput(
            assertion_key="name",
            kind=StructuredClaimKind.IDENTITY_NAME,
            field_path="name_zh",
            proposed_value="   ",
            explanation="The official profile uses this exact Chinese name.",
            source_locators=["https://example.invalid/source"],
        )


def test_structured_assertion_requires_claim_level_evidence() -> None:
    with pytest.raises(ValueError, match="requires a source or attachment"):
        StructuredAssertionInput(
            assertion_key="name",
            kind=StructuredClaimKind.IDENTITY_NAME,
            field_path="name_zh",
            proposed_value="测试",
            explanation="The official profile uses this exact Chinese name.",
        )


def test_draft_sources_remain_permissive_and_string_shaped() -> None:
    command = ContributorUpdateDraftCommand(
        idempotency_key="draft-source-1",
        expected_version=1,
        locale="en",
        public_version_seen="release-1",
        sources=[
            {
                "source_kind": SourceKind.URL,
                "title": "   ",
                "locator": "   ",
                "publisher": "   ",
            }
        ],
    )

    assert command.sources[0].title == ""
    assert command.sources[0].locator == ""
    assert command.sources[0].publisher is None


def test_formal_submit_binds_assertions_to_included_sources_and_confirmation() -> None:
    locator = "https://example.invalid/source"
    command = ContributorSubmitCommand(
        idempotency_key="formal-submit-1",
        expected_version=2,
        locale="en",
        public_version_seen="release-1",
        assertions=[_assertion(source_locator=locator)],
        sources=[
            SubmittedSourceInput(
                source_kind=SourceKind.URL,
                title="Institution profile",
                locator=locator,
            )
        ],
        confirmation=True,
    )
    assert command.confirmation is True

    with pytest.raises(ValueError, match="included in sources"):
        ContributorSubmitCommand(
            idempotency_key="formal-submit-2",
            expected_version=2,
            locale="en",
            public_version_seen="release-1",
            assertions=[_assertion(source_locator="https://example.invalid/omitted")],
            sources=[
                SubmittedSourceInput(
                    source_kind=SourceKind.URL,
                    title="Different source",
                    locator=locator,
                )
            ],
            confirmation=True,
        )


def test_status_projection_requires_visible_action_request_and_valid_origin() -> None:
    with pytest.raises(ValueError, match="visible reason"):
        ProjectContributorStatusCommand(
            idempotency_key="status-action-1",
            expected_version=3,
            status=ContributorStatus.ACTION_REQUIRED,
            active_revision_number=1,
            source_context="review",
        )

    result = AssertionResultInput(
        assertion_key="birth-date",
        disposition=AssertionDisposition.NOT_SELECTED,
        explanation="The source does not support the proposed day.",
    )
    command = ProjectContributorStatusCommand(
        idempotency_key="status-partial-1",
        expected_version=4,
        status=ContributorStatus.INCORPORATED_PARTIAL,
        active_revision_number=1,
        source_context="projection",
        user_visible_reason="One assertion was incorporated and one was not.",
        assertion_results=[result],
    )
    assert command.source_context == "projection"


def test_submission_etag_is_stable_and_resource_scoped() -> None:
    submission_id = uuid4()
    assert submission_etag(submission_id, 7) == f'"submission:{submission_id}:v7"'
    assert submission_etag(submission_id, 8) != submission_etag(submission_id, 7)
