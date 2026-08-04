from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.community_intake.repository import CommunityIntakeRepository, default_storage
from app.core.config import settings
from app.notification.repository import NotificationRepository
from app.privacy_operations.models import PrivacyMaintenanceRead, PrivacyMetricsSnapshot
from app.privacy_operations.replay import PrivacyDeletionReplayError, reapply_account_deletion


class PrivacyMaintenanceConflictError(RuntimeError):
    """Raised when a maintenance command conflicts with durable state."""


class PrivacyMaintenanceForbiddenError(PermissionError):
    """Raised when the recorded operator lacks the Privacy capability."""


def _scoped_key(*parts: object) -> str:
    return ":".join(str(part) for part in parts)


def _command_hash(value: object) -> str:
    payload = json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(payload).hexdigest()


class PrivacyMaintenanceService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def run(
        self,
        *,
        actor_account_id: UUID,
        replay_tombstones_after_restore: bool,
        tombstone_account_limit: int,
        max_scan_attempts: int,
        idempotency_key: str,
        correlation_id: UUID,
    ) -> PrivacyMaintenanceRead:
        self._require_operator(actor_account_id)
        lock_acquired = bool(
            self.session.execute(
                text(
                    "select pg_try_advisory_xact_lock("
                    "hashtextextended('privacy-maintenance-v1', 0))"
                )
            ).scalar_one()
        )
        if not lock_acquired:
            raise PrivacyMaintenanceConflictError(
                "Another Privacy maintenance run is already active"
            )
        command = {
            "replay_tombstones_after_restore": replay_tombstones_after_restore,
            "tombstone_account_limit": tombstone_account_limit,
            "max_scan_attempts": max_scan_attempts,
        }
        command_hash = _command_hash(command)
        command_key = _scoped_key(
            "privacy-maintenance",
            actor_account_id,
            idempotency_key,
        )
        replay = self.session.execute(
            text(
                """
                select run_id, started_at, completed_at,
                       replay_tombstones_after_restore, counts, command_hash
                from privacy.maintenance_runs
                where idempotency_key = :idempotency_key
                """
            ),
            {"idempotency_key": command_key},
        ).mappings().one_or_none()
        if replay is not None:
            if str(replay["command_hash"]) != command_hash:
                raise PrivacyMaintenanceConflictError(
                    "Privacy maintenance idempotency key was reused with different input"
                )
            return self._read(replay)

        started_at = datetime.now(UTC)
        export_result = self.session.execute(
            text(
                """
                update privacy.export_artifacts
                set state = 'deleted',
                    nonce = null,
                    ciphertext = null,
                    ciphertext_sha256 = null,
                    ciphertext_byte_size = null,
                    expired_at = coalesce(expired_at, now()),
                    deleted_at = now(),
                    version = version + 1
                where state in ('ready', 'expired')
                  and expires_at <= now()
                returning artifact_id
                """
            )
        )
        exports_deleted = len(export_result.scalars().all())

        community = CommunityIntakeRepository(
            self.session,
            storage=default_storage(
                settings.community_intake_storage_signing_key,
                settings.community_intake_storage_reference_ttl_seconds,
            ),
        ).expire_and_repair(
            correlation_id=correlation_id,
            max_scan_attempts=max_scan_attempts,
            commit=False,
        )
        notification_bodies_purged = NotificationRepository(
            self.session,
            cursor_signing_key=settings.notification_cursor_signing_key,
        ).purge_expired_bodies(commit=False)

        replayed_accounts = 0
        replayed_tombstones = 0
        replay_counts: dict[str, int] = {}
        if replay_tombstones_after_restore:
            accounts = self.session.execute(
                text(
                    """
                    select account_id, min(request_id::text)::uuid as request_id
                    from privacy.deletion_tombstones
                    where applied_at >= now() - interval '35 days'
                    group by account_id
                    order by min(applied_at), account_id
                    limit :account_limit
                    """
                ),
                {"account_limit": tombstone_account_limit},
            ).mappings().all()
            for account in accounts:
                account_id = UUID(str(account["account_id"]))
                request_id = UUID(str(account["request_id"]))
                try:
                    counts = reapply_account_deletion(
                        self.session,
                        actor_account_id=actor_account_id,
                        account_id=account_id,
                        request_id=request_id,
                        idempotency_key=_scoped_key(command_key, account_id),
                        correlation_id=correlation_id,
                    )
                except PrivacyDeletionReplayError as error:
                    raise PrivacyMaintenanceConflictError(str(error)) from error
                for key, value in counts.items():
                    replay_counts[key] = replay_counts.get(key, 0) + int(value)
                updated = self.session.execute(
                    text(
                        """
                        update privacy.deletion_tombstones
                        set last_replayed_at = now(),
                            replay_count = replay_count + 1,
                            version = version + 1
                        where account_id = :account_id
                        """
                    ),
                    {"account_id": account_id},
                )
                replayed_accounts += 1
                replayed_tombstones += int(updated.rowcount or 0)
                self._audit(
                    event_type="privacy.deletion-tombstone.reapplied",
                    actor_account_id=actor_account_id,
                    subject_account_id=account_id,
                    request_id=request_id,
                    outcome="reapplied",
                    reason="backup-restore-maintenance",
                    details={"counts": counts},
                    correlation_id=correlation_id,
                    idempotency_key=_scoped_key(command_key, account_id, "audit"),
                )

        counts = {
            "exports_deleted": exports_deleted,
            "community_drafts_expired": community.expired_drafts,
            "community_closed_submissions_processed": (
                community.closed_submissions_processed
            ),
            "community_orphan_attachments_deleted": community.orphan_attachments,
            "community_scan_retries_requested": community.scan_retries,
            "notification_bodies_purged": notification_bodies_purged,
            "tombstone_accounts_replayed": replayed_accounts,
            "tombstones_replayed": replayed_tombstones,
            **{f"replay_{key}": value for key, value in replay_counts.items()},
        }
        completed_at = datetime.now(UTC)
        run_id = uuid4()
        self.session.execute(
            text(
                """
                insert into privacy.maintenance_runs (
                  run_id, actor_account_id, started_at, completed_at,
                  replay_tombstones_after_restore, counts, command_hash,
                  correlation_id, idempotency_key
                ) values (
                  :run_id, :actor_account_id, :started_at, :completed_at,
                  :replay_tombstones_after_restore, cast(:counts as jsonb),
                  :command_hash, :correlation_id, :idempotency_key
                )
                """
            ),
            {
                "run_id": run_id,
                "actor_account_id": actor_account_id,
                "started_at": started_at,
                "completed_at": completed_at,
                "replay_tombstones_after_restore": replay_tombstones_after_restore,
                "counts": json.dumps(counts, sort_keys=True),
                "command_hash": command_hash,
                "correlation_id": correlation_id,
                "idempotency_key": command_key,
            },
        )
        self._audit(
            event_type="privacy.maintenance.completed",
            actor_account_id=actor_account_id,
            subject_account_id=None,
            request_id=None,
            outcome="completed",
            reason=(
                "retention-and-post-restore-replay"
                if replay_tombstones_after_restore
                else "scheduled-retention"
            ),
            details={"run_id": str(run_id), "counts": counts},
            correlation_id=correlation_id,
            idempotency_key=_scoped_key(command_key, "audit"),
        )
        self.session.commit()
        return PrivacyMaintenanceRead(
            run_id=run_id,
            started_at=started_at,
            completed_at=completed_at,
            replay_tombstones_after_restore=replay_tombstones_after_restore,
            counts=counts,
        )

    def metrics(
        self,
        *,
        actor_account_id: UUID,
        correlation_id: UUID,
        request_age_alert_seconds: int = 86400,
    ) -> PrivacyMetricsSnapshot:
        self._require_operator(actor_account_id)
        row = self.session.execute(
            text(
                """
                select
                  (
                    select count(*) from privacy.requests
                    where state in ('requested', 'verified', 'processing')
                  ) as open_request_count,
                  coalesce(
                    (
                      select extract(epoch from now() - min(requested_at))
                      from privacy.requests
                      where state in ('requested', 'verified', 'processing')
                    ),
                    0
                  ) as oldest_open_request_age_seconds,
                  (
                    select count(*) from privacy.request_contexts where state = 'failed'
                  ) as failed_context_count,
                  (
                    select count(*)
                    from community_intake.attachments attachment
                    where attachment.upload_completed_at is null
                      and attachment.state <> 'deleted'
                      and attachment.created_at <= now() - interval '24 hours'
                  ) as orphan_attachment_count,
                  (
                    select count(*) from privacy.holds
                    where state = 'active' and review_due_at <= now()
                  ) as overdue_hold_review_count,
                  (
                    select count(*) from privacy.export_artifacts
                    where state in ('ready', 'expired') and expires_at <= now()
                  ) as expired_export_payload_count,
                  (
                    select count(distinct account_id)
                    from privacy.deletion_tombstones
                    where applied_at >= now() - interval '35 days'
                  ) as tombstone_account_count,
                  (
                    select count(*) from privacy.audit_events
                    where event_type = 'privacy.deletion-tombstone.reapplied'
                      and occurred_at >= now() - interval '24 hours'
                  ) as tombstone_replay_count_24h,
                  (
                    select count(*) from privacy.audit_events
                    where event_type = 'privacy.export-access.granted'
                      and occurred_at >= now() - interval '24 hours'
                  ) as export_access_grant_count_24h,
                  (
                    select count(*) from privacy.audit_events
                    where event_type = 'privacy.export.downloaded'
                      and occurred_at >= now() - interval '24 hours'
                  ) as export_download_count_24h,
                  (
                    select count(*) from privacy.requests
                    where state = 'completed'
                      and completed_at >= now() - interval '24 hours'
                  ) as completed_request_count_24h
                """
            )
        ).mappings().one()
        values = {key: int(value or 0) for key, value in row.items()}
        oldest_age = float(row["oldest_open_request_age_seconds"] or 0)
        alerts: list[str] = []
        if oldest_age >= request_age_alert_seconds:
            alerts.append("privacy_request_age")
        if values["failed_context_count"] > 0:
            alerts.append("privacy_failed_context")
        if values["orphan_attachment_count"] > 0:
            alerts.append("privacy_orphan_attachment")
        if values["overdue_hold_review_count"] > 0:
            alerts.append("privacy_hold_review_overdue")
        if values["expired_export_payload_count"] > 0:
            alerts.append("privacy_expired_export_payload")

        self._audit(
            event_type="privacy.metrics.read",
            actor_account_id=actor_account_id,
            subject_account_id=None,
            request_id=None,
            outcome="read",
            reason="operator-workbench",
            details={"alerts": alerts},
            correlation_id=correlation_id,
            idempotency_key=_scoped_key(
                "privacy-metrics-read",
                actor_account_id,
                uuid4(),
            ),
        )
        self.session.commit()
        return PrivacyMetricsSnapshot(
            open_request_count=values["open_request_count"],
            oldest_open_request_age_seconds=oldest_age,
            failed_context_count=values["failed_context_count"],
            orphan_attachment_count=values["orphan_attachment_count"],
            overdue_hold_review_count=values["overdue_hold_review_count"],
            expired_export_payload_count=values["expired_export_payload_count"],
            tombstone_account_count=values["tombstone_account_count"],
            tombstone_replay_count_24h=values["tombstone_replay_count_24h"],
            export_access_grant_count_24h=values["export_access_grant_count_24h"],
            export_download_count_24h=values["export_download_count_24h"],
            completed_request_count_24h=values["completed_request_count_24h"],
            alerts=alerts,
        )

    def _require_operator(self, account_id: UUID) -> None:
        allowed = bool(
            self.session.execute(
                text(
                    """
                    select exists (
                      select 1
                      from identity.accounts account
                      join identity.role_assignments assignment
                        on assignment.account_id = account.account_id
                      join identity.role_capabilities role_capability
                        on role_capability.role_key = assignment.role_key
                      left join identity.role_assignment_revocations revocation
                        on revocation.assignment_id = assignment.assignment_id
                      where account.account_id = :account_id
                        and account.state = 'active'
                        and role_capability.capability_key = 'privacy.operate'
                        and revocation.assignment_id is null
                        and (
                          assignment.expires_at is null
                          or assignment.expires_at > now()
                        )
                    )
                    """
                ),
                {"account_id": account_id},
            ).scalar_one()
        )
        if not allowed:
            raise PrivacyMaintenanceForbiddenError(
                "Active privacy.operate capability is required"
            )

    def _audit(
        self,
        *,
        event_type: str,
        actor_account_id: UUID,
        subject_account_id: UUID | None,
        request_id: UUID | None,
        outcome: str,
        reason: str,
        details: dict[str, object],
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
                  :outcome, :reason, cast(:details as jsonb),
                  :correlation_id, :idempotency_key
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

    @staticmethod
    def _read(row: object) -> PrivacyMaintenanceRead:
        values = dict(row)  # type: ignore[arg-type]
        counts = values["counts"]
        if isinstance(counts, str):
            counts = json.loads(counts)
        return PrivacyMaintenanceRead(
            run_id=UUID(str(values["run_id"])),
            started_at=values["started_at"],
            completed_at=values["completed_at"],
            replay_tombstones_after_restore=bool(
                values["replay_tombstones_after_restore"]
            ),
            counts={key: int(value) for key, value in dict(counts).items()},
        )
