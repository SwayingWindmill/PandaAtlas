from __future__ import annotations

import os
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.community_intake.journey_models import (
    AssertionDisposition,
    AssertionResultInput,
    ContributorCreateDraftCommand,
    ContributorStatus,
    ContributorSubmitCommand,
    ContributorUpdateDraftCommand,
    ContributorWithdrawCommand,
    ProjectContributorStatusCommand,
    RespondInformationRequestCommand,
    StructuredAssertionInput,
    StructuredClaimKind,
)
from app.community_intake.journey_repository import (
    ContributorJourneyRepository,
    submission_etag,
)
from app.community_intake.models import (
    PrepareAttachmentUploadCommand,
    SourceKind,
    SubmissionType,
    SubmittedSourceInput,
)
from app.community_intake.repository import CommunityIntakeConflictError
from app.community_intake.storage import OpaqueStorageReferenceSigner
from app.db.session import configure_database, session_scope
from app.identity.models import AccountState, RequestIdentity
from app.notification.models import NotificationCategory
from app.notification.repository import NotificationRepository


class RecordingStorage(OpaqueStorageReferenceSigner):
    def __init__(self) -> None:
        super().__init__(
            signing_key="contributor-journey-real-db-signing-key-1234567890",
            ttl_seconds=120,
        )
        self.uploads: list[tuple[str, str, str, int]] = []

    def upload_content(
        self,
        *,
        bucket: str,
        object_key: str,
        content: bytes,
        media_type: str,
    ) -> str:
        self.uploads.append((bucket, object_key, media_type, len(content)))
        return "storage-version-1"


@pytest.fixture(scope="module")
def real_db_url() -> Iterator[str]:
    if os.getenv("RUN_REAL_DB_TESTS") != "1":
        pytest.skip("Set RUN_REAL_DB_TESTS=1 to run contributor journey database tests")
    value = os.getenv("REAL_DB_URL") or os.getenv("DATABASE_URL")
    if not value:
        pytest.skip("Set REAL_DB_URL or DATABASE_URL")
    configure_database(value)
    try:
        yield value
    finally:
        configure_database(None)


@pytest.fixture(autouse=True)
def clean_contributor_journey(real_db_url: str) -> Iterator[None]:
    _ = real_db_url

    def clear() -> None:
        with session_scope() as session:
            assert session is not None
            session.execute(
                text(
                    """
                    truncate table
                      notification.inbox_state_events,
                      notification.inbox_items,
                      notification.intent_channels,
                      notification.intents,
                      notification.source_receipts,
                      notification.preference_events,
                      notification.preferences,
                      notification.audit_events,
                      community_intake.contributor_assertion_results,
                      community_intake.contributor_status_events,
                      community_intake.contributor_journey_events,
                      community_intake.sensitive_read_events,
                      community_intake.attachment_scan_events,
                      community_intake.submitted_sources,
                      community_intake.submission_revisions,
                      community_intake.retention_events,
                      community_intake.audit_events,
                      community_intake.attachments,
                      community_intake.submissions
                    cascade
                    """
                )
            )
            session.execute(
                text(
                    """
                    delete from integration.outbox_events
                    where source_context = 'community_intake'
                    """
                )
            )
            session.execute(text("delete from identity.accounts where email like 'journey-test-%'"))
            session.execute(text("delete from auth.users where email like 'journey-test-%'"))
            session.commit()

    clear()
    try:
        yield
    finally:
        clear()


def _identity(
    account_id: UUID,
    *,
    capabilities: frozenset[str] = frozenset(),
) -> RequestIdentity:
    now = datetime.now(UTC)
    return RequestIdentity(
        account_id=account_id,
        email=f"journey-test-{account_id}@example.invalid",
        session_id="contributor-journey-real-db",
        state=AccountState.ACTIVE,
        roles=frozenset(),
        capabilities=capabilities,
        authenticated_at=now,
        authentication_method="otp",
        issued_at=now,
        expires_at=now + timedelta(hours=1),
        assurance_level="aal1",
        recent_auth=True,
    )


def _insert_account(session: object, account_id: UUID) -> None:
    email = f"journey-test-{account_id}@example.invalid"
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


def _assertion(locator: str, attachment_id: UUID) -> StructuredAssertionInput:
    return StructuredAssertionInput(
        assertion_key="birth-date",
        kind=StructuredClaimKind.VITAL_EVENT,
        field_path="birth_date",
        proposed_value="2001-01-02",
        explanation="The institution profile and attached record show this date.",
        source_locators=[locator],
        attachment_ids=[attachment_id],
    )


def test_contributor_commands_status_projection_and_private_view(real_db_url: str) -> None:
    _ = real_db_url
    contributor_id = uuid4()
    reviewer_id = uuid4()
    storage = RecordingStorage()
    with session_scope() as session:
        assert session is not None
        _insert_account(session, contributor_id)
        _insert_account(session, reviewer_id)
        panda_id = UUID(
            str(session.execute(text("select id from public.pandas limit 1")).scalar_one())
        )
        session.commit()

        contributor = _identity(contributor_id)
        reviewer = _identity(
            reviewer_id,
            capabilities=frozenset({"community_intake.status.project"}),
        )
        repository = ContributorJourneyRepository(session, storage=storage)

        create = ContributorCreateDraftCommand(
            idempotency_key="journey-create-1",
            submission_type=SubmissionType.CORRECTION,
            target_id=str(panda_id),
            public_version_seen="release-1",
            locale="en",
        )
        created = repository.create_contributor_draft(
            contributor,
            create,
            correlation_id=uuid4(),
        )
        draft = created.submission
        assert draft.contributor_status is ContributorStatus.DRAFT
        assert draft.version == 1

        save = ContributorUpdateDraftCommand(
            idempotency_key="journey-save-1",
            expected_version=1,
            locale="en",
            public_version_seen="release-1",
            assertions=[],
            sources=[
                {
                    "source_kind": SourceKind.URL,
                    "title": "Draft institution source",
                    "locator": "https://example.invalid/draft-source",
                }
            ],
            additional_context="Draft notes may be incomplete.",
        )
        saved = repository.update_contributor_draft(
            contributor,
            draft.submission_id,
            save,
            if_match=submission_etag(draft.submission_id, 1),
            correlation_id=uuid4(),
        ).submission
        assert saved.version == 2
        assert saved.draft_content["sources"][0]["title"] == "Draft institution source"
        replayed_save = repository.update_contributor_draft(
            contributor,
            draft.submission_id,
            save,
            if_match=submission_etag(draft.submission_id, 1),
            correlation_id=uuid4(),
        ).submission
        assert replayed_save.version == 2

        evidence = b"%PDF-1.4 journey evidence"
        reservation_command = PrepareAttachmentUploadCommand(
            idempotency_key="journey-attachment-reserve-1",
            original_filename="evidence.pdf",
            media_type="application/pdf",
            byte_size=len(evidence),
        )
        reservation = repository.prepare_contributor_attachment(
            contributor,
            draft.submission_id,
            reservation_command,
            if_match=submission_etag(draft.submission_id, 2),
            correlation_id=uuid4(),
        )
        uploaded = repository.upload_contributor_attachment(
            contributor,
            reservation.attachment.attachment_id,
            idempotency_key="journey-attachment-upload-1",
            upload_reference=reservation.upload_reference.reference,
            original_filename="evidence.pdf",
            media_type="application/pdf",
            content=evidence,
            if_match=submission_etag(draft.submission_id, 2),
            correlation_id=uuid4(),
        )
        assert uploaded.state.value == "quarantined"
        assert storage.uploads[0][0] == "community-intake-private"

        locator = "https://example.invalid/panda-record"
        source = SubmittedSourceInput(
            source_kind=SourceKind.URL,
            title="Institution profile",
            locator=locator,
        )
        submit = ContributorSubmitCommand(
            idempotency_key="journey-submit-1",
            expected_version=2,
            locale="en",
            public_version_seen="release-1",
            assertions=[_assertion(locator, uploaded.attachment_id)],
            sources=[source],
            confirmation=True,
        )
        submitted_result = repository.submit_contributor(
            contributor,
            draft.submission_id,
            submit,
            if_match=submission_etag(draft.submission_id, 2),
            correlation_id=uuid4(),
            responding=False,
        )
        submitted = submitted_result.submission
        assert submitted_result.inline_confirmation is True
        assert submitted_result.notification_created is False
        assert submitted.version == 3
        assert submitted.latest_revision_number == 1
        assert submitted.contributor_status is ContributorStatus.SUBMITTED

        replayed_submit = repository.submit_contributor(
            contributor,
            draft.submission_id,
            submit,
            if_match=submission_etag(draft.submission_id, 1),
            correlation_id=uuid4(),
            responding=False,
        )
        assert replayed_submit.submission.version == 3

        action_required = repository.project_contributor_status(
            reviewer,
            draft.submission_id,
            ProjectContributorStatusCommand(
                idempotency_key="journey-status-action-1",
                expected_version=3,
                status=ContributorStatus.ACTION_REQUIRED,
                active_revision_number=1,
                user_visible_reason="Please explain how the date maps to the public record.",
                action_required_fields=["assertions.birth-date.explanation"],
                source_context="review",
            ),
            correlation_id=uuid4(),
        )
        assert action_required.version == 4
        request_event_id = action_required.status_history[-1].status_event_id

        response = RespondInformationRequestCommand(
            idempotency_key="journey-response-1",
            expected_version=4,
            request_status_event_id=request_event_id,
            locale="en",
            public_version_seen="release-1",
            assertions=[_assertion(locator, uploaded.attachment_id)],
            sources=[source],
            additional_context="The source labels the field as date of birth.",
            confirmation=True,
        )
        responded = repository.submit_contributor(
            contributor,
            draft.submission_id,
            response,
            if_match=submission_etag(draft.submission_id, 4),
            correlation_id=uuid4(),
            responding=True,
        ).submission
        assert responded.version == 5
        assert responded.latest_revision_number == 2
        assert responded.contributor_status is ContributorStatus.SUBMITTED

        accepted = repository.project_contributor_status(
            reviewer,
            draft.submission_id,
            ProjectContributorStatusCommand(
                idempotency_key="journey-status-accepted-1",
                expected_version=5,
                status=ContributorStatus.ACCEPTED,
                active_revision_number=2,
                user_visible_reason="The contribution is supported and accepted for curation.",
                source_context="review",
                assertion_results=[
                    AssertionResultInput(
                        assertion_key="birth-date",
                        disposition=AssertionDisposition.SELECTED,
                        explanation="Selected for a curation change set.",
                    )
                ],
            ),
            correlation_id=uuid4(),
        )
        assert accepted.version == 6

        incorporating = repository.project_contributor_status(
            reviewer,
            draft.submission_id,
            ProjectContributorStatusCommand(
                idempotency_key="journey-status-incorporating-1",
                expected_version=6,
                status=ContributorStatus.INCORPORATION_IN_PROGRESS,
                active_revision_number=2,
                user_visible_reason="Selected assertions are moving through curation.",
                source_context="curation",
            ),
            correlation_id=uuid4(),
        )
        assert incorporating.version == 7
        with pytest.raises(CommunityIntakeConflictError, match="incorporation starts"):
            repository.withdraw_contributor(
                contributor,
                draft.submission_id,
                ContributorWithdrawCommand(
                    idempotency_key="journey-withdraw-late-1",
                    expected_version=7,
                    locale="en",
                    reason="Changed my mind after curation started.",
                ),
                if_match=submission_etag(draft.submission_id, 7),
                correlation_id=uuid4(),
            )
        session.rollback()

        partial = repository.project_contributor_status(
            reviewer,
            draft.submission_id,
            ProjectContributorStatusCommand(
                idempotency_key="journey-status-partial-1",
                expected_version=7,
                status=ContributorStatus.INCORPORATED_PARTIAL,
                active_revision_number=2,
                user_visible_reason="The date was incorporated with year-level precision.",
                source_context="projection",
                assertion_results=[
                    AssertionResultInput(
                        assertion_key="birth-date",
                        disposition=AssertionDisposition.INCORPORATED,
                        explanation="The public record now reflects the supported precision.",
                        public_reference_id="public-fact:birth-date",
                    )
                ],
            ),
            correlation_id=uuid4(),
        )
        assert partial.version == 8
        assert partial.contributor_status is ContributorStatus.INCORPORATED_PARTIAL
        assert partial.assertion_results[-1].public_reference_id == "public-fact:birth-date"

        visible = partial.model_dump(mode="json")
        assert "account_id" not in visible
        assert "contributor_subject_hash" not in visible
        assert "actor_subject_hash" not in visible
        assert "source_context" not in visible["status_history"][-1]

        listing = repository.list_contributor_submissions(contributor)
        assert [item.submission_id for item in listing.items] == [draft.submission_id]
        analytics = repository.contributor_analytics(contributor)
        assert analytics.total == 1
        assert analytics.open_count == 0

        outbox = (
            session.execute(
                text(
                    """
                select event_id, event_type, payload
                from integration.outbox_events
                where source_context = 'community_intake'
                order by occurred_at, event_id
                """
                )
            )
            .mappings()
            .all()
        )
        formal = next(
            row for row in outbox if row["event_type"] == "community.submission.submitted"
        )
        assert formal["payload"]["notify_contributor"] is False
        assert formal["payload"]["inline_confirmation"] is True
        status_events = [
            row
            for row in outbox
            if row["event_type"] == "community.submission.contributor_status_changed"
        ]
        assert status_events[-1]["payload"]["notify_contributor"] is True
        assert status_events[-1]["payload"]["notification_link"] == (
            f"/me/submissions/{draft.submission_id}"
        )

        notification = NotificationRepository(
            session, cursor_signing_key="contributor-journey-notification-signing-key"
        )
        projected = notification.project_outbox_event(status_events[-1]["event_id"])
        assert projected["outcome"] == "created"
        assert projected["intent_count"] == 1
        inbox = notification.list_inbox(contributor, page_size=10, cursor=None)
        assert inbox.unread_count == 1
        assert inbox.items[0].category is NotificationCategory.INCORPORATION
        assert inbox.items[0].body["payload"]["notification_link"] == (
            f"/me/submissions/{draft.submission_id}"
        )
        assert "account_id" not in inbox.items[0].body["payload"]

        with pytest.raises(DBAPIError):
            session.execute(
                text(
                    """
                    update community_intake.contributor_status_events
                    set user_visible_reason = 'tampered'
                    where status_event_id = :status_event_id
                    """
                ),
                {"status_event_id": request_event_id},
            )
            session.commit()
        session.rollback()
