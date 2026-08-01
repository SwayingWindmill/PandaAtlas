from __future__ import annotations

import base64
import hashlib
import json
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.community_intake.journey_models import (
    AssertionResultInput,
    AssertionResultView,
    ContributorCommandResult,
    ContributorCreateDraftCommand,
    ContributorStatus,
    ContributorStatusEventView,
    ContributorSubmissionAnalytics,
    ContributorSubmissionPage,
    ContributorSubmissionSummary,
    ContributorSubmissionView,
    ContributorSubmitCommand,
    ContributorUpdateDraftCommand,
    ContributorWithdrawCommand,
    DraftStructuredAssertionInput,
    DraftSubmittedSourceInput,
    ProjectContributorStatusCommand,
    RespondInformationRequestCommand,
    StructuredAssertionInput,
)
from app.community_intake.models import (
    AttachmentState,
    AttachmentUploadReservation,
    AttachmentView,
    PrepareAttachmentUploadCommand,
    SubmissionState,
)
from app.community_intake.repository import (
    CommunityIntakeConflictError,
    CommunityIntakeForbiddenError,
    CommunityIntakeNotFoundError,
    CommunityIntakeRepository,
    _canonical_hash,
    _command_hash,
    _json_value,
    _scoped_key,
    _subject_hash,
)
from app.community_intake.storage import (
    PrivateAttachmentStorage,
    StorageReferenceError,
    StorageWriteError,
)
from app.identity.models import RequestIdentity

_TERMINAL_OR_INCORPORATING = {
    ContributorStatus.INCORPORATION_IN_PROGRESS.value,
    ContributorStatus.INCORPORATED_FULL.value,
    ContributorStatus.INCORPORATED_PARTIAL.value,
    ContributorStatus.TARGET_MERGED.value,
    ContributorStatus.TARGET_UNPUBLISHED.value,
}

_ALLOWED_STATUS_TRANSITIONS: dict[str, set[str]] = {
    ContributorStatus.SUBMITTED.value: {
        ContributorStatus.ACTION_REQUIRED.value,
        ContributorStatus.DUPLICATE.value,
        ContributorStatus.OUT_OF_SCOPE.value,
        ContributorStatus.NOT_ACCEPTED.value,
        ContributorStatus.ACCEPTED.value,
        ContributorStatus.TARGET_MERGED.value,
        ContributorStatus.TARGET_UNPUBLISHED.value,
    },
    ContributorStatus.ACTION_REQUIRED.value: {
        ContributorStatus.DUPLICATE.value,
        ContributorStatus.OUT_OF_SCOPE.value,
        ContributorStatus.NOT_ACCEPTED.value,
        ContributorStatus.ACCEPTED.value,
        ContributorStatus.TARGET_MERGED.value,
        ContributorStatus.TARGET_UNPUBLISHED.value,
    },
    ContributorStatus.ACCEPTED.value: {
        ContributorStatus.INCORPORATION_IN_PROGRESS.value,
        ContributorStatus.TARGET_MERGED.value,
        ContributorStatus.TARGET_UNPUBLISHED.value,
    },
    ContributorStatus.INCORPORATION_IN_PROGRESS.value: {
        ContributorStatus.INCORPORATED_FULL.value,
        ContributorStatus.INCORPORATED_PARTIAL.value,
        ContributorStatus.TARGET_MERGED.value,
        ContributorStatus.TARGET_UNPUBLISHED.value,
    },
}


class ContributorJourneyRepository(CommunityIntakeRepository):
    def __init__(self, session: Session, *, storage: PrivateAttachmentStorage) -> None:
        super().__init__(session, storage=storage)

    def create_contributor_draft(
        self,
        identity: RequestIdentity,
        command: ContributorCreateDraftCommand,
        *,
        correlation_id: UUID,
    ) -> ContributorCommandResult:
        self._require_active(identity)
        actor_hash = _subject_hash(identity.account_id)
        command_hash = _command_hash(command)
        self._lock_idempotency(actor_hash, command.idempotency_key)
        replay = self._replay(
            actor_hash,
            command.idempotency_key,
            command_hash,
            expected_event_types=("community.contributor.draft_created",),
        )
        if replay is not None:
            submission_id = UUID(str(replay["target_id"]))
            return ContributorCommandResult(
                submission=self.get_contributor_submission(identity, submission_id)
            )

        self._require_panda_target(command.target_id)
        submission_id = uuid4()
        content = _draft_content(command.draft_content, [], [], None)
        self.session.execute(
            text(
                """
                insert into community_intake.submissions (
                  submission_id, account_id, contributor_subject_hash,
                  submission_type, target_type, target_id, public_version_seen,
                  draft_content, contributor_status
                ) values (
                  :submission_id, :account_id, :subject_hash,
                  :submission_type, :target_type, :target_id, :public_version_seen,
                  cast(:draft_content as jsonb), 'draft'
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
                "draft_content": json.dumps(content),
            },
        )
        status_event_id = self._record_status(
            submission_id=submission_id,
            status=ContributorStatus.DRAFT,
            active_revision_number=None,
            user_visible_reason=None,
            action_required_fields=[],
            target_redirect_id=None,
            source_context="contributor",
            source_event_id=None,
            actor_hash=actor_hash,
            correlation_id=correlation_id,
            idempotency_key=f"status:{command.idempotency_key}",
            assertion_results=[],
        )
        self._set_current_status(
            submission_id,
            status=ContributorStatus.DRAFT,
            status_event_id=status_event_id,
            increment_version=False,
        )
        self._audit(
            event_type="community.contributor.draft_created",
            actor_hash=actor_hash,
            submission_id=submission_id,
            target_type="submission",
            target_id=str(submission_id),
            outcome="created",
            reason=None,
            details={"command_sha256": command_hash, "locale": command.locale},
            correlation_id=correlation_id,
            idempotency_key=command.idempotency_key,
        )
        self._journey_event(
            submission_id=submission_id,
            subject_hash=actor_hash,
            event_type="draft_created",
            locale=command.locale,
            details={"submission_type": command.submission_type.value},
            correlation_id=correlation_id,
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
        return ContributorCommandResult(
            submission=self.get_contributor_submission(identity, submission_id)
        )

    def update_contributor_draft(
        self,
        identity: RequestIdentity,
        submission_id: UUID,
        command: ContributorUpdateDraftCommand,
        *,
        if_match: str,
        correlation_id: UUID,
    ) -> ContributorCommandResult:
        self._require_active(identity)
        actor_hash = _subject_hash(identity.account_id)
        command_hash = _command_hash(command)
        self._lock_idempotency(actor_hash, command.idempotency_key)
        replay = self._replay(
            actor_hash,
            command.idempotency_key,
            command_hash,
            expected_event_types=("community.contributor.draft_saved",),
            expected_submission_id=submission_id,
        )
        if replay is not None:
            return ContributorCommandResult(
                submission=self.get_contributor_submission(identity, submission_id)
            )

        row = self._owned_submission(identity.account_id, submission_id, for_update=True)
        self._require_submission_etag(if_match, submission_id, int(row["version"]))
        if row["state"] != SubmissionState.DRAFT.value:
            self.session.rollback()
            raise CommunityIntakeConflictError("only a draft submission can be edited")
        if int(row["version"]) != command.expected_version:
            self.session.rollback()
            raise CommunityIntakeConflictError("submission version does not match")
        next_version = int(row["version"]) + 1
        content = _draft_content(
            {}, command.assertions, command.sources, command.additional_context
        )
        self.session.execute(
            text(
                """
                update community_intake.submissions
                set draft_content = cast(:draft_content as jsonb),
                    public_version_seen = :public_version_seen,
                    version = :version,
                    expires_at = now() + interval '90 days',
                    updated_at = now()
                where submission_id = :submission_id
                """
            ),
            {
                "submission_id": submission_id,
                "draft_content": json.dumps(content),
                "public_version_seen": command.public_version_seen,
                "version": next_version,
            },
        )
        self._audit(
            event_type="community.contributor.draft_saved",
            actor_hash=actor_hash,
            submission_id=submission_id,
            target_type="submission",
            target_id=str(submission_id),
            outcome="updated",
            reason=None,
            details={
                "command_sha256": command_hash,
                "version": next_version,
                "assertion_count": len(command.assertions),
                "locale": command.locale,
            },
            correlation_id=correlation_id,
            idempotency_key=command.idempotency_key,
        )
        self._journey_event(
            submission_id=submission_id,
            subject_hash=actor_hash,
            event_type="draft_saved",
            locale=command.locale,
            details={"assertion_count": len(command.assertions)},
            correlation_id=correlation_id,
        )
        self.session.commit()
        return ContributorCommandResult(
            submission=self.get_contributor_submission(identity, submission_id)
        )

    def prepare_contributor_attachment(
        self,
        identity: RequestIdentity,
        submission_id: UUID,
        command: PrepareAttachmentUploadCommand,
        *,
        if_match: str,
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
            return super().prepare_attachment_upload(
                identity, submission_id, command, correlation_id=correlation_id
            )
        row = self._owned_journey_submission(identity.account_id, submission_id, for_update=True)
        self._require_submission_etag(if_match, submission_id, int(row["version"]))
        return super().prepare_attachment_upload(
            identity, submission_id, command, correlation_id=correlation_id
        )

    def upload_contributor_attachment(
        self,
        identity: RequestIdentity,
        attachment_id: UUID,
        *,
        idempotency_key: str,
        upload_reference: str,
        original_filename: str,
        media_type: str,
        content: bytes,
        if_match: str,
        correlation_id: UUID,
    ) -> AttachmentView:
        self._require_active(identity)
        self._require_not_restricted(identity, "attachment")
        actor_hash = _subject_hash(identity.account_id)
        content_sha256 = hashlib.sha256(content).hexdigest()
        command_hash = _canonical_hash(
            {
                "attachment_id": str(attachment_id),
                "original_filename": original_filename,
                "media_type": media_type,
                "byte_size": len(content),
                "content_sha256": content_sha256,
            }
        )
        self._lock_idempotency(actor_hash, idempotency_key)
        replay = self._replay(
            actor_hash,
            idempotency_key,
            command_hash,
            expected_event_types=("community.contributor.attachment_uploaded",),
            expected_target_id=str(attachment_id),
        )
        if replay is not None:
            return self._attachment_for_owner(identity.account_id, attachment_id)
        row = self._attachment_row(attachment_id, for_update=True)
        self._require_attachment_owner(row, identity.account_id)
        submission_id = UUID(str(row["submission_id"]))
        submission = self._owned_journey_submission(
            identity.account_id, submission_id, for_update=True
        )
        self._require_submission_etag(if_match, submission_id, int(submission["version"]))
        if row["upload_completed_at"] is not None:
            self.session.rollback()
            raise CommunityIntakeConflictError("attachment upload is already complete")
        if original_filename != row["original_filename"]:
            self.session.rollback()
            raise CommunityIntakeConflictError("uploaded filename does not match reservation")
        if media_type != row["media_type"] or len(content) != int(row["byte_size"]):
            self.session.rollback()
            raise CommunityIntakeConflictError("uploaded file does not match reservation")
        try:
            self.storage.verify_upload_reference(
                upload_reference,
                attachment_id=str(attachment_id),
                media_type=media_type,
                byte_size=len(content),
            )
            object_version = self.storage.upload_content(
                bucket=str(row["storage_bucket"]),
                object_key=str(row["storage_object_key"]),
                content=content,
                media_type=media_type,
            )
        except StorageReferenceError as error:
            self.session.rollback()
            raise CommunityIntakeConflictError(
                "upload reference is invalid, expired, or belongs to another attachment"
            ) from error
        except StorageWriteError:
            self.session.rollback()
            raise
        self.session.execute(
            text(
                """
                update community_intake.attachments
                set object_version = :object_version,
                    content_sha256 = :content_sha256,
                    upload_completed_at = now(), updated_at = now()
                where attachment_id = :attachment_id
                """
            ),
            {
                "attachment_id": attachment_id,
                "object_version": object_version[:255],
                "content_sha256": content_sha256,
            },
        )
        self._audit(
            event_type="community.contributor.attachment_uploaded",
            actor_hash=actor_hash,
            submission_id=submission_id,
            target_type="attachment",
            target_id=str(attachment_id),
            outcome="quarantined",
            reason=None,
            details={
                "command_sha256": command_hash,
                "media_type": media_type,
                "byte_size": len(content),
            },
            correlation_id=correlation_id,
            idempotency_key=idempotency_key,
        )
        self._outbox(
            event_type="community.attachment.quarantined",
            aggregate_type="community_attachment",
            aggregate_id=str(attachment_id),
            aggregate_version=1,
            idempotency_key=_scoped_key(identity.account_id, idempotency_key),
            correlation_id=correlation_id,
            payload={
                "attachment_id": str(attachment_id),
                "submission_id": str(submission_id),
                "state": AttachmentState.QUARANTINED.value,
                "media_type": media_type,
                "byte_size": len(content),
            },
        )
        self._journey_event(
            submission_id=submission_id,
            subject_hash=actor_hash,
            event_type="evidence_uploaded",
            locale=None,
            details={"attachment_id": str(attachment_id), "media_type": media_type},
            correlation_id=correlation_id,
        )
        self.session.commit()
        return self._attachment_for_owner(identity.account_id, attachment_id)

    def submit_contributor(
        self,
        identity: RequestIdentity,
        submission_id: UUID,
        command: ContributorSubmitCommand | RespondInformationRequestCommand,
        *,
        if_match: str,
        correlation_id: UUID,
        responding: bool,
    ) -> ContributorCommandResult:
        self._require_active(identity)
        self._require_not_restricted(identity, "submission")
        actor_hash = _subject_hash(identity.account_id)
        command_hash = _command_hash(command)
        event_type = (
            "community.contributor.information_response_submitted"
            if responding
            else "community.contributor.submitted"
        )
        self._lock_idempotency(actor_hash, command.idempotency_key)
        replay = self._replay(
            actor_hash,
            command.idempotency_key,
            command_hash,
            expected_event_types=(event_type,),
            expected_submission_id=submission_id,
        )
        if replay is not None:
            return ContributorCommandResult(
                submission=self.get_contributor_submission(identity, submission_id),
                inline_confirmation=True,
                notification_created=False,
            )

        row = self._owned_journey_submission(identity.account_id, submission_id, for_update=True)
        self._require_submission_etag(if_match, submission_id, int(row["version"]))
        if row["state"] not in {SubmissionState.DRAFT.value, SubmissionState.SUBMITTED.value}:
            self.session.rollback()
            raise CommunityIntakeConflictError("submission cannot accept another revision")
        if int(row["version"]) != command.expected_version:
            self.session.rollback()
            raise CommunityIntakeConflictError("submission version does not match")
        if responding:
            if row["contributor_status"] != ContributorStatus.ACTION_REQUIRED.value:
                self.session.rollback()
                raise CommunityIntakeConflictError(
                    "submission is not awaiting contributor information"
                )
            request_event_id = getattr(command, "request_status_event_id", None)
            if request_event_id != row["current_status_event_id"]:
                self.session.rollback()
                raise CommunityIntakeConflictError("information request is no longer current")
        elif row["contributor_status"] == ContributorStatus.ACTION_REQUIRED.value:
            self.session.rollback()
            raise CommunityIntakeConflictError(
                "use the information-response command for an action-required submission"
            )
        elif row["contributor_status"] in _TERMINAL_OR_INCORPORATING:
            self.session.rollback()
            raise CommunityIntakeConflictError("submission cannot accept another revision")

        self._validate_structured_evidence(submission_id, command.assertions, command.sources)
        revision_number = int(row["latest_revision_number"]) + 1
        content = {
            "schema_version": 1,
            "assertions": [assertion.model_dump(mode="json") for assertion in command.assertions],
            "additional_context": command.additional_context,
            "confirmation": True,
        }
        content_hash = _canonical_hash(content)
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
                "content": json.dumps(content),
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
            {"submission_id": submission_id, "revision_number": revision_number},
        )
        next_version = int(row["version"]) + 1
        self.session.execute(
            text(
                """
                update community_intake.submissions
                set state = 'submitted',
                    contributor_status = 'submitted',
                    draft_content = cast(:draft_content as jsonb),
                    public_version_seen = :public_version_seen,
                    version = :version,
                    latest_revision_number = :revision_number,
                    submitted_at = coalesce(submitted_at, now()),
                    contributor_status_updated_at = now(),
                    updated_at = now()
                where submission_id = :submission_id
                """
            ),
            {
                "submission_id": submission_id,
                "draft_content": json.dumps(content),
                "public_version_seen": command.public_version_seen,
                "version": next_version,
                "revision_number": revision_number,
            },
        )
        status_event_id = self._record_status(
            submission_id=submission_id,
            status=ContributorStatus.SUBMITTED,
            active_revision_number=revision_number,
            user_visible_reason=None,
            action_required_fields=[],
            target_redirect_id=None,
            source_context="contributor",
            source_event_id=None,
            actor_hash=actor_hash,
            correlation_id=correlation_id,
            idempotency_key=f"status:{command.idempotency_key}",
            assertion_results=[
                AssertionResultInput(
                    assertion_key=assertion.assertion_key,
                    disposition="pending",
                )
                for assertion in command.assertions
            ],
        )
        self._set_current_status(
            submission_id,
            status=ContributorStatus.SUBMITTED,
            status_event_id=status_event_id,
            increment_version=False,
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
                "assertion_count": len(command.assertions),
                "source_count": len(command.sources),
                "locale": command.locale,
                "inline_confirmation": True,
                "notification_created": False,
            },
            correlation_id=correlation_id,
            idempotency_key=command.idempotency_key,
        )
        journey_type = "information_response_submitted" if responding else "formal_submission"
        self._journey_event(
            submission_id=submission_id,
            subject_hash=actor_hash,
            event_type=journey_type,
            locale=command.locale,
            details={
                "revision_number": revision_number,
                "assertion_count": len(command.assertions),
            },
            correlation_id=correlation_id,
        )
        public_event_type = (
            "community.submission.information_response_submitted"
            if responding
            else "community.submission.submitted"
        )
        self._outbox(
            event_type=public_event_type,
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
                "assertion_count": len(command.assertions),
                "source_count": len(command.sources),
                "inline_confirmation": True,
                "notify_contributor": False,
            },
        )
        self.session.commit()
        return ContributorCommandResult(
            submission=self.get_contributor_submission(identity, submission_id),
            inline_confirmation=True,
            notification_created=False,
        )

    def withdraw_contributor(
        self,
        identity: RequestIdentity,
        submission_id: UUID,
        command: ContributorWithdrawCommand,
        *,
        if_match: str,
        correlation_id: UUID,
    ) -> ContributorCommandResult:
        self._require_active(identity)
        actor_hash = _subject_hash(identity.account_id)
        command_hash = _command_hash(command)
        self._lock_idempotency(actor_hash, command.idempotency_key)
        replay = self._replay(
            actor_hash,
            command.idempotency_key,
            command_hash,
            expected_event_types=("community.contributor.withdrawn",),
            expected_submission_id=submission_id,
        )
        if replay is not None:
            return ContributorCommandResult(
                submission=self.get_contributor_submission(identity, submission_id)
            )

        row = self._owned_journey_submission(identity.account_id, submission_id, for_update=True)
        self._require_submission_etag(if_match, submission_id, int(row["version"]))
        if row["state"] not in {SubmissionState.DRAFT.value, SubmissionState.SUBMITTED.value}:
            self.session.rollback()
            raise CommunityIntakeConflictError("submission cannot be withdrawn")
        if row["contributor_status"] in _TERMINAL_OR_INCORPORATING:
            self.session.rollback()
            raise CommunityIntakeConflictError(
                "submission cannot be withdrawn after incorporation starts"
            )
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
        status_event_id = self._record_status(
            submission_id=submission_id,
            status=ContributorStatus.WITHDRAWN,
            active_revision_number=int(row["latest_revision_number"]) or None,
            user_visible_reason=command.reason,
            action_required_fields=[],
            target_redirect_id=None,
            source_context="contributor",
            source_event_id=None,
            actor_hash=actor_hash,
            correlation_id=correlation_id,
            idempotency_key=f"status:{command.idempotency_key}",
            assertion_results=[],
        )
        self._set_current_status(
            submission_id,
            status=ContributorStatus.WITHDRAWN,
            status_event_id=status_event_id,
            increment_version=False,
        )
        self._audit(
            event_type="community.contributor.withdrawn",
            actor_hash=actor_hash,
            submission_id=submission_id,
            target_type="submission",
            target_id=str(submission_id),
            outcome="withdrawn",
            reason=command.reason,
            details={
                "command_sha256": command_hash,
                "version": next_version,
                "locale": command.locale,
            },
            correlation_id=correlation_id,
            idempotency_key=command.idempotency_key,
        )
        self._journey_event(
            submission_id=submission_id,
            subject_hash=actor_hash,
            event_type="withdrawn",
            locale=command.locale,
            details={},
            correlation_id=correlation_id,
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
                "reevaluate_unpublished_change_sets": True,
                "notify_contributor": False,
            },
        )
        self.session.commit()
        return ContributorCommandResult(
            submission=self.get_contributor_submission(identity, submission_id)
        )

    def project_contributor_status(
        self,
        actor: RequestIdentity,
        submission_id: UUID,
        command: ProjectContributorStatusCommand,
        *,
        correlation_id: UUID,
    ) -> ContributorSubmissionView:
        self._require_capability(actor, "community_intake.status.project")
        actor_hash = _subject_hash(actor.account_id)
        command_hash = _command_hash(command)
        self._lock_idempotency(actor_hash, command.idempotency_key)
        replay = self._replay(
            actor_hash,
            command.idempotency_key,
            command_hash,
            expected_event_types=("community.contributor.status_projected",),
            expected_submission_id=submission_id,
        )
        row = self._journey_submission(submission_id, for_update=replay is None)
        if replay is not None:
            return self._contributor_view(row)
        if row["account_id"] is None:
            self.session.rollback()
            raise CommunityIntakeConflictError(
                "an anonymized submission cannot receive status updates"
            )
        if row["account_id"] == actor.account_id:
            self.session.rollback()
            raise CommunityIntakeForbiddenError(
                "reviewer cannot project their own submission status"
            )
        if int(row["version"]) != command.expected_version:
            self.session.rollback()
            raise CommunityIntakeConflictError("submission version does not match")
        allowed = _ALLOWED_STATUS_TRANSITIONS.get(str(row["contributor_status"]), set())
        if command.status.value not in allowed:
            self.session.rollback()
            raise CommunityIntakeConflictError("contributor status transition is not allowed")
        if command.active_revision_number is not None and (
            command.active_revision_number > int(row["latest_revision_number"])
        ):
            self.session.rollback()
            raise CommunityIntakeConflictError("active revision does not exist")
        if command.assertion_results:
            self._require_assertion_keys(
                submission_id,
                command.active_revision_number or int(row["latest_revision_number"]),
                command.assertion_results,
            )
        next_version = int(row["version"]) + 1
        status_event_id = self._record_status(
            submission_id=submission_id,
            status=command.status,
            active_revision_number=command.active_revision_number,
            user_visible_reason=command.user_visible_reason,
            action_required_fields=command.action_required_fields,
            target_redirect_id=command.target_redirect_id,
            source_context=command.source_context,
            source_event_id=command.source_event_id,
            actor_hash=actor_hash,
            correlation_id=correlation_id,
            idempotency_key=f"status:{command.idempotency_key}",
            assertion_results=command.assertion_results,
        )
        self.session.execute(
            text(
                """
                update community_intake.submissions
                set contributor_status = :status,
                    current_status_event_id = :status_event_id,
                    contributor_status_updated_at = now(),
                    version = :version,
                    updated_at = now()
                where submission_id = :submission_id
                """
            ),
            {
                "submission_id": submission_id,
                "status": command.status.value,
                "status_event_id": status_event_id,
                "version": next_version,
            },
        )
        self._audit(
            event_type="community.contributor.status_projected",
            actor_hash=actor_hash,
            submission_id=submission_id,
            target_type="submission",
            target_id=str(submission_id),
            outcome=command.status.value,
            reason=command.user_visible_reason,
            details={
                "command_sha256": command_hash,
                "version": next_version,
                "source_context": command.source_context,
                "assertion_result_count": len(command.assertion_results),
            },
            correlation_id=correlation_id,
            idempotency_key=command.idempotency_key,
        )
        self._outbox(
            event_type="community.submission.contributor_status_changed",
            aggregate_id=str(submission_id),
            aggregate_version=next_version,
            idempotency_key=f"community-status:{submission_id}:{command.idempotency_key}",
            correlation_id=correlation_id,
            payload={
                "account_id": str(row["account_id"]),
                "submission_id": str(submission_id),
                "status": command.status.value,
                "active_revision_number": command.active_revision_number,
                "notification_link": f"/me/submissions/{submission_id}",
                "notify_contributor": True,
                "source_context": command.source_context,
            },
        )
        self.session.commit()
        return self._contributor_view(self._journey_submission(submission_id))

    def list_contributor_submissions(
        self,
        identity: RequestIdentity,
        *,
        limit: int = 20,
        cursor: str | None = None,
    ) -> ContributorSubmissionPage:
        self._require_active(identity)
        cursor_created_at, cursor_id = _decode_cursor(cursor)
        rows = (
            self.session.execute(
                text(
                    """
                select submission.submission_id, submission.submission_type::text,
                       submission.target_type::text, submission.target_id,
                       submission.public_version_seen, submission.state::text,
                       submission.contributor_status::text, submission.version,
                       submission.latest_revision_number, submission.created_at,
                       submission.updated_at, status.user_visible_reason
                from community_intake.submissions submission
                left join community_intake.contributor_status_events status
                  on status.status_event_id = submission.current_status_event_id
                where submission.account_id = :account_id
                  and (
                    cast(:cursor_created_at as timestamptz) is null
                    or (submission.created_at, submission.submission_id)
                       < (
                         cast(:cursor_created_at as timestamptz),
                         cast(:cursor_id as uuid)
                       )
                  )
                order by submission.created_at desc, submission.submission_id desc
                limit :fetch_limit
                """
                ),
                {
                    "account_id": identity.account_id,
                    "cursor_created_at": cursor_created_at,
                    "cursor_id": cursor_id,
                    "fetch_limit": limit + 1,
                },
            )
            .mappings()
            .all()
        )
        items = [ContributorSubmissionSummary.model_validate(dict(row)) for row in rows[:limit]]
        next_cursor = None
        if len(rows) > limit:
            last = rows[limit - 1]
            next_cursor = _encode_cursor(last["created_at"], last["submission_id"])
        return ContributorSubmissionPage(items=items, next_cursor=next_cursor)

    def get_contributor_submission(
        self,
        identity: RequestIdentity,
        submission_id: UUID,
    ) -> ContributorSubmissionView:
        self._require_active(identity)
        row = self._owned_journey_submission(identity.account_id, submission_id, for_update=False)
        return self._contributor_view(row)

    def contributor_analytics(self, identity: RequestIdentity) -> ContributorSubmissionAnalytics:
        self._require_active(identity)
        rows = (
            self.session.execute(
                text(
                    """
                select contributor_status::text as status, count(*) as count
                from community_intake.submissions
                where account_id = :account_id
                group by contributor_status
                """
                ),
                {"account_id": identity.account_id},
            )
            .mappings()
            .all()
        )
        by_status = {ContributorStatus(str(row["status"])): int(row["count"]) for row in rows}
        total = sum(by_status.values())
        terminal = {
            ContributorStatus.DUPLICATE,
            ContributorStatus.OUT_OF_SCOPE,
            ContributorStatus.NOT_ACCEPTED,
            ContributorStatus.INCORPORATED_FULL,
            ContributorStatus.INCORPORATED_PARTIAL,
            ContributorStatus.WITHDRAWN,
            ContributorStatus.EXPIRED,
            ContributorStatus.TARGET_MERGED,
            ContributorStatus.TARGET_UNPUBLISHED,
        }
        open_count = total - sum(by_status.get(status, 0) for status in terminal)
        latest = self.session.execute(
            text(
                """
                select max(updated_at) from community_intake.submissions
                where account_id = :account_id
                """
            ),
            {"account_id": identity.account_id},
        ).scalar_one()
        return ContributorSubmissionAnalytics(
            total=total,
            open_count=open_count,
            action_required_count=by_status.get(ContributorStatus.ACTION_REQUIRED, 0),
            by_status=by_status,
            latest_activity_at=latest,
        )

    def _validate_structured_evidence(
        self,
        submission_id: UUID,
        assertions: list[StructuredAssertionInput],
        sources: list[Any],
    ) -> None:
        normalized_sources = {
            " ".join(source.locator.strip().lower().split()) for source in sources
        }
        referenced_source_locators = {
            " ".join(locator.strip().lower().split())
            for assertion in assertions
            for locator in assertion.source_locators
        }
        if referenced_source_locators - normalized_sources:
            self.session.rollback()
            raise CommunityIntakeConflictError("assertion references an omitted source")
        attachment_ids = {
            attachment_id for assertion in assertions for attachment_id in assertion.attachment_ids
        }
        rows = (
            self.session.execute(
                text(
                    """
                select attachment_id, upload_completed_at, state::text
                from community_intake.attachments
                where submission_id = :submission_id and state <> 'deleted'
                """
                ),
                {"submission_id": submission_id},
            )
            .mappings()
            .all()
        )
        by_id = {UUID(str(row["attachment_id"])): row for row in rows}
        if attachment_ids - set(by_id):
            self.session.rollback()
            raise CommunityIntakeConflictError("assertion references another submission attachment")
        for row in rows:
            if row["upload_completed_at"] is None:
                self.session.rollback()
                raise CommunityIntakeConflictError(
                    "all reserved attachments must complete upload before submission"
                )
            if row["state"] in {
                AttachmentState.INFECTED.value,
                AttachmentState.SCAN_FAILED.value,
            }:
                self.session.rollback()
                raise CommunityIntakeConflictError(
                    "infected or failed evidence must be removed or rescanned before submission"
                )
        if not normalized_sources and not attachment_ids:
            self.session.rollback()
            raise CommunityIntakeConflictError(
                "formal submission requires a referenced source or evidence attachment"
            )

    def _require_assertion_keys(
        self,
        submission_id: UUID,
        revision_number: int,
        results: list[AssertionResultInput],
    ) -> None:
        content = self.session.execute(
            text(
                """
                select content from community_intake.submission_revisions
                where submission_id = :submission_id and revision_number = :revision_number
                """
            ),
            {"submission_id": submission_id, "revision_number": revision_number},
        ).scalar_one_or_none()
        if content is None:
            self.session.rollback()
            raise CommunityIntakeConflictError("active revision does not exist")
        payload = _json_value(content)
        keys = {
            str(item.get("assertion_key"))
            for item in payload.get("assertions", [])
            if isinstance(item, dict) and item.get("assertion_key")
        }
        requested = {result.assertion_key for result in results}
        if requested - keys:
            self.session.rollback()
            raise CommunityIntakeConflictError("assertion result references an unknown assertion")

    def _record_status(
        self,
        *,
        submission_id: UUID,
        status: ContributorStatus,
        active_revision_number: int | None,
        user_visible_reason: str | None,
        action_required_fields: list[str],
        target_redirect_id: str | None,
        source_context: str,
        source_event_id: UUID | None,
        actor_hash: str,
        correlation_id: UUID,
        idempotency_key: str,
        assertion_results: list[AssertionResultInput],
    ) -> UUID:
        status_event_id = uuid4()
        self.session.execute(
            text(
                """
                insert into community_intake.contributor_status_events (
                  status_event_id, submission_id, status, active_revision_number,
                  user_visible_reason, action_required_fields, target_redirect_id,
                  source_context, source_event_id, actor_subject_hash,
                  correlation_id, idempotency_key
                ) values (
                  :status_event_id, :submission_id, :status, :active_revision_number,
                  :user_visible_reason, cast(:action_required_fields as jsonb),
                  :target_redirect_id, :source_context, :source_event_id, :actor_hash,
                  :correlation_id, :idempotency_key
                )
                """
            ),
            {
                "status_event_id": status_event_id,
                "submission_id": submission_id,
                "status": status.value,
                "active_revision_number": active_revision_number,
                "user_visible_reason": user_visible_reason,
                "action_required_fields": json.dumps(action_required_fields),
                "target_redirect_id": target_redirect_id,
                "source_context": source_context,
                "source_event_id": source_event_id,
                "actor_hash": actor_hash,
                "correlation_id": correlation_id,
                "idempotency_key": idempotency_key,
            },
        )
        revision_number = active_revision_number or 1
        for result in assertion_results:
            self.session.execute(
                text(
                    """
                    insert into community_intake.contributor_assertion_results (
                      status_event_id, submission_id, revision_number, assertion_key,
                      disposition, explanation, public_reference_id
                    ) values (
                      :status_event_id, :submission_id, :revision_number, :assertion_key,
                      :disposition, :explanation, :public_reference_id
                    )
                    """
                ),
                {
                    "status_event_id": status_event_id,
                    "submission_id": submission_id,
                    "revision_number": revision_number,
                    "assertion_key": result.assertion_key,
                    "disposition": result.disposition.value,
                    "explanation": result.explanation,
                    "public_reference_id": result.public_reference_id,
                },
            )
        return status_event_id

    def _set_current_status(
        self,
        submission_id: UUID,
        *,
        status: ContributorStatus,
        status_event_id: UUID,
        increment_version: bool,
    ) -> None:
        self.session.execute(
            text(
                """
                update community_intake.submissions
                set contributor_status = :status,
                    current_status_event_id = :status_event_id,
                    contributor_status_updated_at = now(),
                    version = version + case when :increment_version then 1 else 0 end,
                    updated_at = now()
                where submission_id = :submission_id
                """
            ),
            {
                "submission_id": submission_id,
                "status": status.value,
                "status_event_id": status_event_id,
                "increment_version": increment_version,
            },
        )

    def _journey_event(
        self,
        *,
        submission_id: UUID | None,
        subject_hash: str,
        event_type: str,
        locale: str | None,
        details: dict[str, object],
        correlation_id: UUID,
    ) -> None:
        self.session.execute(
            text(
                """
                insert into community_intake.contributor_journey_events (
                  submission_id, contributor_subject_hash, event_type,
                  locale, details, correlation_id
                ) values (
                  :submission_id, :subject_hash, :event_type,
                  :locale, cast(:details as jsonb), :correlation_id
                )
                """
            ),
            {
                "submission_id": submission_id,
                "subject_hash": subject_hash,
                "event_type": event_type,
                "locale": locale,
                "details": json.dumps(details),
                "correlation_id": correlation_id,
            },
        )

    def _owned_journey_submission(
        self,
        account_id: UUID,
        submission_id: UUID,
        *,
        for_update: bool,
    ) -> Any:
        row = self._journey_submission(submission_id, for_update=for_update)
        if row["account_id"] != account_id:
            raise CommunityIntakeNotFoundError("submission was not found")
        return row

    def _journey_submission(self, submission_id: UUID, *, for_update: bool = False) -> Any:
        suffix = " for update of submission" if for_update else ""
        row = (
            self.session.execute(
                text(
                    """
                select submission.submission_id, submission.account_id,
                       submission.contributor_subject_hash,
                       submission.submission_type::text, submission.target_type::text,
                       submission.target_id, submission.public_version_seen,
                       submission.state::text, submission.contributor_status::text,
                       submission.current_status_event_id, submission.draft_content,
                       submission.version, submission.latest_revision_number,
                       submission.expires_at, submission.submitted_at,
                       submission.withdrawn_at, submission.closed_at,
                       submission.created_at, submission.updated_at,
                       status.user_visible_reason
                from community_intake.submissions submission
                left join community_intake.contributor_status_events status
                  on status.status_event_id = submission.current_status_event_id
                where submission.submission_id = :submission_id
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

    def _contributor_view(self, row: Any) -> ContributorSubmissionView:
        submission_id = UUID(str(row["submission_id"]))
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
        status_rows = (
            self.session.execute(
                text(
                    """
                select status_event_id, status::text, active_revision_number,
                       user_visible_reason, action_required_fields,
                       target_redirect_id, occurred_at
                from community_intake.contributor_status_events
                where submission_id = :submission_id
                order by occurred_at, status_event_id
                """
                ),
                {"submission_id": submission_id},
            )
            .mappings()
            .all()
        )
        result_rows = (
            self.session.execute(
                text(
                    """
                select assertion_key, revision_number, disposition::text,
                       explanation, public_reference_id, created_at
                from community_intake.contributor_assertion_results
                where submission_id = :submission_id
                order by created_at, result_id
                """
                ),
                {"submission_id": submission_id},
            )
            .mappings()
            .all()
        )
        return ContributorSubmissionView.model_validate(
            {
                "submission_id": row["submission_id"],
                "submission_type": row["submission_type"],
                "target_type": row["target_type"],
                "target_id": row["target_id"],
                "public_version_seen": row["public_version_seen"],
                "state": row["state"],
                "contributor_status": row["contributor_status"],
                "version": row["version"],
                "latest_revision_number": row["latest_revision_number"],
                "user_visible_reason": row["user_visible_reason"],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
                "draft_content": _json_value(row["draft_content"]),
                "expires_at": row["expires_at"],
                "submitted_at": row["submitted_at"],
                "withdrawn_at": row["withdrawn_at"],
                "closed_at": row["closed_at"],
                "revisions": revisions,
                "attachments": [self._attachment_view(item) for item in attachments],
                "status_history": [
                    ContributorStatusEventView.model_validate(
                        {
                            **dict(item),
                            "action_required_fields": _json_value(item["action_required_fields"]),
                        }
                    )
                    for item in status_rows
                ],
                "assertion_results": [
                    AssertionResultView.model_validate(dict(item)) for item in result_rows
                ],
            }
        )

    def _require_submission_etag(
        self,
        if_match: str,
        submission_id: UUID,
        version: int,
    ) -> None:
        expected = submission_etag(submission_id, version)
        if if_match.strip() != expected:
            self.session.rollback()
            raise CommunityIntakeConflictError("submission ETag does not match")


def submission_etag(submission_id: UUID, version: int) -> str:
    return f'"submission:{submission_id}:v{version}"'


def _draft_content(
    original: dict[str, Any],
    assertions: list[DraftStructuredAssertionInput | StructuredAssertionInput],
    sources: list[DraftSubmittedSourceInput],
    additional_context: str | None,
) -> dict[str, Any]:
    if assertions or sources or additional_context is not None:
        return {
            "schema_version": 1,
            "assertions": [assertion.model_dump(mode="json") for assertion in assertions],
            "sources": [source.model_dump(mode="json") for source in sources],
            "additional_context": additional_context,
        }
    return original


def _encode_cursor(created_at: datetime, submission_id: UUID) -> str:
    payload = json.dumps(
        {"created_at": created_at.astimezone(UTC).isoformat(), "submission_id": str(submission_id)},
        separators=(",", ":"),
    ).encode()
    return base64.urlsafe_b64encode(payload).decode().rstrip("=")


def _decode_cursor(cursor: str | None) -> tuple[datetime | None, UUID | None]:
    if cursor is None:
        return None, None
    try:
        payload = json.loads(base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4)))
        return datetime.fromisoformat(str(payload["created_at"])), UUID(
            str(payload["submission_id"])
        )
    except (ValueError, KeyError, json.JSONDecodeError) as error:
        raise CommunityIntakeConflictError("submission cursor is invalid") from error
