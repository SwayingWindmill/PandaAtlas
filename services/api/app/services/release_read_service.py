from __future__ import annotations

from datetime import date
from uuid import UUID

from fastapi import HTTPException

from app.schemas.map import (
    DistributionFeatureCollection,
    DistributionSnapshotList,
    HabitatFeatureCollection,
)
from app.schemas.panda import (
    PaginatedPandasResponse,
    PaginationMeta,
    PandaDetail,
    PandaLineageMeta,
    PandaLineageNode,
    PandaLineageResponse,
    PandaListItem,
)
from app.schemas.stats import OverviewStats
from app.services.map_service import (
    HABITAT_FEATURE_LIMIT,
    _distribution_feature_limit,
    _geometry_intersects_bbox,
    _parse_bbox,
)
from app.services.panda_service import (
    _build_lineage_edges,
    _build_lineage_relationships,
    _lineage_sort_key,
)
from app.services.release_service import get_current_api_release


def _pandas() -> list[PandaDetail]:
    payload = get_current_api_release()
    return [PandaDetail.model_validate(item) for item in payload.get("pandas", [])]


def _matches_reference(detail: PandaDetail, reference: str) -> bool:
    normalized = reference.strip().lower()
    references = {str(detail.id).lower(), detail.slug.lower()}
    if detail.identity:
        references.add(detail.identity.canonical_slug.lower())
        references.update(item.value.lower() for item in detail.identity.legacy_slugs)
        references.update(item.value.lower() for item in detail.identity.external_identifiers)
        references.update(
            f"{item.system}:{item.value}".lower()
            for item in detail.identity.external_identifiers
        )
    return normalized in references


def list_release_pandas(
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
    rows = _pandas()
    if q:
        normalized = q.strip().lower()
        rows = [
            row
            for row in rows
            if normalized in row.name_zh.lower()
            or bool(row.name_en and normalized in row.name_en.lower())
            or any(normalized in term.lower() for term in row.search_terms)
            or _matches_reference(row, q)
        ]
    if status:
        rows = [row for row in rows if row.status == status]
    if gender:
        rows = [row for row in rows if row.gender == gender]
    if habitat_id is not None:
        rows = [
            row for row in rows if any(item.id == habitat_id for item in row.habitats)
        ]
    if featured is not None:
        rows = [row for row in rows if ("featured" in row.tags) is featured]
    if sort == "name_asc":
        rows.sort(key=lambda item: item.name_zh)
    elif sort == "name_desc":
        rows.sort(key=lambda item: item.name_zh, reverse=True)
    elif sort == "birth_date_desc":
        rows.sort(key=lambda item: item.birth_date or date.min, reverse=True)
    else:
        rows.sort(key=lambda item: str(item.id), reverse=True)
    total = len(rows)
    start = (page - 1) * page_size
    return PaginatedPandasResponse(
        items=[
            PandaListItem.model_validate(item.model_dump())
            for item in rows[start : start + page_size]
        ],
        meta=PaginationMeta(page=page, page_size=page_size, total=total),
    )


def get_release_panda(reference: str) -> PandaDetail:
    for detail in _pandas():
        if _matches_reference(detail, reference):
            return detail
    raise HTTPException(status_code=404, detail="Panda not found in current public release")


def get_release_lineage(
    reference: str, *, ancestor_depth: int, descendant_depth: int
) -> PandaLineageResponse:
    rows = _pandas()
    focus = next((row for row in rows if _matches_reference(row, reference)), None)
    if focus is None:
        raise HTTPException(status_code=404, detail="Panda not found in current public release")
    by_id = {row.id: row for row in rows}
    children: dict[UUID, set[UUID]] = {}
    for row in rows:
        for parent_id in (row.father_id, row.mother_id):
            if parent_id in by_id:
                children.setdefault(parent_id, set()).add(row.id)
    selected = {focus.id}
    queue = [(focus.id, 0)]
    while queue:
        item_id, depth = queue.pop(0)
        if depth >= ancestor_depth:
            continue
        for parent_id in (by_id[item_id].father_id, by_id[item_id].mother_id):
            if parent_id in by_id and parent_id not in selected:
                selected.add(parent_id)
                queue.append((parent_id, depth + 1))
    queue = [(focus.id, 0)]
    while queue:
        item_id, depth = queue.pop(0)
        if depth >= descendant_depth:
            continue
        for child_id in children.get(item_id, set()):
            if child_id not in selected:
                selected.add(child_id)
                queue.append((child_id, depth + 1))
    for parent_id in (focus.father_id, focus.mother_id):
        if parent_id in by_id:
            selected.add(parent_id)
            selected.update(children.get(parent_id, set()))
    nodes = [
        PandaLineageNode.model_validate(row.model_dump())
        for row in rows
        if row.id in selected
    ]
    nodes.sort(key=_lineage_sort_key)
    edges = _build_lineage_edges(nodes)
    return PandaLineageResponse(
        focus_id=focus.id,
        nodes=nodes,
        edges=edges,
        relationships=_build_lineage_relationships(nodes, edges),
        meta=PandaLineageMeta(
            ancestor_depth=ancestor_depth, descendant_depth=descendant_depth
        ),
    )


def get_release_distribution(
    *, bbox: str, snapshot_date: date | None, layer: str | None, zoom: int | None
) -> DistributionFeatureCollection:
    parsed_bbox = _parse_bbox(bbox)
    payload = get_current_api_release()
    features = []
    for feature in payload.get("distribution", {}).get("features", []):
        properties = feature.get("properties", {})
        if layer and properties.get("layer") != layer:
            continue
        if snapshot_date and properties.get("snapshot_date") != snapshot_date.isoformat():
            continue
        if not _geometry_intersects_bbox(feature.get("geometry"), parsed_bbox):
            continue
        features.append(feature)
    limit = _distribution_feature_limit(zoom)
    return DistributionFeatureCollection.model_validate(
        {
            "type": "FeatureCollection",
            "features": features[:limit],
            "meta": {
                "truncated": len(features) > limit,
                "limit": limit,
                "requested_zoom": zoom,
            },
        }
    )


def get_release_habitats(*, bbox: str | None, level: str | None) -> HabitatFeatureCollection:
    parsed_bbox = _parse_bbox(bbox) if bbox else None
    payload = get_current_api_release()
    features = []
    for feature in payload.get("habitats", {}).get("features", []):
        if level and feature.get("properties", {}).get("level") != level:
            continue
        if not _geometry_intersects_bbox(feature.get("geometry"), parsed_bbox):
            continue
        features.append(feature)
    return HabitatFeatureCollection.model_validate(
        {
            "type": "FeatureCollection",
            "features": features[:HABITAT_FEATURE_LIMIT],
            "meta": {
                "truncated": len(features) > HABITAT_FEATURE_LIMIT,
                "limit": HABITAT_FEATURE_LIMIT,
                "requested_zoom": None,
            },
        }
    )


def list_release_snapshots(limit: int) -> DistributionSnapshotList:
    payload = get_current_api_release()
    return DistributionSnapshotList.model_validate(
        {"items": list(payload.get("snapshots", []))[:limit]}
    )


def get_release_stats() -> OverviewStats:
    stats = get_current_api_release().get("stats")
    if stats is None:
        raise HTTPException(status_code=503, detail="Overview stats were withdrawn")
    return OverviewStats.model_validate(stats)
