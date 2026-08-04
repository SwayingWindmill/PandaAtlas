from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.identity.models import RequestIdentity
from app.privacy_operations.models import (
    PrivacyContextState,
    PrivacyExportAccessRead,
    PrivacyExportRead,
    PrivacyExportState,
    PrivacyRequestKind,
    PrivacyRequestState,
)
from app.privacy_operations.service import (
    PrivacyOperationsConflictError,
    PrivacyOperationsForbiddenError,
    PrivacyOperationsNotFoundError,
)

_EXPORT_CONTEXTS = (
    "identity_profile",
    "engagement",
    "community_intake",
    "notification",
)
_EXPORT_SCHEMA_VERSION = 1
_EXPORT_KEY_VERSION = 1


class PrivacyExportReferenceError(ValueError):
    """Raised when a privacy export download reference is invalid or expired."""


class PrivacyExportDecryptionError(RuntimeError):
    """Raised when encrypted export integrity or authentication fails."""


@dataclass(frozen=True)
class EncryptedPrivacyExport:
    nonce: bytes
    ciphertext: bytes
    ciphertext_sha256: str
    plaintext_byte_size: int


@dataclass(frozen=True)
class VerifiedPrivacyExportReference:
    artifact_id: UUID
    request_id: UUID
    account_subject_hash: str
    jti: str
    expires_at: datetime


class PrivacyExportCipher:
    """AES-256-GCM with a per-artifact key derived from a configured root secret."""

    def __init__(self, master_key: str) -> None:
        if len(master_key) < 32:
            raise ValueError("privacy export master key must be at least 32 characters")
        self._root_key = hashlib.sha256(master_key.encode("utf-8")).digest()

    def encrypt(
        self,
        *,
        artifact_id: UUID,
        request_id: UUID,
        account_id: UUID,
        plaintext: bytes,
        schema_version: int = _EXPORT_SCHEMA_VERSION,
        key_version: int = _EXPORT_KEY_VERSION,
    ) -> EncryptedPrivacyExport:
        nonce = os.urandom(12)
        ciphertext = AESGCM(
            self._derive_key(artifact_id=artifact_id, key_version=key_version)
        ).encrypt(
            nonce,
            plaintext,
            self._aad(
                artifact_id=artifact_id,
                request_id=request_id,
                account_id=account_id,
                schema_version=schema_version,
                key_version=key_version,
            ),
        )
        return EncryptedPrivacyExport(
            nonce=nonce,
            ciphertext=ciphertext,
            ciphertext_sha256=hashlib.sha256(ciphertext).hexdigest(),
            plaintext_byte_size=len(plaintext),
        )

    def decrypt(
        self,
        *,
        artifact_id: UUID,
        request_id: UUID,
        account_id: UUID,
        nonce: bytes,
        ciphertext: bytes,
        schema_version: int,
        key_version: int,
    ) -> bytes:
        try:
            return AESGCM(
                self._derive_key(artifact_id=artifact_id, key_version=key_version)
            ).decrypt(
                nonce,
                ciphertext,
                self._aad(
                    artifact_id=artifact_id,
                    request_id=request_id,
                    account_id=account_id,
                    schema_version=schema_version,
                    key_version=key_version,
                ),
            )
        except InvalidTag as error:
            raise PrivacyExportDecryptionError("privacy export authentication failed") from error

    def _derive_key(self, *, artifact_id: UUID, key_version: int) -> bytes:
        if key_version != _EXPORT_KEY_VERSION:
            raise PrivacyExportDecryptionError("unsupported privacy export key version")
        return HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=artifact_id.bytes,
            info=f"zhipanda:privacy-export:key:{key_version}".encode(),
        ).derive(self._root_key)

    @staticmethod
    def _aad(
        *,
        artifact_id: UUID,
        request_id: UUID,
        account_id: UUID,
        schema_version: int,
        key_version: int,
    ) -> bytes:
        return (
            f"{artifact_id}:{request_id}:{account_id}:{schema_version}:{key_version}"
        ).encode()


class PrivacyExportDownloadSigner:
    """Issues short-lived opaque references without exposing database identifiers as URLs."""

    def __init__(self, *, signing_key: str, ttl_seconds: int) -> None:
        if len(signing_key) < 32:
            raise ValueError("privacy export signing key must be at least 32 characters")
        if ttl_seconds < 30 or ttl_seconds > 900:
            raise ValueError("privacy export download TTL must be between 30 and 900 seconds")
        self._key = signing_key.encode("utf-8")
        self._ttl_seconds = ttl_seconds

    def issue(
        self,
        *,
        artifact_id: UUID,
        request_id: UUID,
        account_id: UUID,
        artifact_expires_at: datetime,
        now: datetime | None = None,
    ) -> tuple[str, datetime, str]:
        issued_at = now or datetime.now(UTC)
        expires_at = min(
            issued_at + timedelta(seconds=self._ttl_seconds),
            artifact_expires_at,
        )
        if expires_at <= issued_at:
            raise PrivacyExportReferenceError("privacy export has expired")
        jti = uuid4().hex
        material = {
            "action": "privacy_export_download",
            "artifact_id": str(artifact_id),
            "request_id": str(request_id),
            "account_subject_hash": self.subject_hash(account_id),
            "iat": int(issued_at.timestamp()),
            "exp": int(expires_at.timestamp()),
            "jti": jti,
        }
        payload = json.dumps(material, sort_keys=True, separators=(",", ":")).encode()
        signature = hmac.new(self._key, payload, hashlib.sha256).digest()
        return f"{_urlsafe_encode(payload)}.{_urlsafe_encode(signature)}", expires_at, jti

    def verify(
        self,
        reference: str,
        *,
        now: datetime | None = None,
    ) -> VerifiedPrivacyExportReference:
        try:
            encoded_payload, encoded_signature = reference.split(".", 1)
            payload = _urlsafe_decode(encoded_payload)
            signature = _urlsafe_decode(encoded_signature)
            expected = hmac.new(self._key, payload, hashlib.sha256).digest()
            if not hmac.compare_digest(signature, expected):
                raise PrivacyExportReferenceError("invalid privacy export reference")
            decoded = json.loads(payload)
            if decoded.get("action") != "privacy_export_download":
                raise PrivacyExportReferenceError("invalid privacy export reference action")
            expires_at = datetime.fromtimestamp(int(decoded["exp"]), tz=UTC)
            if expires_at <= (now or datetime.now(UTC)):
                raise PrivacyExportReferenceError("privacy export reference has expired")
            subject_hash = str(decoded["account_subject_hash"])
            if len(subject_hash) != 64:
                raise PrivacyExportReferenceError("invalid privacy export reference subject")
            return VerifiedPrivacyExportReference(
                artifact_id=UUID(str(decoded["artifact_id"])),
                request_id=UUID(str(decoded["request_id"])),
                account_subject_hash=subject_hash,
                jti=str(decoded["jti"]),
                expires_at=expires_at,
            )
        except PrivacyExportReferenceError:
            raise
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
            raise PrivacyExportReferenceError("invalid privacy export reference") from error

    def subject_hash(self, account_id: UUID) -> str:
        return hmac.new(
            self._key,
            b"privacy-export-subject:" + account_id.bytes,
            hashlib.sha256,
        ).hexdigest()


class PrivacyExportBuilder:
    """Builds a strict user-visible export projection from authoritative PostgreSQL state."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def build(
        self,
        *,
        account_id: UUID,
        request_id: UUID,
        generated_at: datetime,
    ) -> bytes:
        account = self.session.execute(
            text(
                """
                select account_id, email, state::text, state_changed_at,
                       created_at, updated_at
                from identity.accounts
                where account_id = :account_id
                """
            ),
            {"account_id": account_id},
        ).mappings().one_or_none()
        if account is None:
            raise PrivacyOperationsNotFoundError("Privacy export account not found")

        follows = self._rows(
            """
            select panda_id, state::text, first_followed_at, followed_at,
                   unfollowed_at, version, updated_at
            from engagement.follows
            where account_id = :account_id
            order by panda_id
            """,
            account_id=account_id,
        )
        engagement_preferences = self._rows(
            """
            select category, channel, enabled, version, updated_at
            from engagement.notification_preferences
            where account_id = :account_id
            order by category, channel
            """,
            account_id=account_id,
        )
        passport = self._rows(
            """
            select panda_id, relationship_state::text, first_followed_at,
                   followed_at, unfollowed_at, contribution_count,
                   projection_version, projected_at
            from engagement.passport_entries
            where account_id = :account_id
            order by panda_id
            """,
            account_id=account_id,
        )

        submissions = self._rows(
            """
            select submission_id, submission_type::text, target_type::text, target_id,
                   public_version_seen, state::text, draft_content, version,
                   latest_revision_number, expires_at, submitted_at, withdrawn_at,
                   closed_at, created_at, updated_at, contributor_status::text,
                   contributor_status_updated_at
            from community_intake.submissions
            where account_id = :account_id
            order by created_at, submission_id
            """,
            account_id=account_id,
        )
        revisions = self._rows(
            """
            select revision.submission_id, revision.revision_number, revision.content,
                   revision.public_version_seen, revision.submitted_at
            from community_intake.submission_revisions revision
            join community_intake.submissions submission
              on submission.submission_id = revision.submission_id
            where submission.account_id = :account_id
            order by revision.submission_id, revision.revision_number
            """,
            account_id=account_id,
        )
        sources = self._rows(
            """
            select source.submission_id, source.revision_number, source.source_kind::text,
                   source.title, source.locator, source.publisher, source.published_on,
                   source.created_at
            from community_intake.submitted_sources source
            join community_intake.submissions submission
              on submission.submission_id = source.submission_id
            where submission.account_id = :account_id
            order by source.submission_id, source.revision_number, source.created_at,
                     source.source_id
            """,
            account_id=account_id,
        )
        attachments = self._rows(
            """
            select attachment.submission_id, attachment.attachment_id,
                   attachment.bound_revision_number, attachment.original_filename,
                   attachment.media_type, attachment.byte_size, attachment.state::text,
                   attachment.upload_completed_at, attachment.metadata_stripped,
                   attachment.body_deleted_at, attachment.created_at, attachment.updated_at
            from community_intake.attachments attachment
            join community_intake.submissions submission
              on submission.submission_id = attachment.submission_id
            where submission.account_id = :account_id
            order by attachment.submission_id, attachment.created_at,
                     attachment.attachment_id
            """,
            account_id=account_id,
        )
        statuses = self._rows(
            """
            select event.submission_id, event.status::text, event.active_revision_number,
                   event.user_visible_reason, event.action_required_fields,
                   event.target_redirect_id, event.occurred_at
            from community_intake.contributor_status_events event
            join community_intake.submissions submission
              on submission.submission_id = event.submission_id
            where submission.account_id = :account_id
            order by event.submission_id, event.occurred_at, event.status_event_id
            """,
            account_id=account_id,
        )
        assertion_results = self._rows(
            """
            select result.submission_id, result.revision_number, result.assertion_key,
                   result.disposition::text, result.explanation,
                   result.public_reference_id, result.created_at
            from community_intake.contributor_assertion_results result
            join community_intake.submissions submission
              on submission.submission_id = result.submission_id
            where submission.account_id = :account_id
            order by result.submission_id, result.revision_number,
                     result.assertion_key, result.created_at
            """,
            account_id=account_id,
        )

        revision_groups = _group_rows(revisions, "submission_id")
        source_groups = _group_rows(sources, "submission_id")
        attachment_groups = _group_rows(attachments, "submission_id")
        status_groups = _group_rows(statuses, "submission_id")
        assertion_groups = _group_rows(assertion_results, "submission_id")
        submission_exports: list[dict[str, Any]] = []
        for submission in submissions:
            submission_id = str(submission["submission_id"])
            submission_revisions: list[dict[str, Any]] = []
            for revision in revision_groups.get(submission_id, []):
                revision_number = int(revision["revision_number"])
                revision_sources = [
                    item
                    for item in source_groups.get(submission_id, [])
                    if int(item["revision_number"]) == revision_number
                ]
                submission_revisions.append({**revision, "sources": revision_sources})
            submission_exports.append(
                {
                    **submission,
                    "revisions": submission_revisions,
                    "attachments": attachment_groups.get(submission_id, []),
                    "status_history": status_groups.get(submission_id, []),
                    "assertion_results": assertion_groups.get(submission_id, []),
                }
            )

        notification_preferences = self._rows(
            """
            select category::text, channel::text, enabled, version, updated_at
            from notification.preferences
            where account_id = :account_id
            order by category, channel
            """,
            account_id=account_id,
        )
        inbox = self._rows(
            """
            select inbox_item_id, category::text, body, body_version, created_at,
                   body_expires_at, body_purged_at, seen_at, read_at, retracted_at,
                   retraction_reason, updated_at
            from notification.inbox_items
            where account_id = :account_id
            order by created_at, inbox_item_id
            """,
            account_id=account_id,
        )

        payload = {
            "schema": "zhipanda.privacy-export.v1",
            "schema_version": _EXPORT_SCHEMA_VERSION,
            "request_id": str(request_id),
            "generated_at": generated_at,
            "account": dict(account),
            "engagement": {
                "follows": follows,
                "preferences": engagement_preferences,
                "passport": passport,
            },
            "submissions": submission_exports,
            "notifications": {
                "preferences": notification_preferences,
                "inbox": inbox,
            },
        }
        return json.dumps(
            _json_value(payload),
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")

    def _rows(self, query: str, *, account_id: UUID) -> list[dict[str, Any]]:
        return [
            _json_value(dict(row))
            for row in self.session.execute(
                text(query),
                {"account_id": account_id},
            ).mappings().all()
        ]


class PrivacyExportService:
    def __init__(
        self,
        session: Session,
        *,
        cipher: PrivacyExportCipher,
        signer: PrivacyExportDownloadSigner,
        artifact_ttl_seconds: int,
    ) -> None:
        if artifact_ttl_seconds < 300 or artifact_ttl_seconds > 86400:
            raise ValueError("privacy export artifact TTL must be between 300 and 86400 seconds")
        self.session = session
        self.cipher = cipher
        self.signer = signer
        self.artifact_ttl_seconds = artifact_ttl_seconds

    def generate(
        self,
        *,
        actor: RequestIdentity,
        request_id: UUID,
        expected_context_versions: dict[str, int],
        idempotency_key: str,
        correlation_id: UUID,
    ) -> PrivacyExportRead:
        if set(expected_context_versions) != set(_EXPORT_CONTEXTS):
            raise PrivacyOperationsConflictError(
                "Privacy export requires exact identity_profile, engagement, "
                "community_intake, and notification versions"
            )
        if any(version < 1 for version in expected_context_versions.values()):
            raise PrivacyOperationsConflictError("Privacy context versions must be positive")

        command_hash = _canonical_hash(expected_context_versions)
        command_key = _scoped_key("privacy-export", request_id, idempotency_key)
        replay = self.session.execute(
            text(
                """
                select artifact_id, request_id, command_hash
                from privacy.export_artifacts
                where idempotency_key = :idempotency_key
                """
            ),
            {"idempotency_key": command_key},
        ).mappings().one_or_none()
        if replay is not None:
            if (
                UUID(str(replay["request_id"])) != request_id
                or replay["command_hash"] != command_hash
            ):
                raise PrivacyOperationsConflictError(
                    "Idempotency key was already used with different export data"
                )
            return self.get_artifact(UUID(str(replay["artifact_id"])))

        request = self.session.execute(
            text(
                """
                select account_id, kind::text, state::text
                from privacy.requests
                where request_id = :request_id
                for update
                """
            ),
            {"request_id": request_id},
        ).mappings().one_or_none()
        if request is None:
            raise PrivacyOperationsNotFoundError("Privacy request not found")
        account_id = UUID(str(request["account_id"]))
        if actor.account_id == account_id:
            raise PrivacyOperationsForbiddenError(
                "Privacy Operators cannot generate their own exports"
            )
        if request["kind"] != PrivacyRequestKind.ACCESS_EXPORT.value:
            raise PrivacyOperationsConflictError("Privacy request is not an access export")
        request_state = PrivacyRequestState(str(request["state"]))
        if request_state not in {
            PrivacyRequestState.VERIFIED,
            PrivacyRequestState.PROCESSING,
        }:
            raise PrivacyOperationsConflictError("Privacy export request is not ready")

        existing = self.session.execute(
            text(
                """
                select artifact_id
                from privacy.export_artifacts
                where request_id = :request_id
                """
            ),
            {"request_id": request_id},
        ).scalar_one_or_none()
        if existing is not None:
            raise PrivacyOperationsConflictError("Privacy export was already generated")

        context_rows = self.session.execute(
            text(
                """
                select context_key, state::text, version
                from privacy.request_contexts
                where request_id = :request_id
                for update
                """
            ),
            {"request_id": request_id},
        ).mappings().all()
        contexts = {str(row["context_key"]): row for row in context_rows}
        if set(contexts) != set(_EXPORT_CONTEXTS):
            raise PrivacyOperationsConflictError("Privacy export contexts are incomplete")
        for context_key in _EXPORT_CONTEXTS:
            row = contexts[context_key]
            if int(row["version"]) != expected_context_versions[context_key]:
                raise PrivacyOperationsConflictError(
                    f"Privacy context version conflict for {context_key}"
                )
            state = PrivacyContextState(str(row["state"]))
            if state not in {
                PrivacyContextState.PENDING,
                PrivacyContextState.PROCESSING,
                PrivacyContextState.FAILED,
            }:
                raise PrivacyOperationsConflictError(
                    f"Privacy context {context_key} cannot export from {state.value}"
                )

        artifact_id = uuid4()
        generated_at = datetime.now(UTC)
        expires_at = generated_at + timedelta(seconds=self.artifact_ttl_seconds)
        plaintext = PrivacyExportBuilder(self.session).build(
            account_id=account_id,
            request_id=request_id,
            generated_at=generated_at,
        )
        encrypted = self.cipher.encrypt(
            artifact_id=artifact_id,
            request_id=request_id,
            account_id=account_id,
            plaintext=plaintext,
        )
        self.session.execute(
            text(
                """
                insert into privacy.export_artifacts (
                  artifact_id, request_id, account_id, schema_version, key_version,
                  nonce, ciphertext, ciphertext_sha256, plaintext_byte_size,
                  ciphertext_byte_size, created_by_account_id, created_at, expires_at,
                  command_hash, idempotency_key, correlation_id
                ) values (
                  :artifact_id, :request_id, :account_id, :schema_version, :key_version,
                  :nonce, :ciphertext, :ciphertext_sha256, :plaintext_byte_size,
                  :ciphertext_byte_size, :created_by_account_id, :created_at, :expires_at,
                  :command_hash, :idempotency_key, :correlation_id
                )
                """
            ),
            {
                "artifact_id": artifact_id,
                "request_id": request_id,
                "account_id": account_id,
                "schema_version": _EXPORT_SCHEMA_VERSION,
                "key_version": _EXPORT_KEY_VERSION,
                "nonce": encrypted.nonce,
                "ciphertext": encrypted.ciphertext,
                "ciphertext_sha256": encrypted.ciphertext_sha256,
                "plaintext_byte_size": encrypted.plaintext_byte_size,
                "ciphertext_byte_size": len(encrypted.ciphertext),
                "created_by_account_id": actor.account_id,
                "created_at": generated_at,
                "expires_at": expires_at,
                "command_hash": command_hash,
                "idempotency_key": command_key,
                "correlation_id": correlation_id,
            },
        )

        for context_key in _EXPORT_CONTEXTS:
            previous_state = PrivacyContextState(str(contexts[context_key]["state"]))
            version_increment = 1 if previous_state is PrivacyContextState.PROCESSING else 2
            attempt_increment = 0 if previous_state is PrivacyContextState.PROCESSING else 1
            self.session.execute(
                text(
                    """
                    update privacy.request_contexts
                    set state = 'completed', last_error_code = null,
                        attempts = attempts + :attempt_increment,
                        version = version + :version_increment
                    where request_id = :request_id and context_key = :context_key
                    """
                ),
                {
                    "request_id": request_id,
                    "context_key": context_key,
                    "attempt_increment": attempt_increment,
                    "version_increment": version_increment,
                },
            )
            if previous_state is not PrivacyContextState.PROCESSING:
                self._insert_context_event(
                    request_id=request_id,
                    context_key=context_key,
                    previous_state=previous_state,
                    next_state=PrivacyContextState.PROCESSING,
                    actor_account_id=actor.account_id,
                    correlation_id=correlation_id,
                    idempotency_key=_scoped_key(command_key, context_key, "processing"),
                )
            self._insert_context_event(
                request_id=request_id,
                context_key=context_key,
                previous_state=PrivacyContextState.PROCESSING,
                next_state=PrivacyContextState.COMPLETED,
                actor_account_id=actor.account_id,
                correlation_id=correlation_id,
                idempotency_key=_scoped_key(command_key, context_key, "completed"),
            )

        if request_state is PrivacyRequestState.VERIFIED:
            self.session.execute(
                text(
                    """
                    update privacy.requests
                    set state = 'completed',
                        processing_started_at = coalesce(processing_started_at, :generated_at),
                        completed_at = :generated_at,
                        version = version + 2
                    where request_id = :request_id
                    """
                ),
                {"request_id": request_id, "generated_at": generated_at},
            )
            self._insert_request_event(
                request_id=request_id,
                event_type="privacy.request.processing",
                previous_state=PrivacyRequestState.VERIFIED,
                next_state=PrivacyRequestState.PROCESSING,
                actor_account_id=actor.account_id,
                details={"execution": "encrypted-export"},
                correlation_id=correlation_id,
                idempotency_key=_scoped_key(command_key, "request-processing"),
            )
        else:
            self.session.execute(
                text(
                    """
                    update privacy.requests
                    set state = 'completed', completed_at = :generated_at,
                        version = version + 1
                    where request_id = :request_id
                    """
                ),
                {"request_id": request_id, "generated_at": generated_at},
            )
        self._insert_request_event(
            request_id=request_id,
            event_type="privacy.request.completed",
            previous_state=PrivacyRequestState.PROCESSING,
            next_state=PrivacyRequestState.COMPLETED,
            actor_account_id=actor.account_id,
            details={"artifact_id": str(artifact_id)},
            correlation_id=correlation_id,
            idempotency_key=_scoped_key(command_key, "request-completed"),
        )
        self._insert_audit(
            event_type="privacy.export.generated",
            actor_account_id=actor.account_id,
            subject_account_id=account_id,
            request_id=request_id,
            outcome="ready",
            reason="verified-access-export",
            details={
                "artifact_id": str(artifact_id),
                "schema_version": _EXPORT_SCHEMA_VERSION,
                "plaintext_byte_size": encrypted.plaintext_byte_size,
                "ciphertext_byte_size": len(encrypted.ciphertext),
                "expires_at": expires_at.isoformat(),
                "sections": ["account", "engagement", "submissions", "notifications"],
            },
            correlation_id=correlation_id,
            idempotency_key=_scoped_key(command_key, "audit"),
        )
        self._insert_outbox(
            event_type="privacy.export.generated",
            request_id=request_id,
            idempotency_key=_scoped_key(command_key, "outbox"),
            correlation_id=correlation_id,
            payload={
                "artifact_id": str(artifact_id),
                "request_id": str(request_id),
                "account_id": str(account_id),
                "expires_at": expires_at.isoformat(),
                "schema_version": _EXPORT_SCHEMA_VERSION,
            },
        )
        self.session.commit()
        return self.get_artifact(artifact_id)

    def get_for_account_audited(
        self,
        *,
        actor: RequestIdentity,
        request_id: UUID,
        correlation_id: UUID,
    ) -> PrivacyExportRead:
        row = self._artifact_for_account(request_id=request_id, account_id=actor.account_id)
        row = self._expire_if_needed(row)
        self._insert_audit(
            event_type="privacy.export-status.read",
            actor_account_id=actor.account_id,
            subject_account_id=actor.account_id,
            request_id=request_id,
            outcome="read",
            reason="self-service",
            details={"artifact_id": str(row["artifact_id"]), "state": str(row["state"])},
            correlation_id=correlation_id,
            idempotency_key=_scoped_key(
                "privacy-export-status-read",
                request_id,
                actor.account_id,
                uuid4(),
            ),
        )
        self.session.commit()
        return self._read(row)

    def issue_access(
        self,
        *,
        actor: RequestIdentity,
        request_id: UUID,
        correlation_id: UUID,
    ) -> PrivacyExportAccessRead:
        row = self._expire_if_needed(
            self._artifact_for_account(request_id=request_id, account_id=actor.account_id)
        )
        if row["state"] != PrivacyExportState.READY.value:
            self.session.commit()
            raise PrivacyOperationsConflictError("Privacy export is no longer available")
        reference, reference_expires_at, jti = self.signer.issue(
            artifact_id=UUID(str(row["artifact_id"])),
            request_id=request_id,
            account_id=actor.account_id,
            artifact_expires_at=row["expires_at"],
        )
        self._insert_audit(
            event_type="privacy.export-access.granted",
            actor_account_id=actor.account_id,
            subject_account_id=actor.account_id,
            request_id=request_id,
            outcome="granted",
            reason="self-service",
            details={
                "artifact_id": str(row["artifact_id"]),
                "reference_jti_hash": hash_export_reference_jti(jti),
                "reference_expires_at": reference_expires_at.isoformat(),
                "artifact_expires_at": row["expires_at"].isoformat(),
            },
            correlation_id=correlation_id,
            idempotency_key=_scoped_key(
                "privacy-export-access",
                request_id,
                actor.account_id,
                uuid4(),
            ),
        )
        self.session.commit()
        return PrivacyExportAccessRead(
            artifact=self._read(row),
            reference=reference,
            expires_at=reference_expires_at,
        )

    def download(
        self,
        *,
        actor: RequestIdentity,
        reference: str,
        correlation_id: UUID,
    ) -> tuple[bytes, str]:
        verified = self.signer.verify(reference)
        row = self.session.execute(
            text(
                """
                select artifact_id, request_id, account_id, state::text, schema_version,
                       key_version, nonce, ciphertext, ciphertext_sha256,
                       plaintext_byte_size, created_at, expires_at
                from privacy.export_artifacts
                where artifact_id = :artifact_id
                  and request_id = :request_id
                """
            ),
            {
                "artifact_id": verified.artifact_id,
                "request_id": verified.request_id,
            },
        ).mappings().one_or_none()
        if row is None:
            raise PrivacyOperationsNotFoundError("Privacy export not found")
        owner_account_id = UUID(str(row["account_id"]))
        if verified.account_subject_hash != self.signer.subject_hash(owner_account_id):
            raise PrivacyExportReferenceError("invalid privacy export reference subject")
        if owner_account_id != actor.account_id:
            self._insert_audit(
                event_type="privacy.export-access.denied",
                actor_account_id=actor.account_id,
                subject_account_id=owner_account_id,
                request_id=verified.request_id,
                outcome="denied",
                reason="account-mismatch",
                details={
                    "artifact_id": str(verified.artifact_id),
                    "reference_jti_hash": hash_export_reference_jti(verified.jti),
                },
                correlation_id=correlation_id,
                idempotency_key=_scoped_key(
                    "privacy-export-access-denied",
                    verified.artifact_id,
                    actor.account_id,
                    verified.jti,
                    uuid4(),
                ),
            )
            self.session.commit()
            raise PrivacyOperationsForbiddenError("Privacy export is unavailable")
        row = self._expire_if_needed(row)
        if row["state"] != PrivacyExportState.READY.value:
            self.session.commit()
            raise PrivacyOperationsConflictError("Privacy export is no longer available")
        ciphertext = bytes(row["ciphertext"])
        if hashlib.sha256(ciphertext).hexdigest() != row["ciphertext_sha256"]:
            raise PrivacyExportDecryptionError("privacy export ciphertext integrity failed")
        plaintext = self.cipher.decrypt(
            artifact_id=verified.artifact_id,
            request_id=verified.request_id,
            account_id=owner_account_id,
            nonce=bytes(row["nonce"]),
            ciphertext=ciphertext,
            schema_version=int(row["schema_version"]),
            key_version=int(row["key_version"]),
        )
        if len(plaintext) != int(row["plaintext_byte_size"]):
            raise PrivacyExportDecryptionError("privacy export plaintext size mismatch")
        self._insert_audit(
            event_type="privacy.export.downloaded",
            actor_account_id=actor.account_id,
            subject_account_id=actor.account_id,
            request_id=verified.request_id,
            outcome="downloaded",
            reason="self-service",
            details={
                "artifact_id": str(verified.artifact_id),
                "reference_jti_hash": hash_export_reference_jti(verified.jti),
                "plaintext_byte_size": len(plaintext),
            },
            correlation_id=correlation_id,
            idempotency_key=_scoped_key(
                "privacy-export-downloaded",
                verified.artifact_id,
                verified.jti,
                uuid4(),
            ),
        )
        self.session.commit()
        filename = f"zhipanda-privacy-export-{verified.request_id}.json"
        return plaintext, filename

    def get_artifact(self, artifact_id: UUID) -> PrivacyExportRead:
        row = self.session.execute(
            text(
                """
                select artifact_id, request_id, state::text, schema_version,
                       plaintext_byte_size, created_at, expires_at
                from privacy.export_artifacts
                where artifact_id = :artifact_id
                """
            ),
            {"artifact_id": artifact_id},
        ).mappings().one_or_none()
        if row is None:
            raise PrivacyOperationsNotFoundError("Privacy export not found")
        current = self._expire_if_needed(row)
        if current["state"] != row["state"]:
            self.session.commit()
        return self._read(current)

    def _artifact_for_account(self, *, request_id: UUID, account_id: UUID) -> Any:
        row = self.session.execute(
            text(
                """
                select artifact_id, request_id, account_id, state::text, schema_version,
                       plaintext_byte_size, created_at, expires_at
                from privacy.export_artifacts
                where request_id = :request_id and account_id = :account_id
                """
            ),
            {"request_id": request_id, "account_id": account_id},
        ).mappings().one_or_none()
        if row is None:
            raise PrivacyOperationsNotFoundError("Privacy export not found")
        return row

    def _expire_if_needed(self, row: Any) -> Any:
        if (
            row["state"] == PrivacyExportState.READY.value
            and row["expires_at"] <= datetime.now(UTC)
        ):
            self.session.execute(
                text(
                    """
                    update privacy.export_artifacts
                    set state = 'expired', expired_at = now(), version = version + 1
                    where artifact_id = :artifact_id and state = 'ready'
                    """
                ),
                {"artifact_id": row["artifact_id"]},
            )
            values = dict(row)
            values["state"] = PrivacyExportState.EXPIRED.value
            return values
        return row

    @staticmethod
    def _read(row: Any) -> PrivacyExportRead:
        return PrivacyExportRead(
            artifact_id=UUID(str(row["artifact_id"])),
            request_id=UUID(str(row["request_id"])),
            state=PrivacyExportState(str(row["state"])),
            schema_version=int(row["schema_version"]),
            plaintext_byte_size=int(row["plaintext_byte_size"]),
            created_at=row["created_at"],
            expires_at=row["expires_at"],
        )

    def _insert_context_event(
        self,
        *,
        request_id: UUID,
        context_key: str,
        previous_state: PrivacyContextState,
        next_state: PrivacyContextState,
        actor_account_id: UUID,
        correlation_id: UUID,
        idempotency_key: str,
    ) -> None:
        self.session.execute(
            text(
                """
                insert into privacy.context_events (
                  request_id, context_key, previous_state, next_state,
                  actor_account_id, correlation_id, idempotency_key
                ) values (
                  :request_id, :context_key,
                  cast(:previous_state as privacy.context_state),
                  cast(:next_state as privacy.context_state),
                  :actor_account_id, :correlation_id, :idempotency_key
                )
                """
            ),
            {
                "request_id": request_id,
                "context_key": context_key,
                "previous_state": previous_state.value,
                "next_state": next_state.value,
                "actor_account_id": actor_account_id,
                "correlation_id": correlation_id,
                "idempotency_key": idempotency_key,
            },
        )

    def _insert_request_event(
        self,
        *,
        request_id: UUID,
        event_type: str,
        previous_state: PrivacyRequestState,
        next_state: PrivacyRequestState,
        actor_account_id: UUID,
        details: dict[str, Any],
        correlation_id: UUID,
        idempotency_key: str,
    ) -> None:
        self.session.execute(
            text(
                """
                insert into privacy.request_events (
                  request_id, event_type, previous_state, next_state,
                  actor_account_id, details, correlation_id, idempotency_key
                ) values (
                  :request_id, :event_type,
                  cast(:previous_state as privacy.request_state),
                  cast(:next_state as privacy.request_state),
                  :actor_account_id, cast(:details as jsonb),
                  :correlation_id, :idempotency_key
                )
                """
            ),
            {
                "request_id": request_id,
                "event_type": event_type,
                "previous_state": previous_state.value,
                "next_state": next_state.value,
                "actor_account_id": actor_account_id,
                "details": json.dumps(details, sort_keys=True),
                "correlation_id": correlation_id,
                "idempotency_key": idempotency_key,
            },
        )

    def _insert_audit(
        self,
        *,
        event_type: str,
        actor_account_id: UUID,
        subject_account_id: UUID,
        request_id: UUID,
        outcome: str,
        reason: str,
        details: dict[str, Any],
        correlation_id: UUID,
        idempotency_key: str,
    ) -> None:
        self.session.execute(
            text(
                """
                insert into privacy.audit_events (
                  event_type, actor_account_id, subject_account_id, request_id,
                  outcome, reason, details, correlation_id, idempotency_key
                ) values (
                  :event_type, :actor_account_id, :subject_account_id, :request_id,
                  :outcome, :reason, cast(:details as jsonb), :correlation_id,
                  :idempotency_key
                )
                """
            ),
            {
                "event_type": event_type,
                "actor_account_id": actor_account_id,
                "subject_account_id": subject_account_id,
                "request_id": request_id,
                "outcome": outcome,
                "reason": reason,
                "details": json.dumps(details, sort_keys=True),
                "correlation_id": correlation_id,
                "idempotency_key": idempotency_key,
            },
        )

    def _insert_outbox(
        self,
        *,
        event_type: str,
        request_id: UUID,
        idempotency_key: str,
        correlation_id: UUID,
        payload: dict[str, Any],
    ) -> None:
        self.session.execute(
            text(
                """
                insert into integration.outbox_events (
                  event_type, event_version, source_context, aggregate_type,
                  aggregate_id, idempotency_key, correlation_id, occurred_at, payload
                ) values (
                  :event_type, 1, 'privacy-operations', 'privacy_request',
                  :aggregate_id, :idempotency_key, :correlation_id, now(),
                  cast(:payload as jsonb)
                )
                on conflict (source_context, idempotency_key) do nothing
                """
            ),
            {
                "event_type": event_type,
                "aggregate_id": str(request_id),
                "idempotency_key": idempotency_key,
                "correlation_id": correlation_id,
                "payload": json.dumps(payload, sort_keys=True),
            },
        )


def hash_export_reference_jti(jti: str) -> str:
    return hashlib.sha256(f"privacy-export-reference:{jti}".encode()).hexdigest()


def _canonical_hash(value: object) -> str:
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def _scoped_key(*parts: object) -> str:
    return ":".join(str(part) for part in parts)


def _json_value(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, dict):
        return {str(key): _json_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_value(item) for item in value]
    return value


def _group_rows(rows: list[dict[str, Any]], key: str) -> dict[str, list[dict[str, Any]]]:
    groups: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        group_key = str(row[key])
        groups.setdefault(group_key, []).append(
            {name: value for name, value in row.items() if name != key}
        )
    return groups


def _urlsafe_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode().rstrip("=")


def _urlsafe_decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
