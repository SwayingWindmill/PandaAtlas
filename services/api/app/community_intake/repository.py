from __future__ import annotations

import hashlib
import json
from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.community_intake.models import (
    AttachmentAccessCommand,
    AttachmentScanCommand,
    AttachmentState,
    AttachmentUploadReservation,
    AttachmentView,
    ClosedSubmissionRetentionView,
    CloseUnincorporatedCommand,
    CommunityIntakeMetrics,
    CompleteAttachmentUploadCommand,
    CreateDraftCommand,
    PrepareAttachmentUploadCommand,
    RetentionResult,
    SignedStorageReference,
    SubmissionRevisionView,
    SubmissionState,
    SubmissionView,
    SubmitRevisionCommand,
    SubmittedSourceInput,
    SubmittedSourceView,
    UpdateDraftCommand,
    WithdrawSubmissionCommand,
)
from app.community_intake.storage import (
    OpaqueStorageReferenceSigner,
    PrivateAttachmentStorage,
    StorageReferenceError,
    SupabasePrivateAttachmentStorage,
    hash_reference_jti,
)
from app.identity.models import AccountState, RequestIdentity
from app.integration.events import AggregateReference, IntegrationEventEnvelope


class CommunityIntakeError(RuntimeError):
    """Base Community Intake error."""


class CommunityIntakeNotFoundError(CommunityIntakeError):
    """Raised when a private Intake resource is not visible to the caller."""


class CommunityIntakeConflictError(CommunityIntakeError):
    """Raised for state, optimistic-concurrency, or idempotency conflicts."""


class CommunityIntakeForbiddenError(CommunityIntakeError):
    """Raised when a caller lacks a sensitive capability."""


class CommunityIntakeRepository:
    BUCKET = "community-intake-private"

    def __init__(
        self,
        session: Session,
        *,
        storage: PrivateAttachmentStorage,
    ) -> None:
        self.session = session
        self.storage = storage

    def create_draft(
        self,
        identity: RequestIdentity,
        command: CreateDraftCommand,
        *,
        correlation_id: UUID,
    ) -> SubmissionView:
        self._require_active(identity)
        actor_hash = _subject_hash(identity.account_id)
        command_hash = _command_hash(command)
        self._lock_idempotency(actor_hash, command.idempotency_key)
        replay = self._replay(
            actor_hash,
            command.idempotency_key,
            command_hash,
            expected_event_types=("community.submission.draft_created",),
        )
        if replay is not None:
            return self.get_submission(identity, UUID(str(replay["target_id"])))
        self._require_panda_target(command.target_id)
        submission_id = uuid4()
        self.session.execute(
            text(
                """
                insert into community_intake.submissions (
                  submission_id, account_id, contributor_subject_hash,
                  submission_type, target_type, target_id, public_version_seen,
                  draft_content
                ) values (
                  :submission_id, :account_id, :subject_hash,
                  :submission_type, :target_type, :target_id, :public_version_seen,
                  cast(:draft_content as jsonb)
                )
                """
            ),
            {
                "submission_id": submission_id,
                "account_id": identity.account_id,
                "subject_hash": actor_hash,
                "submission_type": command.submission_type.value,
                "target_type": command.target_type.value,
                "target_id": command.target_id,
                "public_version_seen": command.public_version_seen,
                "draft_content": json.dumps(command.draft_content),
            },
        )
        self._audit(
            event_type="community.submission.draft_created",
            actor_hash=actor_hash,
            submission_id=submission_id,
            target_type="submission",
            target_id=str(submission_id),
            outcome="created",
            reason=None,
            details={"command_sha256": command_hash},
            correlation_id=correlation_id,
            idempotency_key=command.idempotency_key,
        )
        self._outbox(
            event_type="community.submission.draft_created",
            aggregate_id=str(submission_id),
            aggregate_version=1,
            idempotency_key=_scoped_key(identity.account_id, command.idempotency_key),
            correlation_id=correlation_id,
            payload={
                "submission_id": str(submission_id),
                "account_id": str(identity.account_id),
                "submission_type": command.submission_type.value,
                "target_type": command.target_type.value,
                "target_id": command.target_id,
            },
        )
        self.session.commit()
        return self.get_submission(identity, submission_id)

    def update_draft(
        self,
        identity: RequestIdentity,
        submission_id: UUID,
        command: UpdateDraftCommand,
        *,
        correlation_id: UUID,
    ) -> SubmissionView:
        self._require_active(identity)
        actor_hash = _subject_hash(identity.account_id)
        command_hash = _command_hash(command)
        self._lock_idempotency(actor_hash, command.idempotency_key)
        replay = self._replay(
            actor_hash,
            command.idempotency_key,
            command_hash,
            expected_event_types=("community.submission.draft_updated",),
            expected_submission_id=submission_id,
        )
        if replay is not None:
            return self.get_submission(identity, submission_id)
        row = self._owned_submission(identity.account_id, submission_id, for_update=True)
        if row["state"] != SubmissionState.DRAFT.value:
            self.session.rollback()
            raise CommunityIntakeConflictError("only a draft submission can be edited")
        if int(row["version"]) != command.expected_version:
            self.session.rollback()
            raise CommunityIntakeConflictError("submission version does not match")
        next_version = int(row["version"]) + 1
        self.session.execute(
            text(
                """
                update community_intake.submissions
                set draft_content = cast(:draft_content as jsonb),
                    public_version_seen = coalesce(:public_version_seen, public_version_seen),
                    version = :version,
                    expires_at = now() + interval '90 days',
                    updated_at = now()
                where submission_id = :submission_id
                """
            ),
            {
                "submission_id": submission_id,
                "draft_content": json.dumps(command.draft_content),
                "public_version_seen": command.public_version_seen,
                "version": next_version,
            },
        )
        self._audit(
            event_type="community.submission.draft_updated",
            actor_hash=actor_hash,
            submission_id=submission_id,
            target_type="submission",
            target_id=str(submission_id),
            outcome="updated",
            reason=None,
            details={"command_sha256": command_hash, "version": next_version},
            correlation_id=correlation_id,
            idempotency_key=command.idempotency_key,
        )
        self.session.commit()
        return self.get_submission(identity, submission_id)

    def submit_revision(
        self,
        identity: RequestIdentity,
        submission_id: UUID,
        command: SubmitRevisionCommand,
        *,
        correlation_id: UUID,
    ) -> SubmissionView:
        self._require_active(identity)
        actor_hash = _subject_hash(identity.account_id)
        command_hash = _command_hash(command)
        self._lock_idempotency(actor_hash, command.idempotency_key)
        replay = self._replay(
            actor_hash,
            command.idempotency_key,
            command_hash,
            expected_event_types=(
                "community.submission.submitted",
                "community.submission.revised",
            ),
            expected_submission_id=submission_id,
        )
        if replay is not None:
            return self.get_submission(identity, submission_id)
        row = self._owned_submission(identity.account_id, submission_id, for_update=True)
        if row["state"] not in {
            SubmissionState.DRAFT.value,
            SubmissionState.SUBMITTED.value,
        }:
            self.session.rollback()
            raise CommunityIntakeConflictError("submission cannot accept another revision")
        if int(row["version"]) != command.expected_version:
            self.session.rollback()
            raise CommunityIntakeConflictError("submission version does not match")
        incomplete = int(
            self.session.execute(
                text(
                    """
                    select count(*) from community_intake.attachments
                    where submission_id = :submission_id
                      and state <> 'deleted'
                      and upload_completed_at is null
                    """
                ),
                {"submission_id": submission_id},
            ).scalar_one()
        )
        if incomplete:
            self.session.rollback()
            raise CommunityIntakeConflictError(
                "all reserved attachments must complete upload before submission"
            )
        completed_attachments = int(
            self.session.execute(
                text(
                    """
                    select count(*) from community_intake.attachments
                    where submission_id = :submission_id
                      and state <> 'deleted'
                      and upload_completed_at is not null
                    """
                ),
                {"submission_id": submission_id},
            ).scalar_one()
        )
        if not command.sources and completed_attachments == 0:
            self.session.rollback()
            raise CommunityIntakeConflictError(
                "formal submission requires a source or completed evidence attachment"
            )
        revision_number = int(row["latest_revision_number"]) + 1
        content_hash = _canonical_hash(command.content)
        self.session.execute(
            text(
                """
                insert into community_intake.submission_revisions (
                  submission_id, revision_number, content, content_sha256,
                  public_version_seen
                ) values (
                  :submission_id, :revision_number, cast(:content as jsonb),
                  :content_sha256, :public_version_seen
                )
                """
            ),
            {
                "submission_id": submission_id,
                "revision_number": revision_number,
                "content": json.dumps(command.content),
                "content_sha256": content_hash,
                "public_version_seen": command.public_version_seen,
            },
        )
        for source in command.sources:
            self._insert_source(submission_id, revision_number, source)
        self.session.execute(
            text(
                """
                update community_intake.attachments
                set bound_revision_number = :revision_number,
                    updated_at = now()
                where submission_id = :submission_id
                  and bound_revision_number is null
                  and upload_completed_at is not null
                  and state <> 'deleted'
                """
            ),
            {
                "submission_id": submission_id,
                "revision_number": revision_number,
            },
        )
        next_version = int(row["version"]) + 1
        first_submission = row["state"] == SubmissionState.DRAFT.value
        self.session.execute(
            text(
                """
                update community_intake.submissions
                set state = 'submitted', contributor_status = 'submitted',
                    contributor_status_updated_at = now(),
                    draft_content = cast(:draft_content as jsonb),
                    public_version_seen = :public_version_seen,
                    version = :version,
                    latest_revision_number = :revision_number,
                    submitted_at = coalesce(submitted_at, now()),
                    updated_at = now()
                where submission_id = :submission_id
                """
            ),
            {
                "submission_id": submission_id,
                "draft_content": json.dumps(command.content),
                "public_version_seen": command.public_version_seen,
                "version": next_version,
                "revision_number": revision_number,
            },
        )
        event_type = (
            "community.submission.submitted" if first_submission else "community.submission.revised"
        )
        self._audit(
            event_type=event_type,
            actor_hash=actor_hash,
            submission_id=submission_id,
            target_type="submission_revision",
            target_id=f"{submission_id}:{revision_number}",
            outcome="submitted",
            reason=None,
            details={
                "command_sha256": command_hash,
                "content_sha256": content_hash,
                "revision_number": revision_number,
                "source_count": len(command.sources),
                "attachment_count": completed_attachments,
            },
            correlation_id=correlation_id,
            idempotency_key=command.idempotency_key,
        )
        self._outbox(
            event_type=event_type,
            aggregate_id=str(submission_id),
            aggregate_version=revision_number,
            idempotency_key=_scoped_key(identity.account_id, command.idempotency_key),
            correlation_id=correlation_id,
            payload={
                "submission_id": str(submission_id),
                "account_id": str(identity.account_id),
                "revision_number": revision_number,
                "submission_type": row["submission_type"],
                "target_type": row["target_type"],
                "target_id": row["target_id"],
                "source_count": len(command.sources),
                "attachment_count": completed_attachments,
            },
        )
        self.session.commit()
        return self.get_submission(identity, submission_id)

    def withdraw(
        self,
        identity: RequestIdentity,
        submission_id: UUID,
        command: WithdrawSubmissionCommand,
        *,
        correlation_id: UUID,
    ) -> SubmissionView:
        self._require_active(identity)
        actor_hash = _subject_hash(identity.account_id)
        command_hash = _command_hash(command)
        self._lock_idempotency(actor_hash, command.idempotency_key)
        replay = self._replay(
            actor_hash,
            command.idempotency_key,
            command_hash,
            expected_event_types=("community.submission.withdrawn",),
            expected_submission_id=submission_id,
        )
        if replay is not None:
            return self.get_submission(identity, submission_id)
        row = self._owned_submission(identity.account_id, submission_id, for_update=True)
        if row["state"] not in {
            SubmissionState.DRAFT.value,
            SubmissionState.SUBMITTED.value,
        }:
            self.session.rollback()
            raise CommunityIntakeConflictError("submission cannot be withdrawn")
        if int(row["version"]) != command.expected_version:
            self.session.rollback()
            raise CommunityIntakeConflictError("submission version does not match")
        next_version = int(row["version"]) + 1
        self.session.execute(
            text(
                """
                update community_intake.submissions
                set state = 'withdrawn', contributor_status = 'withdrawn',
                    withdrawn_at = now(), contributor_status_updated_at = now(),
                    version = :version, updated_at = now()
                where submission_id = :submission_id
                """
            ),
            {"submission_id": submission_id, "version": next_version},
        )
        self._audit(
            event_type="community.submission.withdrawn",
            actor_hash=actor_hash,
            submission_id=submission_id,
            target_type="submission",
            target_id=str(submission_id),
            outcome="withdrawn",
            reason=command.reason,
            details={"command_sha256": command_hash, "version": next_version},
            correlation_id=correlation_id,
            idempotency_key=command.idempotency_key,
        )
        self._outbox(
            event_type="community.submission.withdrawn",
            aggregate_id=str(submission_id),
            aggregate_version=next_version,
            idempotency_key=_scoped_key(identity.account_id, command.idempotency_key),
            correlation_id=correlation_id,
            payload={
                "submission_id": str(submission_id),
                "account_id": str(identity.account_id),
                "latest_revision_number": int(row["latest_revision_number"]),
            },
        )
        self.session.commit()
        return self.get_submission(identity, submission_id)

    def close_unincorporated(
        self,
        actor: RequestIdentity,
        submission_id: UUID,
        command: CloseUnincorporatedCommand,
        *,
        correlation_id: UUID,
    ) -> ClosedSubmissionRetentionView:
        self._require_capability(actor, "community_intake.retention.manage")
        actor_hash = _subject_hash(actor.account_id)
        command_hash = _command_hash(command)
        self._lock_idempotency(actor_hash, command.idempotency_key)
        replay = self._replay(
            actor_hash,
            command.idempotency_key,
            command_hash,
            expected_event_types=("community.submission.closed_unincorporated",),
            expected_submission_id=submission_id,
        )
        if replay is not None:
            return self._closed_retention_view(submission_id)
        row = self._submission_row(submission_id, for_update=True)
        if row["state"] != SubmissionState.SUBMITTED.value:
            self.session.rollback()
            raise CommunityIntakeConflictError(
                "only a submitted contribution can close as unincorporated"
            )
        if int(row["version"]) != command.expected_version:
            self.session.rollback()
            raise CommunityIntakeConflictError("submission version does not match")
        next_version = int(row["version"]) + 1
        closed = (
            self.session.execute(
                text(
                    """
                update community_intake.submissions
                set state = 'closed', contributor_status = 'not_accepted',
                    closed_at = now(), contributor_status_updated_at = now(),
                    retention_due_at = now() + (:retention_days * interval '1 day'),
                    draft_content = '{}'::jsonb, version = :version, updated_at = now()
                where submission_id = :submission_id
                returning retention_due_at
                """
                ),
                {
                    "submission_id": submission_id,
                    "retention_days": command.retention_days,
                    "version": next_version,
                },
            )
            .mappings()
            .one()
        )
        retention_due_at = closed["retention_due_at"]
        self._audit(
            event_type="community.submission.closed_unincorporated",
            actor_hash=actor_hash,
            submission_id=submission_id,
            target_type="submission",
            target_id=str(submission_id),
            outcome="closed",
            reason=command.reason,
            details={
                "command_sha256": command_hash,
                "version": next_version,
                "retention_days": command.retention_days,
            },
            correlation_id=correlation_id,
            idempotency_key=command.idempotency_key,
        )
        self._retention(
            submission_id=submission_id,
            subject_hash=str(row["contributor_subject_hash"]),
            action="closed_unincorporated_due",
            reason=command.reason,
            details={"retention_due_at": retention_due_at.isoformat()},
            correlation_id=correlation_id,
        )
        self._outbox(
            event_type="community.submission.closed_unincorporated",
            aggregate_id=str(submission_id),
            aggregate_version=next_version,
            idempotency_key=_scoped_key(actor.account_id, command.idempotency_key),
            correlation_id=correlation_id,
            payload={
                "submission_id": str(submission_id),
                "latest_revision_number": int(row["latest_revision_number"]),
                "retention_due_at": retention_due_at.isoformat(),
            },
        )
        self.session.commit()
        return self._closed_retention_view(submission_id)

    def prepare_attachment_upload(
        self,
        identity: RequestIdentity,
        submission_id: UUID,
        command: PrepareAttachmentUploadCommand,
        *,
        correlation_id: UUID,
    ) -> AttachmentUploadReservation:
        self._require_active(identity)
        actor_hash = _subject_hash(identity.account_id)
        command_hash = _command_hash(command)
        self._lock_idempotency(actor_hash, command.idempotency_key)
        replay = self._replay(
            actor_hash,
            command.idempotency_key,
            command_hash,
            expected_event_types=("community.attachment.upload_reserved",),
            expected_submission_id=submission_id,
        )
        if replay is not None:
            attachment_id = UUID(str(replay["target_id"]))
            attachment = self._attachment_for_owner(identity.account_id, attachment_id)
            reference = self.storage.create_upload_reference(
                attachment_id=str(attachment_id),
                media_type=attachment.media_type,
                byte_size=attachment.byte_size,
            )
            return AttachmentUploadReservation(
                attachment=attachment,
                upload_reference=reference,
            )
        submission = self._owned_submission(identity.account_id, submission_id, for_update=True)
        if submission["state"] not in {
            SubmissionState.DRAFT.value,
            SubmissionState.SUBMITTED.value,
        }:
            self.session.rollback()
            raise CommunityIntakeConflictError("submission does not accept attachments")
        current = (
            self.session.execute(
                text(
                    """
                select count(*) as attachment_count, coalesce(sum(byte_size), 0) as byte_size
                from community_intake.attachments
                where submission_id = :submission_id and state <> 'deleted'
                """
                ),
                {"submission_id": submission_id},
            )
            .mappings()
            .one()
        )
        if int(current["attachment_count"]) >= 5:
            self.session.rollback()
            raise CommunityIntakeConflictError("a submission may contain at most five attachments")
        if int(current["byte_size"]) + command.byte_size > 30 * 1024 * 1024:
            self.session.rollback()
            raise CommunityIntakeConflictError("submission attachments may total at most 30 MiB")
        attachment_id = uuid4()
        object_key = (
            f"subjects/{actor_hash[:24]}/submissions/{submission_id}/attachments/{attachment_id}"
        )
        self.session.execute(
            text(
                """
                insert into community_intake.attachments (
                  attachment_id, submission_id, storage_bucket, storage_object_key,
                  original_filename, media_type, byte_size
                ) values (
                  :attachment_id, :submission_id, :storage_bucket, :storage_object_key,
                  :original_filename, :media_type, :byte_size
                )
                """
            ),
            {
                "attachment_id": attachment_id,
                "submission_id": submission_id,
                "storage_bucket": self.BUCKET,
                "storage_object_key": object_key,
                "original_filename": command.original_filename,
                "media_type": command.media_type,
                "byte_size": command.byte_size,
            },
        )
        self._audit(
            event_type="community.attachment.upload_reserved",
            actor_hash=actor_hash,
            submission_id=submission_id,
            target_type="attachment",
            target_id=str(attachment_id),
            outcome="reserved",
            reason=None,
            details={
                "command_sha256": command_hash,
                "media_type": command.media_type,
                "byte_size": command.byte_size,
            },
            correlation_id=correlation_id,
            idempotency_key=command.idempotency_key,
        )
        self.session.commit()
        attachment = self._attachment_for_owner(identity.account_id, attachment_id)
        reference = self.storage.create_upload_reference(
            attachment_id=str(attachment_id),
            media_type=command.media_type,
            byte_size=command.byte_size,
        )
        return AttachmentUploadReservation(
            attachment=attachment,
            upload_reference=reference,
        )

    def complete_attachment_upload(
        self,
        identity: RequestIdentity,
        attachment_id: UUID,
        command: CompleteAttachmentUploadCommand,
        *,
        correlation_id: UUID,
    ) -> AttachmentView:
        self._require_active(identity)
        actor_hash = _subject_hash(identity.account_id)
        command_hash = _command_hash(command)
        self._lock_idempotency(actor_hash, command.idempotency_key)
        replay = self._replay(
            actor_hash,
            command.idempotency_key,
            command_hash,
            expected_event_types=("community.attachment.quarantined",),
            expected_target_id=str(attachment_id),
        )
        if replay is not None:
            return self._attachment_for_owner(identity.account_id, attachment_id)
        row = self._attachment_row(attachment_id, for_update=True)
        self._require_attachment_owner(row, identity.account_id)
        if row["upload_completed_at"] is not None:
            self.session.rollback()
            raise CommunityIntakeConflictError("attachment upload is already complete")
        try:
            self.storage.verify_upload_reference(
                command.upload_reference,
                attachment_id=str(attachment_id),
                media_type=str(row["media_type"]),
                byte_size=int(row["byte_size"]),
            )
        except StorageReferenceError as error:
            self.session.rollback()
            raise CommunityIntakeConflictError(
                "upload reference is invalid, expired, or belongs to another attachment"
            ) from error
        self.session.execute(
            text(
                """
                update community_intake.attachments
                set object_version = :object_version,
                    content_sha256 = :content_sha256,
                    upload_completed_at = now(),
                    updated_at = now()
                where attachment_id = :attachment_id
                """
            ),
            {
                "attachment_id": attachment_id,
                "object_version": command.object_version,
                "content_sha256": command.content_sha256,
            },
        )
        submission_id = UUID(str(row["submission_id"]))
        self._audit(
            event_type="community.attachment.quarantined",
            actor_hash=actor_hash,
            submission_id=submission_id,
            target_type="attachment",
            target_id=str(attachment_id),
            outcome="quarantined",
            reason=None,
            details={"command_sha256": command_hash},
            correlation_id=correlation_id,
            idempotency_key=command.idempotency_key,
        )
        self._outbox(
            event_type="community.attachment.quarantined",
            aggregate_id=str(attachment_id),
            aggregate_version=1,
            idempotency_key=_scoped_key(identity.account_id, command.idempotency_key),
            correlation_id=correlation_id,
            payload={
                "attachment_id": str(attachment_id),
                "submission_id": str(submission_id),
                "state": AttachmentState.QUARANTINED.value,
                "media_type": row["media_type"],
                "byte_size": int(row["byte_size"]),
            },
            aggregate_type="community_attachment",
        )
        self.session.commit()
        return self._attachment_for_owner(identity.account_id, attachment_id)

    def record_scan_result(
        self,
        actor: RequestIdentity,
        attachment_id: UUID,
        command: AttachmentScanCommand,
        *,
        correlation_id: UUID,
    ) -> AttachmentView:
        self._require_capability(actor, "community_intake.scan.record")
        actor_hash = _subject_hash(actor.account_id)
        command_hash = _command_hash(command)
        self._lock_idempotency(actor_hash, command.idempotency_key)
        replay = self._replay(
            actor_hash,
            command.idempotency_key,
            command_hash,
            expected_event_types=("community.attachment.scan_recorded",),
            expected_target_id=str(attachment_id),
        )
        if replay is not None:
            return self._attachment_view(self._attachment_row(attachment_id, for_update=False))
        row = self._attachment_row(attachment_id, for_update=True)
        if row["upload_completed_at"] is None:
            self.session.rollback()
            raise CommunityIntakeConflictError("attachment upload is incomplete")
        if row["state"] not in {
            AttachmentState.QUARANTINED.value,
            AttachmentState.SCAN_FAILED.value,
        }:
            self.session.rollback()
            raise CommunityIntakeConflictError("attachment is not awaiting a scan")
        if command.outcome is AttachmentState.CLEAN and row["media_type"].startswith("image/"):
            if not command.metadata_stripped or command.preview_object_key is None:
                self.session.rollback()
                raise CommunityIntakeConflictError(
                    "clean image evidence requires a metadata-stripped preview"
                )
        attempt = int(row["scan_attempts"]) + 1
        self.session.execute(
            text(
                """
                insert into community_intake.attachment_scan_events (
                  attachment_id, attempt_number, outcome, scanner_name,
                  scanner_version, result_code, metadata_stripped,
                  preview_object_key, correlation_id
                ) values (
                  :attachment_id, :attempt_number, :outcome, :scanner_name,
                  :scanner_version, :result_code, :metadata_stripped,
                  :preview_object_key, :correlation_id
                )
                """
            ),
            {
                "attachment_id": attachment_id,
                "attempt_number": attempt,
                "outcome": command.outcome.value,
                "scanner_name": command.scanner_name,
                "scanner_version": command.scanner_version,
                "result_code": command.result_code,
                "metadata_stripped": command.metadata_stripped,
                "preview_object_key": command.preview_object_key,
                "correlation_id": correlation_id,
            },
        )
        self.session.execute(
            text(
                """
                update community_intake.attachments
                set state = :state,
                    scan_attempts = :scan_attempts,
                    last_scan_code = :last_scan_code,
                    last_scanned_at = now(),
                    metadata_stripped = :metadata_stripped,
                    preview_object_key = :preview_object_key,
                    updated_at = now()
                where attachment_id = :attachment_id
                """
            ),
            {
                "attachment_id": attachment_id,
                "state": command.outcome.value,
                "scan_attempts": attempt,
                "last_scan_code": command.result_code,
                "metadata_stripped": command.metadata_stripped,
                "preview_object_key": command.preview_object_key,
            },
        )
        submission_id = UUID(str(row["submission_id"]))
        self._audit(
            event_type="community.attachment.scan_recorded",
            actor_hash=actor_hash,
            submission_id=submission_id,
            target_type="attachment",
            target_id=str(attachment_id),
            outcome=command.outcome.value,
            reason=command.result_code,
            details={"command_sha256": command_hash, "attempt_number": attempt},
            correlation_id=correlation_id,
            idempotency_key=command.idempotency_key,
        )
        self._outbox(
            event_type="community.attachment.scan_recorded",
            aggregate_id=str(attachment_id),
            aggregate_version=attempt,
            idempotency_key=_scoped_key(actor.account_id, command.idempotency_key),
            correlation_id=correlation_id,
            payload={
                "attachment_id": str(attachment_id),
                "submission_id": str(submission_id),
                "state": command.outcome.value,
                "attempt_number": attempt,
                "result_code": command.result_code,
            },
            aggregate_type="community_attachment",
        )
        self.session.commit()
        return self._attachment_view(self._attachment_row(attachment_id, for_update=False))

    def create_attachment_access(
        self,
        actor: RequestIdentity,
        attachment_id: UUID,
        command: AttachmentAccessCommand,
        *,
        correlation_id: UUID,
    ) -> SignedStorageReference:
        actor_hash = _subject_hash(actor.account_id)
        row = self._attachment_row(attachment_id, for_update=False)
        denial_reason: str | None = None
        if actor.state is not AccountState.ACTIVE:
            denial_reason = "account_not_active"
        elif not actor.has_capability("community_intake.evidence.read"):
            denial_reason = "missing_capability"
        elif row["state"] != AttachmentState.CLEAN.value:
            denial_reason = "attachment_not_clean"
        elif command.preview and (
            not bool(row["metadata_stripped"]) or row["preview_object_key"] is None
        ):
            denial_reason = "safe_preview_unavailable"
        if denial_reason is not None:
            self._sensitive_read(
                attachment_id=attachment_id,
                actor_hash=actor_hash,
                purpose=command.purpose,
                outcome="denied",
                denial_reason=denial_reason,
                reference_jti_hash=None,
                reference_expires_at=None,
                correlation_id=correlation_id,
            )
            self.session.commit()
            raise CommunityIntakeForbiddenError("private evidence is unavailable for this request")
        reference, jti = self.storage.create_download_reference(
            attachment_id=str(attachment_id),
            preview=command.preview,
        )
        self._sensitive_read(
            attachment_id=attachment_id,
            actor_hash=actor_hash,
            purpose=command.purpose,
            outcome="granted",
            denial_reason=None,
            reference_jti_hash=hash_reference_jti(jti),
            reference_expires_at=reference.expires_at,
            correlation_id=correlation_id,
        )
        self.session.commit()
        return reference

    def get_submission(
        self,
        identity: RequestIdentity,
        submission_id: UUID,
    ) -> SubmissionView:
        row = self._owned_submission(identity.account_id, submission_id, for_update=False)
        revisions = self._revisions(submission_id)
        attachments = (
            self.session.execute(
                text(
                    """
                select attachment_id, submission_id, bound_revision_number,
                       original_filename, media_type, byte_size, state::text,
                       upload_completed_at, scan_attempts, last_scan_code,
                       last_scanned_at, metadata_stripped, created_at
                from community_intake.attachments
                where submission_id = :submission_id and state <> 'deleted'
                order by created_at, attachment_id
                """
                ),
                {"submission_id": submission_id},
            )
            .mappings()
            .all()
        )
        return SubmissionView.model_validate(
            {
                **dict(row),
                "draft_content": _json_value(row["draft_content"]),
                "revisions": revisions,
                "attachments": [self._attachment_view(item) for item in attachments],
            }
        )

    def expire_and_repair(
        self,
        *,
        correlation_id: UUID,
        max_scan_attempts: int = 3,
        commit: bool = True,
    ) -> RetentionResult:
        expired = (
            self.session.execute(
                text(
                    """
                update community_intake.submissions
                set state = 'expired', contributor_status = 'expired',
                    contributor_status_updated_at = now(), draft_content = '{}'::jsonb,
                    version = version + 1, updated_at = now()
                where state = 'draft' and expires_at <= now()
                returning submission_id, contributor_subject_hash
                """
                )
            )
            .mappings()
            .all()
        )
        for row in expired:
            submission_id = UUID(str(row["submission_id"]))
            deleted_attachments = self._mark_submission_attachments_deleted(submission_id)
            for attachment_id in deleted_attachments:
                self._emit_attachment_deletion_requested(
                    attachment_id=attachment_id,
                    submission_id=submission_id,
                    reason_code="draft_expired",
                    correlation_id=correlation_id,
                )
            self._retention(
                submission_id=UUID(str(row["submission_id"])),
                subject_hash=str(row["contributor_subject_hash"]),
                action="draft_expired",
                reason="draft exceeded the 90-day retention window",
                details={},
                correlation_id=correlation_id,
            )
        closed_due = (
            self.session.execute(
                text(
                    """
                update community_intake.submissions
                set retention_completed_at = now(), updated_at = now()
                where state = 'closed'
                  and retention_due_at <= now()
                  and retention_completed_at is null
                returning submission_id, contributor_subject_hash
                """
                )
            )
            .mappings()
            .all()
        )
        for row in closed_due:
            submission_id = UUID(str(row["submission_id"]))
            deleted_attachments = self._mark_submission_attachments_deleted(submission_id)
            for attachment_id in deleted_attachments:
                self._emit_attachment_deletion_requested(
                    attachment_id=attachment_id,
                    submission_id=submission_id,
                    reason_code="closed_unincorporated_due",
                    correlation_id=correlation_id,
                )
            self._retention(
                submission_id=submission_id,
                subject_hash=str(row["contributor_subject_hash"]),
                action="attachment_deleted",
                reason="closed unincorporated evidence reached its retention date",
                details={"attachment_count": len(deleted_attachments)},
                correlation_id=correlation_id,
            )
        orphans = (
            self.session.execute(
                text(
                    """
                update community_intake.attachments attachment
                set state = 'deleted', body_deleted_at = now(),
                    original_filename = '[deleted]', updated_at = now()
                from community_intake.submissions submission
                where attachment.submission_id = submission.submission_id
                  and attachment.upload_completed_at is null
                  and attachment.state <> 'deleted'
                  and attachment.created_at <= now() - interval '24 hours'
                returning attachment.attachment_id, attachment.submission_id,
                          submission.contributor_subject_hash
                """
                )
            )
            .mappings()
            .all()
        )
        for row in orphans:
            self._emit_attachment_deletion_requested(
                attachment_id=UUID(str(row["attachment_id"])),
                submission_id=UUID(str(row["submission_id"])),
                reason_code="orphan_upload",
                correlation_id=correlation_id,
            )
            self._retention(
                submission_id=UUID(str(row["submission_id"])),
                subject_hash=str(row["contributor_subject_hash"]),
                action="orphan_deleted",
                reason="reserved upload did not complete within 24 hours",
                details={"attachment_id": str(row["attachment_id"])},
                correlation_id=correlation_id,
            )
        retried = (
            self.session.execute(
                text(
                    """
                update community_intake.attachments
                set state = 'quarantined', updated_at = now()
                where state = 'scan_failed'
                  and scan_attempts < :max_scan_attempts
                  and last_scanned_at <= now() - interval '15 minutes'
                returning attachment_id, submission_id, scan_attempts
                """
                ),
                {"max_scan_attempts": max_scan_attempts},
            )
            .mappings()
            .all()
        )
        for row in retried:
            attachment_id = UUID(str(row["attachment_id"]))
            submission_id = UUID(str(row["submission_id"]))
            self._outbox(
                event_type="community.attachment.scan_retry_requested",
                aggregate_type="community_attachment",
                aggregate_id=str(attachment_id),
                aggregate_version=int(row["scan_attempts"]) + 1,
                idempotency_key=(
                    f"attachment-scan-retry:{attachment_id}:{int(row['scan_attempts']) + 1}"
                ),
                correlation_id=correlation_id,
                payload={
                    "attachment_id": str(attachment_id),
                    "submission_id": str(submission_id),
                    "next_attempt_number": int(row["scan_attempts"]) + 1,
                },
            )
        if commit:
            self.session.commit()
        return RetentionResult(
            expired_drafts=len(expired),
            closed_submissions_processed=len(closed_due),
            orphan_attachments=len(orphans),
            scan_retries=len(retried),
        )

    def anonymize_account(
        self,
        account_id: UUID,
        *,
        reason: str,
        correlation_id: UUID,
    ) -> dict[str, int]:
        result = anonymize_community_intake_account(
            self.session,
            account_id,
            reason=reason,
            correlation_id=correlation_id,
        )
        self.session.commit()
        return result

    def metrics(self) -> CommunityIntakeMetrics:
        row = (
            self.session.execute(
                text(
                    """
                select
                  count(*) filter (where state = 'draft') as draft_count,
                  count(*) filter (where state = 'submitted') as submitted_count
                from community_intake.submissions
                """
                )
            )
            .mappings()
            .one()
        )
        attachments = (
            self.session.execute(
                text(
                    """
                select
                  count(*) filter (where state = 'quarantined') as quarantined_count,
                  count(*) filter (where state = 'scan_failed') as scan_failed_count,
                  count(*) filter (where state = 'infected') as infected_count,
                  count(*) filter (where state = 'clean') as clean_count,
                  coalesce(max(extract(epoch from (now() - created_at)))
                    filter (where state = 'quarantined'), 0)::double precision
                    as oldest_quarantined_age_seconds
                from community_intake.attachments
                """
                )
            )
            .mappings()
            .one()
        )
        reads = (
            self.session.execute(
                text(
                    """
                select
                  count(*) filter (where outcome = 'granted') as granted,
                  count(*) filter (where outcome = 'denied') as denied
                from community_intake.sensitive_read_events
                """
                )
            )
            .mappings()
            .one()
        )
        return CommunityIntakeMetrics(
            draft_count=int(row["draft_count"]),
            submitted_count=int(row["submitted_count"]),
            quarantined_count=int(attachments["quarantined_count"]),
            scan_failed_count=int(attachments["scan_failed_count"]),
            infected_count=int(attachments["infected_count"]),
            clean_count=int(attachments["clean_count"]),
            oldest_quarantined_age_seconds=float(attachments["oldest_quarantined_age_seconds"]),
            sensitive_reads_granted=int(reads["granted"]),
            sensitive_reads_denied=int(reads["denied"]),
        )

    def _require_panda_target(self, target_id: str) -> None:
        try:
            target_uuid = UUID(target_id)
        except ValueError as error:
            raise CommunityIntakeConflictError("target_id must be a stable Panda UUID") from error
        exists = self.session.execute(
            text("select exists(select 1 from public.pandas where id = :target_id)"),
            {"target_id": target_uuid},
        ).scalar_one()
        if not exists:
            raise CommunityIntakeNotFoundError("stable Panda target was not found")

    def _owned_submission(
        self,
        account_id: UUID,
        submission_id: UUID,
        *,
        for_update: bool,
    ) -> Any:
        suffix = " for update" if for_update else ""
        row = (
            self.session.execute(
                text(
                    """
                select submission_id, submission_type::text, target_type::text,
                       target_id, public_version_seen, state::text, draft_content,
                       version, latest_revision_number, expires_at, submitted_at,
                       withdrawn_at, closed_at, retention_due_at,
                       retention_completed_at, created_at, updated_at
                from community_intake.submissions
                where submission_id = :submission_id and account_id = :account_id
                """
                    + suffix
                ),
                {"submission_id": submission_id, "account_id": account_id},
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise CommunityIntakeNotFoundError("submission was not found")
        return row

    def _submission_row(self, submission_id: UUID, *, for_update: bool) -> Any:
        suffix = " for update" if for_update else ""
        row = (
            self.session.execute(
                text(
                    """
                select submission_id, contributor_subject_hash, state::text, version,
                       latest_revision_number, retention_due_at, retention_completed_at
                from community_intake.submissions
                where submission_id = :submission_id
                """
                    + suffix
                ),
                {"submission_id": submission_id},
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise CommunityIntakeNotFoundError("submission was not found")
        return row

    def _closed_retention_view(self, submission_id: UUID) -> ClosedSubmissionRetentionView:
        row = self._submission_row(submission_id, for_update=False)
        if row["state"] != SubmissionState.CLOSED.value or row["retention_due_at"] is None:
            raise CommunityIntakeConflictError("submission is not closed for retention")
        return ClosedSubmissionRetentionView.model_validate(
            {
                "submission_id": row["submission_id"],
                "state": row["state"],
                "version": row["version"],
                "retention_due_at": row["retention_due_at"],
            }
        )

    def _attachment_row(self, attachment_id: UUID, *, for_update: bool) -> Any:
        suffix = " for update" if for_update else ""
        row = (
            self.session.execute(
                text(
                    """
                select attachment.attachment_id, attachment.submission_id,
                       attachment.bound_revision_number, attachment.storage_bucket,
                       attachment.storage_object_key, attachment.object_version,
                       attachment.original_filename, attachment.media_type,
                       attachment.byte_size, attachment.content_sha256,
                       attachment.state::text, attachment.upload_completed_at,
                       attachment.scan_attempts, attachment.last_scan_code,
                       attachment.last_scanned_at, attachment.metadata_stripped,
                       attachment.preview_object_key, attachment.created_at,
                       submission.account_id
                from community_intake.attachments attachment
                join community_intake.submissions submission
                  on submission.submission_id = attachment.submission_id
                where attachment.attachment_id = :attachment_id
                """
                    + suffix
                ),
                {"attachment_id": attachment_id},
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise CommunityIntakeNotFoundError("attachment was not found")
        return row

    def _attachment_for_owner(
        self,
        account_id: UUID,
        attachment_id: UUID,
    ) -> AttachmentView:
        row = self._attachment_row(attachment_id, for_update=False)
        self._require_attachment_owner(row, account_id)
        return self._attachment_view(row)

    def _require_attachment_owner(self, row: Any, account_id: UUID) -> None:
        if row["account_id"] != account_id:
            raise CommunityIntakeNotFoundError("attachment was not found")

    def _attachment_view(self, row: Any) -> AttachmentView:
        return AttachmentView.model_validate(
            {
                "attachment_id": row["attachment_id"],
                "submission_id": row["submission_id"],
                "bound_revision_number": row["bound_revision_number"],
                "original_filename": row["original_filename"],
                "media_type": row["media_type"],
                "byte_size": row["byte_size"],
                "state": row["state"],
                "upload_completed_at": row["upload_completed_at"],
                "scan_attempts": row["scan_attempts"],
                "last_scan_code": row["last_scan_code"],
                "last_scanned_at": row["last_scanned_at"],
                "metadata_stripped": row["metadata_stripped"],
                "created_at": row["created_at"],
            }
        )

    def _revisions(self, submission_id: UUID) -> list[SubmissionRevisionView]:
        revision_rows = (
            self.session.execute(
                text(
                    """
                select revision_number, content, content_sha256,
                       public_version_seen, submitted_at
                from community_intake.submission_revisions
                where submission_id = :submission_id
                order by revision_number
                """
                ),
                {"submission_id": submission_id},
            )
            .mappings()
            .all()
        )
        source_rows = (
            self.session.execute(
                text(
                    """
                select source_id, revision_number, source_kind::text,
                       title, locator, publisher, published_on, created_at
                from community_intake.submitted_sources
                where submission_id = :submission_id
                order by revision_number, created_at, source_id
                """
                ),
                {"submission_id": submission_id},
            )
            .mappings()
            .all()
        )
        by_revision: dict[int, list[SubmittedSourceView]] = {}
        for source in source_rows:
            revision_number = int(source["revision_number"])
            by_revision.setdefault(revision_number, []).append(
                SubmittedSourceView.model_validate(dict(source))
            )
        return [
            SubmissionRevisionView.model_validate(
                {
                    **dict(row),
                    "content": _json_value(row["content"]),
                    "sources": by_revision.get(int(row["revision_number"]), []),
                }
            )
            for row in revision_rows
        ]

    def _insert_source(
        self,
        submission_id: UUID,
        revision_number: int,
        source: SubmittedSourceInput,
    ) -> None:
        normalized = " ".join(source.locator.strip().lower().split())
        self.session.execute(
            text(
                """
                insert into community_intake.submitted_sources (
                  submission_id, revision_number, source_kind, title, locator,
                  publisher, published_on, normalized_locator_hash
                ) values (
                  :submission_id, :revision_number, :source_kind, :title, :locator,
                  :publisher, :published_on, :normalized_locator_hash
                )
                """
            ),
            {
                "submission_id": submission_id,
                "revision_number": revision_number,
                "source_kind": source.source_kind.value,
                "title": source.title,
                "locator": source.locator,
                "publisher": source.publisher,
                "published_on": source.published_on,
                "normalized_locator_hash": hashlib.sha256(normalized.encode()).hexdigest(),
            },
        )

    def _mark_submission_attachments_deleted(self, submission_id: UUID) -> list[UUID]:
        rows = (
            self.session.execute(
                text(
                    """
                update community_intake.attachments
                set state = 'deleted', body_deleted_at = coalesce(body_deleted_at, now()),
                    original_filename = '[deleted]', updated_at = now()
                where submission_id = :submission_id and state <> 'deleted'
                returning attachment_id
                """
                ),
                {"submission_id": submission_id},
            )
            .scalars()
            .all()
        )
        return [UUID(str(attachment_id)) for attachment_id in rows]

    def _emit_attachment_deletion_requested(
        self,
        *,
        attachment_id: UUID,
        submission_id: UUID,
        reason_code: str,
        correlation_id: UUID,
    ) -> None:
        self._outbox(
            event_type="community.attachment.deletion_requested",
            aggregate_type="community_attachment",
            aggregate_id=str(attachment_id),
            aggregate_version=None,
            idempotency_key=f"attachment-delete:{attachment_id}:{reason_code}",
            correlation_id=correlation_id,
            payload={
                "attachment_id": str(attachment_id),
                "submission_id": str(submission_id),
                "reason_code": reason_code,
            },
        )

    def _lock_idempotency(self, actor_hash: str, idempotency_key: str) -> None:
        self.session.execute(
            text("select pg_advisory_xact_lock(hashtextextended(:key, 0))"),
            {"key": f"community-intake:{actor_hash}:{idempotency_key}"},
        )

    def _require_active(self, identity: RequestIdentity) -> None:
        if identity.state is not AccountState.ACTIVE:
            raise CommunityIntakeForbiddenError("account is not active")

    def _require_capability(self, identity: RequestIdentity, capability: str) -> None:
        if identity.state is not AccountState.ACTIVE or not identity.has_capability(capability):
            raise CommunityIntakeForbiddenError("required capability is missing")

    def _replay(
        self,
        actor_hash: str,
        idempotency_key: str,
        command_hash: str,
        *,
        expected_event_types: tuple[str, ...],
        expected_submission_id: UUID | None = None,
        expected_target_id: str | None = None,
    ) -> Any | None:
        row = (
            self.session.execute(
                text(
                    """
                select event_type, submission_id, target_id, details
                from community_intake.audit_events
                where actor_subject_hash = :actor_hash
                  and idempotency_key = :idempotency_key
                """
                ),
                {"actor_hash": actor_hash, "idempotency_key": idempotency_key},
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            return None
        details = _json_value(row["details"])
        if (
            details.get("command_sha256") != command_hash
            or row["event_type"] not in expected_event_types
            or (
                expected_submission_id is not None
                and row["submission_id"] != expected_submission_id
            )
            or (expected_target_id is not None and row["target_id"] != expected_target_id)
        ):
            self.session.rollback()
            raise CommunityIntakeConflictError(
                "idempotency key was reused for another Community Intake command"
            )
        return row

    def _audit(
        self,
        *,
        event_type: str,
        actor_hash: str,
        submission_id: UUID | None,
        target_type: str,
        target_id: str,
        outcome: str,
        reason: str | None,
        details: dict[str, object],
        correlation_id: UUID,
        idempotency_key: str,
    ) -> None:
        self.session.execute(
            text(
                """
                insert into community_intake.audit_events (
                  event_type, actor_subject_hash, submission_id, target_type,
                  target_id, outcome, reason, details, correlation_id,
                  idempotency_key
                ) values (
                  :event_type, :actor_hash, :submission_id, :target_type,
                  :target_id, :outcome, :reason, cast(:details as jsonb),
                  :correlation_id, :idempotency_key
                )
                """
            ),
            {
                "event_type": event_type,
                "actor_hash": actor_hash,
                "submission_id": submission_id,
                "target_type": target_type,
                "target_id": target_id,
                "outcome": outcome,
                "reason": reason,
                "details": json.dumps(details),
                "correlation_id": correlation_id,
                "idempotency_key": idempotency_key,
            },
        )

    def _sensitive_read(
        self,
        *,
        attachment_id: UUID,
        actor_hash: str,
        purpose: str,
        outcome: str,
        denial_reason: str | None,
        reference_jti_hash: str | None,
        reference_expires_at: datetime | None,
        correlation_id: UUID,
    ) -> None:
        self.session.execute(
            text(
                """
                insert into community_intake.sensitive_read_events (
                  attachment_id, actor_subject_hash, purpose, outcome,
                  denial_reason, reference_jti_hash, reference_expires_at,
                  correlation_id
                ) values (
                  :attachment_id, :actor_hash, :purpose, :outcome,
                  :denial_reason, :reference_jti_hash, :reference_expires_at,
                  :correlation_id
                )
                """
            ),
            {
                "attachment_id": attachment_id,
                "actor_hash": actor_hash,
                "purpose": purpose,
                "outcome": outcome,
                "denial_reason": denial_reason,
                "reference_jti_hash": reference_jti_hash,
                "reference_expires_at": reference_expires_at,
                "correlation_id": correlation_id,
            },
        )

    def _retention(
        self,
        *,
        submission_id: UUID,
        subject_hash: str,
        action: str,
        reason: str,
        details: dict[str, object],
        correlation_id: UUID,
    ) -> None:
        self.session.execute(
            text(
                """
                insert into community_intake.retention_events (
                  submission_id, contributor_subject_hash, action, reason,
                  details, correlation_id
                ) values (
                  :submission_id, :subject_hash, :action, :reason,
                  cast(:details as jsonb), :correlation_id
                )
                """
            ),
            {
                "submission_id": submission_id,
                "subject_hash": subject_hash,
                "action": action,
                "reason": reason,
                "details": json.dumps(details),
                "correlation_id": correlation_id,
            },
        )

    def _outbox(
        self,
        *,
        event_type: str,
        aggregate_id: str,
        aggregate_version: int | None,
        idempotency_key: str,
        correlation_id: UUID,
        payload: dict[str, object],
        aggregate_type: str = "community_submission",
    ) -> None:
        _insert_outbox_event(
            self.session,
            event_type=event_type,
            aggregate_type=aggregate_type,
            aggregate_id=aggregate_id,
            aggregate_version=aggregate_version,
            idempotency_key=idempotency_key,
            correlation_id=correlation_id,
            payload=payload,
        )


def _insert_outbox_event(
    session: Session,
    *,
    event_type: str,
    aggregate_type: str,
    aggregate_id: str,
    aggregate_version: int | None,
    idempotency_key: str,
    correlation_id: UUID,
    payload: dict[str, object],
) -> None:
    envelope = IntegrationEventEnvelope(
        event_type=event_type,
        source_context="community_intake",
        aggregate=AggregateReference(
            type=aggregate_type,
            id=aggregate_id,
            version=aggregate_version,
        ),
        idempotency_key=idempotency_key,
        correlation_id=correlation_id,
        payload=payload,
    )
    record = envelope.to_outbox_record()
    session.execute(
        text(
            """
            insert into integration.outbox_events (
              event_id, schema_version, event_type, event_version, source_context,
              aggregate_type, aggregate_id, aggregate_version, idempotency_key,
              correlation_id, causation_id, occurred_at, payload
            ) values (
              :event_id, :schema_version, :event_type, :event_version, :source_context,
              :aggregate_type, :aggregate_id, :aggregate_version, :idempotency_key,
              :correlation_id, :causation_id, :occurred_at, cast(:payload as jsonb)
            )
            """
        ),
        {**record, "payload": json.dumps(record["payload"])},
    )


def anonymize_community_intake_account(
    session: Session,
    account_id: UUID,
    *,
    reason: str,
    correlation_id: UUID,
    allow_tombstone_replay: bool = False,
) -> dict[str, int]:
    state = session.execute(
        text("select state::text from identity.accounts where account_id = :account_id"),
        {"account_id": account_id},
    ).scalar_one_or_none()
    allowed_states = {AccountState.DELETING.value}
    if allow_tombstone_replay:
        allowed_states.update(
            {
                AccountState.ACTIVE.value,
                AccountState.SUSPENDED.value,
                AccountState.DELETED.value,
            }
        )
    if state not in allowed_states:
        raise CommunityIntakeConflictError(
            "Community Intake data can be anonymized only while account is deleting"
        )
    subject_hash = _subject_hash(account_id)
    attachments = (
        session.execute(
            text(
                """
            with target as (
              select attachment.attachment_id, attachment.submission_id,
                     attachment.state::text as prior_state
              from community_intake.attachments attachment
              join community_intake.submissions submission
                on submission.submission_id = attachment.submission_id
              where submission.account_id = :account_id
            )
            update community_intake.attachments attachment
            set state = 'deleted', body_deleted_at = coalesce(body_deleted_at, now()),
                original_filename = '[deleted]', updated_at = now()
            from target
            where attachment.attachment_id = target.attachment_id
            returning attachment.attachment_id, attachment.submission_id,
                      target.prior_state
            """
            ),
            {"account_id": account_id},
        )
        .mappings()
        .all()
    )
    attachment_count = len(attachments)
    for attachment in attachments:
        if attachment["prior_state"] == AttachmentState.DELETED.value:
            continue
        attachment_id = UUID(str(attachment["attachment_id"]))
        submission_id = UUID(str(attachment["submission_id"]))
        _insert_outbox_event(
            session,
            event_type="community.attachment.deletion_requested",
            aggregate_type="community_attachment",
            aggregate_id=str(attachment_id),
            aggregate_version=None,
            idempotency_key=f"attachment-delete:{attachment_id}:account_deleting",
            correlation_id=correlation_id,
            payload={
                "attachment_id": str(attachment_id),
                "submission_id": str(submission_id),
                "reason_code": "account_deleting",
            },
        )
    submissions = (
        session.execute(
            text(
                """
            update community_intake.submissions
            set account_id = null, draft_content = '{}'::jsonb,
                anonymized_at = now(), updated_at = now()
            where account_id = :account_id
            returning submission_id
            """
            ),
            {"account_id": account_id},
        )
        .scalars()
        .all()
    )
    for submission_id in submissions:
        session.execute(
            text(
                """
                insert into community_intake.retention_events (
                  submission_id, contributor_subject_hash, action, reason,
                  details, correlation_id
                ) values (
                  :submission_id, :subject_hash, 'anonymized', :reason,
                  cast(:details as jsonb), :correlation_id
                )
                """
            ),
            {
                "submission_id": submission_id,
                "subject_hash": subject_hash,
                "reason": reason,
                "details": json.dumps({"attachments_deleted": attachment_count}),
                "correlation_id": correlation_id,
            },
        )
    return {
        "community_submissions_anonymized": len(submissions),
        "community_attachments_deleted": attachment_count,
    }


def _subject_hash(account_id: UUID) -> str:
    return hashlib.sha256(f"community-intake-account:{account_id}".encode()).hexdigest()


def _scoped_key(account_id: UUID, idempotency_key: str) -> str:
    digest = hashlib.sha256(f"{account_id}:{idempotency_key}".encode()).hexdigest()
    return f"community-intake:{digest}"


def _command_hash(command: Any) -> str:
    material = command.model_dump(mode="json", exclude={"idempotency_key"})
    return _canonical_hash(material)


def _canonical_hash(value: object) -> str:
    serialized = json.dumps(value, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode()).hexdigest()


def _json_value(value: Any) -> Any:
    if isinstance(value, str):
        return json.loads(value)
    return value


def default_storage(
    signing_key: str,
    ttl_seconds: int,
    *,
    supabase_url: str | None = None,
    service_role_key: str | None = None,
) -> PrivateAttachmentStorage:
    if supabase_url and service_role_key:
        return SupabasePrivateAttachmentStorage(
            signing_key=signing_key,
            ttl_seconds=ttl_seconds,
            supabase_url=supabase_url,
            service_role_key=service_role_key,
        )
    return OpaqueStorageReferenceSigner(
        signing_key=signing_key,
        ttl_seconds=ttl_seconds,
    )
