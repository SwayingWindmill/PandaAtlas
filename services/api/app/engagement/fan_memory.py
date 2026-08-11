from __future__ import annotations

from datetime import date
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.engagement.models import EngagementAccountUnavailableError, EngagementNotFoundError
from app.identity.models import RequestIdentity


class FanMemoryRepository:
    """Private fan memories: place check-ins and pandas personally seen."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def list_checkins(self, account_id: UUID) -> list[dict[str, Any]]:
        rows = self.session.execute(
            text(
                """
                select checkin_id, place_id, visited_on, note, created_at
                from engagement.location_checkins
                where account_id = :account_id
                order by visited_on desc, created_at desc, checkin_id
                """
            ),
            {"account_id": account_id},
        ).mappings()
        return [dict(row) for row in rows]

    def create_checkin(
        self,
        *,
        identity: RequestIdentity,
        place_id: str,
        visited_on: date,
        note: str | None,
    ) -> dict[str, Any]:
        self._require_active_account(identity.account_id)
        place_id = self._normalize_reference(place_id, "Place")
        note = self._normalize_note(note)
        row = (
            self.session.execute(
                text(
                    """
                    insert into engagement.location_checkins (
                      account_id, place_id, visited_on, note
                    ) values (:account_id, :place_id, :visited_on, :note)
                    on conflict (account_id, place_id, visited_on) do update
                    set note = excluded.note
                    returning checkin_id, place_id, visited_on, note, created_at
                    """
                ),
                {
                    "account_id": identity.account_id,
                    "place_id": place_id,
                    "visited_on": visited_on,
                    "note": note,
                },
            )
            .mappings()
            .one()
        )
        self.session.commit()
        return dict(row)

    def delete_checkin(self, *, identity: RequestIdentity, checkin_id: UUID) -> UUID:
        self._require_active_account(identity.account_id)
        deleted_id = self.session.execute(
            text(
                """
                delete from engagement.location_checkins
                where checkin_id = :checkin_id and account_id = :account_id
                returning checkin_id
                """
            ),
            {"checkin_id": checkin_id, "account_id": identity.account_id},
        ).scalar_one_or_none()
        self.session.commit()
        if deleted_id is None:
            raise EngagementNotFoundError("Check-in was not found")
        return UUID(str(deleted_id))

    def list_seen_pandas(self, account_id: UUID) -> list[dict[str, Any]]:
        rows = self.session.execute(
            text(
                """
                select seen_id, panda_id, place_id, seen_on, note, first_seen_at, updated_at
                from engagement.seen_pandas
                where account_id = :account_id
                order by seen_on desc nulls last, first_seen_at desc, panda_id
                """
            ),
            {"account_id": account_id},
        ).mappings()
        return [dict(row) for row in rows]

    def get_seen_panda(self, account_id: UUID, panda_id: str) -> dict[str, Any]:
        panda_id = self._canonical_panda_id(panda_id)
        row = (
            self.session.execute(
                text(
                    """
                    select seen_id, panda_id, place_id, seen_on, note, first_seen_at, updated_at
                    from engagement.seen_pandas
                    where account_id = :account_id and panda_id = :panda_id
                    """
                ),
                {"account_id": account_id, "panda_id": panda_id},
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise EngagementNotFoundError("Seen panda was not found")
        return dict(row)

    def save_seen_panda(
        self,
        *,
        identity: RequestIdentity,
        panda_id: str,
        seen_on: date | None,
        place_id: str | None,
        note: str | None,
    ) -> dict[str, Any]:
        self._require_active_account(identity.account_id)
        panda_id = self._canonical_panda_id(panda_id)
        place_id = self._normalize_optional_reference(place_id, "Place")
        note = self._normalize_note(note)
        row = (
            self.session.execute(
                text(
                    """
                    insert into engagement.seen_pandas (
                      account_id, panda_id, place_id, seen_on, note
                    ) values (:account_id, :panda_id, :place_id, :seen_on, :note)
                    on conflict (account_id, panda_id) do update
                    set place_id = excluded.place_id,
                        seen_on = excluded.seen_on,
                        note = excluded.note,
                        updated_at = now()
                    returning seen_id, panda_id, place_id, seen_on, note, first_seen_at, updated_at
                    """
                ),
                {
                    "account_id": identity.account_id,
                    "panda_id": panda_id,
                    "place_id": place_id,
                    "seen_on": seen_on,
                    "note": note,
                },
            )
            .mappings()
            .one()
        )
        self.session.commit()
        return dict(row)

    def delete_seen_panda(self, *, identity: RequestIdentity, panda_id: str) -> str:
        self._require_active_account(identity.account_id)
        panda_id = self._canonical_panda_id(panda_id)
        deleted = self.session.execute(
            text(
                """
                delete from engagement.seen_pandas
                where account_id = :account_id and panda_id = :panda_id
                returning panda_id
                """
            ),
            {"account_id": identity.account_id, "panda_id": panda_id},
        ).scalar_one_or_none()
        self.session.commit()
        if deleted is None:
            raise EngagementNotFoundError("Seen panda was not found")
        return str(deleted)

    def _canonical_panda_id(self, panda_id: str) -> str:
        canonical = self.session.execute(
            text(
                """
                select id::text
                from public.pandas
                where id::text = :panda_id or slug = :panda_id
                limit 1
                """
            ),
            {"panda_id": panda_id},
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
    def _normalize_reference(value: str, label: str) -> str:
        normalized = value.strip()
        if not 1 <= len(normalized) <= 255:
            raise EngagementNotFoundError(f"{label} reference is invalid")
        return normalized

    @classmethod
    def _normalize_optional_reference(cls, value: str | None, label: str) -> str | None:
        if value is None:
            return None
        return cls._normalize_reference(value, label)

    @staticmethod
    def _normalize_note(note: str | None) -> str | None:
        if note is None:
            return None
        normalized = " ".join(note.strip().split())
        if not normalized:
            return None
        return normalized[:280]
