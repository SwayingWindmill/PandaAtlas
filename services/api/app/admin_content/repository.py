from __future__ import annotations

import json
from datetime import UTC, date, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.data.golden_dataset import project_panda_details, public_trusted_panda_record
from app.identity.models import RequestIdentity
from app.schemas.admin_content import (
    AdminContentDashboardRead,
    AdminDashboardIssue,
    AdminEvidenceSourceCreate,
    AdminEvidenceSourceRead,
    AdminPandaBasicChange,
    AdminPandaChangeSetRead,
    AdminPandaCreate,
    AdminPandaDetailRead,
    AdminPandaDraftCreatedRead,
    AdminPandaEventCreate,
    AdminPandaEventRead,
    AdminPandaListItem,
    AdminPandaListRead,
    AdminPandaMediaCreate,
    AdminPandaMediaRead,
    AdminPandaNameCreate,
    AdminPandaNameRead,
    AdminPandaParentCreate,
    AdminPandaParentRead,
    AdminPandaResidencyCreate,
    AdminPandaResidencyRead,
    AdminPandaWorkflowRead,
    AdminRecentActivityRead,
)
from app.services import publication_repository

COLLECTION_BY_ENTITY = {
    "source": "sources",
    "facility": "facilities",
    "institution": "institutions",
    "place": "places",
    "panda": "pandas",
    "fact": "facts",
    "parentage_assertion": "parentage_assertions",
    "residency": "residencies",
    "event": "events",
    "media_item": "media",
}


class AdminContentRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def _active_public_record(self, panda_id: UUID) -> dict[str, Any] | None:
        return publication_repository.get_active_public_record(self.session, "panda", str(panda_id))

    def _working_revision(self, panda_id: UUID) -> dict[str, Any] | None:
        row = self.session.execute(
            text(
                """
                select
                  change_set.id as change_set_id,
                  change_set.status,
                  change_set.governance_version,
                  change_set.validation_state,
                  change_set.validation_reason,
                  revision.payload,
                  revision.created_at,
                  coalesce(actor.email, revision.substantive_modified_by::text) as last_editor
                from public.change_sets change_set
                join public.change_set_revisions link on link.change_set_id = change_set.id
                join public.entity_revisions revision on revision.id = link.revision_id
                left join identity.accounts actor
                  on actor.account_id = revision.substantive_modified_by
                where revision.entity_type = 'panda'
                  and revision.entity_id = :panda_id
                  and change_set.status in (
                    'draft', 'submitted', 'approved', 'validation_failed',
                    'ready', 'publishing', 'publish_failed'
                  )
                order by revision.revision_number desc, revision.created_at desc
                limit 1
                """
            ),
            {"panda_id": str(panda_id)},
        ).mappings().first()
        return dict(row) if row is not None else None

    def _base_record(self, panda_id: UUID) -> dict[str, Any]:
        row = self.session.execute(
            text(
                """
                select
                  id, slug, name_zh, name_en, gender,
                  birth_date, death_date, status::text as status,
                  birthplace, current_location, intro, tags, is_featured,
                  created_at, updated_at
                from public.pandas
                where id = :panda_id
                """
            ),
            {"panda_id": panda_id},
        ).mappings().first()
        if row is None:
            raise HTTPException(status_code=404, detail={"code": "admin_panda_not_found"})
        return dict(row)

    @staticmethod
    def _payload_public_record(payload: object) -> dict[str, Any]:
        if isinstance(payload, dict):
            value = payload.get("public_record")
            return dict(value) if isinstance(value, dict) else {}
        return {}

    def _merged_record(self, panda_id: UUID) -> tuple[dict[str, Any], dict[str, Any] | None, bool]:
        base = self._base_record(panda_id)
        active = self._active_public_record(panda_id)
        is_published = bool(active and not active.get("_withdrawn"))
        if is_published and active is not None:
            base.update({key: value for key, value in active.items() if not key.startswith("_")})
        working = self._working_revision(panda_id)
        if working is not None:
            base.update(self._payload_public_record(working.get("payload")))
        return base, working, is_published

    def _source_ids(self, panda_id: UUID) -> list[str]:
        return list(
            self.session.execute(
                text(
                    """
                    select distinct source_id
                    from (
                      select link.source_id
                      from public.panda_names name
                      join public.panda_name_sources link on link.panda_name_id = name.id
                      where name.panda_id = :panda_id
                      union all
                      select link.source_id
                      from public.fact_assertions assertion
                      join public.fact_assertion_sources link on link.assertion_id = assertion.id
                      where assertion.panda_id = :panda_id
                      union all
                      select link.source_id
                      from public.parentage_assertions assertion
                      join public.parentage_assertion_sources link
                        on link.assertion_id = assertion.id
                      where assertion.child_id = :panda_id
                      union all
                      select link.source_id
                      from public.panda_residencies residency
                      join public.residency_sources link on link.residency_id = residency.id
                      where residency.panda_id = :panda_id
                      union all
                      select link.source_id
                      from public.domain_event_participants participant
                      join public.domain_event_sources link on link.event_id = participant.event_id
                      where participant.panda_id = :panda_id
                    ) source_ids
                    order by source_id
                    """
                ),
                {"panda_id": panda_id},
            ).scalars()
        )

    def _has_cover(self, panda_id: UUID) -> bool:
        return bool(
            self.session.execute(
                text(
                    """
                    select exists(
                      select 1 from public.panda_media
                      where panda_id = :panda_id and is_cover = true
                    )
                    """
                ),
                {"panda_id": panda_id},
            ).scalar_one()
        )

    def _parent_count(self, panda_id: UUID) -> int:
        return int(
            self.session.execute(
                text(
                    """
                    select count(distinct parent_role)
                    from public.parentage_assertions
                    where child_id = :panda_id
                      and status in ('confirmed', 'tentative', 'disputed')
                    """
                ),
                {"panda_id": panda_id},
            ).scalar_one()
        )

    def _residency_count(self, panda_id: UUID) -> int:
        return int(
            self.session.execute(
                text("select count(*) from public.panda_residencies where panda_id = :panda_id"),
                {"panda_id": panda_id},
            ).scalar_one()
        )

    def _event_count(self, panda_id: UUID) -> int:
        return int(
            self.session.execute(
                text(
                    """
                    select count(*)
                    from public.domain_event_participants
                    where panda_id = :panda_id
                    """
                ),
                {"panda_id": panda_id},
            ).scalar_one()
        )

    def _quality(self, panda_id: UUID, source_count: int) -> str:
        uncertain = bool(
            self.session.execute(
                text(
                    """
                    select exists(
                      select 1 from public.parentage_assertions
                      where child_id = :panda_id and status in ('tentative', 'disputed')
                      union all
                      select 1 from public.fact_assertions
                      where panda_id = :panda_id and certainty = 'provisional'
                    )
                    """
                ),
                {"panda_id": panda_id},
            ).scalar_one()
        )
        if uncertain or source_count == 0:
            return "uncertain"
        if source_count < 2:
            return "likely"
        return "verified"

    def _completeness(
        self,
        record: dict[str, Any],
        *,
        parent_count: int,
        residency_count: int,
        event_count: int,
        has_cover: bool,
        source_count: int,
    ) -> int:
        checks = [
            bool(record.get("name_zh") and record.get("slug")),
            bool(record.get("birth_date")),
            parent_count >= 1,
            bool(record.get("current_location")) or residency_count >= 1,
            has_cover,
            source_count >= 1,
            event_count >= 1,
            bool(record.get("intro")),
        ]
        return round(sum(checks) / len(checks) * 100)

    def _list_item(self, panda_id: UUID) -> AdminPandaListItem:
        record, working, is_published = self._merged_record(panda_id)
        source_count = len(self._source_ids(panda_id))
        has_cover = self._has_cover(panda_id)
        parent_count = self._parent_count(panda_id)
        residency_count = self._residency_count(panda_id)
        event_count = self._event_count(panda_id)
        workflow_state = str(working["status"]) if working is not None else "none"
        updated_at = (
            working.get("created_at")
            if working is not None and working.get("created_at") is not None
            else record["updated_at"]
        )
        return AdminPandaListItem(
            id=panda_id,
            slug=str(record.get("slug") or ""),
            name_zh=str(record.get("name_zh") or ""),
            name_en=record.get("name_en"),
            gender=str(record.get("gender") or "unknown"),
            birth_date=record.get("birth_date"),
            current_location=record.get("current_location"),
            publication_state="published" if is_published else "draft",
            workflow_state=workflow_state,
            completeness=self._completeness(
                record,
                parent_count=parent_count,
                residency_count=residency_count,
                event_count=event_count,
                has_cover=has_cover,
                source_count=source_count,
            ),
            data_quality=self._quality(panda_id, source_count),
            has_cover=has_cover,
            source_count=source_count,
            updated_at=updated_at,
            last_editor=(
                str(working["last_editor"])
                if working and working.get("last_editor")
                else None
            ),
            working_change_set_id=(working.get("change_set_id") if working else None),
        )

    def list_pandas(
        self,
        *,
        query: str | None,
        publication_state: str | None,
        quality: str | None,
        issue: str | None,
        page: int,
        page_size: int,
    ) -> AdminPandaListRead:
        candidate_ids = list(
            self.session.execute(
                text(
                    """
                    select distinct panda.id
                    from public.pandas panda
                    left join public.panda_names name on name.panda_id = panda.id
                    where :query = ''
                       or panda.name_zh ilike :like_query
                       or coalesce(panda.name_en, '') ilike :like_query
                       or panda.slug ilike :like_query
                       or coalesce(name.value, '') ilike :like_query
                    order by panda.id
                    """
                ),
                {
                    "query": (query or "").strip(),
                    "like_query": f"%{(query or '').strip()}%",
                },
            ).scalars()
        )
        items = [self._list_item(UUID(str(item))) for item in candidate_ids]
        if publication_state:
            items = [item for item in items if item.publication_state == publication_state]
        if quality:
            items = [item for item in items if item.data_quality == quality]
        if issue == "incomplete":
            items = [item for item in items if item.completeness < 100]
        elif issue == "no-cover":
            items = [item for item in items if not item.has_cover]
        elif issue == "no-source":
            items = [item for item in items if item.source_count == 0]
        elif issue == "no-location":
            items = [item for item in items if not item.current_location]
        items.sort(key=lambda item: item.updated_at, reverse=True)
        total = len(items)
        start = (page - 1) * page_size
        return AdminPandaListRead(
            items=items[start : start + page_size],
            total=total,
            page=page,
            page_size=page_size,
        )

    def current_archive_version(self) -> str:
        value = self.session.execute(
            text(
                """
                select release.data_version
                from public.archive_release_pointer pointer
                left join public.publication_batches release
                  on release.id = pointer.latest_release_id
                where pointer.singleton = true
                """
            )
        ).scalar_one_or_none()
        return str(value) if value else "unpublished"

    def _names(self, panda_id: UUID) -> list[AdminPandaNameRead]:
        rows = self.session.execute(
            text(
                """
                select name.id, name.value, name.language_tag, name.name_kind,
                       name.is_primary, name.publication_status,
                       coalesce(array_agg(link.source_id order by link.source_id)
                         filter (where link.source_id is not null), '{}') as source_ids
                from public.panda_names name
                left join public.panda_name_sources link on link.panda_name_id = name.id
                where name.panda_id = :panda_id
                group by name.id
                order by name.is_primary desc, name.language_tag, name.name_kind, name.value
                """
            ),
            {"panda_id": panda_id},
        ).mappings()
        return [
            AdminPandaNameRead.model_validate({**dict(row), "id": str(row["id"])})
            for row in rows
        ]

    def _parents(self, panda_id: UUID) -> list[AdminPandaParentRead]:
        rows = self.session.execute(
            text(
                """
                select assertion.id as assertion_id, assertion.parent_role as role,
                       assertion.status, parent.id as parent_id, parent.slug as parent_slug,
                       parent.name_zh as parent_name_zh, parent.name_en as parent_name_en,
                       parent.birth_date as parent_birth_date,
                       coalesce(array_agg(link.source_id order by link.source_id)
                         filter (where link.source_id is not null), '{}') as source_ids
                from public.parentage_assertions assertion
                join public.pandas parent on parent.id = assertion.parent_id
                left join public.parentage_assertion_sources link
                  on link.assertion_id = assertion.id
                where assertion.child_id = :panda_id and assertion.status <> 'superseded'
                group by assertion.id, parent.id
                order by assertion.parent_role, assertion.id
                """
            ),
            {"panda_id": panda_id},
        ).mappings()
        return [AdminPandaParentRead.model_validate(dict(row)) for row in rows]

    def _residencies(self, panda_id: UUID) -> list[AdminPandaResidencyRead]:
        rows = self.session.execute(
            text(
                """
                select residency.id, residency.residency_type, residency.start_date,
                       residency.start_precision, residency.end_date, residency.end_precision,
                       residency.status, residency.publication_status, residency.facility_id,
                       coalesce(facility.name_zh, facility.name_en) as facility_name,
                       residency.coarse_location,
                       coalesce(array_agg(link.source_id order by link.source_id)
                         filter (where link.source_id is not null), '{}') as source_ids
                from public.panda_residencies residency
                left join public.facilities facility on facility.id = residency.facility_id
                left join public.residency_sources link on link.residency_id = residency.id
                where residency.panda_id = :panda_id
                group by residency.id, facility.id
                order by residency.start_date desc, residency.id
                """
            ),
            {"panda_id": panda_id},
        ).mappings()
        return [AdminPandaResidencyRead.model_validate(dict(row)) for row in rows]

    def _events(self, panda_id: UUID) -> list[AdminPandaEventRead]:
        rows = self.session.execute(
            text(
                """
                select event.id, event.event_type, event.event_status, event.event_date,
                       event.event_date_precision, event.publication_status,
                       coalesce(array_agg(source.source_id order by source.source_id)
                         filter (where source.source_id is not null), '{}') as source_ids
                from public.domain_event_participants participant
                join public.domain_events event on event.id = participant.event_id
                left join public.domain_event_sources source on source.event_id = event.id
                where participant.panda_id = :panda_id
                group by event.id
                order by event.event_date desc, event.id
                """
            ),
            {"panda_id": panda_id},
        ).mappings()
        return [AdminPandaEventRead.model_validate(dict(row)) for row in rows]

    def _media(self, panda_id: UUID) -> list[AdminPandaMediaRead]:
        rows = self.session.execute(
            text(
                """
                select media.id, media.title, media.photographer, media.copyright_text,
                       media.license, media.taken_at, media.storage_bucket, media.storage_path,
                       link.is_cover, link.display_order
                from public.panda_media link
                join public.media_assets media on media.id = link.media_id
                where link.panda_id = :panda_id
                order by link.is_cover desc, link.display_order, media.created_at
                """
            ),
            {"panda_id": panda_id},
        ).mappings()
        return [
            AdminPandaMediaRead.model_validate({**dict(row), "id": str(row["id"])})
            for row in rows
        ]

    def _sources(self, panda_id: UUID) -> list[AdminEvidenceSourceRead]:
        source_ids = self._source_ids(panda_id)
        if not source_ids:
            return []
        rows = self.session.execute(
            text(
                """
                select id, publisher, title, url, published_at, last_verified_at,
                       access_state, publication_status, evidence_tier
                from public.evidence_sources
                where id = any(:source_ids)
                order by publisher, title, id
                """
            ),
            {"source_ids": source_ids},
        ).mappings()
        return [AdminEvidenceSourceRead.model_validate(dict(row)) for row in rows]

    def _canonical_detail_views(
        self,
        panda_id: UUID,
        working_change_set_id: UUID | None,
    ) -> tuple[
        list[AdminPandaNameRead],
        list[AdminPandaParentRead],
        list[AdminPandaResidencyRead],
        list[AdminPandaEventRead],
        list[AdminPandaMediaRead],
        list[AdminEvidenceSourceRead],
    ] | None:
        records = self._effective_records(working_change_set_id)
        panda_public = records.get(("panda", str(panda_id)))
        if panda_public is None:
            return None
        pending = self._change_set_records(working_change_set_id) if working_change_set_id else {}

        names: list[AdminPandaNameRead] = []
        for index, item in enumerate(
            [
                *[value for value in panda_public.get("names", []) if isinstance(value, dict)],
                *[value for value in panda_public.get("aliases", []) if isinstance(value, dict)],
            ]
        ):
            names.append(
                AdminPandaNameRead(
                    id=f"archive-name-{index}",
                    value=str(item.get("value") or ""),
                    language_tag=str(item.get("language") or "und"),
                    name_kind=str(item.get("kind") or "alias"),
                    is_primary=bool(item.get("primary")),
                    publication_status=(
                        "draft" if ("panda", str(panda_id)) in pending else "published"
                    ),
                    source_ids=[str(value) for value in item.get("source_ids", [])],
                )
            )

        parents: list[AdminPandaParentRead] = []
        for (entity_type, entity_id), item in records.items():
            if entity_type != "parentage_assertion":
                continue
            if str(item.get("child_id")) != str(panda_id):
                continue
            if str(item.get("status")) == "superseded":
                continue
            parent_id = UUID(str(item["parent_id"]))
            parent_public = records.get(("panda", str(parent_id))) or {}
            parent_base = self._base_record(parent_id)
            parent_names = [
                value for value in parent_public.get("names", []) if isinstance(value, dict)
            ]
            parent_name_zh = next(
                (
                    str(value.get("value"))
                    for value in parent_names
                    if value.get("language") == "zh-Hans" and value.get("primary")
                ),
                str(parent_base["name_zh"]),
            )
            parent_name_en = next(
                (
                    str(value.get("value"))
                    for value in parent_names
                    if value.get("language") == "en" and value.get("primary")
                ),
                parent_base.get("name_en"),
            )
            parents.append(
                AdminPandaParentRead(
                    assertion_id=entity_id,
                    role=str(item.get("role") or "father"),
                    status=str(item.get("status") or "tentative"),
                    parent_id=parent_id,
                    parent_slug=str(
                        parent_public.get("canonical_slug") or parent_base["slug"]
                    ),
                    parent_name_zh=parent_name_zh,
                    parent_name_en=parent_name_en,
                    parent_birth_date=parent_base.get("birth_date"),
                    source_ids=[str(value) for value in item.get("source_ids", [])],
                )
            )
        parents.sort(key=lambda item: item.role)

        residencies: list[AdminPandaResidencyRead] = []
        for (entity_type, entity_id), item in records.items():
            if entity_type != "residency" or str(item.get("panda_id")) != str(panda_id):
                continue
            facility_id_value = item.get("facility_id")
            facility_id = UUID(str(facility_id_value)) if facility_id_value else None
            facility_name: str | None = None
            if facility_id:
                facility_public = records.get(("facility", str(facility_id))) or {}
                facility_name = str(
                    facility_public.get("name_zh")
                    or facility_public.get("name_en")
                    or facility_public.get("name")
                    or ""
                ) or None
            residencies.append(
                AdminPandaResidencyRead(
                    id=entity_id,
                    residency_type=str(item.get("residency_type") or "primary"),
                    start_date=date.fromisoformat(str(item["start_date"])),
                    start_precision=str(item.get("start_precision") or "day"),
                    end_date=(
                        date.fromisoformat(str(item["end_date"]))
                        if item.get("end_date")
                        else None
                    ),
                    end_precision=(
                        str(item.get("end_precision")) if item.get("end_precision") else None
                    ),
                    status=str(item.get("status") or "provisional"),
                    publication_status=(
                        "draft" if ("residency", entity_id) in pending else "published"
                    ),
                    facility_id=facility_id,
                    facility_name=facility_name,
                    coarse_location=(
                        str(item.get("coarse_location")) if item.get("coarse_location") else None
                    ),
                    source_ids=[str(value) for value in item.get("source_ids", [])],
                )
            )
        residencies.sort(key=lambda item: item.start_date, reverse=True)

        events: list[AdminPandaEventRead] = []
        for (entity_type, entity_id), item in records.items():
            if entity_type != "event":
                continue
            participants = {str(value) for value in item.get("participants", [])}
            if str(panda_id) not in participants:
                continue
            events.append(
                AdminPandaEventRead(
                    id=entity_id,
                    event_type=str(item.get("event_type") or "observation"),
                    event_status=str(item.get("event_status") or "completed"),
                    event_date=date.fromisoformat(str(item["event_date"])),
                    event_date_precision=str(item.get("event_date_precision") or "day"),
                    publication_status=(
                        "draft" if ("event", entity_id) in pending else "published"
                    ),
                    source_ids=[str(value) for value in item.get("source_ids", [])],
                )
            )
        events.sort(key=lambda item: item.event_date, reverse=True)

        media: list[AdminPandaMediaRead] = []
        for (entity_type, entity_id), item in records.items():
            if entity_type != "media_item" or str(item.get("panda_id")) != str(panda_id):
                continue
            media.append(
                AdminPandaMediaRead(
                    id=entity_id,
                    title=None,
                    photographer=None,
                    copyright_text=str(item.get("credit") or "") or None,
                    license=str(item.get("rights") or "") or None,
                    url=str(item.get("url") or "") or None,
                    source_url=str(item.get("source_url") or "") or None,
                    credit=str(item.get("credit") or "") or None,
                    alt_zh=str(item.get("alt_zh") or "") or None,
                    alt_en=str(item.get("alt_en") or "") or None,
                    source_ids=[str(value) for value in item.get("source_ids", [])],
                    is_cover=bool(item.get("is_cover")),
                    display_order=0,
                )
            )
        media.sort(key=lambda item: (not item.is_cover, item.id))

        source_ids: set[str] = set()
        for name in names:
            source_ids.update(name.source_ids)
        for parent in parents:
            source_ids.update(parent.source_ids)
        for residency in residencies:
            source_ids.update(residency.source_ids)
        for event in events:
            source_ids.update(event.source_ids)
        for item in media:
            source_ids.update(item.source_ids)
        for (entity_type, _entity_id), item in records.items():
            if entity_type == "fact" and str(item.get("subject_id")) == str(panda_id):
                source_ids.update(str(value) for value in item.get("source_ids", []))

        sources: list[AdminEvidenceSourceRead] = []
        for source_id in sorted(source_ids):
            item = records.get(("source", source_id))
            if item is None:
                continue
            sources.append(
                AdminEvidenceSourceRead(
                    id=source_id,
                    publisher=str(item.get("publisher") or ""),
                    title=str(item.get("title") or ""),
                    url=str(item.get("url") or ""),
                    published_at=(
                        date.fromisoformat(str(item["published_at"]))
                        if item.get("published_at")
                        else None
                    ),
                    last_verified_at=date.fromisoformat(str(item["last_verified_at"])),
                    access_state=str(item.get("access_state") or "unavailable"),
                    publication_status=(
                        "draft" if ("source", source_id) in pending else "published"
                    ),
                    evidence_tier=(
                        str(item.get("evidence_tier")) if item.get("evidence_tier") else None
                    ),
                )
            )
        return names, parents, residencies, events, media, sources

    def _quality_issues(
        self,
        record: dict[str, Any],
        *,
        parent_count: int,
        residencies: list[AdminPandaResidencyRead],
        media: list[AdminPandaMediaRead],
        sources: list[AdminEvidenceSourceRead],
    ) -> list[str]:
        issues: list[str] = []
        if not any(item.is_cover for item in media):
            issues.append("missing_cover")
        if not sources:
            issues.append("missing_source")
        if not record.get("current_location") and not residencies:
            issues.append("missing_current_location")
        if parent_count == 0:
            issues.append("missing_parentage")
        if not record.get("birth_date"):
            issues.append("missing_birth_date")
        if any(item.license is None for item in media):
            issues.append("unknown_media_license")
        primary_open = [
            item
            for item in residencies
            if item.residency_type == "primary" and item.end_date is None
        ]
        if len(primary_open) > 1:
            issues.append("multiple_current_residencies")
        return issues

    def get_panda(self, panda_id: UUID, identity: RequestIdentity) -> AdminPandaDetailRead:
        record, working, _is_published = self._merged_record(panda_id)
        panda = self._list_item(panda_id)
        working_change_set_id = (
            UUID(str(working["change_set_id"]))
            if working and working.get("change_set_id")
            else None
        )
        canonical_views = self._canonical_detail_views(panda_id, working_change_set_id)
        if canonical_views is None:
            names = self._names(panda_id)
            parents = self._parents(panda_id)
            residencies = self._residencies(panda_id)
            events = self._events(panda_id)
            media = self._media(panda_id)
            sources = self._sources(panda_id)
        else:
            names, parents, residencies, events, media, sources = canonical_views
        workflow = AdminPandaWorkflowRead(
            change_set_id=(working.get("change_set_id") if working else None),
            status=(str(working["status"]) if working else "none"),
            governance_version=(int(working["governance_version"]) if working else None),
            validation_state=(str(working["validation_state"]) if working else None),
            validation_reason=(
                str(working["validation_reason"])
                if working and working.get("validation_reason") is not None
                else None
            ),
            base_archive_version=self.current_archive_version(),
            can_validate=identity.has_capability("archive.accountable.validate"),
            can_publish=(
                identity.has_capability("archive.accountable.publish")
                and identity.recent_auth
            ),
        )
        return AdminPandaDetailRead(
            panda=panda,
            status=str(record.get("status") or "unknown"),
            death_date=record.get("death_date"),
            birthplace=record.get("birthplace"),
            intro=record.get("intro"),
            tags=list(record.get("tags") or []),
            is_featured=bool(record.get("is_featured")),
            names=names,
            parents=parents,
            residencies=residencies,
            events=events,
            media=media,
            sources=sources,
            workflow=workflow,
            quality_issues=self._quality_issues(
                record,
                parent_count=len(parents),
                residencies=residencies,
                media=media,
                sources=sources,
            ),
        )

    def create_panda_draft(
        self,
        payload: AdminPandaCreate,
        identity: RequestIdentity,
    ) -> AdminPandaDraftCreatedRead:
        try:
            panda_id = self.session.execute(
                text(
                    """
                    insert into public.pandas (slug, name_zh, gender, birth_date, status)
                    values (:slug, :name_zh, :gender, :birth_date, 'unknown')
                    returning id
                    """
                ),
                payload.model_dump(mode="python"),
            ).scalar_one()
            self.session.execute(
                text(
                    """
                    insert into public.panda_names (
                      panda_id, language_tag, name_kind, value, normalized_value,
                      is_primary, publication_status
                    ) values (
                      :panda_id, 'zh-CN', 'official', :name_zh, lower(trim(:name_zh)),
                      true, 'draft'
                    )
                    """
                ),
                {"panda_id": panda_id, "name_zh": payload.name_zh},
            )
            self.session.execute(
                text(
                    """
                    insert into public.panda_slugs (
                      panda_id, slug, slug_kind, publication_status
                    ) values (:panda_id, :slug, 'canonical', 'draft')
                    """
                ),
                {"panda_id": panda_id, "slug": payload.slug},
            )
            self.session.execute(
                text(
                    """
                    insert into public.audit_events (
                      event_type, subject_type, subject_id, actor_id, reason, metadata
                    ) values (
                      'admin.panda_draft.created', 'panda', :panda_id, :actor_id,
                      'Created Panda draft identity', cast(:metadata as jsonb)
                    )
                    """
                ),
                {
                    "panda_id": panda_id,
                    "actor_id": identity.account_id,
                    "metadata": '{"publication_state":"draft"}',
                },
            )
            self.session.commit()
        except IntegrityError as error:
            self.session.rollback()
            raise HTTPException(
                status_code=409,
                detail={"code": "admin_panda_identity_conflict", "message": "Slug already exists"},
            ) from error
        return AdminPandaDraftCreatedRead(id=panda_id, slug=payload.slug, name_zh=payload.name_zh)

    def _head_release_records(self) -> dict[tuple[str, str], dict[str, Any]]:
        rows = self.session.execute(
            text(
                """
                with head as (
                  select latest_release_id as release_id
                  from public.archive_release_pointer
                  where singleton = true
                ), ranked as (
                  select revision.entity_type, revision.entity_id, revision.payload,
                         row_number() over (
                           partition by revision.entity_type, revision.entity_id
                           order by revision.revision_number desc, revision.created_at desc
                         ) as position
                  from head
                  join public.publication_batch_change_sets batch_link
                    on batch_link.batch_id = head.release_id
                  join public.change_set_revisions change_link
                    on change_link.change_set_id = batch_link.change_set_id
                  join public.entity_revisions revision on revision.id = change_link.revision_id
                )
                select entity_type, entity_id, payload
                from ranked
                where position = 1
                """
            )
        ).mappings()
        return {
            (str(row["entity_type"]), str(row["entity_id"])): self._payload_public_record(
                row["payload"]
            )
            for row in rows
        }

    def _change_set_records(self, change_set_id: UUID) -> dict[tuple[str, str], dict[str, Any]]:
        rows = self.session.execute(
            text(
                """
                with ranked as (
                  select revision.entity_type, revision.entity_id, revision.payload,
                         row_number() over (
                           partition by revision.entity_type, revision.entity_id
                           order by revision.revision_number desc, revision.created_at desc
                         ) as position
                  from public.change_set_revisions change_link
                  join public.entity_revisions revision on revision.id = change_link.revision_id
                  where change_link.change_set_id = :change_set_id
                )
                select entity_type, entity_id, payload
                from ranked
                where position = 1
                """
            ),
            {"change_set_id": change_set_id},
        ).mappings()
        return {
            (str(row["entity_type"]), str(row["entity_id"])): self._payload_public_record(
                row["payload"]
            )
            for row in rows
        }

    def _effective_records(
        self,
        change_set_id: UUID | None,
    ) -> dict[tuple[str, str], dict[str, Any]]:
        records = self._head_release_records()
        if change_set_id is not None:
            records.update(self._change_set_records(change_set_id))
        return records

    def _effective_admin_records(self) -> dict[tuple[str, str], dict[str, Any]]:
        records = self._head_release_records()
        rows = self.session.execute(
            text(
                """
                with ranked as (
                  select revision.entity_type, revision.entity_id, revision.payload,
                         row_number() over (
                           partition by revision.entity_type, revision.entity_id
                           order by revision.created_at desc, revision.revision_number desc
                         ) as position
                  from public.change_sets change_set
                  join public.change_set_revisions link on link.change_set_id = change_set.id
                  join public.entity_revisions revision on revision.id = link.revision_id
                  where change_set.status in (
                    'draft', 'submitted', 'approved', 'validation_failed',
                    'ready', 'publishing', 'publish_failed'
                  )
                )
                select entity_type, entity_id, payload
                from ranked
                where position = 1
                """
            )
        ).mappings()
        records.update(
            {
                (str(row["entity_type"]), str(row["entity_id"])): self._payload_public_record(
                    row["payload"]
                )
                for row in rows
            }
        )
        return records

    @staticmethod
    def _center_panda_name(record: dict[str, Any] | None, fallback: str) -> str:
        if record is None:
            return fallback
        names = [item for item in record.get("names", []) if isinstance(item, dict)]
        for language in ("zh-Hans", "en"):
            for item in names:
                if item.get("language") == language and item.get("primary") and item.get("value"):
                    return str(item["value"])
        return str(
            record.get("name_zh")
            or record.get("name_en")
            or record.get("canonical_slug")
            or fallback
        )

    @staticmethod
    def planned_data_version(change_set_id: UUID) -> str:
        return f"admin-{change_set_id}"

    @staticmethod
    def _canonical_language(language_tag: str) -> str:
        normalized = language_tag.strip().lower()
        if normalized in {"zh", "zh-cn", "zh-hans"}:
            return "zh-Hans"
        if normalized in {"en", "en-us", "en-gb"}:
            return "en"
        return language_tag.strip()

    def _canonical_panda_record(
        self,
        panda_id: UUID,
        payload: AdminPandaBasicChange | None = None,
    ) -> dict[str, Any]:
        active = self._active_public_record(panda_id) or {}
        if active.get("_withdrawn"):
            active = {}
        base = self._base_record(panda_id)
        record = {key: value for key, value in active.items() if not key.startswith("_")}
        slug = payload.slug if payload else str(record.get("canonical_slug") or base["slug"])
        name_zh = payload.name_zh if payload else str(base["name_zh"])
        name_en = payload.name_en if payload else base.get("name_en")
        gender = payload.gender if payload else str(base.get("gender") or "unknown")
        life_status = payload.status if payload else str(base.get("status") or "unknown")
        intro = payload.intro if payload else base.get("intro")

        names = [dict(item) for item in record.get("names", []) if isinstance(item, dict)]
        zh_found = False
        en_found = False
        for item in names:
            language = str(item.get("language"))
            if language == "zh-Hans" and item.get("primary"):
                item["value"] = name_zh
                item["kind"] = "official"
                zh_found = True
            if language == "en" and item.get("primary") and name_en:
                item["value"] = name_en
                item["kind"] = "official_romanization"
                en_found = True
        if not zh_found:
            names.append(
                {
                    "language": "zh-Hans",
                    "value": name_zh,
                    "kind": "official",
                    "primary": True,
                    "source_ids": [],
                }
            )
        if name_en and not en_found:
            names.append(
                {
                    "language": "en",
                    "value": name_en,
                    "kind": "official_romanization",
                    "primary": True,
                    "source_ids": [],
                }
            )

        content = [dict(item) for item in record.get("content", []) if isinstance(item, dict)]
        if intro:
            replaced = False
            for item in content:
                if item.get("locale") == "zh-CN":
                    item.update(
                        {
                            "translation_status": "approved",
                            "summary": intro,
                        }
                    )
                    replaced = True
            if not replaced:
                content.append(
                    {
                        "locale": "zh-CN",
                        "translation_status": "approved",
                        "summary": intro,
                    }
                )

        record.update(
            {
                "canonical_slug": slug,
                "legacy_slugs": list(record.get("legacy_slugs", [])),
                "record_tier": str(record.get("record_tier") or "identity_first_pass"),
                "names": names,
                "aliases": list(record.get("aliases", [])),
                "external_identifiers": list(record.get("external_identifiers", [])),
                "content": content,
                "revision_summaries": list(record.get("revision_summaries", [])),
                "sex": gender if gender in {"male", "female"} else "unknown",
                "life_status": (
                    life_status if life_status in {"alive", "deceased"} else "unknown"
                ),
            }
        )
        return record

    def _create_admin_change_set(
        self,
        panda_id: UUID,
        *,
        identity: RequestIdentity,
        reason: str,
    ) -> UUID:
        change_set_id = uuid4()
        self.session.execute(
            text(
                """
                insert into public.change_sets (
                  id, title, reason, status, created_by, governance_mode,
                  validation_state, base_archive_version, governance_version,
                  risk_level, origin_context, origin_actor_id
                ) values (
                  :id, :title, :reason, 'draft', :actor_id,
                  'single-accountable-approver-v1', 'not_validated', :base_archive_version,
                  1, 'ordinary', 'archive', :actor_id
                )
                """
            ),
            {
                "id": change_set_id,
                "title": f"Admin Panda {panda_id}",
                "reason": reason,
                "actor_id": identity.account_id,
                "base_archive_version": self.current_archive_version(),
            },
        )
        return change_set_id

    def _append_revision(
        self,
        change_set_id: UUID,
        *,
        entity_type: str,
        entity_id: str,
        public_record: dict[str, Any],
        checks: dict[str, Any],
        identity: RequestIdentity,
    ) -> UUID:
        state = self.session.execute(
            text("select status from public.change_sets where id = :id for update"),
            {"id": change_set_id},
        ).scalar_one_or_none()
        if state != "draft":
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "admin_change_set_not_editable",
                    "state": state,
                },
            )
        revision_number = int(
            self.session.execute(
                text(
                    """
                    select coalesce(max(revision_number), 0) + 1
                    from public.entity_revisions
                    where entity_type = :entity_type and entity_id = :entity_id
                    """
                ),
                {"entity_type": entity_type, "entity_id": entity_id},
            ).scalar_one()
        )
        revision_id = uuid4()
        payload = {
            "public_record": public_record,
            "publication_checks": checks,
            "activities": [],
        }
        self.session.execute(
            text(
                """
                insert into public.entity_revisions (
                  id, entity_type, entity_id, revision_number, payload,
                  created_by, substantive_modified_by
                ) values (
                  :id, :entity_type, :entity_id, :revision_number,
                  cast(:payload as jsonb), :actor_id, :actor_id
                )
                """
            ),
            {
                "id": revision_id,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "revision_number": revision_number,
                "payload": json.dumps(payload, ensure_ascii=False),
                "actor_id": identity.account_id,
            },
        )
        self.session.execute(
            text(
                """
                insert into public.change_set_revisions (change_set_id, revision_id)
                values (:change_set_id, :revision_id)
                """
            ),
            {"change_set_id": change_set_id, "revision_id": revision_id},
        )
        return revision_id

    def _ensure_working_change_set(
        self,
        panda_id: UUID,
        *,
        identity: RequestIdentity,
        reason: str,
    ) -> UUID:
        working = self._working_revision(panda_id)
        if working is not None:
            if str(working["status"]) != "draft":
                raise HTTPException(
                    status_code=409,
                    detail={
                        "code": "admin_panda_change_set_locked",
                        "state": str(working["status"]),
                    },
                )
            return UUID(str(working["change_set_id"]))
        change_set_id = self._create_admin_change_set(
            panda_id,
            identity=identity,
            reason=reason,
        )
        self._append_revision(
            change_set_id,
            entity_type="panda",
            entity_id=str(panda_id),
            public_record=self._canonical_panda_record(panda_id),
            checks={
                "references": [],
                "residencies": [],
                "translations": [],
                "sources": [],
                "media": [],
            },
            identity=identity,
        )
        return change_set_id

    def _effective_dataset(self, change_set_id: UUID) -> dict[str, Any]:
        records = self._effective_records(change_set_id)
        dataset: dict[str, Any] = {
            "dataset": {
                "version": self.planned_data_version(change_set_id),
                "public_schema_version": "1.3.0",
            },
            **{collection: [] for collection in COLLECTION_BY_ENTITY.values()},
        }
        for (entity_type, entity_id), public_record in records.items():
            collection = COLLECTION_BY_ENTITY.get(entity_type)
            if collection is None:
                continue
            dataset[collection].append(
                {
                    "id": entity_id,
                    "publication_status": "published",
                    "public": public_record,
                }
            )
        return dataset

    def refresh_runtime_panda_revisions(
        self,
        change_set_id: UUID,
        identity: RequestIdentity,
    ) -> int:
        records = self._effective_records(change_set_id)
        pending = self._change_set_records(change_set_id)
        changed_panda_ids = {
            entity_id
            for (entity_type, entity_id) in pending
            if entity_type == "panda"
        }
        dataset = self._effective_dataset(change_set_id)
        projected = {
            str(item["id"]): public_trusted_panda_record(item)
            for item in project_panda_details(dataset, effective_date=date.today())
        }
        archive_panda_ids = {
            entity_id
            for (entity_type, entity_id), public_record in records.items()
            if entity_type == "panda"
            and public_record.get("record_tier") != "dependency_stub"
        }
        if not archive_panda_ids:
            raise HTTPException(
                status_code=422,
                detail={"code": "admin_panda_runtime_projection_failed"},
            )
        data_version = self.planned_data_version(change_set_id)
        for panda_id in sorted(archive_panda_ids):
            if panda_id in changed_panda_ids or ("api_pandas", panda_id) not in records:
                runtime = projected.get(panda_id)
                if runtime is None:
                    raise HTTPException(
                        status_code=422,
                        detail={
                            "code": "admin_panda_runtime_projection_failed",
                            "panda_id": panda_id,
                        },
                    )
            else:
                runtime = dict(records[("api_pandas", panda_id)])
                revision = dict(runtime.get("public_revision") or {})
                revision["data_version"] = data_version
                revision["public_schema_version"] = "1.3.0"
                runtime["public_revision"] = revision
            self._append_revision(
                change_set_id,
                entity_type="api_pandas",
                entity_id=panda_id,
                public_record=runtime,
                checks={
                    "references": [],
                    "residencies": [],
                    "translations": [],
                    "sources": [],
                    "media": [],
                },
                identity=identity,
            )
        self.session.commit()
        return len(archive_panda_ids)

    def _available_source_ids(self, change_set_id: UUID) -> set[str]:
        records = self._effective_records(change_set_id)
        return {
            entity_id
            for (entity_type, entity_id), public_record in records.items()
            if entity_type == "source"
            and str(public_record.get("access_state"))
            in {"accessible", "redirected", "archived"}
        }

    def _require_sources(self, change_set_id: UUID, source_ids: list[str]) -> list[str]:
        normalized = sorted({item.strip() for item in source_ids if item.strip()})
        available = self._available_source_ids(change_set_id)
        missing = sorted(set(normalized) - available)
        if missing:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "admin_source_not_available",
                    "source_ids": missing,
                },
            )
        return normalized

    def _upsert_fact_revision(
        self,
        change_set_id: UUID,
        *,
        panda_id: UUID,
        field: str,
        value: object,
        identity: RequestIdentity,
    ) -> None:
        if value is None or value == "":
            return
        records = self._effective_records(change_set_id)
        existing_id = next(
            (
                entity_id
                for (entity_type, entity_id), record in records.items()
                if entity_type == "fact"
                and str(record.get("subject_id")) == str(panda_id)
                and str(record.get("field")) == field
            ),
            None,
        )
        fact_id = existing_id or f"fact-admin-{panda_id}-{field}"
        existing = records.get(("fact", fact_id), {})
        source_ids = list(existing.get("source_ids", []))
        public_record = {
            "subject_id": str(panda_id),
            "field": field,
            "value": value,
            "conclusion_status": "confirmed",
            "source_ids": source_ids,
            "last_verified_at": date.today().isoformat(),
            "freshness": existing.get(
                "freshness",
                {"policy": "admin_verified", "max_age_days": None, "state": "current"},
            ),
        }
        self._append_revision(
            change_set_id,
            entity_type="fact",
            entity_id=fact_id,
            public_record=public_record,
            checks={
                "references": [
                    {"target_type": "panda", "target_id": str(panda_id), "resolved": False}
                ],
                "residencies": [],
                "translations": [],
                "sources": [
                    {"id": source_id, "access_state": "pending"} for source_id in source_ids
                ],
                "media": [],
            },
            identity=identity,
        )

    def create_basic_change_set(
        self,
        panda_id: UUID,
        payload: AdminPandaBasicChange,
        identity: RequestIdentity,
    ) -> AdminPandaChangeSetRead:
        self._base_record(panda_id)
        change_set_id = self._ensure_working_change_set(
            panda_id,
            identity=identity,
            reason=payload.reason,
        )
        self._append_revision(
            change_set_id,
            entity_type="panda",
            entity_id=str(panda_id),
            public_record=self._canonical_panda_record(panda_id, payload),
            checks={
                "references": [],
                "residencies": [],
                "translations": [],
                "sources": [],
                "media": [],
            },
            identity=identity,
        )
        self._upsert_fact_revision(
            change_set_id,
            panda_id=panda_id,
            field="birth_date",
            value=payload.birth_date.isoformat() if payload.birth_date else None,
            identity=identity,
        )
        self._upsert_fact_revision(
            change_set_id,
            panda_id=panda_id,
            field="sex",
            value=payload.gender if payload.gender in {"male", "female"} else None,
            identity=identity,
        )
        self._upsert_fact_revision(
            change_set_id,
            panda_id=panda_id,
            field="birthplace",
            value=payload.birthplace,
            identity=identity,
        )
        self.session.commit()
        version, state = self.change_set_state(change_set_id)
        return AdminPandaChangeSetRead(
            change_set_id=change_set_id,
            status=state,
            governance_version=version,
        )

    def add_name(
        self,
        panda_id: UUID,
        payload: AdminPandaNameCreate,
        identity: RequestIdentity,
    ) -> AdminPandaChangeSetRead:
        change_set_id = self._ensure_working_change_set(
            panda_id,
            identity=identity,
            reason=payload.reason,
        )
        source_ids = (
            self._require_sources(change_set_id, payload.source_ids)
            if payload.source_ids
            else []
        )
        records = self._effective_records(change_set_id)
        panda_public = dict(records[("panda", str(panda_id))])
        target_key = "aliases" if payload.name_kind in {
            "alias", "historic_spelling", "historical_name", "nickname"
        } else "names"
        values = [dict(item) for item in panda_public.get(target_key, []) if isinstance(item, dict)]
        language = self._canonical_language(payload.language_tag)
        normalized = payload.value.strip().casefold()
        if any(
            str(item.get("value", "")).strip().casefold() == normalized
            and str(item.get("language")) == language
            and str(item.get("kind")) == payload.name_kind
            for item in values
        ):
            raise HTTPException(status_code=409, detail={"code": "admin_panda_name_duplicate"})
        if payload.is_primary:
            for item in values:
                if str(item.get("language")) == language:
                    item["primary"] = False
        values.append(
            {
                "value": payload.value.strip(),
                "language": language,
                "kind": payload.name_kind,
                "primary": payload.is_primary,
                "source_ids": source_ids,
            }
        )
        panda_public[target_key] = values
        self._append_revision(
            change_set_id,
            entity_type="panda",
            entity_id=str(panda_id),
            public_record=panda_public,
            checks={
                "references": [],
                "residencies": [],
                "translations": [],
                "sources": [
                    {"id": source_id, "access_state": "pending"} for source_id in source_ids
                ],
                "media": [],
            },
            identity=identity,
        )
        self.session.commit()
        version, state = self.change_set_state(change_set_id)
        return AdminPandaChangeSetRead(
            change_set_id=change_set_id,
            status=state,
            governance_version=version,
        )

    def _parentage_edges(self, change_set_id: UUID) -> set[tuple[UUID, UUID]]:
        records = self._effective_records(change_set_id)
        return {
            (UUID(str(record["parent_id"])), UUID(str(record["child_id"])))
            for (entity_type, _entity_id), record in records.items()
            if entity_type == "parentage_assertion"
            and record.get("status") == "confirmed"
            and record.get("source_ids")
        }

    def add_parent(
        self,
        panda_id: UUID,
        payload: AdminPandaParentCreate,
        identity: RequestIdentity,
    ) -> AdminPandaChangeSetRead:
        self._base_record(payload.parent_id)
        if payload.parent_id == panda_id:
            raise HTTPException(status_code=422, detail={"code": "admin_parent_self_relation"})
        change_set_id = self._ensure_working_change_set(
            panda_id,
            identity=identity,
            reason=payload.reason,
        )
        source_ids = self._require_sources(change_set_id, payload.source_ids)
        records = self._effective_records(change_set_id)
        existing = [
            (entity_id, record)
            for (entity_type, entity_id), record in records.items()
            if entity_type == "parentage_assertion"
            and str(record.get("child_id")) == str(panda_id)
            and str(record.get("role")) == payload.role
            and str(record.get("status")) != "superseded"
        ]
        assertion_id = existing[0][0] if existing else f"parent-admin-{panda_id}-{payload.role}"
        edges = self._parentage_edges(change_set_id)
        edges = {edge for edge in edges if edge[1] != panda_id or edge[0] == payload.parent_id}
        edges.add((payload.parent_id, panda_id))
        frontier = [panda_id]
        visited: set[UUID] = set()
        while frontier:
            current = frontier.pop()
            if current in visited:
                continue
            visited.add(current)
            children = [child for parent, child in edges if parent == current]
            if payload.parent_id in children:
                raise HTTPException(status_code=422, detail={"code": "admin_parentage_cycle"})
            frontier.extend(children)
        public_record = {
            "child_id": str(panda_id),
            "parent_id": str(payload.parent_id),
            "role": payload.role,
            "status": payload.status,
            "source_ids": source_ids,
        }
        self._append_revision(
            change_set_id,
            entity_type="parentage_assertion",
            entity_id=assertion_id,
            public_record=public_record,
            checks={
                "references": [
                    {"target_type": "panda", "target_id": str(panda_id), "resolved": False},
                    {
                        "target_type": "panda",
                        "target_id": str(payload.parent_id),
                        "resolved": False,
                    },
                ],
                "residencies": [],
                "translations": [],
                "sources": [
                    {"id": source_id, "access_state": "pending"} for source_id in source_ids
                ],
                "media": [],
            },
            identity=identity,
        )
        self.session.commit()
        version, state = self.change_set_state(change_set_id)
        return AdminPandaChangeSetRead(
            change_set_id=change_set_id,
            status=state,
            governance_version=version,
        )

    def add_residency(
        self,
        panda_id: UUID,
        payload: AdminPandaResidencyCreate,
        identity: RequestIdentity,
    ) -> AdminPandaChangeSetRead:
        if (payload.facility_id is None) == (not payload.coarse_location):
            raise HTTPException(
                status_code=422,
                detail={"code": "admin_residency_requires_one_location"},
            )
        if payload.end_date is not None and payload.end_date < payload.start_date:
            raise HTTPException(
                status_code=422,
                detail={"code": "admin_residency_invalid_interval"},
            )
        if payload.facility_id is not None:
            facility_exists = self.session.execute(
                text("select exists(select 1 from public.facilities where id = :id)"),
                {"id": payload.facility_id},
            ).scalar_one()
            if not facility_exists:
                raise HTTPException(status_code=404, detail={"code": "admin_facility_not_found"})
        change_set_id = self._ensure_working_change_set(
            panda_id,
            identity=identity,
            reason=payload.reason,
        )
        source_ids = self._require_sources(change_set_id, payload.source_ids)
        records = self._effective_records(change_set_id)
        if payload.residency_type == "primary" and payload.end_date is None:
            for (entity_type, entity_id), record in list(records.items()):
                if entity_type != "residency":
                    continue
                if str(record.get("panda_id")) != str(panda_id):
                    continue
                if record.get("residency_type") != "primary" or record.get("end_date") is not None:
                    continue
                closed = dict(record)
                closed["end_date"] = payload.start_date.isoformat()
                closed["end_precision"] = payload.start_precision
                self._append_revision(
                    change_set_id,
                    entity_type="residency",
                    entity_id=entity_id,
                    public_record=closed,
                    checks={
                        "references": [
                            {"target_type": "panda", "target_id": str(panda_id), "resolved": False}
                        ],
                        "residencies": [
                            {
                                "panda_id": str(panda_id),
                                "start_date": str(closed["start_date"]),
                                "end_date": str(closed["end_date"]),
                            }
                        ],
                        "translations": [],
                        "sources": [
                            {"id": source_id, "access_state": "pending"}
                            for source_id in closed.get("source_ids", [])
                        ],
                        "media": [],
                    },
                    identity=identity,
                )
        residency_id = f"res-admin-{uuid4()}"
        public_record = {
            "panda_id": str(panda_id),
            "facility_id": str(payload.facility_id) if payload.facility_id else None,
            "coarse_location": payload.coarse_location.strip() if payload.coarse_location else None,
            "residency_type": payload.residency_type,
            "start_date": payload.start_date.isoformat(),
            "start_precision": payload.start_precision,
            "end_date": payload.end_date.isoformat() if payload.end_date else None,
            "end_precision": payload.end_precision,
            "status": payload.status,
            "source_ids": source_ids,
            "last_verified_at": date.today().isoformat(),
        }
        self._append_revision(
            change_set_id,
            entity_type="residency",
            entity_id=residency_id,
            public_record=public_record,
            checks={
                "references": [
                    {"target_type": "panda", "target_id": str(panda_id), "resolved": False},
                    *(
                        [
                            {
                                "target_type": "facility",
                                "target_id": str(payload.facility_id),
                                "resolved": False,
                            }
                        ]
                        if payload.facility_id
                        else []
                    ),
                ],
                "residencies": [
                    {
                        "panda_id": str(panda_id),
                        "start_date": payload.start_date.isoformat(),
                        "end_date": payload.end_date.isoformat() if payload.end_date else None,
                    }
                ],
                "translations": [],
                "sources": [
                    {"id": source_id, "access_state": "pending"} for source_id in source_ids
                ],
                "media": [],
            },
            identity=identity,
        )
        self.session.commit()
        version, state = self.change_set_state(change_set_id)
        return AdminPandaChangeSetRead(
            change_set_id=change_set_id,
            status=state,
            governance_version=version,
        )

    def add_event(
        self,
        panda_id: UUID,
        payload: AdminPandaEventCreate,
        identity: RequestIdentity,
    ) -> AdminPandaChangeSetRead:
        if payload.facility_id and payload.coarse_location:
            raise HTTPException(status_code=422, detail={"code": "admin_event_location_conflict"})
        change_set_id = self._ensure_working_change_set(
            panda_id,
            identity=identity,
            reason=payload.reason,
        )
        source_ids = self._require_sources(change_set_id, payload.source_ids)
        event_id = f"event-admin-{uuid4()}"
        public_record = {
            "event_type": payload.event_type,
            "event_status": payload.event_status,
            "event_date": payload.event_date.isoformat(),
            "event_date_precision": payload.event_date_precision,
            "participants": [str(panda_id)],
            "source_ids": source_ids,
            "changes_current_residency": payload.event_type in {"arrival", "transfer", "return"},
        }
        if payload.facility_id:
            public_record["to_facility_id"] = str(payload.facility_id)
        if payload.coarse_location:
            public_record["to_coarse_location"] = payload.coarse_location.strip()
        self._append_revision(
            change_set_id,
            entity_type="event",
            entity_id=event_id,
            public_record=public_record,
            checks={
                "references": [
                    {"target_type": "panda", "target_id": str(panda_id), "resolved": False}
                ],
                "residencies": [],
                "translations": [],
                "sources": [
                    {"id": source_id, "access_state": "pending"} for source_id in source_ids
                ],
                "media": [],
            },
            identity=identity,
        )
        self.session.commit()
        version, state = self.change_set_state(change_set_id)
        return AdminPandaChangeSetRead(
            change_set_id=change_set_id,
            status=state,
            governance_version=version,
        )

    def add_source(
        self,
        panda_id: UUID,
        payload: AdminEvidenceSourceCreate,
        identity: RequestIdentity,
    ) -> AdminPandaChangeSetRead:
        change_set_id = self._ensure_working_change_set(
            panda_id,
            identity=identity,
            reason=payload.reason,
        )
        records = self._effective_records(change_set_id)
        duplicate = next(
            (
                entity_id
                for (entity_type, entity_id), record in records.items()
                if entity_type == "source" and str(record.get("url")) == payload.url
            ),
            None,
        )
        if duplicate and duplicate != payload.source_id:
            raise HTTPException(
                status_code=409,
                detail={"code": "admin_source_url_exists", "source_id": duplicate},
            )
        public_record = {
            "publisher": payload.publisher,
            "title": payload.title,
            "url": payload.url,
            "published_at": payload.published_at.isoformat() if payload.published_at else None,
            "last_verified_at": payload.last_verified_at.isoformat(),
            "language": self._canonical_language(payload.language_tag),
            "access_state": payload.access_state,
            "evidence_tier": payload.evidence_tier,
        }
        self._append_revision(
            change_set_id,
            entity_type="source",
            entity_id=payload.source_id,
            public_record=public_record,
            checks={
                "references": [],
                "residencies": [],
                "translations": [],
                "sources": [],
                "media": [],
            },
            identity=identity,
        )
        self.session.commit()
        version, state = self.change_set_state(change_set_id)
        return AdminPandaChangeSetRead(
            change_set_id=change_set_id,
            status=state,
            governance_version=version,
        )

    def add_media(
        self,
        panda_id: UUID,
        payload: AdminPandaMediaCreate,
        identity: RequestIdentity,
    ) -> AdminPandaChangeSetRead:
        change_set_id = self._ensure_working_change_set(
            panda_id,
            identity=identity,
            reason=payload.reason,
        )
        source_ids = self._require_sources(change_set_id, payload.source_ids)
        public_record = {
            "panda_id": str(panda_id),
            "source_url": payload.source_url,
            "url": payload.url,
            "rights": payload.rights,
            "credit": payload.credit,
            "alt_zh": payload.alt_zh,
            "alt_en": payload.alt_en,
            "status": "available",
            "source_ids": source_ids,
            "sha256": payload.sha256,
            "mime_type": payload.mime_type,
            "width": payload.width,
            "height": payload.height,
            "bytes": payload.byte_size,
            "derivatives": [
                {
                    "kind": "display",
                    "url": payload.derivative_url,
                    "sha256": payload.derivative_sha256,
                    "mime_type": "image/webp",
                    "width": payload.derivative_width,
                    "height": payload.derivative_height,
                    "bytes": payload.byte_size,
                }
            ],
            "is_cover": payload.is_cover,
        }
        self._append_revision(
            change_set_id,
            entity_type="media_item",
            entity_id=payload.media_id,
            public_record=public_record,
            checks={
                "references": [
                    {"target_type": "panda", "target_id": str(panda_id), "resolved": False}
                ],
                "residencies": [],
                "translations": [],
                "sources": [
                    {"id": source_id, "access_state": "pending"} for source_id in source_ids
                ],
                "media": [{"id": payload.media_id, "license": payload.rights}],
            },
            identity=identity,
        )
        self.session.commit()
        version, state = self.change_set_state(change_set_id)
        return AdminPandaChangeSetRead(
            change_set_id=change_set_id,
            status=state,
            governance_version=version,
        )

    def reopen_failed_change_set(
        self,
        change_set_id: UUID,
        *,
        identity: RequestIdentity,
        reason: str,
    ) -> AdminPandaChangeSetRead:
        row = self.session.execute(
            text(
                """
                select status, governance_version
                from public.change_sets
                where id = :change_set_id
                for update
                """
            ),
            {"change_set_id": change_set_id},
        ).first()
        if row is None:
            raise HTTPException(status_code=404, detail={"code": "change_set_not_found"})
        state = str(row[0])
        if state != "validation_failed":
            raise HTTPException(
                status_code=409,
                detail={"code": "admin_change_set_not_reopenable", "state": state},
            )
        next_version = int(row[1]) + 1
        self.session.execute(
            text(
                """
                update public.change_sets
                set status = 'draft',
                    validation_state = 'not_validated',
                    validated_by = null,
                    validated_at = null,
                    validation_reason = null,
                    last_validation_hash = null,
                    base_archive_version = :base_archive_version,
                    governance_version = :governance_version
                where id = :change_set_id
                """
            ),
            {
                "change_set_id": change_set_id,
                "base_archive_version": self.current_archive_version(),
                "governance_version": next_version,
            },
        )
        self.session.execute(
            text(
                """
                insert into public.audit_events (
                  event_type, subject_type, subject_id, actor_id, reason, metadata
                ) values (
                  'admin.change_set.reopened', 'change_set', :change_set_id,
                  :actor_id, :reason,
                  cast(:metadata as jsonb)
                )
                """
            ),
            {
                "change_set_id": change_set_id,
                "actor_id": identity.account_id,
                "reason": reason,
                "metadata": json.dumps(
                    {
                        "previous_state": "validation_failed",
                        "next_state": "draft",
                        "governance_version": next_version,
                    }
                ),
            },
        )
        self.session.commit()
        return AdminPandaChangeSetRead(
            change_set_id=change_set_id,
            status="draft",
            governance_version=next_version,
        )

    def change_set_state(self, change_set_id: UUID) -> tuple[int, str]:
        row = self.session.execute(
            text(
                """
                select governance_version, status
                from public.change_sets
                where id = :change_set_id
                """
            ),
            {"change_set_id": change_set_id},
        ).first()
        if row is None:
            raise HTTPException(status_code=404, detail={"code": "change_set_not_found"})
        return int(row[0]), str(row[1])

    def dashboard(self) -> AdminContentDashboardRead:
        panda_ids = [
            UUID(str(item))
            for item in self.session.execute(text("select id from public.pandas")).scalars()
        ]
        items = [self._list_item(panda_id) for panda_id in panda_ids]
        published = sum(item.publication_state == "published" for item in items)
        incomplete = sum(item.completeness < 100 for item in items)
        no_cover = sum(not item.has_cover for item in items)
        no_source = sum(item.source_count == 0 for item in items)
        no_location = sum(not item.current_location for item in items)
        uncertain = sum(item.data_quality == "uncertain" for item in items)
        pending_media = int(
            self.session.execute(
                text(
                    """
                    select count(*) from public.media_assets
                    where license is null or trim(coalesce(copyright_text, '')) = ''
                    """
                )
            ).scalar_one()
        )
        recent_sources = int(
            self.session.execute(
                text(
                    """
                    select count(*) from public.evidence_sources
                    where created_at >= :cutoff
                    """
                ),
                {"cutoff": datetime.now(UTC) - timedelta(days=30)},
            ).scalar_one()
        )
        activity_rows = self.session.execute(
            text(
                """
                select coalesce(account.email, audit.actor_id::text) as actor,
                       audit.event_type as action, audit.subject_type as object_type,
                       audit.subject_id::text as object_id, audit.occurred_at
                from public.audit_events audit
                left join identity.accounts account on account.account_id = audit.actor_id
                order by audit.occurred_at desc
                limit 10
                """
            )
        ).mappings()
        return AdminContentDashboardRead(
            panda_total=len(items),
            panda_published=published,
            panda_draft=len(items) - published,
            panda_incomplete=incomplete,
            pending_media=pending_media,
            recent_sources=recent_sources,
            issues=[
                AdminDashboardIssue(
                    code="no-cover",
                    label="没有封面的熊猫",
                    count=no_cover,
                    href="/pandas?issue=no-cover",
                ),
                AdminDashboardIssue(
                    code="no-source",
                    label="没有来源的熊猫",
                    count=no_source,
                    href="/pandas?issue=no-source",
                ),
                AdminDashboardIssue(
                    code="no-location",
                    label="当前所在地缺失",
                    count=no_location,
                    href="/pandas?issue=no-location",
                ),
                AdminDashboardIssue(
                    code="uncertain",
                    label="资料可信度待确认",
                    count=uncertain,
                    href="/pandas?quality=uncertain",
                ),
            ],
            recent_activity=[
                AdminRecentActivityRead.model_validate(dict(row)) for row in activity_rows
            ],
        )
