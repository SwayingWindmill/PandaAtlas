from __future__ import annotations

import json
import re
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from hashlib import sha256
from typing import Any
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.audit.models import (
    AuditEventList,
    AuditEventRead,
    AuditIntegrityCheckRead,
    AuditIntegritySummaryList,
    AuditIntegritySummaryRead,
    AuditMetricsRead,
    GenerateAuditIntegritySummaryCommand,
    VerifyAuditIntegritySummaryCommand,
)
from app.core.config import settings
from app.db.session import has_database, session_scope
from app.identity.models import RequestIdentity

_EMAIL_PATTERN = re.compile(r"\b[^\s@]+@[^\s@]+\.[^\s@]+\b", re.IGNORECASE)
_FORBIDDEN_MARKERS = (
    "access_token",
    "refresh_token",
    "authorization: bearer",
    "cookie=",
    "set-cookie",
    "x-amz-signature",
    "signed_url",
    "secret_key",
    "otp=",
)


class AuditConflictError(RuntimeError):
    pass


class AuditNotFoundError(RuntimeError):
    pass


class AuditPayloadRejectedError(RuntimeError):
    pass


@contextmanager
def audit_session() -> Iterator[Session]:
    if not settings.unified_audit_enabled:
        raise HTTPException(status_code=404, detail={"code": "unified_audit_disabled"})
    if not has_database():
        raise HTTPException(status_code=503, detail={"code": "authoritative_database_unavailable"})
    with session_scope() as session:
        if session is None:
            raise HTTPException(
                status_code=503,
                detail={"code": "authoritative_database_unavailable"},
            )
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise


def _canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)


def _payload_hash(value: Any) -> str:
    return sha256(_canonical_json(value).encode("utf-8")).hexdigest()


def _assert_safe_text(value: str) -> None:
    lowered = value.lower()
    if _EMAIL_PATTERN.search(value) or any(marker in lowered for marker in _FORBIDDEN_MARKERS):
        raise AuditPayloadRejectedError("Audit text contains prohibited credential or contact data")


def _event_digest(rows: list[dict[str, Any]]) -> str:
    digest = sha256()
    for row in rows:
        canonical = {
            "event_id": str(row["event_id"]),
            "source_context": row["source_context"],
            "source_event_id": str(row["source_event_id"]),
            "event_class": row["event_class"],
            "actor_account_id": str(row["actor_account_id"]) if row["actor_account_id"] else None,
            "actor_subject_hash": row["actor_subject_hash"],
            "subject_account_id": str(row["subject_account_id"])
            if row["subject_account_id"]
            else None,
            "actor_role_snapshot": row["actor_role_snapshot"],
            "action": row["action"],
            "target_type": row["target_type"],
            "target_id": row["target_id"],
            "request_id": row["request_id"],
            "idempotency_key": row["idempotency_key"],
            "correlation_id": str(row["correlation_id"]),
            "reason": row["reason"],
            "result": row["result"],
            "related_case_id": row["related_case_id"],
            "related_release_id": row["related_release_id"],
            "before_version": row["before_version"],
            "after_version": row["after_version"],
            "diff_hash": row["diff_hash"],
            "details_hash": row["details_hash"],
            "sensitive_read": row["sensitive_read"],
            "bulk_count": row["bulk_count"],
            "occurred_at": row["occurred_at"].astimezone(UTC).isoformat(),
        }
        digest.update(_canonical_json(canonical).encode("utf-8"))
        digest.update(b"\n")
    return digest.hexdigest()


class AuditService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def _reject_payload(
        self,
        *,
        identity: RequestIdentity,
        action: str,
        payload: Any,
        correlation_id: UUID,
        code: str = "audit_payload_prohibited",
    ) -> None:
        self.session.execute(
            text(
                """
                insert into audit.rejected_payloads (
                  source_context, action, payload_hash, rejection_code,
                  actor_account_id, correlation_id
                ) values (
                  'audit', :action, :payload_hash, :rejection_code,
                  :actor_account_id, :correlation_id
                )
                """
            ),
            {
                "action": action,
                "payload_hash": _payload_hash(payload),
                "rejection_code": code,
                "actor_account_id": identity.account_id,
                "correlation_id": correlation_id,
            },
        )
        self.session.commit()

    def _validate_reason(
        self,
        *,
        identity: RequestIdentity,
        action: str,
        reason: str,
        correlation_id: UUID,
    ) -> None:
        try:
            _assert_safe_text(reason)
        except AuditPayloadRejectedError:
            self._reject_payload(
                identity=identity,
                action=action,
                payload={"reason": reason},
                correlation_id=correlation_id,
            )
            raise

    def _record_event(
        self,
        *,
        identity: RequestIdentity,
        action: str,
        target_type: str,
        target_id: str,
        reason: str,
        result: str,
        correlation_id: UUID,
        event_class: str,
        details: dict[str, Any],
        sensitive_read: bool = False,
        bulk_count: int = 1,
        idempotency_key: str | None = None,
        related_case_id: str | None = None,
        related_release_id: str | None = None,
    ) -> UUID:
        self._validate_reason(
            identity=identity,
            action=action,
            reason=reason,
            correlation_id=correlation_id,
        )
        source_event_id = uuid4()
        event_id = self.session.execute(
            text(
                """
                insert into audit.event_facts (
                  source_context, source_event_id, event_class, actor_account_id,
                  actor_role_snapshot, action, target_type, target_id,
                  idempotency_key, correlation_id, reason, result,
                  related_case_id, related_release_id, details_hash,
                  sensitive_read, bulk_count, occurred_at
                ) values (
                  'audit', :source_event_id, :event_class, :actor_account_id,
                  audit.role_snapshot(:actor_account_id, now()),
                  :action, :target_type, :target_id,
                  :idempotency_key, :correlation_id, :reason, :result,
                  :related_case_id, :related_release_id, :details_hash,
                  :sensitive_read, :bulk_count, now()
                )
                returning event_id
                """
            ),
            {
                "source_event_id": source_event_id,
                "event_class": event_class,
                "actor_account_id": identity.account_id,
                "action": action,
                "target_type": target_type,
                "target_id": target_id,
                "idempotency_key": idempotency_key,
                "correlation_id": correlation_id,
                "reason": reason,
                "result": result,
                "related_case_id": related_case_id,
                "related_release_id": related_release_id,
                "details_hash": _payload_hash(details),
                "sensitive_read": sensitive_read,
                "bulk_count": bulk_count,
            },
        ).scalar_one()
        return UUID(str(event_id))

    @staticmethod
    def _event(row: dict[str, Any]) -> AuditEventRead:
        return AuditEventRead(**row)

    @staticmethod
    def _summary(row: dict[str, Any]) -> AuditIntegritySummaryRead:
        return AuditIntegritySummaryRead(**row)

    def search(
        self,
        *,
        identity: RequestIdentity,
        correlation_id: UUID,
        reason: str,
        source_context: str | None = None,
        action: str | None = None,
        target_type: str | None = None,
        target_id: str | None = None,
        actor_account_id: UUID | None = None,
        event_correlation_id: UUID | None = None,
        result: str | None = None,
        sensitive_only: bool | None = None,
        occurred_after: datetime | None = None,
        occurred_before: datetime | None = None,
        limit: int = 50,
    ) -> AuditEventList:
        self._validate_reason(
            identity=identity,
            action="audit.events.search",
            reason=reason,
            correlation_id=correlation_id,
        )
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
                  and (cast(:target_id as text) is null or target_id = :target_id)
                  and (
                    cast(:actor_account_id as uuid) is null
                    or actor_account_id = cast(:actor_account_id as uuid)
                  )
                  and (
                    cast(:event_correlation_id as uuid) is null
                    or correlation_id = cast(:event_correlation_id as uuid)
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
                order by occurred_at desc, event_id desc
                limit :limit
                """
            ),
            {
                "source_context": source_context,
                "action": action,
                "target_type": target_type,
                "target_id": target_id,
                "actor_account_id": str(actor_account_id) if actor_account_id else None,
                "event_correlation_id": str(event_correlation_id)
                if event_correlation_id
                else None,
                "result": result,
                "sensitive_only": sensitive_only,
                "occurred_after": occurred_after,
                "occurred_before": occurred_before,
                "limit": limit,
            },
        ).mappings().all()
        filter_hash = _payload_hash(
            {
                "source_context": source_context,
                "action": action,
                "target_type": target_type,
                "target_id": target_id,
                "actor_account_id": str(actor_account_id) if actor_account_id else None,
                "event_correlation_id": str(event_correlation_id)
                if event_correlation_id
                else None,
                "result": result,
                "sensitive_only": sensitive_only,
                "occurred_after": occurred_after,
                "occurred_before": occurred_before,
                "limit": limit,
            }
        )
        self._record_event(
            identity=identity,
            action="audit.events.search",
            target_type="audit_query",
            target_id=filter_hash,
            reason=reason,
            result="succeeded",
            correlation_id=correlation_id,
            event_class="sensitive_read",
            details={"filter_hash": filter_hash, "result_count": len(rows)},
            sensitive_read=True,
            bulk_count=max(1, len(rows)),
        )
        return AuditEventList(items=[self._event(dict(row)) for row in rows])

    def list_integrity_summaries(
        self,
        *,
        identity: RequestIdentity,
        correlation_id: UUID,
        reason: str,
        limit: int = 50,
    ) -> AuditIntegritySummaryList:
        self._validate_reason(
            identity=identity,
            action="audit.integrity.list",
            reason=reason,
            correlation_id=correlation_id,
        )
        rows = self.session.execute(
            text(
                """
                select summary_id, range_started_at, range_ended_at, event_count,
                       digest_sha256, previous_digest_sha256,
                       generated_by_account_id, generated_at, reason,
                       correlation_id, idempotency_key
                from audit.integrity_summaries
                order by generated_at desc, summary_id desc
                limit :limit
                """
            ),
            {"limit": limit},
        ).mappings().all()
        self._record_event(
            identity=identity,
            action="audit.integrity.list",
            target_type="audit_integrity_summary",
            target_id="latest",
            reason=reason,
            result="succeeded",
            correlation_id=correlation_id,
            event_class="sensitive_read",
            details={"result_count": len(rows)},
            sensitive_read=True,
            bulk_count=max(1, len(rows)),
        )
        return AuditIntegritySummaryList(items=[self._summary(dict(row)) for row in rows])

    def _digest_rows(self, range_started_at: datetime, range_ended_at: datetime) -> tuple[int, str]:
        rows = self.session.execute(
            text(
                """
                select event_id, source_context, source_event_id, event_class,
                       actor_account_id, actor_subject_hash, subject_account_id,
                       actor_role_snapshot, action, target_type, target_id,
                       request_id, idempotency_key, correlation_id, reason, result,
                       related_case_id, related_release_id, before_version,
                       after_version, diff_hash, details_hash, sensitive_read,
                       bulk_count, occurred_at
                from audit.event_facts
                where occurred_at >= :range_started_at
                  and occurred_at < :range_ended_at
                order by occurred_at, event_id
                """
            ),
            {
                "range_started_at": range_started_at,
                "range_ended_at": range_ended_at,
            },
        ).mappings().all()
        normalized = [dict(row) for row in rows]
        return len(normalized), _event_digest(normalized)

    def generate_integrity_summary(
        self,
        *,
        identity: RequestIdentity,
        correlation_id: UUID,
        command: GenerateAuditIntegritySummaryCommand,
    ) -> AuditIntegritySummaryRead:
        if command.range_ended_at > datetime.now(UTC):
            raise AuditConflictError("Integrity summaries require a closed time window")
        self._validate_reason(
            identity=identity,
            action="audit.integrity.generate",
            reason=command.reason,
            correlation_id=correlation_id,
        )
        existing = self.session.execute(
            text(
                """
                select summary_id, range_started_at, range_ended_at, event_count,
                       digest_sha256, previous_digest_sha256,
                       generated_by_account_id, generated_at, reason,
                       correlation_id, idempotency_key
                from audit.integrity_summaries
                where idempotency_key = :idempotency_key
                """
            ),
            {"idempotency_key": command.idempotency_key},
        ).mappings().one_or_none()
        if existing is not None:
            if (
                existing["range_started_at"] != command.range_started_at
                or existing["range_ended_at"] != command.range_ended_at
                or existing["reason"] != command.reason
            ):
                raise AuditConflictError("Integrity idempotency key payload conflict")
            return self._summary(dict(existing))

        event_count, digest_sha256 = self._digest_rows(
            command.range_started_at,
            command.range_ended_at,
        )
        previous_digest = self.session.execute(
            text(
                """
                select digest_sha256
                from audit.integrity_summaries
                where range_ended_at <= :range_started_at
                order by range_ended_at desc, generated_at desc
                limit 1
                """
            ),
            {"range_started_at": command.range_started_at},
        ).scalar_one_or_none()
        summary_id = uuid4()
        row = self.session.execute(
            text(
                """
                insert into audit.integrity_summaries (
                  summary_id, range_started_at, range_ended_at, event_count,
                  digest_sha256, previous_digest_sha256,
                  generated_by_account_id, reason, correlation_id, idempotency_key
                ) values (
                  :summary_id, :range_started_at, :range_ended_at, :event_count,
                  :digest_sha256, :previous_digest_sha256,
                  :generated_by_account_id, :reason, :correlation_id, :idempotency_key
                )
                returning summary_id, range_started_at, range_ended_at, event_count,
                          digest_sha256, previous_digest_sha256,
                          generated_by_account_id, generated_at, reason,
                          correlation_id, idempotency_key
                """
            ),
            {
                "summary_id": summary_id,
                "range_started_at": command.range_started_at,
                "range_ended_at": command.range_ended_at,
                "event_count": event_count,
                "digest_sha256": digest_sha256,
                "previous_digest_sha256": previous_digest,
                "generated_by_account_id": identity.account_id,
                "reason": command.reason,
                "correlation_id": correlation_id,
                "idempotency_key": command.idempotency_key,
            },
        ).mappings().one()
        self._record_event(
            identity=identity,
            action="audit.integrity.generate",
            target_type="audit_integrity_summary",
            target_id=str(summary_id),
            reason=command.reason,
            result="succeeded",
            correlation_id=correlation_id,
            event_class="integrity",
            details={
                "range_started_at": command.range_started_at,
                "range_ended_at": command.range_ended_at,
                "event_count": event_count,
                "digest_sha256": digest_sha256,
                "previous_digest_sha256": previous_digest,
            },
            idempotency_key=command.idempotency_key,
        )
        return self._summary(dict(row))

    def verify_integrity_summary(
        self,
        *,
        identity: RequestIdentity,
        correlation_id: UUID,
        summary_id: UUID,
        command: VerifyAuditIntegritySummaryCommand,
    ) -> AuditIntegrityCheckRead:
        self._validate_reason(
            identity=identity,
            action="audit.integrity.verify",
            reason=command.reason,
            correlation_id=correlation_id,
        )
        existing = self.session.execute(
            text(
                """
                select check_id, summary_id, expected_digest_sha256,
                       actual_digest_sha256, matched, checked_by_account_id,
                       checked_at, reason, correlation_id, idempotency_key
                from audit.integrity_checks
                where idempotency_key = :idempotency_key
                """
            ),
            {"idempotency_key": command.idempotency_key},
        ).mappings().one_or_none()
        if existing is not None:
            if existing["summary_id"] != summary_id or existing["reason"] != command.reason:
                raise AuditConflictError("Integrity check idempotency key payload conflict")
            return AuditIntegrityCheckRead(**dict(existing))

        summary = self.session.execute(
            text(
                """
                select summary_id, range_started_at, range_ended_at, digest_sha256
                from audit.integrity_summaries
                where summary_id = :summary_id
                """
            ),
            {"summary_id": summary_id},
        ).mappings().one_or_none()
        if summary is None:
            raise AuditNotFoundError("Integrity summary not found")
        _, actual_digest = self._digest_rows(
            summary["range_started_at"],
            summary["range_ended_at"],
        )
        matched = actual_digest == summary["digest_sha256"]
        row = self.session.execute(
            text(
                """
                insert into audit.integrity_checks (
                  summary_id, expected_digest_sha256, actual_digest_sha256,
                  matched, checked_by_account_id, reason,
                  correlation_id, idempotency_key
                ) values (
                  :summary_id, :expected_digest_sha256, :actual_digest_sha256,
                  :matched, :checked_by_account_id, :reason,
                  :correlation_id, :idempotency_key
                )
                returning check_id, summary_id, expected_digest_sha256,
                          actual_digest_sha256, matched, checked_by_account_id,
                          checked_at, reason, correlation_id, idempotency_key
                """
            ),
            {
                "summary_id": summary_id,
                "expected_digest_sha256": summary["digest_sha256"],
                "actual_digest_sha256": actual_digest,
                "matched": matched,
                "checked_by_account_id": identity.account_id,
                "reason": command.reason,
                "correlation_id": correlation_id,
                "idempotency_key": command.idempotency_key,
            },
        ).mappings().one()
        self._record_event(
            identity=identity,
            action="audit.integrity.verify",
            target_type="audit_integrity_summary",
            target_id=str(summary_id),
            reason=command.reason,
            result="matched" if matched else "mismatch",
            correlation_id=correlation_id,
            event_class="integrity",
            details={
                "expected_digest_sha256": summary["digest_sha256"],
                "actual_digest_sha256": actual_digest,
                "matched": matched,
            },
            idempotency_key=command.idempotency_key,
        )
        return AuditIntegrityCheckRead(**dict(row))

    def metrics(
        self,
        *,
        identity: RequestIdentity,
        correlation_id: UUID,
        reason: str,
    ) -> AuditMetricsRead:
        self._validate_reason(
            identity=identity,
            action="audit.metrics.read",
            reason=reason,
            correlation_id=correlation_id,
        )
        counts = self.session.execute(
            text(
                """
                with source_counts as (
                  select 'identity'::text as source_context, count(*)::bigint as source_count
                    from identity.authorization_audit_events
                  union all select 'engagement', count(*) from engagement.audit_events
                  union all select 'activity', count(*) from activity.audit_events
                  union all select 'notification', count(*) from notification.audit_events
                  union all select 'community_intake', count(*) from community_intake.audit_events
                  union all select 'review_moderation', count(*) from review_moderation.audit_events
                  union all select 'archive', count(*) from public.audit_events
                ), projected_counts as (
                  select source_context, count(*)::bigint as projected_count
                  from audit.event_facts
                  where source_context <> 'audit'
                  group by source_context
                )
                select
                  (select count(*) from audit.event_facts) as projected_event_count,
                  coalesce((
                    select sum(
                      greatest(
                        source.source_count - coalesce(projected.projected_count, 0),
                        0
                      )
                    )
                    from source_counts source
                    left join projected_counts projected using (source_context)
                  ), 0) as source_projection_gap_count,
                  (select count(*) from audit.event_facts
                    where sensitive_read and occurred_at >= now() - interval '24 hours')
                    as sensitive_read_count_24h,
                  (select count(*) from audit.event_facts
                    where sensitive_read and bulk_count >= 100
                      and occurred_at >= now() - interval '24 hours')
                    as bulk_sensitive_read_count_24h,
                  (select count(*) from audit.rejected_payloads
                    where occurred_at >= now() - interval '24 hours')
                    as rejected_payload_count_24h,
                  (select count(*) from audit.event_facts
                    where event_class = 'export'
                      and occurred_at >= now() - interval '24 hours')
                    as export_event_count_24h,
                  (select count(*) from audit.integrity_checks
                    where not matched and checked_at >= now() - interval '24 hours')
                    as integrity_mismatch_count_24h,
                  (select max(generated_at) from audit.integrity_summaries)
                    as latest_integrity_generated_at
                """
            )
        ).mappings().one()
        alerts: list[str] = []
        if int(counts["source_projection_gap_count"]) > 0:
            alerts.append("audit_projection_lag")
        if int(counts["rejected_payload_count_24h"]) > 0:
            alerts.append("audit_rejected_payload")
        if int(counts["bulk_sensitive_read_count_24h"]) > 0:
            alerts.append("audit_bulk_read_anomaly")
        if int(counts["integrity_mismatch_count_24h"]) > 0:
            alerts.append("audit_integrity_mismatch")
        if counts["latest_integrity_generated_at"] is None:
            alerts.append("audit_integrity_summary_missing")
        self._record_event(
            identity=identity,
            action="audit.metrics.read",
            target_type="audit_metrics",
            target_id="current",
            reason=reason,
            result="succeeded",
            correlation_id=correlation_id,
            event_class="sensitive_read",
            details={key: str(value) for key, value in counts.items()},
            sensitive_read=True,
        )
        return AuditMetricsRead(
            projected_event_count=int(counts["projected_event_count"]),
            source_projection_gap_count=int(counts["source_projection_gap_count"]),
            sensitive_read_count_24h=int(counts["sensitive_read_count_24h"]),
            bulk_sensitive_read_count_24h=int(counts["bulk_sensitive_read_count_24h"]),
            rejected_payload_count_24h=int(counts["rejected_payload_count_24h"]),
            export_event_count_24h=int(counts["export_event_count_24h"]),
            integrity_mismatch_count_24h=int(counts["integrity_mismatch_count_24h"]),
            latest_integrity_generated_at=counts["latest_integrity_generated_at"],
            alerts=alerts,
        )


def record_sensitive_read(
    session: Session,
    *,
    identity: RequestIdentity,
    correlation_id: UUID,
    action: str,
    target_type: str,
    target_id: str,
    reason: str,
    result: str,
    details: dict[str, Any] | None = None,
    bulk_count: int = 1,
    related_case_id: str | None = None,
    related_release_id: str | None = None,
) -> UUID:
    return AuditService(session)._record_event(
        identity=identity,
        action=action,
        target_type=target_type,
        target_id=target_id,
        reason=reason,
        result=result,
        correlation_id=correlation_id,
        event_class="sensitive_read",
        details=details or {},
        sensitive_read=True,
        bulk_count=bulk_count,
        related_case_id=related_case_id,
        related_release_id=related_release_id,
    )
