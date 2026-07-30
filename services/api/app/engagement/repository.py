from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.community_intake.repository import anonymize_community_intake_account
from app.engagement.handles import hash_opaque_handle, new_opaque_handle
from app.engagement.models import (
    EngagementAccountUnavailableError,
    EngagementConflictError,
    EngagementNotFoundError,
    FollowState,
    PendingFollowHandle,
    PendingFollowOutcome,
    PendingFollowResult,
    PendingFollowStatus,
)
from app.identity.models import RequestIdentity


class EngagementRepository:
    def __init__(self, session: Session, *, pending_ttl_seconds: int = 3600) -> None:
        self.session = session
        self.pending_ttl_seconds = min(max(pending_ttl_seconds, 60), 3600)

    def create_pending_intent(
        self,
        *,
        panda_id: str,
        locale: str,
        safe_return_path: str,
        existing_handle: str | None,
        request_id: UUID,
        correlation_id: UUID,
    ) -> PendingFollowHandle:
        panda = self._resolve_panda(panda_id)
        panda_id = str(panda["id"])
        safe_return_path = f"/{locale}/pandas/{panda['slug']}"
        continuation_handle = new_opaque_handle()
        if existing_handle:
            row = (
                self.session.execute(
                    text(
                        """
                    select intent_id, panda_id, locale, safe_return_path, status::text,
                           outcome::text, expires_at
                    from engagement.pending_follow_intents
                    where handle_hash = :handle_hash
                    for update
                    """
                    ),
                    {"handle_hash": hash_opaque_handle(existing_handle)},
                )
                .mappings()
                .one_or_none()
            )
            if row is not None and row["status"] == "pending":
                if row["expires_at"] <= datetime.now(UTC):
                    self._expire_intent(row["intent_id"], correlation_id=correlation_id)
                elif row["panda_id"] == panda_id:
                    self.session.execute(
                        text(
                            """
                            update engagement.pending_follow_intents
                            set continuation_handle_hash = :continuation_hash,
                                locale = :locale,
                                safe_return_path = :safe_return_path,
                                version = version + 1
                            where intent_id = :intent_id
                            """
                        ),
                        {
                            "continuation_hash": hash_opaque_handle(continuation_handle),
                            "locale": locale,
                            "safe_return_path": safe_return_path,
                            "intent_id": row["intent_id"],
                        },
                    )
                    self.session.commit()
                    return PendingFollowHandle(
                        intent_id=UUID(str(row["intent_id"])),
                        handle=existing_handle,
                        continuation_handle=continuation_handle,
                        panda_id=panda_id,
                        locale=locale,
                        safe_return_path=safe_return_path,
                        status=PendingFollowStatus.PENDING,
                        expires_at=row["expires_at"],
                    )

        handle = new_opaque_handle()
        intent_id = uuid4()
        created_at = datetime.now(UTC)
        expires_at = created_at + timedelta(seconds=self.pending_ttl_seconds)
        self.session.execute(
            text(
                """
                insert into engagement.pending_follow_intents (
                  intent_id, handle_hash, continuation_handle_hash, panda_id, locale,
                  safe_return_path, created_at, expires_at, request_id, correlation_id
                ) values (
                  :intent_id, :handle_hash, :continuation_hash, :panda_id, :locale,
                  :safe_return_path, :created_at, :expires_at, :request_id, :correlation_id
                )
                """
            ),
            {
                "intent_id": intent_id,
                "handle_hash": hash_opaque_handle(handle),
                "continuation_hash": hash_opaque_handle(continuation_handle),
                "panda_id": panda_id,
                "locale": locale,
                "safe_return_path": safe_return_path,
                "created_at": created_at,
                "expires_at": expires_at,
                "request_id": request_id,
                "correlation_id": correlation_id,
            },
        )
        self._audit(
            event_type="pending_follow.created",
            actor_account_id=None,
            subject_account_id=None,
            target_type="pending_follow_intent",
            target_id=str(intent_id),
            outcome="created",
            reason=None,
            details={"panda_id": panda_id, "locale": locale},
            correlation_id=correlation_id,
            idempotency_key=f"pending-created:{request_id}",
        )
        self._outbox(
            event_type="pending_follow.created",
            aggregate_type="pending_follow_intent",
            aggregate_id=str(intent_id),
            aggregate_version=1,
            idempotency_key=f"pending-created:{request_id}",
            correlation_id=correlation_id,
            payload={"intent_id": str(intent_id), "panda_id": panda_id, "locale": locale},
        )
        self.session.commit()
        return PendingFollowHandle(
            intent_id=intent_id,
            handle=handle,
            continuation_handle=continuation_handle,
            panda_id=panda_id,
            locale=locale,
            safe_return_path=safe_return_path,
            status=PendingFollowStatus.PENDING,
            expires_at=expires_at,
        )

    def get_pending_intent(self, handle: str, *, correlation_id: UUID) -> dict[str, Any]:
        row = self._get_intent_by_any_handle(handle, for_update=True)
        if row is None:
            raise EngagementNotFoundError("Pending Follow intent was not found")
        if row["status"] == "pending" and row["expires_at"] <= datetime.now(UTC):
            self._expire_intent(row["intent_id"], correlation_id=correlation_id)
            self.session.commit()
            row = self._get_intent_by_id(row["intent_id"])
        return dict(row)

    def cancel_pending_intent(
        self,
        *,
        handle: str,
        idempotency_key: str,
        correlation_id: UUID,
    ) -> dict[str, Any]:
        row = self._get_intent_by_any_handle(handle, for_update=True)
        if row is None:
            raise EngagementNotFoundError("Pending Follow intent was not found")
        if row["status"] == "cancelled":
            return dict(row)
        if row["status"] != "pending":
            raise EngagementConflictError("Pending Follow intent is already terminal")
        if row["expires_at"] <= datetime.now(UTC):
            self._expire_intent(row["intent_id"], correlation_id=correlation_id)
        else:
            self.session.execute(
                text(
                    """
                    update engagement.pending_follow_intents
                    set status = 'cancelled', outcome = 'cancelled', completed_at = now(),
                        version = version + 1
                    where intent_id = :intent_id
                    """
                ),
                {"intent_id": row["intent_id"]},
            )
            self._audit(
                event_type="pending_follow.cancelled",
                actor_account_id=None,
                subject_account_id=None,
                target_type="pending_follow_intent",
                target_id=str(row["intent_id"]),
                outcome="cancelled",
                reason="authentication-cancelled",
                details={"panda_id": row["panda_id"]},
                correlation_id=correlation_id,
                idempotency_key=idempotency_key,
            )
            self._outbox(
                event_type="pending_follow.cancelled",
                aggregate_type="pending_follow_intent",
                aggregate_id=str(row["intent_id"]),
                aggregate_version=int(row["version"]) + 1,
                idempotency_key=f"pending-cancelled:{idempotency_key}",
                correlation_id=correlation_id,
                payload={"intent_id": str(row["intent_id"]), "panda_id": row["panda_id"]},
            )
        self.session.commit()
        return dict(self._get_intent_by_id(row["intent_id"]))

    def complete_pending_follow(
        self,
        *,
        identity: RequestIdentity,
        handle: str,
        idempotency_key: str,
        correlation_id: UUID,
    ) -> PendingFollowResult:
        self._require_active_account(identity.account_id)
        row = self._get_intent_by_any_handle(handle, for_update=True)
        if row is None:
            raise EngagementNotFoundError("Pending Follow intent was not found")
        if row["status"] != "pending":
            if (
                row["status"] == "completed"
                and row["completed_by_account_id"] != identity.account_id
            ):
                raise EngagementNotFoundError("Pending Follow intent was not found")
            return self._terminal_pending_result(row, identity.account_id)
        if row["expires_at"] <= datetime.now(UTC):
            self._expire_intent(row["intent_id"], correlation_id=correlation_id)
            self.session.commit()
            return self._terminal_pending_result(
                self._get_intent_by_id(row["intent_id"]), identity.account_id
            )

        follow = self._get_follow(identity.account_id, row["panda_id"], for_update=True)
        outcome = PendingFollowOutcome.ALREADY_FOLLOWED
        if follow is None:
            follow = self._insert_follow(identity.account_id, row["panda_id"])
            outcome = PendingFollowOutcome.FOLLOWED
            self._insert_follow_event(
                follow=follow,
                account_id=identity.account_id,
                action="followed",
                pending_intent_id=row["intent_id"],
                idempotency_key=idempotency_key,
                correlation_id=correlation_id,
            )
        elif follow["state"] == "inactive":
            follow = self._reactivate_follow(follow)
            outcome = PendingFollowOutcome.FOLLOWED
            self._insert_follow_event(
                follow=follow,
                account_id=identity.account_id,
                action="followed",
                pending_intent_id=row["intent_id"],
                idempotency_key=idempotency_key,
                correlation_id=correlation_id,
            )

        self._project_passport(identity.account_id, follow)
        self.session.execute(
            text(
                """
                update engagement.pending_follow_intents
                set status = 'completed', outcome = :outcome, completed_at = now(),
                    completed_by_account_id = :account_id, version = version + 1
                where intent_id = :intent_id
                """
            ),
            {
                "outcome": outcome.value,
                "account_id": identity.account_id,
                "intent_id": row["intent_id"],
            },
        )
        self._audit(
            event_type="pending_follow.completed",
            actor_account_id=identity.account_id,
            subject_account_id=identity.account_id,
            target_type="pending_follow_intent",
            target_id=str(row["intent_id"]),
            outcome=outcome.value,
            reason=None,
            details={"panda_id": row["panda_id"], "follow_id": str(follow["follow_id"])},
            correlation_id=correlation_id,
            idempotency_key=idempotency_key,
        )
        self._outbox(
            event_type="follow.activated"
            if outcome is PendingFollowOutcome.FOLLOWED
            else "follow.confirmed",
            aggregate_type="follow",
            aggregate_id=str(follow["follow_id"]),
            aggregate_version=int(follow["version"]),
            idempotency_key=f"follow-complete:{idempotency_key}",
            correlation_id=correlation_id,
            payload={
                "account_id": str(identity.account_id),
                "panda_id": row["panda_id"],
                "follow_id": str(follow["follow_id"]),
                "outcome": outcome.value,
                "notification_consent_changed": False,
            },
        )
        self.session.commit()
        return PendingFollowResult(
            intent_id=UUID(str(row["intent_id"])),
            panda_id=str(row["panda_id"]),
            status=PendingFollowStatus.COMPLETED,
            outcome=outcome,
            follow_id=UUID(str(follow["follow_id"])),
            follow_state=FollowState(str(follow["state"])),
            first_followed_at=follow["first_followed_at"],
            followed_at=follow["followed_at"],
            version=int(follow["version"]),
        )

    def follow(
        self,
        *,
        identity: RequestIdentity,
        panda_id: str,
        idempotency_key: str,
        correlation_id: UUID,
    ) -> dict[str, Any]:
        self._require_active_account(identity.account_id)
        self._require_panda(panda_id)
        replay = self._replay_follow(identity.account_id, idempotency_key)
        if replay is not None:
            if replay["panda_id"] != panda_id or replay["action"] != "followed":
                raise EngagementConflictError("Idempotency key was used for another Follow command")
            return dict(self._get_follow(identity.account_id, panda_id, for_update=False))
        follow = self._get_follow(identity.account_id, panda_id, for_update=True)
        if follow is None:
            follow = self._insert_follow(identity.account_id, panda_id)
        elif follow["state"] == "inactive":
            follow = self._reactivate_follow(follow)
        else:
            return dict(follow)
        self._insert_follow_event(
            follow=follow,
            account_id=identity.account_id,
            action="followed",
            pending_intent_id=None,
            idempotency_key=idempotency_key,
            correlation_id=correlation_id,
        )
        self._project_passport(identity.account_id, follow)
        self._audit_follow(identity, follow, "follow.activated", idempotency_key, correlation_id)
        self._outbox_follow(
            follow, identity.account_id, "follow.activated", idempotency_key, correlation_id
        )
        self.session.commit()
        return dict(follow)

    def unfollow(
        self,
        *,
        identity: RequestIdentity,
        panda_id: str,
        idempotency_key: str,
        correlation_id: UUID,
    ) -> dict[str, Any]:
        self._require_active_account(identity.account_id)
        replay = self._replay_follow(identity.account_id, idempotency_key)
        if replay is not None:
            if replay["panda_id"] != panda_id or replay["action"] != "unfollowed":
                raise EngagementConflictError("Idempotency key was used for another Follow command")
            return dict(self._get_follow(identity.account_id, panda_id, for_update=False))
        follow = self._get_follow(identity.account_id, panda_id, for_update=True)
        if follow is None:
            raise EngagementNotFoundError("Follow relationship was not found")
        if follow["state"] == "inactive":
            return dict(follow)
        follow = (
            self.session.execute(
                text(
                    """
                update engagement.follows
                set state = 'inactive', unfollowed_at = now(), version = version + 1,
                    updated_at = now()
                where follow_id = :follow_id
                returning follow_id, panda_id, state::text, first_followed_at, followed_at,
                          unfollowed_at, version
                """
                ),
                {"follow_id": follow["follow_id"]},
            )
            .mappings()
            .one()
        )
        self._insert_follow_event(
            follow=follow,
            account_id=identity.account_id,
            action="unfollowed",
            pending_intent_id=None,
            idempotency_key=idempotency_key,
            correlation_id=correlation_id,
        )
        self._project_passport(identity.account_id, follow)
        self._audit_follow(identity, follow, "follow.deactivated", idempotency_key, correlation_id)
        self._outbox_follow(
            follow, identity.account_id, "follow.deactivated", idempotency_key, correlation_id
        )
        self.session.commit()
        return dict(follow)

    def get_follow(self, account_id: UUID, panda_id: str) -> dict[str, Any]:
        row = self._get_follow(account_id, panda_id, for_update=False)
        if row is None:
            raise EngagementNotFoundError("Follow relationship was not found")
        return dict(row)

    def set_notification_preference(
        self,
        *,
        identity: RequestIdentity,
        category: str,
        channel: str,
        enabled: bool,
        idempotency_key: str,
        correlation_id: UUID,
    ) -> dict[str, Any]:
        self._require_active_account(identity.account_id)
        subject_hash = self._subject_hash(identity.account_id)
        replay = (
            self.session.execute(
                text(
                    """
                select category, channel, enabled
                from engagement.notification_preference_events
                where account_subject_hash = :subject_hash and idempotency_key = :idempotency_key
                """
                ),
                {"subject_hash": subject_hash, "idempotency_key": idempotency_key},
            )
            .mappings()
            .one_or_none()
        )
        if replay is not None:
            if (
                replay["category"] != category
                or replay["channel"] != channel
                or replay["enabled"] != enabled
            ):
                raise EngagementConflictError(
                    "Idempotency key was used for another preference command"
                )
            return dict(self._get_preference(identity.account_id, category, channel))

        current = self._get_preference(identity.account_id, category, channel, for_update=True)
        version = 1 if current is None else int(current["version"]) + 1
        self.session.execute(
            text(
                """
                insert into engagement.notification_preferences (
                  account_id, category, channel, enabled, version, updated_at
                ) values (:account_id, :category, :channel, :enabled, :version, now())
                on conflict (account_id, category, channel) do update
                set enabled = excluded.enabled, version = excluded.version, updated_at = now()
                """
            ),
            {
                "account_id": identity.account_id,
                "category": category,
                "channel": channel,
                "enabled": enabled,
                "version": version,
            },
        )
        self.session.execute(
            text(
                """
                insert into engagement.notification_preference_events (
                  account_subject_hash, category, channel, enabled, preference_version,
                  idempotency_key, correlation_id
                ) values (
                  :subject_hash, :category, :channel, :enabled, :version,
                  :idempotency_key, :correlation_id
                )
                """
            ),
            {
                "subject_hash": subject_hash,
                "category": category,
                "channel": channel,
                "enabled": enabled,
                "version": version,
                "idempotency_key": idempotency_key,
                "correlation_id": correlation_id,
            },
        )
        self._audit(
            event_type="notification_consent.changed",
            actor_account_id=identity.account_id,
            subject_account_id=identity.account_id,
            target_type="notification_preference",
            target_id=f"{category}:{channel}",
            outcome="enabled" if enabled else "disabled",
            reason=None,
            details={"version": version},
            correlation_id=correlation_id,
            idempotency_key=idempotency_key,
        )
        self._outbox(
            event_type="notification_consent.changed",
            aggregate_type="notification_preference",
            aggregate_id=f"{identity.account_id}:{category}:{channel}",
            aggregate_version=version,
            idempotency_key=f"preference:{idempotency_key}",
            correlation_id=correlation_id,
            payload={
                "account_id": str(identity.account_id),
                "category": category,
                "channel": channel,
                "enabled": enabled,
                "version": version,
            },
        )
        self.session.commit()
        return dict(self._get_preference(identity.account_id, category, channel))

    def record_passport_contribution(
        self,
        *,
        account_id: UUID,
        panda_id: str,
        source_event_id: UUID,
        occurred_at: datetime,
        correlation_id: UUID,
    ) -> dict[str, Any]:
        """Record a private, replayable Passport projection input from Community."""
        self._require_panda(panda_id)
        self._require_active_account(account_id)

        replay = (
            self.session.execute(
                text(
                    """
                    select account_id, panda_id
                    from engagement.passport_contribution_events
                    where source_event_id = :source_event_id
                    """
                ),
                {"source_event_id": source_event_id},
            )
            .mappings()
            .one_or_none()
        )
        if replay is not None:
            if replay["account_id"] != account_id or replay["panda_id"] != panda_id:
                raise EngagementConflictError(
                    "Contribution source event was used for another Passport projection"
                )
            entry = self._get_passport_entry(account_id, panda_id)
            if entry is None:
                raise EngagementConflictError("Contribution projection replay is incomplete")
            return dict(entry)

        inserted_event_id = self.session.execute(
            text(
                """
                insert into engagement.passport_contribution_events (
                  source_event_id, account_id, panda_id, occurred_at, correlation_id
                ) values (
                  :source_event_id, :account_id, :panda_id, :occurred_at, :correlation_id
                )
                on conflict (source_event_id) do nothing
                returning source_event_id
                """
            ),
            {
                "source_event_id": source_event_id,
                "account_id": account_id,
                "panda_id": panda_id,
                "occurred_at": occurred_at,
                "correlation_id": correlation_id,
            },
        ).scalar_one_or_none()
        if inserted_event_id is None:
            replay = (
                self.session.execute(
                    text(
                        """
                        select account_id, panda_id
                        from engagement.passport_contribution_events
                        where source_event_id = :source_event_id
                        """
                    ),
                    {"source_event_id": source_event_id},
                )
                .mappings()
                .one_or_none()
            )
            if replay is None:
                raise EngagementConflictError("Contribution source event replay was not visible")
            if replay["account_id"] != account_id or replay["panda_id"] != panda_id:
                raise EngagementConflictError(
                    "Contribution source event was used for another Passport projection"
                )
            entry = self._get_passport_entry(account_id, panda_id)
            if entry is None:
                raise EngagementConflictError("Contribution projection replay is incomplete")
            return dict(entry)
        entry = (
            self.session.execute(
                text(
                    """
                    insert into engagement.passport_entries (
                      account_id, panda_id, relationship_state, first_followed_at, followed_at,
                      unfollowed_at, contribution_count, projection_version, projected_at
                    ) values (
                      :account_id, :panda_id, null, null, null, null, 1, 1, now()
                    )
                    on conflict (account_id, panda_id) do update
                    set contribution_count = engagement.passport_entries.contribution_count + 1,
                        projection_version = engagement.passport_entries.projection_version + 1,
                        projected_at = now()
                    returning panda_id, relationship_state::text, first_followed_at, followed_at,
                              unfollowed_at, contribution_count, projection_version, projected_at
                    """
                ),
                {"account_id": account_id, "panda_id": panda_id},
            )
            .mappings()
            .one()
        )
        source_event_key = hashlib.sha256(str(source_event_id).encode("utf-8")).hexdigest()
        self._audit(
            event_type="passport.contribution-recorded",
            actor_account_id=None,
            subject_account_id=account_id,
            target_type="passport_entry",
            target_id=panda_id,
            outcome="recorded",
            reason=None,
            details={"contribution_count": int(entry["contribution_count"])},
            correlation_id=correlation_id,
            idempotency_key=f"passport-contribution:{source_event_key}",
        )
        self._outbox(
            event_type="passport.contribution-recorded",
            aggregate_type="passport_entry",
            aggregate_id=f"{account_id}:{panda_id}",
            aggregate_version=int(entry["projection_version"]),
            idempotency_key=f"passport-contribution:{source_event_key}",
            correlation_id=correlation_id,
            payload={
                "account_id": str(account_id),
                "panda_id": panda_id,
                "contribution_count": int(entry["contribution_count"]),
            },
        )
        self.session.commit()
        return dict(entry)

    def get_passport(self, account_id: UUID) -> list[dict[str, Any]]:
        return [
            dict(row)
            for row in self.session.execute(
                text(
                    """
                    select panda_id, relationship_state::text, first_followed_at, followed_at,
                           unfollowed_at, contribution_count, projection_version, projected_at
                    from engagement.passport_entries
                    where account_id = :account_id
                    order by coalesce(first_followed_at, projected_at), panda_id
                    """
                ),
                {"account_id": account_id},
            ).mappings()
        ]

    def rebuild_passport(
        self,
        *,
        identity: RequestIdentity,
        idempotency_key: str,
        correlation_id: UUID,
    ) -> list[dict[str, Any]]:
        self._require_active_account(identity.account_id)
        replay = (
            self.session.execute(
                text(
                    """
                    select subject_account_id
                    from engagement.audit_events
                    where event_type = 'passport.rebuilt'
                      and idempotency_key = :idempotency_key
                    """
                ),
                {"idempotency_key": idempotency_key},
            )
            .mappings()
            .one_or_none()
        )
        if replay is not None:
            if replay["subject_account_id"] != identity.account_id:
                raise EngagementConflictError(
                    "Idempotency key was used for another Passport rebuild"
                )
            return self.get_passport(identity.account_id)

        self.session.execute(
            text("delete from engagement.passport_entries where account_id = :account_id"),
            {"account_id": identity.account_id},
        )
        self.session.execute(
            text(
                """
                insert into engagement.passport_entries (
                  account_id, panda_id, relationship_state, first_followed_at, followed_at,
                  unfollowed_at, contribution_count, projection_version, projected_at
                )
                select account_id, panda_id, state, first_followed_at, followed_at,
                       unfollowed_at, 0, version, now()
                from engagement.follows
                where account_id = :account_id
                """
            ),
            {"account_id": identity.account_id},
        )
        self.session.execute(
            text(
                """
                insert into engagement.passport_entries (
                  account_id, panda_id, relationship_state, first_followed_at, followed_at,
                  unfollowed_at, contribution_count, projection_version, projected_at
                )
                select account_id, panda_id, null, null, null, null,
                       count(*)::integer, count(*)::integer, now()
                from engagement.passport_contribution_events
                where account_id = :account_id
                group by account_id, panda_id
                on conflict (account_id, panda_id) do update
                set contribution_count = excluded.contribution_count,
                    projection_version = engagement.passport_entries.projection_version
                      + excluded.projection_version,
                    projected_at = now()
                """
            ),
            {"account_id": identity.account_id},
        )
        self._audit(
            event_type="passport.rebuilt",
            actor_account_id=identity.account_id,
            subject_account_id=identity.account_id,
            target_type="passport",
            target_id=str(identity.account_id),
            outcome="rebuilt",
            reason=None,
            details={},
            correlation_id=correlation_id,
            idempotency_key=idempotency_key,
        )
        self._outbox(
            event_type="passport.rebuilt",
            aggregate_type="passport",
            aggregate_id=str(identity.account_id),
            aggregate_version=None,
            idempotency_key=f"passport-rebuild:{idempotency_key}",
            correlation_id=correlation_id,
            payload={"account_id": str(identity.account_id)},
        )
        self.session.commit()
        return self.get_passport(identity.account_id)

    def delete_private_data(
        self,
        *,
        identity: RequestIdentity,
        idempotency_key: str,
        reason: str,
        correlation_id: UUID,
    ) -> dict[str, Any]:
        self._require_deleting_account(identity.account_id)
        replay = (
            self.session.execute(
                text(
                    """
                select details
                from engagement.audit_events
                where event_type = 'engagement.private_data.deleted'
                  and idempotency_key = :idempotency_key
                  and subject_account_id = :account_id
                """
                ),
                {"idempotency_key": idempotency_key, "account_id": identity.account_id},
            )
            .mappings()
            .one_or_none()
        )
        if replay is not None:
            return {
                **dict(replay["details"]),
                "account_id": identity.account_id,
                "outcome": "deleted",
            }

        self.session.execute(
            text(
                """
                update engagement.pending_follow_intents
                set completed_by_account_id = null
                where completed_by_account_id = :account_id
                """
            ),
            {"account_id": identity.account_id},
        )
        feed_last_viewed_deleted = int(
            self.session.execute(
                text("delete from feed.account_state where account_id = :account_id"),
                {"account_id": identity.account_id},
            ).rowcount
            or 0
        )
        community_counts = anonymize_community_intake_account(
            self.session,
            identity.account_id,
            reason=reason,
            correlation_id=correlation_id,
        )
        notification_counts = self._delete_notification_private_data(identity.account_id)
        counts = {
            "passport_entries_deleted": self._delete_count("passport_entries", identity.account_id),
            "preferences_deleted": self._delete_count(
                "notification_preferences", identity.account_id
            ),
            "last_viewed_deleted": (
                self._delete_count("last_viewed_profiles", identity.account_id)
                + feed_last_viewed_deleted
            ),
            "contribution_events_deleted": self._delete_count(
                "passport_contribution_events", identity.account_id
            ),
            "follows_deleted": self._delete_count("follows", identity.account_id),
            **community_counts,
            **notification_counts,
        }
        self._audit(
            event_type="engagement.private_data.deleted",
            actor_account_id=identity.account_id,
            subject_account_id=identity.account_id,
            target_type="account_engagement",
            target_id=str(identity.account_id),
            outcome="deleted",
            reason=reason,
            details=counts,
            correlation_id=correlation_id,
            idempotency_key=idempotency_key,
        )
        self._outbox(
            event_type="engagement.private_data.deleted",
            aggregate_type="account",
            aggregate_id=str(identity.account_id),
            aggregate_version=None,
            idempotency_key=f"engagement-delete:{idempotency_key}",
            correlation_id=correlation_id,
            payload={"account_id": str(identity.account_id), **counts},
        )
        self.session.commit()
        return {"account_id": identity.account_id, **counts, "outcome": "deleted"}

    def _get_intent_by_any_handle(self, handle: str, *, for_update: bool) -> Any:
        suffix = " for update" if for_update else ""
        handle_hash = hash_opaque_handle(handle)
        return (
            self.session.execute(
                text(
                    """
                select intent_id, panda_id, locale, safe_return_path, status::text,
                       outcome::text, expires_at, completed_at, completed_by_account_id, version
                from engagement.pending_follow_intents
                where handle_hash = :handle_hash or continuation_handle_hash = :handle_hash
                """
                    + suffix
                ),
                {"handle_hash": handle_hash},
            )
            .mappings()
            .one_or_none()
        )

    def _get_intent_by_id(self, intent_id: UUID) -> Any:
        return (
            self.session.execute(
                text(
                    """
                select intent_id, panda_id, locale, safe_return_path, status::text,
                       outcome::text, expires_at, completed_at, completed_by_account_id, version
                from engagement.pending_follow_intents where intent_id = :intent_id
                """
                ),
                {"intent_id": intent_id},
            )
            .mappings()
            .one()
        )

    def _expire_intent(self, intent_id: UUID, *, correlation_id: UUID) -> None:
        row = self._get_intent_by_id(intent_id)
        if row["status"] != "pending":
            return
        self.session.execute(
            text(
                """
                update engagement.pending_follow_intents
                set status = 'expired', outcome = 'intent_expired', completed_at = now(),
                    version = version + 1
                where intent_id = :intent_id
                """
            ),
            {"intent_id": intent_id},
        )
        self._outbox(
            event_type="pending_follow.expired",
            aggregate_type="pending_follow_intent",
            aggregate_id=str(intent_id),
            aggregate_version=int(row["version"]) + 1,
            idempotency_key=f"pending-expired:{intent_id}",
            correlation_id=correlation_id,
            payload={"intent_id": str(intent_id), "panda_id": row["panda_id"]},
        )

    def _terminal_pending_result(self, row: Any, account_id: UUID) -> PendingFollowResult:
        follow = self._get_follow(account_id, row["panda_id"], for_update=False)
        return PendingFollowResult(
            intent_id=UUID(str(row["intent_id"])),
            panda_id=str(row["panda_id"]),
            status=PendingFollowStatus(str(row["status"])),
            outcome=PendingFollowOutcome(str(row["outcome"])),
            follow_id=UUID(str(follow["follow_id"])) if follow is not None else None,
            follow_state=FollowState(str(follow["state"])) if follow is not None else None,
            first_followed_at=follow["first_followed_at"] if follow is not None else None,
            followed_at=follow["followed_at"] if follow is not None else None,
            version=int(follow["version"]) if follow is not None else None,
        )

    def _get_follow(self, account_id: UUID, panda_id: str, *, for_update: bool) -> Any:
        suffix = " for update" if for_update else ""
        return (
            self.session.execute(
                text(
                    """
                select follow_id, panda_id, state::text, first_followed_at, followed_at,
                       unfollowed_at, version
                from engagement.follows
                where account_id = :account_id and panda_id = :panda_id
                """
                    + suffix
                ),
                {"account_id": account_id, "panda_id": panda_id},
            )
            .mappings()
            .one_or_none()
        )

    def _insert_follow(self, account_id: UUID, panda_id: str) -> Any:
        return (
            self.session.execute(
                text(
                    """
                insert into engagement.follows (account_id, panda_id)
                values (:account_id, :panda_id)
                returning follow_id, panda_id, state::text, first_followed_at, followed_at,
                          unfollowed_at, version
                """
                ),
                {"account_id": account_id, "panda_id": panda_id},
            )
            .mappings()
            .one()
        )

    def _reactivate_follow(self, follow: Any) -> Any:
        return (
            self.session.execute(
                text(
                    """
                update engagement.follows
                set state = 'active', followed_at = now(), unfollowed_at = null,
                    version = version + 1, updated_at = now()
                where follow_id = :follow_id
                returning follow_id, panda_id, state::text, first_followed_at, followed_at,
                          unfollowed_at, version
                """
                ),
                {"follow_id": follow["follow_id"]},
            )
            .mappings()
            .one()
        )

    def _replay_follow(self, account_id: UUID, idempotency_key: str) -> Any:
        return (
            self.session.execute(
                text(
                    """
                select panda_id, action
                from engagement.follow_events
                where account_subject_hash = :subject_hash and idempotency_key = :idempotency_key
                """
                ),
                {
                    "subject_hash": self._subject_hash(account_id),
                    "idempotency_key": idempotency_key,
                },
            )
            .mappings()
            .one_or_none()
        )

    def _insert_follow_event(
        self,
        *,
        follow: Any,
        account_id: UUID,
        action: str,
        pending_intent_id: UUID | None,
        idempotency_key: str,
        correlation_id: UUID,
    ) -> None:
        self.session.execute(
            text(
                """
                insert into engagement.follow_events (
                  follow_id, account_subject_hash, panda_id, action, follow_version,
                  pending_intent_id, idempotency_key, correlation_id
                ) values (
                  :follow_id, :subject_hash, :panda_id, :action, :version,
                  :pending_intent_id, :idempotency_key, :correlation_id
                )
                """
            ),
            {
                "follow_id": follow["follow_id"],
                "subject_hash": self._subject_hash(account_id),
                "panda_id": follow["panda_id"],
                "action": action,
                "version": follow["version"],
                "pending_intent_id": pending_intent_id,
                "idempotency_key": idempotency_key,
                "correlation_id": correlation_id,
            },
        )

    def _project_passport(self, account_id: UUID, follow: Any) -> None:
        self.session.execute(
            text(
                """
                insert into engagement.passport_entries (
                  account_id, panda_id, relationship_state, first_followed_at, followed_at,
                  unfollowed_at, contribution_count, projection_version, projected_at
                ) values (
                  :account_id, :panda_id, :state, :first_followed_at, :followed_at,
                  :unfollowed_at, 0, :version, now()
                )
                on conflict (account_id, panda_id) do update
                set relationship_state = excluded.relationship_state,
                    first_followed_at = excluded.first_followed_at,
                    followed_at = excluded.followed_at,
                    unfollowed_at = excluded.unfollowed_at,
                    projection_version = engagement.passport_entries.projection_version + 1,
                    projected_at = now()
                """
            ),
            {
                "account_id": account_id,
                "panda_id": follow["panda_id"],
                "state": follow["state"],
                "first_followed_at": follow["first_followed_at"],
                "followed_at": follow["followed_at"],
                "unfollowed_at": follow["unfollowed_at"],
                "version": follow["version"],
            },
        )

    def _get_passport_entry(self, account_id: UUID, panda_id: str) -> Any:
        return (
            self.session.execute(
                text(
                    """
                    select panda_id, relationship_state::text, first_followed_at, followed_at,
                           unfollowed_at, contribution_count, projection_version, projected_at
                    from engagement.passport_entries
                    where account_id = :account_id and panda_id = :panda_id
                    """
                ),
                {"account_id": account_id, "panda_id": panda_id},
            )
            .mappings()
            .one_or_none()
        )

    def _get_preference(
        self, account_id: UUID, category: str, channel: str, *, for_update: bool = False
    ) -> Any:
        suffix = " for update" if for_update else ""
        return (
            self.session.execute(
                text(
                    """
                select category, channel, enabled, version, updated_at
                from engagement.notification_preferences
                where account_id = :account_id and category = :category and channel = :channel
                """
                    + suffix
                ),
                {"account_id": account_id, "category": category, "channel": channel},
            )
            .mappings()
            .one_or_none()
        )

    def _require_active_account(self, account_id: UUID) -> None:
        state = self.session.execute(
            text(
                """
                select state::text
                from identity.accounts
                where account_id = :account_id
                for share
                """
            ),
            {"account_id": account_id},
        ).scalar_one_or_none()
        if state is None:
            raise EngagementNotFoundError("Account was not found")
        if state != "active":
            raise EngagementAccountUnavailableError("Account is unavailable")

    def _require_deleting_account(self, account_id: UUID) -> None:
        state = self.session.execute(
            text(
                """
                select state::text
                from identity.accounts
                where account_id = :account_id
                for update
                """
            ),
            {"account_id": account_id},
        ).scalar_one_or_none()
        if state is None:
            raise EngagementNotFoundError("Account was not found")
        if state != "deleting":
            raise EngagementAccountUnavailableError("Account deletion is not active")

    def _resolve_panda(self, panda_id: str) -> Any:
        row = (
            self.session.execute(
                text(
                    """
                    select id::text as id, slug
                    from public.pandas
                    where id::text = :panda_id or slug = :panda_id
                    limit 1
                    """
                ),
                {"panda_id": panda_id},
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise EngagementNotFoundError("Panda was not found")
        return row

    def _require_panda(self, panda_id: str) -> None:
        self._resolve_panda(panda_id)

    def _delete_notification_private_data(self, account_id: UUID) -> dict[str, int]:
        transport_attempts = int(
            self.session.execute(
                text(
                    """
                    delete from notification.transport_attempts
                    where delivery_id in (
                      select delivery_id from notification.delivery_jobs
                      where account_id = :account_id
                    )
                    """
                ),
                {"account_id": account_id},
            ).rowcount
            or 0
        )
        delivery_jobs = int(
            self.session.execute(
                text("delete from notification.delivery_jobs where account_id = :account_id"),
                {"account_id": account_id},
            ).rowcount
            or 0
        )
        email_suppressions = int(
            self.session.execute(
                text("delete from notification.email_suppressions where account_id = :account_id"),
                {"account_id": account_id},
            ).rowcount
            or 0
        )
        digest_items = int(
            self.session.execute(
                text(
                    """
                    delete from notification.digest_items
                    where batch_id in (
                      select batch_id from notification.digest_batches
                      where account_id = :account_id
                    )
                    """
                ),
                {"account_id": account_id},
            ).rowcount
            or 0
        )
        delivery_attempts = int(
            self.session.execute(
                text(
                    """
                    delete from notification.delivery_attempts
                    where intent_id in (
                      select intent_id from notification.intents
                      where account_id = :account_id
                    )
                    """
                ),
                {"account_id": account_id},
            ).rowcount
            or 0
        )
        inbox_items = int(
            self.session.execute(
                text("delete from notification.inbox_items where account_id = :account_id"),
                {"account_id": account_id},
            ).rowcount
            or 0
        )
        intent_channels = int(
            self.session.execute(
                text(
                    """
                    delete from notification.intent_channels
                    where intent_id in (
                      select intent_id from notification.intents
                      where account_id = :account_id
                    )
                    """
                ),
                {"account_id": account_id},
            ).rowcount
            or 0
        )
        digest_batches = int(
            self.session.execute(
                text("delete from notification.digest_batches where account_id = :account_id"),
                {"account_id": account_id},
            ).rowcount
            or 0
        )
        intents = int(
            self.session.execute(
                text("delete from notification.intents where account_id = :account_id"),
                {"account_id": account_id},
            ).rowcount
            or 0
        )
        preferences = int(
            self.session.execute(
                text("delete from notification.preferences where account_id = :account_id"),
                {"account_id": account_id},
            ).rowcount
            or 0
        )
        return {
            "notification_transport_attempts_deleted": transport_attempts,
            "notification_delivery_jobs_deleted": delivery_jobs,
            "notification_email_suppressions_deleted": email_suppressions,
            "notification_digest_items_deleted": digest_items,
            "notification_delivery_attempts_deleted": delivery_attempts,
            "notification_inbox_items_deleted": inbox_items,
            "notification_intent_channels_deleted": intent_channels,
            "notification_digest_batches_deleted": digest_batches,
            "notification_intents_deleted": intents,
            "notification_preferences_deleted": preferences,
        }

    def _delete_count(self, table_name: str, account_id: UUID) -> int:
        result = self.session.execute(
            text(f"delete from engagement.{table_name} where account_id = :account_id"),
            {"account_id": account_id},
        )
        return int(result.rowcount or 0)

    @staticmethod
    def _subject_hash(account_id: UUID) -> str:
        return hashlib.sha256(str(account_id).encode("utf-8")).hexdigest()

    def _audit_follow(
        self,
        identity: RequestIdentity,
        follow: Any,
        event_type: str,
        idempotency_key: str,
        correlation_id: UUID,
    ) -> None:
        self._audit(
            event_type=event_type,
            actor_account_id=identity.account_id,
            subject_account_id=identity.account_id,
            target_type="follow",
            target_id=str(follow["follow_id"]),
            outcome=str(follow["state"]),
            reason=None,
            details={"panda_id": follow["panda_id"], "version": follow["version"]},
            correlation_id=correlation_id,
            idempotency_key=idempotency_key,
        )

    def _outbox_follow(
        self,
        follow: Any,
        account_id: UUID,
        event_type: str,
        idempotency_key: str,
        correlation_id: UUID,
    ) -> None:
        self._outbox(
            event_type=event_type,
            aggregate_type="follow",
            aggregate_id=str(follow["follow_id"]),
            aggregate_version=int(follow["version"]),
            idempotency_key=f"{event_type}:{idempotency_key}",
            correlation_id=correlation_id,
            payload={
                "account_id": str(account_id),
                "panda_id": follow["panda_id"],
                "follow_id": str(follow["follow_id"]),
                "state": follow["state"],
                "version": follow["version"],
            },
        )

    def _audit(
        self,
        *,
        event_type: str,
        actor_account_id: UUID | None,
        subject_account_id: UUID | None,
        target_type: str,
        target_id: str,
        outcome: str,
        reason: str | None,
        details: dict[str, Any],
        correlation_id: UUID,
        idempotency_key: str,
    ) -> None:
        self.session.execute(
            text(
                """
                insert into engagement.audit_events (
                  event_type, actor_account_id, subject_account_id, target_type, target_id,
                  outcome, reason, details, correlation_id, idempotency_key
                ) values (
                  :event_type, :actor_account_id, :subject_account_id, :target_type, :target_id,
                  :outcome, :reason, cast(:details as jsonb), :correlation_id, :idempotency_key
                )
                on conflict (event_type, idempotency_key) do nothing
                """
            ),
            {
                "event_type": event_type,
                "actor_account_id": actor_account_id,
                "subject_account_id": subject_account_id,
                "target_type": target_type,
                "target_id": target_id,
                "outcome": outcome,
                "reason": reason,
                "details": json.dumps(details, sort_keys=True),
                "correlation_id": correlation_id,
                "idempotency_key": idempotency_key,
            },
        )

    def _outbox(
        self,
        *,
        event_type: str,
        aggregate_type: str,
        aggregate_id: str,
        aggregate_version: int | None,
        idempotency_key: str,
        correlation_id: UUID,
        payload: dict[str, Any],
    ) -> None:
        event_id = uuid4()
        message = {
            "event_id": str(event_id),
            "event_type": event_type,
            "schema_version": 1,
            "aggregate_id": aggregate_id,
            "aggregate_version": aggregate_version,
            "outbox_id": str(event_id),
            "correlation_id": str(correlation_id),
        }
        inserted_event_id = self.session.execute(
            text(
                """
                insert into integration.outbox_events (
                  event_id, event_type, event_version, source_context, aggregate_type,
                  aggregate_id, aggregate_version, idempotency_key, correlation_id,
                  occurred_at, payload
                ) values (
                  :event_id, :event_type, 1, 'identity-engagement', :aggregate_type,
                  :aggregate_id, :aggregate_version, :idempotency_key, :correlation_id,
                  now(), cast(:payload as jsonb)
                )
                on conflict (source_context, idempotency_key) do nothing
                returning event_id
                """
            ),
            {
                "event_id": event_id,
                "event_type": event_type,
                "aggregate_type": aggregate_type,
                "aggregate_id": aggregate_id,
                "aggregate_version": aggregate_version,
                "idempotency_key": idempotency_key,
                "correlation_id": correlation_id,
                "payload": json.dumps(payload, sort_keys=True),
            },
        ).scalar_one_or_none()
        if inserted_event_id is None:
            return
        self.session.execute(
            text("select pgmq.send('integration_events', cast(:message as jsonb))"),
            {"message": json.dumps(message, sort_keys=True)},
        )
