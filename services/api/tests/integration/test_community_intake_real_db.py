from __future__ import annotations

import json
import os
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.community_intake.models import (
    AttachmentAccessCommand,
    AttachmentScanCommand,
    AttachmentState,
    CloseUnincorporatedCommand,
    CompleteAttachmentUploadCommand,
    CreateDraftCommand,
    PrepareAttachmentUploadCommand,
    SourceKind,
    SubmissionState,
    SubmissionType,
    SubmitRevisionCommand,
    SubmittedSourceInput,
    UpdateDraftCommand,
)
from app.community_intake.repository import (
    CommunityIntakeConflictError,
    CommunityIntakeForbiddenError,
    CommunityIntakeRepository,
    default_storage,
)
from app.community_intake.storage import OpaqueStorageReferenceSigner
from app.db.session import configure_database, session_scope
from app.engagement.repository import EngagementRepository
from app.identity.models import AccountState, RequestIdentity


@pytest.fixture(scope="module")
def real_db_url() -> Iterator[str]:
    if os.getenv("RUN_REAL_DB_TESTS") != "1":
        pytest.skip("Set RUN_REAL_DB_TESTS=1 to run Community Intake database tests")
    value = os.getenv("REAL_DB_URL") or os.getenv("DATABASE_URL")
    if not value:
        pytest.skip("Set REAL_DB_URL or DATABASE_URL")
    configure_database(value)
    try:
        yield value
    finally:
        configure_database(None)


@pytest.fixture(autouse=True)
def clean_community_state(real_db_url: str) -> Iterator[None]:
    _ = real_db_url

    def clear() -> None:
        with session_scope() as session:
            assert session is not None
            session.execute(
                text(
                    """
                    truncate table
                      community_intake.sensitive_read_events,
                      community_intake.attachment_scan_events,
                      community_intake.submitted_sources,
                      community_intake.submission_revisions,
                      community_intake.retention_events,
                      community_intake.audit_events,
                      community_intake.attachments,
                      community_intake.submissions,
                      engagement.audit_events
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
            session.execute(
                text("delete from identity.accounts where email like 'community-test-%'")
            )
            session.execute(
                text("delete from auth.users where email like 'community-test-%'")
            )
            session.commit()

    clear()
    try:
        yield
    finally:
        clear()


def _identity(
    account_id: UUID,
    *,
    state: AccountState = AccountState.ACTIVE,
    capabilities: frozenset[str] = frozenset(),
) -> RequestIdentity:
    now = datetime.now(UTC)
    return RequestIdentity(
        account_id=account_id,
        email=f"community-test-{account_id}@example.invalid",
        session_id="community-intake-real-db",
        state=state,
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
    email = f"community-test-{account_id}@example.invalid"
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


def _repository(session: object) -> CommunityIntakeRepository:
    return CommunityIntakeRepository(
        session,
        storage=default_storage(
            "community-intake-real-db-signing-key-1234567890",
            120,
        ),
    )


def test_community_intake_persistence_and_private_evidence(real_db_url: str) -> None:
    _ = real_db_url
    contributor_id = uuid4()
    scanner_id = uuid4()
    reviewer_id = uuid4()
    with session_scope() as session:
        assert session is not None
        _insert_account(session, contributor_id)
        _insert_account(session, scanner_id)
        _insert_account(session, reviewer_id)
        panda_id = UUID(
            str(
                session.execute(
                    text("select id from public.pandas limit 1")
                ).scalar_one()
            )
        )
        session.commit()

        contributor = _identity(contributor_id)
        scanner = _identity(
            scanner_id,
            capabilities=frozenset({"community_intake.scan.record"}),
        )
        reviewer = _identity(
            reviewer_id,
            capabilities=frozenset(
                {
                    "community_intake.evidence.read",
                    "community_intake.retention.manage",
                }
            ),
        )
        repository = _repository(session)

        create = CreateDraftCommand(
            idempotency_key="draft-create",
            submission_type=SubmissionType.CORRECTION,
            target_id=str(panda_id),
            public_version_seen="release-2026-07-30",
            draft_content={"field": "birth_date", "proposed": "2000-01-01"},
        )
        draft = repository.create_draft(contributor, create, correlation_id=uuid4())
        replay = repository.create_draft(contributor, create, correlation_id=uuid4())
        assert replay.submission_id == draft.submission_id
        assert draft.state is SubmissionState.DRAFT
        with pytest.raises(CommunityIntakeConflictError):
            repository.create_draft(
                contributor,
                create.model_copy(update={"target_id": str(uuid4())}),
                correlation_id=uuid4(),
            )
        session.rollback()

        updated = repository.update_draft(
            contributor,
            draft.submission_id,
            UpdateDraftCommand(
                idempotency_key="draft-update",
                expected_version=1,
                draft_content={"field": "birth_date", "proposed": "2001-01-01"},
            ),
            correlation_id=uuid4(),
        )
        assert updated.version == 2

        upload = repository.prepare_attachment_upload(
            contributor,
            draft.submission_id,
            PrepareAttachmentUploadCommand(
                idempotency_key="upload-reserve",
                original_filename="phone-location-photo.jpg",
                media_type="image/jpeg",
                byte_size=1024,
            ),
            correlation_id=uuid4(),
        )
        upload_replay = repository.prepare_attachment_upload(
            contributor,
            draft.submission_id,
            PrepareAttachmentUploadCommand(
                idempotency_key="upload-reserve",
                original_filename="phone-location-photo.jpg",
                media_type="image/jpeg",
                byte_size=1024,
            ),
            correlation_id=uuid4(),
        )
        assert upload_replay.attachment.attachment_id == upload.attachment.attachment_id
        signer = repository.storage
        assert isinstance(signer, OpaqueStorageReferenceSigner)
        upload_payload = signer.verify(
            upload.upload_reference.reference,
            expected_action="upload",
        )
        assert upload_payload["attachment_id"] == str(upload.attachment.attachment_id)
        assert "object_key" not in upload_payload

        with pytest.raises(CommunityIntakeConflictError):
            repository.complete_attachment_upload(
                contributor,
                upload.attachment.attachment_id,
                CompleteAttachmentUploadCommand(
                    idempotency_key="upload-complete-invalid",
                    upload_reference=upload.upload_reference.reference + "x",
                    object_version="version-1",
                    content_sha256="a" * 64,
                ),
                correlation_id=uuid4(),
            )
        completed = repository.complete_attachment_upload(
            contributor,
            upload.attachment.attachment_id,
            CompleteAttachmentUploadCommand(
                idempotency_key="upload-complete",
                upload_reference=upload.upload_reference.reference,
                object_version="version-1",
                content_sha256="a" * 64,
            ),
            correlation_id=uuid4(),
        )
        assert completed.state is AttachmentState.QUARANTINED
        with pytest.raises(CommunityIntakeForbiddenError):
            repository.create_attachment_access(
                reviewer,
                completed.attachment_id,
                AttachmentAccessCommand(purpose="review submitted evidence", preview=True),
                correlation_id=uuid4(),
            )

        submitted = repository.submit_revision(
            contributor,
            draft.submission_id,
            SubmitRevisionCommand(
                idempotency_key="submit-revision-1",
                expected_version=2,
                content={"field": "birth_date", "proposed": "2001-01-01"},
                public_version_seen="release-2026-07-30",
                sources=[
                    SubmittedSourceInput(
                        source_kind=SourceKind.URL,
                        title="Institution record",
                        locator="https://example.invalid/panda-record",
                        publisher="Example Institution",
                    )
                ],
            ),
            correlation_id=uuid4(),
        )
        assert submitted.state is SubmissionState.SUBMITTED
        assert submitted.latest_revision_number == 1
        assert submitted.attachments[0].bound_revision_number == 1
        with pytest.raises(DBAPIError):
            session.execute(
                text(
                    """
                    update community_intake.submission_revisions
                    set content = cast(:content as jsonb)
                    where submission_id = :submission_id and revision_number = 1
                    """
                ),
                {
                    "submission_id": submitted.submission_id,
                    "content": '{"tampered":true}',
                },
            )
            session.commit()
        session.rollback()

        clean = repository.record_scan_result(
            scanner,
            completed.attachment_id,
            AttachmentScanCommand(
                idempotency_key="scan-clean",
                outcome=AttachmentState.CLEAN,
                scanner_name="test-scanner",
                scanner_version="1.0",
                result_code="clean",
                metadata_stripped=True,
                preview_object_key="previews/opaque-test-preview",
            ),
            correlation_id=uuid4(),
        )
        assert clean.state is AttachmentState.CLEAN
        with pytest.raises(CommunityIntakeForbiddenError):
            repository.create_attachment_access(
                contributor,
                clean.attachment_id,
                AttachmentAccessCommand(purpose="attempt staff evidence read"),
                correlation_id=uuid4(),
            )
        reference = repository.create_attachment_access(
            reviewer,
            clean.attachment_id,
            AttachmentAccessCommand(purpose="verify submitted evidence", preview=True),
            correlation_id=uuid4(),
        )
        access_payload = signer.verify(reference.reference, expected_action="download")
        assert access_payload["attachment_id"] == str(clean.attachment_id)
        assert access_payload["preview"] is True
        assert "object_key" not in access_payload

        revised = repository.submit_revision(
            contributor,
            draft.submission_id,
            SubmitRevisionCommand(
                idempotency_key="submit-revision-2",
                expected_version=3,
                content={"field": "birth_date", "proposed": "2001-01-02"},
                public_version_seen="release-2026-07-31",
                sources=[
                    SubmittedSourceInput(
                        source_kind=SourceKind.PUBLICATION,
                        title="Published correction",
                        locator="doi:10.0000/example",
                    )
                ],
            ),
            correlation_id=uuid4(),
        )
        assert [revision.revision_number for revision in revised.revisions] == [1, 2]

        limit_draft = repository.create_draft(
            contributor,
            CreateDraftCommand(
                idempotency_key="limit-draft",
                submission_type=SubmissionType.SOURCED_INFORMATION,
                target_id=str(panda_id),
                public_version_seen="release-limits",
            ),
            correlation_id=uuid4(),
        )
        for index in range(5):
            repository.prepare_attachment_upload(
                contributor,
                limit_draft.submission_id,
                PrepareAttachmentUploadCommand(
                    idempotency_key=f"limit-upload-{index}",
                    original_filename=f"evidence-{index}.pdf",
                    media_type="application/pdf",
                    byte_size=1024,
                ),
                correlation_id=uuid4(),
            )
        with pytest.raises(CommunityIntakeConflictError):
            repository.prepare_attachment_upload(
                contributor,
                limit_draft.submission_id,
                PrepareAttachmentUploadCommand(
                    idempotency_key="limit-upload-six",
                    original_filename="evidence-six.pdf",
                    media_type="application/pdf",
                    byte_size=1024,
                ),
                correlation_id=uuid4(),
            )
        session.rollback()

        expiry_draft = repository.create_draft(
            contributor,
            CreateDraftCommand(
                idempotency_key="expiry-draft",
                submission_type=SubmissionType.CORRECTION,
                target_id=str(panda_id),
                public_version_seen="release-expiry",
                draft_content={"private_note": "remove after expiry"},
            ),
            correlation_id=uuid4(),
        )
        session.execute(
            text(
                """
                update community_intake.submissions
                set expires_at = now() - interval '1 second'
                where submission_id = :submission_id
                """
            ),
            {"submission_id": expiry_draft.submission_id},
        )
        session.commit()
        retention = repository.expire_and_repair(correlation_id=uuid4())
        assert retention.expired_drafts == 1
        expired = session.execute(
            text(
                """
                select state::text, draft_content
                from community_intake.submissions
                where submission_id = :submission_id
                """
            ),
            {"submission_id": expiry_draft.submission_id},
        ).mappings().one()
        assert expired["state"] == "expired"
        assert expired["draft_content"] == {}

        metrics = repository.metrics()
        assert metrics.submitted_count == 1
        assert metrics.clean_count == 1
        assert metrics.sensitive_reads_granted == 1
        assert metrics.sensitive_reads_denied == 2

        retry_draft = repository.create_draft(
            contributor,
            CreateDraftCommand(
                idempotency_key="retry-draft",
                submission_type=SubmissionType.SOURCED_INFORMATION,
                target_id=str(panda_id),
                public_version_seen="release-retry",
            ),
            correlation_id=uuid4(),
        )
        retry_upload = repository.prepare_attachment_upload(
            contributor,
            retry_draft.submission_id,
            PrepareAttachmentUploadCommand(
                idempotency_key="retry-upload",
                original_filename="retry.pdf",
                media_type="application/pdf",
                byte_size=2048,
            ),
            correlation_id=uuid4(),
        )
        repository.complete_attachment_upload(
            contributor,
            retry_upload.attachment.attachment_id,
            CompleteAttachmentUploadCommand(
                idempotency_key="retry-upload-complete",
                upload_reference=retry_upload.upload_reference.reference,
                object_version="retry-version-1",
                content_sha256="b" * 64,
            ),
            correlation_id=uuid4(),
        )
        repository.record_scan_result(
            scanner,
            retry_upload.attachment.attachment_id,
            AttachmentScanCommand(
                idempotency_key="retry-scan-failed",
                outcome=AttachmentState.SCAN_FAILED,
                scanner_name="test-scanner",
                scanner_version="1.0",
                result_code="temporary_failure",
            ),
            correlation_id=uuid4(),
        )
        session.execute(
            text(
                """
                update community_intake.attachments
                set last_scanned_at = now() - interval '16 minutes'
                where attachment_id = :attachment_id
                """
            ),
            {"attachment_id": retry_upload.attachment.attachment_id},
        )
        session.commit()

        close_command = CloseUnincorporatedCommand(
            idempotency_key="close-unincorporated",
            expected_version=revised.version,
            reason="review concluded without incorporation",
            retention_days=1,
        )
        closed = repository.close_unincorporated(
            reviewer,
            revised.submission_id,
            close_command,
            correlation_id=uuid4(),
        )
        close_replay = repository.close_unincorporated(
            reviewer,
            revised.submission_id,
            close_command,
            correlation_id=uuid4(),
        )
        assert closed.state is SubmissionState.CLOSED
        assert close_replay.version == closed.version
        session.execute(
            text(
                """
                update community_intake.submissions
                set retention_due_at = now() - interval '1 second'
                where submission_id = :submission_id
                """
            ),
            {"submission_id": revised.submission_id},
        )
        session.commit()
        followup_retention = repository.expire_and_repair(correlation_id=uuid4())
        assert followup_retention.closed_submissions_processed == 1
        assert followup_retention.scan_retries == 1
        assert session.execute(
            text(
                """
                select count(*) from community_intake.submission_revisions
                where submission_id = :submission_id
                """
            ),
            {"submission_id": revised.submission_id},
        ).scalar_one() == 2
        retained_attachment = session.execute(
            text(
                """
                select state::text, original_filename
                from community_intake.attachments
                where attachment_id = :attachment_id
                """
            ),
            {"attachment_id": clean.attachment_id},
        ).mappings().one()
        assert retained_attachment["state"] == "deleted"
        assert retained_attachment["original_filename"] == "[deleted]"
        assert session.execute(
            text(
                """
                select state::text from community_intake.attachments
                where attachment_id = :attachment_id
                """
            ),
            {"attachment_id": retry_upload.attachment.attachment_id},
        ).scalar_one() == "quarantined"

        outbox_rows = session.execute(
            text(
                """
                select event_type, payload from integration.outbox_events
                where source_context = 'community_intake'
                """
            )
        ).mappings().all()
        payload_text = json.dumps([dict(row) for row in outbox_rows], default=str)
        event_types = {str(row["event_type"]) for row in outbox_rows}
        assert "subjects/" not in payload_text
        assert "phone-location-photo.jpg" not in payload_text
        assert "private_note" not in payload_text
        assert "community.attachment.scan_retry_requested" in event_types
        assert "community.attachment.deletion_requested" in event_types
        assert "community.submission.closed_unincorporated" in event_types

        session.execute(
            text("update identity.accounts set state = 'deleting' where account_id = :account_id"),
            {"account_id": contributor_id},
        )
        session.commit()
        deletion = EngagementRepository(session).delete_private_data(
            identity=_identity(contributor_id, state=AccountState.DELETING),
            idempotency_key="community-private-delete",
            reason="account deletion request",
            correlation_id=uuid4(),
        )
        assert deletion["community_submissions_anonymized"] == 4
        assert deletion["community_attachments_deleted"] == 7
        anonymized = session.execute(
            text(
                """
                select account_id, draft_content, anonymized_at
                from community_intake.submissions
                where submission_id = :submission_id
                """
            ),
            {"submission_id": submitted.submission_id},
        ).mappings().one()
        assert anonymized["account_id"] is None
        assert anonymized["draft_content"] == {}
        assert anonymized["anonymized_at"] is not None
        assert session.execute(
            text(
                """
                select original_filename from community_intake.attachments
                where attachment_id = :attachment_id
                """
            ),
            {"attachment_id": clean.attachment_id},
        ).scalar_one() == "[deleted]"
