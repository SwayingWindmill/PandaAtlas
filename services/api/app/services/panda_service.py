import json
from dataclasses import dataclass
from datetime import date
from uuid import UUID

from fastapi import HTTPException

try:
    from sqlalchemy import text
    from sqlalchemy.exc import SQLAlchemyError
except ModuleNotFoundError:  # pragma: no cover - runtime fallback for lightweight envs
    text = None

    class SQLAlchemyError(Exception):
        """Fallback error when SQLAlchemy is not installed."""


from app.core.config import settings
from app.data.golden_dataset import (
    find_trusted_panda,
    public_trusted_panda_record,
    trusted_lineage_pandas,
    trusted_panda_details,
    trusted_panda_matches,
    trusted_parentage_assertions,
)
from app.data.mock_data import MOCK_PANDAS
from app.db.session import has_database, session_scope
from app.domain.archive_relationships import LineageGraph, derive_lineage
from app.domain.trusted_identity import normalize_identity_term
from app.schemas.panda import (
    HabitatSummary,
    MediaAsset,
    PaginatedPandasResponse,
    PaginationMeta,
    PandaDetail,
    PandaLineageEdge,
    PandaLineageMeta,
    PandaLineageNode,
    PandaLineageRelationship,
    PandaLineageResponse,
    PandaListItem,
)
from app.schemas.publication import PANDA_PUBLIC_REVISION_FIELDS
from app.services.publication_service import get_active_public_record


@dataclass(frozen=True)
class PandaReference:
    id: UUID
    slug: str


def _all_mock_panda_details() -> list[PandaDetail]:
    by_id = {
        detail.id: detail
        for detail in (PandaDetail.model_validate(item) for item in MOCK_PANDAS)
    }
    for record in trusted_panda_details():
        detail = PandaDetail.model_validate(public_trusted_panda_record(record))
        by_id[detail.id] = detail
    return list(by_id.values())


def _list_pandas_from_mock(
    *,
    page: int,
    page_size: int,
    q: str | None,
    status: str | None,
    gender: str | None,
    habitat_id: UUID | None,
    featured: bool | None,
    sort: str,
) -> PaginatedPandasResponse:
    rows = _all_mock_panda_details()

    if q:
        lowered = q.lower().strip()
        rows = [
            row
            for row in rows
            if lowered in row.name_zh.lower()
            or (row.name_en and lowered in row.name_en.lower())
            or any(lowered in tag.lower() for tag in row.tags)
            or trusted_panda_matches(str(row.id), q)
        ]

    if status:
        rows = [row for row in rows if row.status == status]

    if gender:
        rows = [row for row in rows if row.gender == gender]

    if habitat_id is not None:
        rows = [
            row
            for row in rows
            if any(habitat.id == habitat_id for habitat in row.habitats)
        ]

    if featured is not None:
        rows = [row for row in rows if ("featured" in row.tags) is featured]

    if sort == "name_asc":
        rows.sort(key=lambda x: x.name_zh)
    elif sort == "name_desc":
        rows.sort(key=lambda x: x.name_zh, reverse=True)
    elif sort == "birth_date_desc":
        rows.sort(key=lambda x: x.birth_date or "0001-01-01", reverse=True)

    total = len(rows)
    start = (page - 1) * page_size
    end = start + page_size
    subset = rows[start:end]

    return PaginatedPandasResponse(
        items=[PandaListItem.model_validate(item.model_dump()) for item in subset],
        meta=PaginationMeta(page=page, page_size=page_size, total=total),
    )


def _get_panda_by_id_from_mock(panda_id: UUID) -> PandaDetail:
    for detail in _all_mock_panda_details():
        if detail.id == panda_id:
            return detail.model_copy(update={"father_id": None, "mother_id": None})

    raise HTTPException(status_code=404, detail="Panda not found")


def _normalize_tags(value: object) -> list[str]:
    if isinstance(value, list):
        return [str(tag) for tag in value]
    if isinstance(value, tuple):
        return [str(tag) for tag in value]
    if isinstance(value, str):
        try:
            loaded = json.loads(value)
            if isinstance(loaded, list):
                return [str(tag) for tag in loaded]
        except json.JSONDecodeError:
            pass
    return []


def _resolve_public_media_url(storage_path: str | None) -> str | None:
    if not storage_path:
        return None

    lowered = storage_path.lower()
    if lowered.startswith("http://") or lowered.startswith("https://"):
        return storage_path

    return None


def _order_clause(sort: str) -> str:
    mapping = {
        "name_asc": "public_name_zh asc",
        "name_desc": "public_name_zh desc",
        "birth_date_desc": "public_birth_date desc nulls last",
        "created_at_desc": "p.created_at desc",
    }
    return mapping.get(sort, "p.created_at desc")


def _try_parse_uuid(value: str) -> UUID | None:
    try:
        return UUID(value)
    except ValueError:
        return None


def _normalize_public_ref(panda_ref: str) -> str:
    normalized = panda_ref.strip()
    if not normalized:
        raise HTTPException(status_code=404, detail="Panda not found")
    return normalized


def _resolve_public_ref_from_mock(panda_ref: str) -> PandaReference:
    normalized = _normalize_public_ref(panda_ref)
    trusted = find_trusted_panda(normalized)
    if trusted is not None:
        return PandaReference(id=UUID(trusted["id"]), slug=trusted["slug"])

    uuid_ref = _try_parse_uuid(normalized)
    for lineage_record in trusted_lineage_pandas():
        if lineage_record["slug"] == normalized or (
            uuid_ref is not None and lineage_record["id"] == uuid_ref
        ):
            return PandaReference(
                id=lineage_record["id"], slug=lineage_record["slug"]
            )

    for detail in _all_mock_panda_details():
        if detail.slug == normalized or (uuid_ref is not None and detail.id == uuid_ref):
            return PandaReference(id=detail.id, slug=detail.slug)

    raise HTTPException(status_code=404, detail="Panda not found")


def _list_pandas_from_db(
    *,
    page: int,
    page_size: int,
    q: str | None,
    status: str | None,
    gender: str | None,
    habitat_id: UUID | None,
    featured: bool | None,
    sort: str,
) -> PaginatedPandasResponse:
    if text is None:
        raise SQLAlchemyError("SQLAlchemy text() unavailable")

    q_like = f"%{q.strip()}%" if q else None
    offset = (page - 1) * page_size

    where_clauses = ["1=1"]
    params: dict[str, object] = {
        "limit": page_size,
        "offset": offset,
    }

    public_name_zh = "coalesce(active_record.public_record ->> 'name_zh', p.name_zh)"
    public_name_en = (
        "case when active_record.public_record ? 'name_en' "
        "then active_record.public_record ->> 'name_en' else p.name_en end"
    )
    public_gender = "coalesce(active_record.public_record ->> 'gender', p.gender)"
    public_status = (
        "coalesce(active_record.public_record ->> 'status', p.status::text)"
    )
    public_birth_date = (
        "case when active_record.public_record ? 'birth_date' "
        "then (active_record.public_record ->> 'birth_date')::date "
        "else p.birth_date end"
    )
    public_current_location = (
        "case when active_record.public_record ? 'current_location' "
        "then active_record.public_record ->> 'current_location' "
        "else p.current_location end"
    )
    public_featured = (
        "coalesce((active_record.public_record ->> 'is_featured')::boolean, p.is_featured)"
    )

    if q_like:
        where_clauses.append(
            f"""
            (
              {public_name_zh} ilike :q_like
              or coalesce({public_name_en}, '') ilike :q_like
              or coalesce(active_record.public_record -> 'tags', to_jsonb(p.tags))::text
                ilike :q_like
              or exists (
                select 1
                from public.panda_names pn
                where pn.panda_id = p.id
                  and pn.publication_status = 'published'
                  and pn.normalized_value like :q_normalized
              )
              or exists (
                select 1
                from public.panda_slugs ps
                where ps.panda_id = p.id
                  and ps.publication_status = 'published'
                  and ps.slug ilike :q_like
              )
              or exists (
                select 1
                from public.panda_external_identifiers pei
                where pei.panda_id = p.id
                  and pei.publication_status = 'published'
                  and (
                    pei.normalized_value like :q_normalized
                    or (pei.system || ':' || pei.value) ilike :q_like
                  )
              )
            )
            """
        )
        normalized_query = normalize_identity_term(q or "")
        params["q_like"] = q_like
        params["q_normalized"] = (
            f"%{normalized_query}%" if normalized_query else "__no_identity_match__"
        )

    if status:
        where_clauses.append(f"{public_status} = :status")
        params["status"] = status

    if gender:
        where_clauses.append(f"{public_gender} = :gender")
        params["gender"] = gender

    if habitat_id is not None:
        where_clauses.append(
            """
            exists (
              select 1
              from public.sightings s
              where s.panda_id = p.id
                and s.habitat_id = :habitat_id
            )
            """
        )
        params["habitat_id"] = habitat_id

    if featured is not None:
        where_clauses.append(f"{public_featured} = :featured")
        params["featured"] = featured

    where_clauses.append(
        "(active_record.entity_id is null or active_record.operation <> 'withdrawal')"
    )

    active_records_cte = """
        active_release as (
          select
            batch.operation,
            case
              when batch.operation = 'withdrawal' then batch.withdrawal_target_id
              else batch.id
            end as source_batch_id
          from public.public_release_pointer pointer
          join public.publication_batches batch on batch.id = pointer.active_batch_id
          where pointer.singleton = true
        ),
        active_records as (
          select distinct on (revision.entity_id)
            revision.entity_id,
            revision.payload -> 'public_record' as public_record,
            active_release.operation
          from active_release
          join public.publication_batch_change_sets batch_link
            on batch_link.batch_id = active_release.source_batch_id
          join public.change_set_revisions change_link
            on change_link.change_set_id = batch_link.change_set_id
          join public.entity_revisions revision on revision.id = change_link.revision_id
          where revision.entity_type = 'panda'
          order by
            revision.entity_id,
            revision.revision_number desc,
            revision.created_at desc
        )
    """

    sql = text(
        f"""
        with {active_records_cte}
        select
          p.id,
          coalesce(canonical_slug.slug, p.slug) as slug,
          {public_name_zh} as public_name_zh,
          {public_name_en} as public_name_en,
          {public_gender} as public_gender,
          {public_status} as public_status,
          {public_birth_date} as public_birth_date,
          {public_current_location} as public_current_location,
          p.tags,
          p.is_featured,
          cover.cover_image_url,
          array_remove(
            array[
              coalesce(canonical_slug.slug, p.slug),
              {public_name_zh},
              {public_name_en}
            ]
            || array(
              select pn.value
              from public.panda_names pn
              where pn.panda_id = p.id
                and pn.publication_status = 'published'
            )
            || array(
              select ps.slug
              from public.panda_slugs ps
              where ps.panda_id = p.id
                and ps.publication_status = 'published'
            )
            || array(
              select pei.value
              from public.panda_external_identifiers pei
              where pei.panda_id = p.id
                and pei.publication_status = 'published'
              union all
              select pei.system || ':' || pei.value
              from public.panda_external_identifiers pei
              where pei.panda_id = p.id
                and pei.publication_status = 'published'
            ),
            null::text
          ) as search_terms
        from public.pandas p
        left join active_records active_record on active_record.entity_id = p.id::text
        left join public.panda_slugs canonical_slug
          on canonical_slug.panda_id = p.id
          and canonical_slug.slug_kind = 'canonical'
          and canonical_slug.publication_status = 'published'
        left join lateral (
          select m.storage_path as cover_image_url
          from public.panda_media pm
          join public.media_assets m on m.id = pm.media_id
          where pm.panda_id = p.id
          order by pm.is_cover desc, pm.display_order asc, m.created_at asc, m.id asc
          limit 1
        ) cover on true
        where {" and ".join(where_clauses)}
        order by {_order_clause(sort)}
        limit :limit offset :offset
        """
    )

    count_sql = text(
        f"""
        with {active_records_cte}
        select count(*) as total
        from public.pandas p
        left join active_records active_record on active_record.entity_id = p.id::text
        where {" and ".join(where_clauses)}
        """
    )

    with session_scope() as session:
        if session is None:
            raise SQLAlchemyError("Database session unavailable")

        rows = session.execute(sql, params).mappings().all()
        total = int(session.execute(count_sql, params).scalar_one())

    items = [
        PandaListItem(
            id=row["id"],
            slug=row["slug"],
            name_zh=row["public_name_zh"],
            name_en=row["public_name_en"],
            gender=row["public_gender"],
            status=row["public_status"],
            birth_date=row["public_birth_date"],
            current_location=row["public_current_location"],
            cover_image_url=_resolve_public_media_url(row["cover_image_url"]),
            search_terms=list(dict.fromkeys(row["search_terms"] or [])),
        )
        for row in rows
    ]

    return PaginatedPandasResponse(
        items=items,
        meta=PaginationMeta(page=page, page_size=page_size, total=total),
    )


def _resolve_public_ref_from_db(panda_ref: str) -> PandaReference:
    if text is None:
        raise SQLAlchemyError("SQLAlchemy text() unavailable")

    normalized = _normalize_public_ref(panda_ref)
    uuid_ref = _try_parse_uuid(normalized)

    with session_scope() as session:
        if session is None:
            raise SQLAlchemyError("Database session unavailable")

        if uuid_ref is not None:
            row = session.execute(
                text(
                    """
                    select p.id, p.slug
                    from public.pandas p
                    where p.id = :panda_id
                    limit 1
                    """
                ),
                {"panda_id": uuid_ref},
            ).mappings().first()
            if row is not None:
                return PandaReference(id=row["id"], slug=row["slug"])

        row = session.execute(
            text(
                """
                select p.id, coalesce(canonical_slug.slug, p.slug) as slug
                from public.pandas p
                left join public.panda_slugs canonical_slug
                  on canonical_slug.panda_id = p.id
                  and canonical_slug.slug_kind = 'canonical'
                  and canonical_slug.publication_status = 'published'
                where p.slug = :panda_ref
                  or exists (
                    select 1
                    from public.panda_slugs ps
                    where ps.panda_id = p.id
                      and ps.publication_status = 'published'
                      and ps.slug = :panda_ref
                  )
                  or exists (
                    select 1
                    from public.panda_names pn
                    where pn.panda_id = p.id
                      and pn.publication_status = 'published'
                      and pn.normalized_value = :normalized_ref
                  )
                  or exists (
                    select 1
                    from public.panda_external_identifiers pei
                    where pei.panda_id = p.id
                      and pei.publication_status = 'published'
                      and (
                        pei.normalized_value = :normalized_ref
                        or lower(pei.system || ':' || pei.value) = lower(:panda_ref)
                      )
                  )
                order by case when p.slug = :panda_ref then 0 else 1 end
                limit 1
                """
            ),
            {
                "panda_ref": normalized,
                "normalized_ref": normalize_identity_term(normalized),
            },
        ).mappings().first()

    if row is None:
        raise HTTPException(status_code=404, detail="Panda not found")

    return PandaReference(id=row["id"], slug=row["slug"])


def _get_panda_by_id_from_db(panda_id: UUID) -> PandaDetail:
    if text is None:
        raise SQLAlchemyError("SQLAlchemy text() unavailable")

    panda_sql = text(
        """
        select
          p.id,
          coalesce(canonical_slug.slug, p.slug) as slug,
          p.name_zh,
          p.name_en,
          p.gender,
          p.status::text as status,
          p.birth_date,
          p.birthplace,
          p.current_location,
          p.intro,
          p.tags,
          (
            select pa.parent_id
            from public.parentage_assertions pa
            where pa.child_id = p.id
              and pa.parent_role = 'father'
              and pa.status = 'confirmed'
              and pa.publication_status = 'published'
              and exists (
                select 1
                from public.parentage_assertion_sources pas
                join public.public_evidence_sources public_source
                  on public_source.id = pas.source_id
                where pas.assertion_id = pa.id
              )
            order by pa.parent_id
            limit 1
          ) as father_id,
          (
            select pa.parent_id
            from public.parentage_assertions pa
            where pa.child_id = p.id
              and pa.parent_role = 'mother'
              and pa.status = 'confirmed'
              and pa.publication_status = 'published'
              and exists (
                select 1
                from public.parentage_assertion_sources pas
                join public.public_evidence_sources public_source
                  on public_source.id = pas.source_id
                where pas.assertion_id = pa.id
              )
            order by pa.parent_id
            limit 1
          ) as mother_id,
          cover.cover_image_url
        from public.pandas p
        left join public.panda_slugs canonical_slug
          on canonical_slug.panda_id = p.id
          and canonical_slug.slug_kind = 'canonical'
          and canonical_slug.publication_status = 'published'
        left join lateral (
          select m.storage_path as cover_image_url
          from public.panda_media pm
          join public.media_assets m on m.id = pm.media_id
          where pm.panda_id = p.id
          order by pm.is_cover desc, pm.display_order asc, m.created_at asc, m.id asc
          limit 1
        ) cover on true
        where p.id = :panda_id
        """
    )

    habitat_sql = text(
        """
        select distinct h.id, h.name, h.province
        from public.sightings s
        join public.habitats h on h.id = s.habitat_id
        where s.panda_id = :panda_id
        order by h.name
        """
    )

    media_sql = text(
        """
        select m.id, m.storage_bucket, m.storage_path, m.title, m.photographer, pm.is_cover
        from public.panda_media pm
        join public.media_assets m on m.id = pm.media_id
        where pm.panda_id = :panda_id
        order by pm.is_cover desc, pm.display_order asc, m.created_at asc, m.id asc
        """
    )

    identity_names_sql = text(
        """
        select
          pn.value,
          pn.language_tag,
          pn.name_kind,
          pn.is_primary,
          coalesce(
            array_remove(array_agg(distinct public_source.id), null),
            '{}'::text[]
          ) as source_ids
        from public.panda_names pn
        left join public.panda_name_sources pns on pns.panda_name_id = pn.id
        left join public.public_evidence_sources public_source
          on public_source.id = pns.source_id
        where pn.panda_id = :panda_id
          and pn.publication_status = 'published'
        group by pn.id, pn.value, pn.language_tag, pn.name_kind, pn.is_primary
        order by pn.is_primary desc, pn.language_tag, pn.name_kind, pn.value
        """
    )

    identity_slugs_sql = text(
        """
        select
          ps.slug,
          ps.slug_kind,
          coalesce(
            array_remove(array_agg(distinct public_source.id), null),
            '{}'::text[]
          ) as source_ids
        from public.panda_slugs ps
        left join public.panda_slug_sources pss on pss.panda_slug_id = ps.id
        left join public.public_evidence_sources public_source
          on public_source.id = pss.source_id
        where ps.panda_id = :panda_id
          and ps.publication_status = 'published'
        group by ps.id, ps.slug, ps.slug_kind
        order by ps.slug_kind, ps.slug
        """
    )

    external_identifiers_sql = text(
        """
        select
          pei.system,
          pei.value,
          coalesce(
            array_remove(array_agg(distinct public_source.id), null),
            '{}'::text[]
          ) as source_ids
        from public.panda_external_identifiers pei
        left join public.panda_external_identifier_sources peis
          on peis.external_identifier_id = pei.id
        left join public.public_evidence_sources public_source
          on public_source.id = peis.source_id
        where pei.panda_id = :panda_id
          and pei.publication_status = 'published'
        group by pei.id, pei.system, pei.value
        order by pei.system, pei.value
        """
    )

    conclusions_sql = text(
        """
        select
          c.field_key,
          c.value_json,
          c.status,
          c.last_verified_at,
          c.candidate_values_json,
          c.superseded_values_json,
          coalesce(
            array_remove(array_agg(distinct pca.assertion_id), null),
            '{}'::text[]
          ) as assertion_ids,
          coalesce(
            array_remove(array_agg(distinct public_source.id), null),
            '{}'::text[]
          ) as source_ids
        from public.public_fact_conclusions c
        left join public.public_fact_conclusion_assertions pca
          on pca.conclusion_id = c.id
        left join public.fact_assertion_sources fas
          on fas.assertion_id = pca.assertion_id
        left join public.public_evidence_sources public_source
          on public_source.id = fas.source_id
        where c.panda_id = :panda_id
          and c.is_current
          and c.publication_status = 'published'
        group by c.id
        order by c.field_key
        """
    )

    residencies_sql = text(
        """
        select
          r.id,
          r.facility_id,
          r.coarse_location,
          r.residency_type,
          r.start_date,
          r.start_precision,
          r.end_date,
          r.end_precision,
          r.status,
          array_agg(distinct public_source.id) as source_ids
        from public.panda_residencies r
        join public.residency_sources rs on rs.residency_id = r.id
        join public.public_evidence_sources public_source on public_source.id = rs.source_id
        where r.panda_id = :panda_id
          and r.publication_status = 'published'
        group by r.id
        order by r.start_date, r.id
        """
    )

    events_sql = text(
        """
        select
          e.id,
          e.event_type,
          e.event_status,
          e.event_date,
          e.event_date_precision,
          e.from_facility_id,
          e.from_coarse_location,
          e.to_facility_id,
          e.to_coarse_location,
          array_agg(distinct participant.panda_id) as participants,
          array_agg(distinct public_source.id) as source_ids
        from public.domain_events e
        join public.domain_event_participants focus
          on focus.event_id = e.id and focus.panda_id = :panda_id
        join public.domain_event_participants participant on participant.event_id = e.id
        join public.domain_event_sources es on es.event_id = e.id
        join public.public_evidence_sources public_source on public_source.id = es.source_id
        where e.publication_status = 'published'
        group by e.id
        order by e.event_date, e.id
        """
    )

    public_sources_sql = text(
        """
        select
          id,
          publisher,
          title,
          url,
          published_at,
          last_verified_at,
          language_tag as language,
          access_state
        from public.public_evidence_sources
        where id = any(:source_ids)
        order by id
        """
    )

    with session_scope() as session:
        if session is None:
            raise SQLAlchemyError("Database session unavailable")

        row = session.execute(panda_sql, {"panda_id": panda_id}).mappings().first()
        if row is None:
            raise HTTPException(status_code=404, detail="Panda not found")

        habitat_rows = session.execute(habitat_sql, {"panda_id": panda_id}).mappings().all()
        media_rows = session.execute(media_sql, {"panda_id": panda_id}).mappings().all()
        identity_name_rows = (
            session.execute(identity_names_sql, {"panda_id": panda_id}).mappings().all()
        )
        identity_slug_rows = (
            session.execute(identity_slugs_sql, {"panda_id": panda_id}).mappings().all()
        )
        external_identifier_rows = (
            session.execute(external_identifiers_sql, {"panda_id": panda_id})
            .mappings()
            .all()
        )
        conclusion_rows = (
            session.execute(conclusions_sql, {"panda_id": panda_id}).mappings().all()
        )
        residency_rows = (
            session.execute(residencies_sql, {"panda_id": panda_id}).mappings().all()
        )
        event_rows = session.execute(events_sql, {"panda_id": panda_id}).mappings().all()
        source_ids = sorted(
            {
                str(source_id)
                for source_row in (
                    *identity_name_rows,
                    *identity_slug_rows,
                    *external_identifier_rows,
                    *conclusion_rows,
                    *residency_rows,
                    *event_rows,
                )
                for source_id in (source_row["source_ids"] or [])
            }
        )
        source_rows = (
            session.execute(public_sources_sql, {"source_ids": source_ids})
            .mappings()
            .all()
            if source_ids
            else []
        )

    habitats = [
        HabitatSummary(id=h["id"], name=h["name"], province=h["province"]) for h in habitat_rows
    ]
    media = [
        MediaAsset(
            id=m["id"],
            storage_bucket=m["storage_bucket"],
            storage_path=m["storage_path"],
            title=m["title"],
            photographer=m["photographer"],
            signed_url=_resolve_public_media_url(m["storage_path"]),
        )
        for m in media_rows
    ]

    alias_kinds = {"alias", "historic_spelling", "historical_name", "nickname"}

    def identity_name_payload(name_row: object) -> dict[str, object]:
        return {
            "value": name_row["value"],
            "language": name_row["language_tag"],
            "kind": name_row["name_kind"],
            "primary": bool(name_row["is_primary"]),
            "source_ids": [str(source_id) for source_id in name_row["source_ids"] or []],
        }

    identity = None
    if identity_name_rows or identity_slug_rows or external_identifier_rows:
        canonical_slug = next(
            (
                slug_row["slug"]
                for slug_row in identity_slug_rows
                if slug_row["slug_kind"] == "canonical"
            ),
            row["slug"],
        )
        identity = {
            "stable_id": row["id"],
            "canonical_slug": canonical_slug,
            "names": [
                identity_name_payload(name_row)
                for name_row in identity_name_rows
                if name_row["name_kind"] not in alias_kinds
            ],
            "aliases": [
                identity_name_payload(name_row)
                for name_row in identity_name_rows
                if name_row["name_kind"] in alias_kinds
            ],
            "legacy_slugs": [
                {
                    "value": slug_row["slug"],
                    "source_ids": [
                        str(source_id) for source_id in slug_row["source_ids"] or []
                    ],
                }
                for slug_row in identity_slug_rows
                if slug_row["slug_kind"] == "legacy"
            ],
            "external_identifiers": [
                {
                    "system": identifier_row["system"],
                    "value": identifier_row["value"],
                    "source_ids": [
                        str(source_id)
                        for source_id in identifier_row["source_ids"] or []
                    ],
                }
                for identifier_row in external_identifier_rows
            ],
        }

    conclusions = [
        {
            "field": conclusion_row["field_key"],
            "value": conclusion_row["value_json"],
            "status": conclusion_row["status"],
            "last_verified_at": conclusion_row["last_verified_at"],
            "assertion_ids": [
                str(assertion_id) for assertion_id in conclusion_row["assertion_ids"] or []
            ],
            "source_ids": [
                str(source_id) for source_id in conclusion_row["source_ids"] or []
            ],
            "candidate_values": conclusion_row["candidate_values_json"] or [],
            "superseded_values": conclusion_row["superseded_values_json"] or [],
        }
        for conclusion_row in conclusion_rows
    ]
    residencies = [
        {
            "id": residency_row["id"],
            "facility_id": residency_row["facility_id"],
            "coarse_location": residency_row["coarse_location"],
            "residency_type": residency_row["residency_type"],
            "start_date": residency_row["start_date"],
            "start_precision": residency_row["start_precision"],
            "end_date": residency_row["end_date"],
            "end_precision": residency_row["end_precision"],
            "status": residency_row["status"],
            "source_ids": [str(value) for value in residency_row["source_ids"]],
        }
        for residency_row in residency_rows
    ]
    current_residency = next(
        (
            residency
            for residency in reversed(residencies)
            if residency["residency_type"] == "primary"
            and residency["start_date"] <= date.today()
            and (
                residency["end_date"] is None or date.today() < residency["end_date"]
            )
            and residency["status"] in {"confirmed", "confirmed_country_level"}
        ),
        None,
    )
    events = [
        {
            "id": event_row["id"],
            "event_type": event_row["event_type"],
            "event_status": event_row["event_status"],
            "event_date": event_row["event_date"],
            "event_date_precision": event_row["event_date_precision"],
            "participants": sorted(event_row["participants"], key=str),
            "from_facility_id": event_row["from_facility_id"],
            "from_coarse_location": event_row["from_coarse_location"],
            "to_facility_id": event_row["to_facility_id"],
            "to_coarse_location": event_row["to_coarse_location"],
            "source_ids": [str(value) for value in event_row["source_ids"]],
            "changes_current_residency": event_row["event_status"] == "completed",
        }
        for event_row in event_rows
    ]

    cover_image_url = _resolve_public_media_url(row["cover_image_url"])
    if cover_image_url is None:
        cover_image_url = next((asset.signed_url for asset in media if asset.signed_url), None)

    return PandaDetail(
        id=row["id"],
        slug=row["slug"],
        name_zh=row["name_zh"],
        name_en=row["name_en"],
        gender=row["gender"],
        status=row["status"],
        birth_date=row["birth_date"],
        birthplace=row["birthplace"],
        current_location=row["current_location"],
        cover_image_url=cover_image_url,
        intro=row["intro"],
        tags=_normalize_tags(row["tags"]),
        father_id=row["father_id"],
        mother_id=row["mother_id"],
        habitats=habitats,
        media=media,
        identity=identity,
        conclusions=conclusions,
        sources=[dict(source_row) for source_row in source_rows],
        current_place=(
            {
                "facility_id": current_residency["facility_id"],
                "coarse_location": current_residency["coarse_location"],
                "status": current_residency["status"],
            }
            if current_residency
            else None
        ),
        residencies=residencies,
        events=events,
    )


def list_pandas(
    *,
    page: int,
    page_size: int,
    q: str | None,
    status: str | None,
    gender: str | None,
    habitat_id: UUID | None,
    featured: bool | None,
    sort: str,
) -> PaginatedPandasResponse:
    if has_database():
        try:
            return _list_pandas_from_db(
                page=page,
                page_size=page_size,
                q=q,
                status=status,
                gender=gender,
                habitat_id=habitat_id,
                featured=featured,
                sort=sort,
            )
        except SQLAlchemyError as err:
            if not settings.db_use_mock_fallback:
                raise HTTPException(status_code=503, detail="Database unavailable") from err

    return _list_pandas_from_mock(
        page=page,
        page_size=page_size,
        q=q,
        status=status,
        gender=gender,
        habitat_id=habitat_id,
        featured=featured,
        sort=sort,
    )


def resolve_panda_reference(panda_ref: str) -> PandaReference:
    if has_database():
        try:
            return _resolve_public_ref_from_db(panda_ref)
        except SQLAlchemyError as err:
            if not settings.db_use_mock_fallback:
                raise HTTPException(status_code=503, detail="Database unavailable") from err

    return _resolve_public_ref_from_mock(panda_ref)


def get_panda_by_ref(panda_ref: str) -> PandaDetail:
    reference = resolve_panda_reference(panda_ref)

    if has_database():
        try:
            detail = _get_panda_by_id_from_db(reference.id)
            public_record = get_active_public_record("panda", str(reference.id))
            if public_record and public_record.get("_withdrawn") is True:
                raise HTTPException(status_code=404, detail="Panda withdrawn from public release")
            if public_record:
                overlay = {
                    key: value
                    for key, value in public_record.items()
                    if key in PANDA_PUBLIC_REVISION_FIELDS
                }
                return PandaDetail.model_validate(
                    {**detail.model_dump(mode="json"), **overlay}
                )
            return detail
        except SQLAlchemyError as err:
            if not settings.db_use_mock_fallback:
                raise HTTPException(status_code=503, detail="Database unavailable") from err

    return _get_panda_by_id_from_mock(reference.id)


def get_panda_by_id(panda_id: UUID) -> PandaDetail:
    return get_panda_by_ref(str(panda_id))


def _lineage_sort_key(node: PandaLineageNode) -> tuple[str, str]:
    birth = node.birth_date.isoformat() if node.birth_date else "9999-12-31"
    return (birth, node.name_zh)


def _build_lineage_edges(nodes: list[PandaLineageNode]) -> list[PandaLineageEdge]:
    node_ids = {node.id for node in nodes}
    edges: list[PandaLineageEdge] = []
    seen_pairs: set[tuple[UUID, UUID]] = set()

    for node in nodes:
        for parent_id in (node.father_id, node.mother_id):
            if parent_id is None or parent_id not in node_ids:
                continue
            pair = (parent_id, node.id)
            if pair in seen_pairs:
                continue
            seen_pairs.add(pair)
            edges.append(PandaLineageEdge(parent_id=parent_id, child_id=node.id))

    edges.sort(key=lambda edge: (str(edge.parent_id), str(edge.child_id)))
    return edges


def _build_lineage_relationships(
    nodes: list[PandaLineageNode], edges: list[PandaLineageEdge]
) -> list[PandaLineageRelationship]:
    node_ids = {node.id for node in nodes}
    graph = LineageGraph(
        edges=tuple((edge.parent_id, edge.child_id) for edge in edges)
    )
    relationships: list[PandaLineageRelationship] = []
    for subject_id in sorted(node_ids, key=str):
        related_by_kind = (
            ("parent", graph.parents_of(subject_id)),
            ("child", graph.children_of(subject_id)),
            ("sibling", graph.siblings_of(subject_id)),
            ("grandparent", graph.grandparents_of(subject_id)),
        )
        for kind, related_ids in related_by_kind:
            for related_id in related_ids:
                if related_id not in node_ids:
                    continue
                path = graph.relationship_path(subject_id, related_id)
                if path is not None:
                    relationships.append(
                        PandaLineageRelationship(
                            subject_id=subject_id,
                            related_id=related_id,
                            kind=kind,
                            path=list(path),
                        )
                    )
    return relationships


def _get_panda_lineage_from_mock(
    panda_id: UUID, *, ancestor_depth: int, descendant_depth: int
) -> PandaLineageResponse:
    trusted_response = _get_panda_lineage_from_trusted_archive(
        panda_id,
        ancestor_depth=ancestor_depth,
        descendant_depth=descendant_depth,
    )
    if trusted_response is not None:
        return trusted_response

    rows = _all_mock_panda_details()
    by_id = {row.id: row for row in rows}

    focus = by_id.get(panda_id)
    if focus is None:
        raise HTTPException(status_code=404, detail="Panda not found")

    nodes = [
        PandaLineageNode(
            id=focus.id,
            slug=focus.slug,
            name_zh=focus.name_zh,
            name_en=focus.name_en,
            gender=focus.gender,
            status=focus.status,
            birth_date=focus.birth_date,
            current_location=focus.current_location,
            cover_image_url=focus.cover_image_url,
            intro=focus.intro,
            tags=focus.tags,
            father_id=None,
            mother_id=None,
        )
    ]
    edges: list[PandaLineageEdge] = []

    return PandaLineageResponse(
        focus_id=panda_id,
        nodes=nodes,
        edges=edges,
        relationships=_build_lineage_relationships(nodes, edges),
        meta=PandaLineageMeta(
            ancestor_depth=ancestor_depth,
            descendant_depth=descendant_depth,
        ),
    )


def _get_panda_lineage_from_trusted_archive(
    panda_id: UUID,
    *,
    ancestor_depth: int,
    descendant_depth: int,
) -> PandaLineageResponse | None:
    rows = trusted_lineage_pandas()
    by_id = {row["id"]: row for row in rows}
    if panda_id not in by_id:
        return None

    assertions = trusted_parentage_assertions()
    graph = derive_lineage(assertions)
    ancestor_ids: set[UUID] = {panda_id}
    ancestor_queue: list[tuple[UUID, int]] = [(panda_id, 0)]
    while ancestor_queue:
        current_id, depth = ancestor_queue.pop(0)
        if depth >= ancestor_depth:
            continue
        for parent_id in graph.parents_of(current_id):
            if parent_id not in by_id or parent_id in ancestor_ids:
                continue
            ancestor_ids.add(parent_id)
            ancestor_queue.append((parent_id, depth + 1))

    descendant_ids: set[UUID] = {panda_id}
    descendant_queue: list[tuple[UUID, int]] = [(panda_id, 0)]
    while descendant_queue:
        current_id, depth = descendant_queue.pop(0)
        if depth >= descendant_depth:
            continue
        for child_id in graph.children_of(current_id):
            if child_id not in by_id or child_id in descendant_ids:
                continue
            descendant_ids.add(child_id)
            descendant_queue.append((child_id, depth + 1))

    sibling_ids = set(graph.siblings_of(panda_id))
    sibling_parent_ids = set(graph.parents_of(panda_id)) if sibling_ids else set()
    selected_ids = ancestor_ids | descendant_ids | sibling_ids | sibling_parent_ids
    eligible_assertions = [
        assertion
        for assertion in assertions
        if assertion.publication_status == "published"
        and assertion.status == "confirmed"
        and assertion.source_ids
    ]
    father_by_child = {
        assertion.child_id: assertion.parent_id
        for assertion in eligible_assertions
        if assertion.role == "father"
    }
    mother_by_child = {
        assertion.child_id: assertion.parent_id
        for assertion in eligible_assertions
        if assertion.role == "mother"
    }
    nodes = [
        PandaLineageNode(
            **row,
            father_id=father_by_child.get(row_id),
            mother_id=mother_by_child.get(row_id),
        )
        for row_id, row in by_id.items()
        if row_id in selected_ids
    ]
    nodes.sort(key=_lineage_sort_key)
    edges = [
        PandaLineageEdge(parent_id=parent_id, child_id=child_id)
        for parent_id, child_id in graph.edges
        if parent_id in selected_ids and child_id in selected_ids
    ]
    relationships: list[PandaLineageRelationship] = []
    for subject_id in sorted(selected_ids, key=str):
        related_by_kind = (
            ("parent", graph.parents_of(subject_id)),
            ("child", graph.children_of(subject_id)),
            ("sibling", graph.siblings_of(subject_id)),
            ("grandparent", graph.grandparents_of(subject_id)),
        )
        for kind, related_ids in related_by_kind:
            for related_id in related_ids:
                if related_id not in selected_ids:
                    continue
                path = graph.relationship_path(subject_id, related_id)
                if path is None:
                    continue
                relationships.append(
                    PandaLineageRelationship(
                        subject_id=subject_id,
                        related_id=related_id,
                        kind=kind,
                        path=list(path),
                    )
                )
    return PandaLineageResponse(
        focus_id=panda_id,
        nodes=nodes,
        edges=edges,
        relationships=relationships,
        meta=PandaLineageMeta(
            ancestor_depth=ancestor_depth,
            descendant_depth=descendant_depth,
        ),
    )


def _get_panda_lineage_from_db(
    panda_id: UUID, *, ancestor_depth: int, descendant_depth: int
) -> PandaLineageResponse:
    if text is None:
        raise SQLAlchemyError("SQLAlchemy text() unavailable")

    lineage_sql = text(
        """
        with recursive eligible_parentage as (
          select pa.child_id, pa.parent_id, pa.parent_role
          from public.parentage_assertions pa
          where pa.publication_status = 'published'
            and pa.status = 'confirmed'
            and exists (
              select 1
              from public.parentage_assertion_sources pas
              join public.public_evidence_sources public_source
                on public_source.id = pas.source_id
              where pas.assertion_id = pa.id
            )
        ),
        ancestors as (
          select p.id, 0 as depth
          from public.pandas p
          where p.id = :panda_id
          union
          select parent.id, a.depth + 1
          from ancestors a
          join eligible_parentage ep on ep.child_id = a.id
          join public.pandas parent on parent.id = ep.parent_id
          where a.depth < :ancestor_depth
        ),
        descendants as (
          select p.id, 0 as depth
          from public.pandas p
          where p.id = :panda_id
          union
          select child.id, d.depth + 1
          from descendants d
          join eligible_parentage ep on ep.parent_id = d.id
          join public.pandas child on child.id = ep.child_id
          where d.depth < :descendant_depth
        ),
        siblings as (
          select sibling.child_id as id
          from eligible_parentage focus_parent
          join eligible_parentage sibling on sibling.parent_id = focus_parent.parent_id
          where focus_parent.child_id = :panda_id
            and sibling.child_id <> :panda_id
        ),
        sibling_parents as (
          select distinct focus_parent.parent_id as id
          from eligible_parentage focus_parent
          where focus_parent.child_id = :panda_id
            and exists (
              select 1 from siblings
            )
        ),
        selected_ids as (
          select id from ancestors
          union
          select id from descendants
          union
          select id from siblings
          union
          select id from sibling_parents
        )
        select
          p.id,
          p.slug,
          p.name_zh,
          p.name_en,
          p.gender,
          p.status::text as status,
          p.birth_date,
          p.current_location,
          p.intro,
          p.tags,
          (
            select ep.parent_id
            from eligible_parentage ep
            where ep.child_id = p.id and ep.parent_role = 'father'
            order by ep.parent_id
            limit 1
          ) as father_id,
          (
            select ep.parent_id
            from eligible_parentage ep
            where ep.child_id = p.id and ep.parent_role = 'mother'
            order by ep.parent_id
            limit 1
          ) as mother_id,
          cover.cover_image_url
        from public.pandas p
        join selected_ids ids on ids.id = p.id
        left join lateral (
          select m.storage_path as cover_image_url
          from public.panda_media pm
          join public.media_assets m on m.id = pm.media_id
          where pm.panda_id = p.id
          order by pm.is_cover desc, pm.display_order asc, m.created_at asc, m.id asc
          limit 1
        ) cover on true
        """
    )

    with session_scope() as session:
        if session is None:
            raise SQLAlchemyError("Database session unavailable")
        rows = session.execute(
            lineage_sql,
            {
                "panda_id": panda_id,
                "ancestor_depth": ancestor_depth,
                "descendant_depth": descendant_depth,
            },
        ).mappings().all()

    if not rows:
        raise HTTPException(status_code=404, detail="Panda not found")

    nodes = [
        PandaLineageNode(
            id=row["id"],
            slug=row["slug"],
            name_zh=row["name_zh"],
            name_en=row["name_en"],
            gender=row["gender"],
            status=row["status"],
            birth_date=row["birth_date"],
            current_location=row["current_location"],
            cover_image_url=_resolve_public_media_url(row["cover_image_url"]),
            intro=row["intro"],
            tags=_normalize_tags(row["tags"]),
            father_id=row["father_id"],
            mother_id=row["mother_id"],
        )
        for row in rows
    ]
    nodes.sort(key=_lineage_sort_key)
    edges = _build_lineage_edges(nodes)

    return PandaLineageResponse(
        focus_id=panda_id,
        nodes=nodes,
        edges=edges,
        relationships=_build_lineage_relationships(nodes, edges),
        meta=PandaLineageMeta(
            ancestor_depth=ancestor_depth,
            descendant_depth=descendant_depth,
        ),
    )


def get_panda_lineage(
    panda_id: UUID, *, ancestor_depth: int = 6, descendant_depth: int = 6
) -> PandaLineageResponse:
    return get_panda_lineage_by_ref(
        str(panda_id),
        ancestor_depth=ancestor_depth,
        descendant_depth=descendant_depth,
    )


def get_panda_lineage_by_ref(
    panda_ref: str, *, ancestor_depth: int = 6, descendant_depth: int = 6
) -> PandaLineageResponse:
    reference = resolve_panda_reference(panda_ref)

    if has_database():
        try:
            return _get_panda_lineage_from_db(
                reference.id,
                ancestor_depth=ancestor_depth,
                descendant_depth=descendant_depth,
            )
        except SQLAlchemyError as err:
            if not settings.db_use_mock_fallback:
                raise HTTPException(status_code=503, detail="Database unavailable") from err

    return _get_panda_lineage_from_mock(
        reference.id,
        ancestor_depth=ancestor_depth,
        descendant_depth=descendant_depth,
    )

