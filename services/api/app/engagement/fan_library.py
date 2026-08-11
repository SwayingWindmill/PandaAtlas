from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.engagement.models import (
    EngagementAccountUnavailableError,
    EngagementConflictError,
    EngagementNotFoundError,
)
from app.engagement.repository import EngagementRepository
from app.identity.models import RequestIdentity


class FanLibraryRepository:
    """Fan-facing saved pandas and Collections over one engagement relationship."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def list_favorites(self, account_id: UUID) -> list[dict[str, Any]]:
        rows = self.session.execute(
            text(
                """
                select panda_id, followed_at as favorited_at
                from engagement.follows
                where account_id = :account_id and state = 'active'
                order by followed_at desc, panda_id
                """
            ),
            {"account_id": account_id},
        ).mappings()
        return [dict(row) for row in rows]

    def get_favorite(self, account_id: UUID, panda_id: str) -> dict[str, Any]:
        panda_id = self._canonical_panda_id(panda_id)
        row = (
            self.session.execute(
                text(
                    """
                    select panda_id, followed_at as favorited_at
                    from engagement.follows
                    where account_id = :account_id
                      and panda_id = :panda_id
                      and state = 'active'
                    """
                ),
                {"account_id": account_id, "panda_id": panda_id},
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise EngagementNotFoundError("Favorite was not found")
        return dict(row)

    def favorite(
        self,
        *,
        identity: RequestIdentity,
        panda_id: str,
        idempotency_key: str,
        correlation_id: UUID,
    ) -> dict[str, Any]:
        panda_id = self._canonical_panda_id(panda_id)
        row = EngagementRepository(self.session).follow(
            identity=identity,
            panda_id=panda_id,
            idempotency_key=idempotency_key,
            correlation_id=correlation_id,
        )
        return {"panda_id": str(row["panda_id"]), "favorited_at": row["followed_at"]}

    def unfavorite(
        self,
        *,
        identity: RequestIdentity,
        panda_id: str,
        idempotency_key: str,
        correlation_id: UUID,
    ) -> dict[str, Any]:
        panda_id = self._canonical_panda_id(panda_id)
        try:
            row = EngagementRepository(self.session).unfollow(
                identity=identity,
                panda_id=panda_id,
                idempotency_key=idempotency_key,
                correlation_id=correlation_id,
            )
        except EngagementNotFoundError:
            return {"panda_id": panda_id, "favorited": False, "favorited_at": None}
        self.session.execute(
            text(
                """
                delete from engagement.collection_pandas cp
                using engagement.collections c
                where cp.collection_id = c.collection_id
                  and c.account_id = :account_id
                  and cp.panda_id = :panda_id
                """
            ),
            {"account_id": identity.account_id, "panda_id": panda_id},
        )
        self.session.commit()
        return {
            "panda_id": panda_id,
            "favorited": False,
            "favorited_at": row["followed_at"],
        }

    def list_collections(self, account_id: UUID) -> list[dict[str, Any]]:
        rows = self.session.execute(
            text(
                """
                select c.collection_id, c.name, c.created_at, c.updated_at,
                       coalesce(
                         array_agg(cp.panda_id order by cp.added_at, cp.panda_id)
                           filter (where cp.panda_id is not null),
                         array[]::text[]
                       ) as panda_ids
                from engagement.collections c
                left join engagement.collection_pandas cp
                  on cp.collection_id = c.collection_id
                where c.account_id = :account_id
                group by c.collection_id
                order by c.updated_at desc, c.created_at desc, c.collection_id
                """
            ),
            {"account_id": account_id},
        ).mappings()
        return [dict(row) for row in rows]

    def create_collection(self, *, identity: RequestIdentity, name: str) -> dict[str, Any]:
        self._require_active_account(identity.account_id)
        name = self._normalize_name(name)
        try:
            row = (
                self.session.execute(
                    text(
                        """
                        insert into engagement.collections (account_id, name)
                        values (:account_id, :name)
                        returning collection_id, name, created_at, updated_at
                        """
                    ),
                    {"account_id": identity.account_id, "name": name},
                )
                .mappings()
                .one()
            )
            self.session.commit()
        except IntegrityError as error:
            self.session.rollback()
            raise EngagementConflictError("A collection with this name already exists") from error
        return {**dict(row), "panda_ids": []}

    def rename_collection(
        self,
        *,
        identity: RequestIdentity,
        collection_id: UUID,
        name: str,
    ) -> dict[str, Any]:
        self._require_active_account(identity.account_id)
        name = self._normalize_name(name)
        try:
            row = (
                self.session.execute(
                    text(
                        """
                        update engagement.collections
                        set name = :name, updated_at = now()
                        where collection_id = :collection_id and account_id = :account_id
                        returning collection_id, name, created_at, updated_at
                        """
                    ),
                    {
                        "collection_id": collection_id,
                        "account_id": identity.account_id,
                        "name": name,
                    },
                )
                .mappings()
                .one_or_none()
            )
            if row is None:
                self.session.rollback()
                raise EngagementNotFoundError("Collection was not found")
            self.session.commit()
        except IntegrityError as error:
            self.session.rollback()
            raise EngagementConflictError("A collection with this name already exists") from error
        return {**dict(row), "panda_ids": self._collection_panda_ids(collection_id)}

    def delete_collection(self, *, identity: RequestIdentity, collection_id: UUID) -> UUID:
        self._require_active_account(identity.account_id)
        deleted_id = self.session.execute(
            text(
                """
                delete from engagement.collections
                where collection_id = :collection_id and account_id = :account_id
                returning collection_id
                """
            ),
            {"collection_id": collection_id, "account_id": identity.account_id},
        ).scalar_one_or_none()
        self.session.commit()
        if deleted_id is None:
            raise EngagementNotFoundError("Collection was not found")
        return UUID(str(deleted_id))

    def add_panda(
        self,
        *,
        identity: RequestIdentity,
        collection_id: UUID,
        panda_id: str,
    ) -> dict[str, Any]:
        self._require_active_account(identity.account_id)
        self._require_owned_collection(identity.account_id, collection_id)
        panda_id = self._canonical_panda_id(panda_id)
        self.get_favorite(identity.account_id, panda_id)
        self.session.execute(
            text(
                """
                insert into engagement.collection_pandas (collection_id, panda_id)
                values (:collection_id, :panda_id)
                on conflict (collection_id, panda_id) do nothing
                """
            ),
            {"collection_id": collection_id, "panda_id": panda_id},
        )
        self._touch_collection(collection_id)
        self.session.commit()
        return self._get_collection(identity.account_id, collection_id)

    def remove_panda(
        self,
        *,
        identity: RequestIdentity,
        collection_id: UUID,
        panda_id: str,
    ) -> dict[str, Any]:
        self._require_active_account(identity.account_id)
        self._require_owned_collection(identity.account_id, collection_id)
        panda_id = self._canonical_panda_id(panda_id)
        self.session.execute(
            text(
                """
                delete from engagement.collection_pandas
                where collection_id = :collection_id and panda_id = :panda_id
                """
            ),
            {"collection_id": collection_id, "panda_id": panda_id},
        )
        self._touch_collection(collection_id)
        self.session.commit()
        return self._get_collection(identity.account_id, collection_id)

    def _get_collection(self, account_id: UUID, collection_id: UUID) -> dict[str, Any]:
        row = (
            self.session.execute(
                text(
                    """
                    select collection_id, name, created_at, updated_at
                    from engagement.collections
                    where collection_id = :collection_id and account_id = :account_id
                    """
                ),
                {"collection_id": collection_id, "account_id": account_id},
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise EngagementNotFoundError("Collection was not found")
        return {**dict(row), "panda_ids": self._collection_panda_ids(collection_id)}

    def _collection_panda_ids(self, collection_id: UUID) -> list[str]:
        return list(
            self.session.execute(
                text(
                    """
                    select panda_id
                    from engagement.collection_pandas
                    where collection_id = :collection_id
                    order by added_at, panda_id
                    """
                ),
                {"collection_id": collection_id},
            ).scalars()
        )

    def _touch_collection(self, collection_id: UUID) -> None:
        self.session.execute(
            text(
                "update engagement.collections set updated_at = now() "
                "where collection_id = :collection_id"
            ),
            {"collection_id": collection_id},
        )

    def _require_owned_collection(self, account_id: UUID, collection_id: UUID) -> None:
        exists = self.session.execute(
            text(
                """
                select 1 from engagement.collections
                where collection_id = :collection_id and account_id = :account_id
                """
            ),
            {"collection_id": collection_id, "account_id": account_id},
        ).scalar_one_or_none()
        if exists is None:
            raise EngagementNotFoundError("Collection was not found")

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
    def _normalize_name(name: str) -> str:
        normalized = " ".join(name.strip().split())
        if not 1 <= len(normalized) <= 80:
            raise EngagementConflictError("Collection name must contain 1 to 80 characters")
        return normalized
