from __future__ import annotations

import hashlib
import json
import os
from collections.abc import Iterator
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import text

from app.core.config import settings
from app.db.session import configure_database, session_scope
from app.review_moderation.models import (
    ClaimReviewCaseCommand,
    DecideReviewCaseCommand,
    IntakeReviewCaseCommand,
    RecommendAssertionsCommand,
    ReopenReviewCaseCommand,
    ReviewDecisionOutcome,
    SourceVerificationOutcome,
    VerifySourceCommand,
)
from app.review_moderation.service import (
    claim_review_case,
    decide_review_case,
    intake_submission,
    recommend_assertions,
    reopen_review_case,
    verify_source,
)


@pytest.fixture(scope="module")
def real_db_url() -> Iterator[str]:
    if os.getenv("RUN_REAL_DB_TESTS") != "1":
        pytest.skip("Set RUN_REAL_DB_TESTS=1 to run Review & Moderation database tests")
    value = os.getenv("REAL_DB_URL") or os.getenv("DATABASE_URL")
    if not value:
        pytest.skip("Set REAL_DB_URL or DATABASE_URL")
    configure_database(value)
    try:
        yield value
    finally:
        configure_database(None)


@pytest.fixture(autouse=True)
def clean_review_data(real_db_url: str, monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    _ = real_db_url
    monkeypatch.setattr(settings, "review_moderation_enabled", True)

    def clear() -> None:
        with session_scope() as session:
            assert session is not None
            session.execute(
                text(
                    """
                    truncate table
                      review_moderation.command_receipts,
                      review_moderation.audit_events,
                      review_moderation.curation_recommendations,
                      review_moderation.decisions,
                      review_moderation.source_verifications,
                      review_moderation.information_requests,
                      review_moderation.review_cases,
                      community_intake.contributor_assertion_results,
                      community_intake.contributor_status_events,
                      community_intake.contributor_journey_events,
                      community_intake.sensitive_read_events,
                      community_intake.attachment_scan_events,
                      community_intake.submitted_sources,
                      community_intake.attachments,
                      community_intake.submission_revisions,
                      community_intake.retention_events,
                      community_intake.audit_events,
                      community_intake.submissions
                    cascade
                    """
                )
            )
            session.execute(text("delete from identity.accounts where email like 'review-test-%'"))
            session.execute(text("delete from auth.users where email like 'review-test-%'"))
            session.commit()

    clear()
    try:
        yield
    finally:
        clear()


def _insert_account(session: object, account_id: UUID) -> None:
    email = f"review-test-{account_id}@example.invalid"
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


def _insert_submission(session: object, contributor_id: UUID, suffix: str) -> tuple[UUID, UUID]:
    submission_id = uuid4()
    source_id = uuid4()
    subject_hash = hashlib.sha256(str(contributor_id).encode("utf-8")).hexdigest()
    locator = f"https://example.invalid/source/{suffix}"
    content = {
        "assertions": [
            {
                "assertion_key": "birth-date",
                "kind": "vital_event",
                "field_path": "birth.date",
                "proposed_value": "2020-01-02",
                "explanation": "The dated institutional source supports this correction.",
                "source_locators": [locator],
                "attachment_ids": [],
            }
        ],
        "sources": [
            {
                "source_kind": "url",
                "title": "Institutional record",
                "locator": locator,
            }
        ],
    }
    session.execute(
        text(
            """
            insert into community_intake.submissions (
              submission_id, account_id, contributor_subject_hash, submission_type,
              target_type, target_id, public_version_seen, state, draft_content,
              version, latest_revision_number, submitted_at, contributor_status
            ) values (
              :submission_id, :account_id, :subject_hash, 'correction', 'panda',
              :target_id, 'public-v1', 'submitted', '{}'::jsonb, 2, 1, now(), 'submitted'
            )
            """
        ),
        {
            "submission_id": submission_id,
            "account_id": contributor_id,
            "subject_hash": subject_hash,
            "target_id": f"panda-{suffix}",
        },
    )
    session.execute(
        text(
            """
            insert into community_intake.submission_revisions (
              submission_id, revision_number, content, content_sha256,
              public_version_seen, submitted_at
            ) values (
              :submission_id, 1, cast(:content as jsonb), :content_sha256,
              'public-v1', now()
            )
            """
        ),
        {
            "submission_id": submission_id,
            "content": json.dumps(content),
            "content_sha256": hashlib.sha256(
                json.dumps(content, sort_keys=True).encode("utf-8")
            ).hexdigest(),
        },
    )
    session.execute(
        text(
            """
            insert into community_intake.submitted_sources (
              source_id, submission_id, revision_number, source_kind, title,
              locator, normalized_locator_hash
            ) values (
              :source_id, :submission_id, 1, 'url', 'Institutional record',
              :locator, :locator_hash
            )
            """
        ),
        {
            "source_id": source_id,
            "submission_id": submission_id,
            "locator": locator,
            "locator_hash": hashlib.sha256(locator.encode("utf-8")).hexdigest(),
        },
    )
    return submission_id, source_id


def test_review_case_journey_enforces_conflict_evidence_and_append_only_reopen(
    real_db_url: str,
) -> None:
    _ = real_db_url
    contributor_id = uuid4()
    reviewer_id = uuid4()
    with session_scope() as session:
        assert session is not None
        _insert_account(session, contributor_id)
        _insert_account(session, reviewer_id)
        submission_id, source_id = _insert_submission(session, contributor_id, "accepted")
        closed_submission_id, _ = _insert_submission(session, contributor_id, "closed")
        session.commit()

    with pytest.raises(HTTPException) as self_review:
        intake_submission(
            submission_id,
            IntakeReviewCaseCommand(idempotency_key="self-intake-accepted"),
            contributor_id,
        )
    assert self_review.value.status_code == 403

    review_case = intake_submission(
        submission_id,
        IntakeReviewCaseCommand(idempotency_key="intake-accepted-case"),
        reviewer_id,
    )
    claimed = claim_review_case(
        review_case.review_case_id,
        ClaimReviewCaseCommand(
            idempotency_key="claim-accepted-case",
            expected_version=review_case.version,
        ),
        reviewer_id,
    )
    replayed = claim_review_case(
        review_case.review_case_id,
        ClaimReviewCaseCommand(
            idempotency_key="claim-accepted-case",
            expected_version=1,
        ),
        reviewer_id,
    )
    assert replayed.review_case_id == claimed.review_case_id
    assert replayed.version == claimed.version

    with pytest.raises(HTTPException) as not_ready:
        decide_review_case(
            review_case.review_case_id,
            DecideReviewCaseCommand(
                idempotency_key="decision-before-evidence",
                expected_version=claimed.version,
                outcome=ReviewDecisionOutcome.ACCEPTED,
                user_visible_explanation=(
                    "The contribution is accepted after evidence review and source normalization."
                ),
                selected_assertion_keys=["birth-date"],
            ),
            reviewer_id,
        )
    assert not_ready.value.status_code == 409

    verified = verify_source(
        review_case.review_case_id,
        source_id,
        VerifySourceCommand(
            idempotency_key="verify-accepted-source",
            expected_version=claimed.version,
            outcome=SourceVerificationOutcome.VERIFIED,
            normalized_locator="https://example.invalid/source/accepted",
            canonical_source_id="trusted-source-accepted",
            reason="Institutional source identity and locator verified.",
        ),
        reviewer_id,
    )
    assert verified.state.value == "decision_ready"

    decided = decide_review_case(
        review_case.review_case_id,
        DecideReviewCaseCommand(
            idempotency_key="decision-accepted-case",
            expected_version=verified.version,
            outcome=ReviewDecisionOutcome.ACCEPTED,
            user_visible_explanation=(
                "The contribution is accepted because the active revision is supported by a verified source."
            ),
            internal_reason="No conflict or unresolved evidence remains.",
            selected_assertion_keys=["birth-date"],
        ),
        reviewer_id,
    )
    recommended = recommend_assertions(
        review_case.review_case_id,
        RecommendAssertionsCommand(
            idempotency_key="recommend-accepted-case",
            expected_version=decided.version,
            reason="The selected birth-date assertion is ready for Curation intake.",
        ),
        reviewer_id,
    )
    assert recommended.state.value == "incorporation_recommended"

    closed_case = intake_submission(
        closed_submission_id,
        IntakeReviewCaseCommand(idempotency_key="intake-closed-case"),
        reviewer_id,
    )
    closed_claim = claim_review_case(
        closed_case.review_case_id,
        ClaimReviewCaseCommand(
            idempotency_key="claim-closed-case",
            expected_version=closed_case.version,
        ),
        reviewer_id,
    )
    closed = decide_review_case(
        closed_case.review_case_id,
        DecideReviewCaseCommand(
            idempotency_key="decision-closed-case",
            expected_version=closed_claim.version,
            outcome=ReviewDecisionOutcome.NOT_ACCEPTED,
            user_visible_explanation=(
                "The contribution is not accepted because the supplied evidence is insufficient."
            ),
            internal_reason="Source verification was not completed.",
        ),
        reviewer_id,
    )
    assert closed.state.value == "closed"
    reopened = reopen_review_case(
        closed.review_case_id,
        ReopenReviewCaseCommand(
            idempotency_key="reopen-closed-case",
            reason="New evidence requires a new independent review record.",
        ),
        reviewer_id,
    )
    assert reopened.review_case_id != closed.review_case_id
    assert reopened.reopened_from_review_case_id == closed.review_case_id

    with session_scope() as session:
        assert session is not None
        denied_audit = session.execute(
            text(
                """
                select count(*)
                from review_moderation.audit_events
                where submission_id = :submission_id
                  and actor_account_id = :actor_id
                  and event_type = 'review.case.intake_denied'
                  and outcome = 'denied'
                """
            ),
            {"submission_id": submission_id, "actor_id": contributor_id},
        ).scalar_one()
        contributor_status = session.execute(
            text(
                """
                select contributor_status::text
                from community_intake.submissions
                where submission_id = :submission_id
                """
            ),
            {"submission_id": submission_id},
        ).scalar_one()
        selected_result = session.execute(
            text(
                """
                select disposition::text
                from community_intake.contributor_assertion_results
                where submission_id = :submission_id and assertion_key = 'birth-date'
                order by created_at desc
                limit 1
                """
            ),
            {"submission_id": submission_id},
        ).scalar_one()
    assert denied_audit == 1
    assert contributor_status == "accepted"
    assert selected_result == "selected"
