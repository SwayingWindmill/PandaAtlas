from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.engagement.models import EngagementAccountUnavailableError, EngagementNotFoundError
from app.identity.models import RequestIdentity


class FanGameRepository:
    """Optional private game history for signed-in fans."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def list_attempts(self, account_id: UUID) -> list[dict[str, Any]]:
        rows = self.session.execute(
            text(
                """
                select attempt_id, game_type, target_panda_id, selected_panda_id,
                       correct, public_release_version, attempted_at
                from engagement.game_attempts
                where account_id = :account_id
                order by attempted_at desc, attempt_id desc
                """
            ),
            {"account_id": account_id},
        ).mappings()
        return [dict(row) for row in rows]

    def save_attempt(
        self,
        *,
        identity: RequestIdentity,
        target_panda_id: str,
        selected_panda_id: str,
        public_release_version: str | None,
    ) -> dict[str, Any]:
        self._require_active_account(identity.account_id)
        target = self._canonical_panda_id(target_panda_id)
        selected = self._canonical_panda_id(selected_panda_id)
        release_version = self._normalize_release(public_release_version)
        row = (
            self.session.execute(
                text(
                    """
                    insert into engagement.game_attempts (
                      account_id, game_type, target_panda_id, selected_panda_id,
                      correct, public_release_version
                    ) values (
                      :account_id, 'guess_panda', :target_panda_id, :selected_panda_id,
                      :correct, :public_release_version
                    )
                    returning attempt_id, game_type, target_panda_id, selected_panda_id,
                              correct, public_release_version, attempted_at
                    """
                ),
                {
                    "account_id": identity.account_id,
                    "target_panda_id": target,
                    "selected_panda_id": selected,
                    "correct": target == selected,
                    "public_release_version": release_version,
                },
            )
            .mappings()
            .one()
        )
        self.session.commit()
        return dict(row)

    def delete_attempt(self, *, identity: RequestIdentity, attempt_id: UUID) -> UUID:
        self._require_active_account(identity.account_id)
        deleted_id = self.session.execute(
            text(
                """
                delete from engagement.game_attempts
                where attempt_id = :attempt_id and account_id = :account_id
                returning attempt_id
                """
            ),
            {"attempt_id": attempt_id, "account_id": identity.account_id},
        ).scalar_one_or_none()
        self.session.commit()
        if deleted_id is None:
            raise EngagementNotFoundError("Game attempt was not found")
        return UUID(str(deleted_id))

    def _canonical_panda_id(self, panda_id: str) -> str:
        normalized = panda_id.strip()
        canonical = self.session.execute(
            text(
                """
                select id::text
                from public.pandas
                where id::text = :panda_id or slug = :panda_id
                limit 1
                """
            ),
            {"panda_id": normalized},
        ).scalar_one_or_none()
        if canonical is None:
            raise EngagementNotFoundError("Panda was not found")
        return str(canonical)

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

    @staticmethod
    def _normalize_release(value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            return None
        return normalized[:120]
