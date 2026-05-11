import json
from dataclasses import dataclass
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
from app.data.mock_data import MOCK_PANDAS
from app.db.session import has_database, session_scope
from app.schemas.panda import (
    HabitatSummary,
    MediaAsset,
    PaginatedPandasResponse,
    PaginationMeta,
    PandaDetail,
    PandaLineageEdge,
    PandaLineageMeta,
    PandaLineageNode,
    PandaLineageResponse,
    PandaListItem,
)


@dataclass(frozen=True)
class PandaReference:
    id: UUID
    slug: str


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
    rows = [PandaDetail.model_validate(item) for item in MOCK_PANDAS]

    if q:
        lowered = q.lower().strip()
        rows = [
            row
            for row in rows
            if lowered in row.name_zh.lower()
            or (row.name_en and lowered in row.name_en.lower())
            or any(lowered in tag.lower() for tag in row.tags)
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
    for item in MOCK_PANDAS:
        detail = PandaDetail.model_validate(item)
        if detail.id == panda_id:
            return detail

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
        "name_asc": "p.name_zh asc",
        "name_desc": "p.name_zh desc",
        "birth_date_desc": "p.birth_date desc nulls last",
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
    uuid_ref = _try_parse_uuid(normalized)

    for item in MOCK_PANDAS:
        detail = PandaDetail.model_validate(item)
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

    if q_like:
        where_clauses.append(
            """
            (
              p.name_zh ilike :q_like
              or coalesce(p.name_en, '') ilike :q_like
              or exists (
                select 1 from unnest(coalesce(p.tags, '{}'::text[])) as tag
                where tag ilike :q_like
              )
            )
            """
        )
        params["q_like"] = q_like

    if status:
        where_clauses.append("p.status::text = :status")
        params["status"] = status

    if gender:
        where_clauses.append("p.gender = :gender")
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
        where_clauses.append("p.is_featured = :featured")
        params["featured"] = featured

    sql = text(
        f"""
        select
          p.id,
          p.slug,
          p.name_zh,
          p.name_en,
          p.gender,
          p.status::text as status,
          p.birth_date,
          p.current_location,
          p.tags,
          p.is_featured,
          cover.cover_image_url
        from public.pandas p
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
        select count(*) as total
        from public.pandas p
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
            name_zh=row["name_zh"],
            name_en=row["name_en"],
            gender=row["gender"],
            status=row["status"],
            birth_date=row["birth_date"],
            current_location=row["current_location"],
            cover_image_url=_resolve_public_media_url(row["cover_image_url"]),
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
                select p.id, p.slug
                from public.pandas p
                where p.slug = :panda_slug
                limit 1
                """
            ),
            {"panda_slug": normalized},
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
          p.slug,
          p.name_zh,
          p.name_en,
          p.gender,
          p.status::text as status,
          p.birth_date,
          p.birthplace,
          p.current_location,
          p.intro,
          p.tags,
          p.father_id,
          p.mother_id,
          cover.cover_image_url
        from public.pandas p
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

    with session_scope() as session:
        if session is None:
            raise SQLAlchemyError("Database session unavailable")

        row = session.execute(panda_sql, {"panda_id": panda_id}).mappings().first()
        if row is None:
            raise HTTPException(status_code=404, detail="Panda not found")

        habitat_rows = session.execute(habitat_sql, {"panda_id": panda_id}).mappings().all()
        media_rows = session.execute(media_sql, {"panda_id": panda_id}).mappings().all()

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
            return _get_panda_by_id_from_db(reference.id)
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


def _get_panda_lineage_from_mock(
    panda_id: UUID, *, ancestor_depth: int, descendant_depth: int
) -> PandaLineageResponse:
    rows = [PandaDetail.model_validate(item) for item in MOCK_PANDAS]
    by_id = {row.id: row for row in rows}

    focus = by_id.get(panda_id)
    if focus is None:
        raise HTTPException(status_code=404, detail="Panda not found")

    children_by_parent: dict[UUID, list[UUID]] = {}
    for row in rows:
        for parent_id in (row.father_id, row.mother_id):
            if parent_id is None:
                continue
            children_by_parent.setdefault(parent_id, []).append(row.id)

    ancestor_ids: set[UUID] = {panda_id}
    ancestor_queue: list[tuple[UUID, int]] = [(panda_id, 0)]
    while ancestor_queue:
        current_id, depth = ancestor_queue.pop(0)
        if depth >= ancestor_depth:
            continue
        current = by_id.get(current_id)
        if current is None:
            continue
        for parent_id in (current.father_id, current.mother_id):
            if parent_id is None or parent_id not in by_id or parent_id in ancestor_ids:
                continue
            ancestor_ids.add(parent_id)
            ancestor_queue.append((parent_id, depth + 1))

    descendant_ids: set[UUID] = {panda_id}
    descendant_queue: list[tuple[UUID, int]] = [(panda_id, 0)]
    while descendant_queue:
        current_id, depth = descendant_queue.pop(0)
        if depth >= descendant_depth:
            continue
        for child_id in children_by_parent.get(current_id, []):
            if child_id in descendant_ids:
                continue
            descendant_ids.add(child_id)
            descendant_queue.append((child_id, depth + 1))

    selected_ids = ancestor_ids | descendant_ids
    nodes = [
        PandaLineageNode(
            id=row.id,
            slug=row.slug,
            name_zh=row.name_zh,
            name_en=row.name_en,
            gender=row.gender,
            status=row.status,
            birth_date=row.birth_date,
            current_location=row.current_location,
            cover_image_url=row.cover_image_url,
            intro=row.intro,
            tags=row.tags,
            father_id=row.father_id,
            mother_id=row.mother_id,
        )
        for row_id, row in by_id.items()
        if row_id in selected_ids
    ]
    nodes.sort(key=_lineage_sort_key)
    edges = _build_lineage_edges(nodes)

    return PandaLineageResponse(
        focus_id=panda_id,
        nodes=nodes,
        edges=edges,
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
        with recursive ancestors as (
          select p.id, 0 as depth
          from public.pandas p
          where p.id = :panda_id
          union
          select parent.id, a.depth + 1
          from ancestors a
          join public.pandas child on child.id = a.id
          join public.pandas parent
            on parent.id = child.father_id
            or parent.id = child.mother_id
          where a.depth < :ancestor_depth
        ),
        descendants as (
          select p.id, 0 as depth
          from public.pandas p
          where p.id = :panda_id
          union
          select child.id, d.depth + 1
          from descendants d
          join public.pandas child
            on child.father_id = d.id
            or child.mother_id = d.id
          where d.depth < :descendant_depth
        ),
        selected_ids as (
          select id from ancestors
          union
          select id from descendants
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
          p.father_id,
          p.mother_id,
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

