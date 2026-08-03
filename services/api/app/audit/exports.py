from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from typing import Any
from uuid import UUID, uuid4

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.audit.models import (
    AuditEventRead,
    AuditExportArtifactRead,
    AuditExportScope,
    CreateAuditExportCommand,
)
from app.audit.service import (
    AuditConflictError,
    AuditNotFoundError,
    AuditService,
    _canonical_json,
    _payload_hash,
)
from app.core.config import settings
from app.identity.models import RequestIdentity

_MAX_EXPORT_ROWS = 10_000
_CONTENT_TYPE = "application/x-ndjson"


@dataclass(frozen=True)
class AuditExportDownload:
    artifact: AuditExportArtifactRead
    content: bytes


def _encryption_key() -> bytes:
    return sha256(settings.audit_export_encryption_key.encode("utf-8")).digest()


def _associated_data(
    *,
    artifact_id: UUID,
    scope_hash: str,
    file_sha256: str,
    key_version: int,
    expires_at: datetime,
) -> bytes:
    return _canonical_json(
        {
            "artifact_id": str(artifact_id),
            "scope_hash": scope_hash,
            "file_sha256": file_sha256,
            "key_version": key_version,
            "expires_at": expires_at.astimezone(UTC).isoformat(),
            "content_type": _CONTENT_TYPE,
        }
    ).encode("utf-8")


def _artifact(row: dict[str, Any]) -> AuditExportArtifactRead:
    return AuditExportArtifactRead(**row)


class AuditExportService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.audit = AuditService(session)

    def _rows(self, scope: AuditExportScope) -> list[AuditEventRead]:
        rows = self.session.execute(
            text(
                """
                select event_id, source_context, source_event_id, event_class,
                       actor_account_id, actor_subject_hash, subject_account_id,
                       actor_role_snapshot, action, target_type, target_id,
                       request_id, idempotency_key, correlation_id, reason, result,
                       related_case_id, related_release_id, before_version,
                       after_version, diff_hash, details_hash, sensitive_read,
                       bulk_count, occurred_at, projected_at
                from audit.event_facts
                where (cast(:source_context as text) is null or source_context = :source_context)
                  and (cast(:action as text) is null or action = :action)
                  and (cast(:target_type as text) is null or target_type = :target_type)
                  and (
                    cast(:actor_account_id as uuid) is null
                    or actor_account_id = cast(:actor_account_id as uuid)
                  )
                  and (cast(:result as text) is null or result = :result)
                  and (
                    cast(:sensitive_only as boolean) is null
                    or sensitive_read = cast(:sensitive_only as boolean)
                  )
                  and (
                    cast(:occurred_after as timestamptz) is null
                    or occurred_at >= cast(:occurred_after as timestamptz)
                  )
                  and (
                    cast(:occurred_before as timestamptz) is null
                    or occurred_at < cast(:occurred_before as timestamptz)
                  )
                order by occurred_at, event_id
                limit :limit
                """
            ),
            {
                "source_context": scope.source_context,
                "action": scope.action,
                "target_type": scope.target_type,
                "actor_account_id": str(scope.actor_account_id)
                if scope.actor_account_id
                else None,
                "result": scope.result,
                "sensitive_only": scope.sensitive_only,
                "occurred_after": scope.occurred_after,
                "occurred_before": scope.occurred_before,
                "limit": _MAX_EXPORT_ROWS + 1,
            },
        ).mappings().all()
        if len(rows) > _MAX_EXPORT_ROWS:
            raise AuditConflictError("Audit export scope exceeds 10000 events")
        return [AuditEventRead(**dict(row)) for row in rows]

    @staticmethod
    def _payload(rows: list[AuditEventRead]) -> bytes:
        return b"".join(
            
                _canonical_json(row.model_dump(mode="json")).encode("utf-8") + b"\n"
                for row in rows
            
        )

    def create(
        self,
        *,
        identity: RequestIdentity,
        correlation_id: UUID,
        command: CreateAuditExportCommand,
    ) -> AuditExportArtifactRead:
        self.audit._validate_reason(
            identity=identity,
            action="audit.export.generate",
            reason=command.reason,
            correlation_id=correlation_id,
        )
        scope_payload = command.scope.model_dump(mode="json")
        scope_hash = _payload_hash(scope_payload)
        request_hash = _payload_hash(
            {
                "scope": scope_payload,
                "reason": command.reason,
                "expires_in_seconds": command.expires_in_seconds,
            }
        )
        existing = self.session.execute(
            text(
                """
                select artifact_id, scope_hash, request_hash, file_sha256,
                       content_type, row_count, byte_size, encryption_algorithm,
                       key_version, generated_by_account_id, reason, created_at, expires_at
                from audit.export_artifacts
                where generated_by_account_id = :generated_by_account_id
                  and idempotency_key = :idempotency_key
                """
            ),
            {
                "generated_by_account_id": identity.account_id,
                "idempotency_key": command.idempotency_key,
            },
        ).mappings().one_or_none()
        if existing is not None:
            if existing["request_hash"] != request_hash:
                raise AuditConflictError("Audit export idempotency key payload conflict")
            return _artifact(dict(existing))

        rows = self._rows(command.scope)
        payload = self._payload(rows)
        file_hash = sha256(payload).hexdigest()
        artifact_id = uuid4()
        created_at = datetime.now(UTC)
        expires_at = created_at + timedelta(seconds=command.expires_in_seconds)
        nonce = os.urandom(12)
        aad = _associated_data(
            artifact_id=artifact_id,
            scope_hash=scope_hash,
            file_sha256=file_hash,
            key_version=settings.audit_export_key_version,
            expires_at=expires_at,
        )
        encrypted_payload = AESGCM(_encryption_key()).encrypt(nonce, payload, aad)
        row = self.session.execute(
            text(
                """
                insert into audit.export_artifacts (
                  artifact_id, generated_by_account_id, scope_hash, request_hash,
                  file_sha256, content_type, row_count, byte_size,
                  encryption_algorithm, key_version, nonce, encrypted_payload,
                  reason, correlation_id, idempotency_key, created_at, expires_at
                ) values (
                  :artifact_id, :generated_by_account_id, :scope_hash, :request_hash,
                  :file_sha256, :content_type, :row_count, :byte_size,
                  'AES-256-GCM', :key_version, :nonce, :encrypted_payload,
                  :reason, :correlation_id, :idempotency_key, :created_at, :expires_at
                )
                returning artifact_id, scope_hash, file_sha256, content_type,
                          row_count, byte_size, encryption_algorithm, key_version,
                          generated_by_account_id, reason, created_at, expires_at
                """
            ),
            {
                "artifact_id": artifact_id,
                "generated_by_account_id": identity.account_id,
                "scope_hash": scope_hash,
                "request_hash": request_hash,
                "file_sha256": file_hash,
                "content_type": _CONTENT_TYPE,
                "row_count": len(rows),
                "byte_size": len(payload),
                "key_version": settings.audit_export_key_version,
                "nonce": nonce,
                "encrypted_payload": encrypted_payload,
                "reason": command.reason,
                "correlation_id": correlation_id,
                "idempotency_key": command.idempotency_key,
                "created_at": created_at,
                "expires_at": expires_at,
            },
        ).mappings().one()
        self.audit._record_event(
            identity=identity,
            action="audit.export.generate",
            target_type="audit_export",
            target_id=str(artifact_id),
            reason=command.reason,
            result="succeeded",
            correlation_id=correlation_id,
            event_class="export",
            details={
                "scope_hash": scope_hash,
                "file_sha256": file_hash,
                "row_count": len(rows),
                "byte_size": len(payload),
                "expires_at": expires_at,
            },
            bulk_count=max(1, len(rows)),
            idempotency_key=command.idempotency_key,
        )
        return _artifact(dict(row))

    def download(
        self,
        *,
        identity: RequestIdentity,
        correlation_id: UUID,
        artifact_id: UUID,
        reason: str,
    ) -> AuditExportDownload:
        self.audit._validate_reason(
            identity=identity,
            action="audit.export.download",
            reason=reason,
            correlation_id=correlation_id,
        )
        row = self.session.execute(
            text(
                """
                select artifact_id, scope_hash, file_sha256, content_type,
                       row_count, byte_size, encryption_algorithm, key_version,
                       generated_by_account_id, reason, created_at, expires_at,
                       nonce, encrypted_payload
                from audit.export_artifacts
                where artifact_id = :artifact_id
                """
            ),
            {"artifact_id": artifact_id},
        ).mappings().one_or_none()
        if row is None or row["generated_by_account_id"] != identity.account_id:
            self.audit._record_event(
                identity=identity,
                action="audit.export.download",
                target_type="audit_export",
                target_id=str(artifact_id),
                reason=reason,
                result="denied",
                correlation_id=correlation_id,
                event_class="export",
                details={"code": "artifact_unavailable"},
            )
            self.session.commit()
            raise AuditNotFoundError("Audit export artifact not found")
        now = datetime.now(UTC)
        if row["expires_at"] <= now:
            self.audit._record_event(
                identity=identity,
                action="audit.export.download",
                target_type="audit_export",
                target_id=str(artifact_id),
                reason=reason,
                result="expired",
                correlation_id=correlation_id,
                event_class="export",
                details={"file_sha256": row["file_sha256"]},
            )
            self.session.commit()
            raise AuditConflictError("Audit export artifact has expired")
        aad = _associated_data(
            artifact_id=artifact_id,
            scope_hash=row["scope_hash"],
            file_sha256=row["file_sha256"],
            key_version=row["key_version"],
            expires_at=row["expires_at"],
        )
        try:
            payload = AESGCM(_encryption_key()).decrypt(
                bytes(row["nonce"]),
                bytes(row["encrypted_payload"]),
                aad,
            )
        except Exception as error:
            self.audit._record_event(
                identity=identity,
                action="audit.export.download",
                target_type="audit_export",
                target_id=str(artifact_id),
                reason=reason,
                result="integrity_failed",
                correlation_id=correlation_id,
                event_class="export",
                details={"file_sha256": row["file_sha256"]},
            )
            self.session.commit()
            raise AuditConflictError("Audit export artifact integrity check failed") from error
        if sha256(payload).hexdigest() != row["file_sha256"]:
            self.audit._record_event(
                identity=identity,
                action="audit.export.download",
                target_type="audit_export",
                target_id=str(artifact_id),
                reason=reason,
                result="integrity_failed",
                correlation_id=correlation_id,
                event_class="export",
                details={"file_sha256": row["file_sha256"]},
            )
            self.session.commit()
            raise AuditConflictError("Audit export file hash mismatch")
        self.audit._record_event(
            identity=identity,
            action="audit.export.download",
            target_type="audit_export",
            target_id=str(artifact_id),
            reason=reason,
            result="succeeded",
            correlation_id=correlation_id,
            event_class="export",
            details={
                "file_sha256": row["file_sha256"],
                "row_count": row["row_count"],
                "byte_size": row["byte_size"],
            },
            bulk_count=max(1, int(row["row_count"])),
        )
        return AuditExportDownload(
            artifact=_artifact(dict(row)),
            content=payload,
        )
