from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.audit.models import AuditMaintenanceRunRead, RunAuditMaintenanceCommand
from app.audit.service import AuditConflictError, AuditService, _payload_hash
from app.identity.models import RequestIdentity


class AuditMaintenanceService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.audit = AuditService(session)

    @staticmethod
    def _run(row: dict[str, Any]) -> AuditMaintenanceRunRead:
        return AuditMaintenanceRunRead(**row)

    def run_retention(
        self,
        *,
        identity: RequestIdentity,
        correlation_id: UUID,
        command: RunAuditMaintenanceCommand,
    ) -> AuditMaintenanceRunRead:
        self.audit._validate_reason(
            identity=identity,
            action="audit.retention.run",
            reason=command.reason,
            correlation_id=correlation_id,
        )
        request_hash = _payload_hash({"reason": command.reason})
        existing = self.session.execute(
            text(
                """
                select run_id, actor_account_id, reason, request_hash,
                       expired_export_count, started_at, completed_at,
                       correlation_id, idempotency_key
                from audit.maintenance_runs
                where actor_account_id = :actor_account_id
                  and idempotency_key = :idempotency_key
                """
            ),
            {
                "actor_account_id": identity.account_id,
                "idempotency_key": command.idempotency_key,
            },
        ).mappings().one_or_none()
        if existing is not None:
            if existing["request_hash"] != request_hash:
                raise AuditConflictError("Audit maintenance idempotency key payload conflict")
            return self._run(dict(existing))

        started_at = datetime.now(UTC)
        expired_ids = self.session.execute(
            text(
                """
                delete from audit.export_artifacts
                where expires_at <= now()
                returning artifact_id
                """
            )
        ).scalars().all()
        completed_at = datetime.now(UTC)
        row = self.session.execute(
            text(
                """
                insert into audit.maintenance_runs (
                  actor_account_id, reason, request_hash, idempotency_key,
                  correlation_id, expired_export_count, started_at, completed_at
                ) values (
                  :actor_account_id, :reason, :request_hash, :idempotency_key,
                  :correlation_id, :expired_export_count, :started_at, :completed_at
                )
                returning run_id, actor_account_id, reason, expired_export_count,
                          started_at, completed_at, correlation_id, idempotency_key
                """
            ),
            {
                "actor_account_id": identity.account_id,
                "reason": command.reason,
                "request_hash": request_hash,
                "idempotency_key": command.idempotency_key,
                "correlation_id": correlation_id,
                "expired_export_count": len(expired_ids),
                "started_at": started_at,
                "completed_at": completed_at,
            },
        ).mappings().one()
        self.audit._record_event(
            identity=identity,
            action="audit.retention.expired_exports",
            target_type="audit_export",
            target_id="expired",
            reason=command.reason,
            result="succeeded",
            correlation_id=correlation_id,
            event_class="correction",
            details={"expired_export_count": len(expired_ids)},
            bulk_count=max(1, len(expired_ids)),
            idempotency_key=command.idempotency_key,
        )
        return self._run(dict(row))
