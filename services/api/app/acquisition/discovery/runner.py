from __future__ import annotations

from collections import Counter, defaultdict
from collections.abc import Mapping
from hashlib import sha256
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from app.acquisition.contracts import canonical_json_bytes
from app.knowledge.contracts import SourceAssessment, SourceEvidence

from .contracts import (
    DiscoveryInventory,
    DiscoveryInventoryItem,
    DiscoveryManifest,
    DiscoveryManifestEntry,
    DiscoveryMaterialEvent,
    DiscoveryPolicyState,
    DiscoveryRunRequest,
    DiscoveryRunResult,
    DiscoveryRunState,
    DiscoveryStopEvent,
    DiscoveryStopRecord,
    DiscoverySummary,
    MaterialChangeState,
)

_TRACKING_QUERY_KEYS = frozenset(
    {
        "fbclid",
        "gclid",
        "mc_cid",
        "mc_eid",
        "ref",
        "ref_src",
    }
)


def run_discovery(
    request: DiscoveryRunRequest,
    *,
    baseline: DiscoveryInventory | None = None,
    known_source_hosts: Mapping[str, str] | None = None,
) -> DiscoveryRunResult:
    known_hosts = {
        host.casefold(): source_id for host, source_id in (known_source_hosts or {}).items()
    }
    baseline_by_key = {
        item.source_key: item for item in (baseline.items if baseline is not None else ())
    }
    query_order = {query.query_id: index for index, query in enumerate(request.queries)}

    material_events = tuple(
        event for event in request.events if isinstance(event, DiscoveryMaterialEvent)
    )
    stop_events = tuple(event for event in request.events if isinstance(event, DiscoveryStopEvent))

    grouped: dict[str, list[DiscoveryMaterialEvent]] = defaultdict(list)
    raw_urls: dict[str, set[str]] = defaultdict(set)
    first_position: dict[str, tuple[int, int, str]] = {}
    for event in material_events:
        canonical_url = canonicalize_discovery_url(str(event.url))
        source_key = _stable_id("source", canonical_url)
        grouped[source_key].append(event)
        raw_urls[source_key].add(str(event.url))
        position = (query_order[event.query_id], event.sequence, str(event.url))
        first_position[source_key] = min(position, first_position.get(source_key, position))

    current_items: dict[str, DiscoveryInventoryItem] = {}
    representatives: dict[str, DiscoveryMaterialEvent] = {}
    for source_key, events in grouped.items():
        hashes = {event.content_sha256 for event in events}
        if len(hashes) != 1:
            raise ValueError("one canonical URL produced multiple content hashes in one run")
        ordered = sorted(
            events,
            key=lambda event: (
                query_order[event.query_id],
                event.sequence,
                str(event.url),
            ),
        )
        representative = ordered[0]
        representatives[source_key] = representative
        canonical_url = canonicalize_discovery_url(str(representative.url))
        host = urlsplit(canonical_url).hostname or ""
        known_source_id = known_hosts.get(host.casefold())
        current_items[source_key] = DiscoveryInventoryItem(
            source_key=source_key,
            query_ids=tuple(sorted({event.query_id for event in events})),
            canonical_url=canonical_url,
            content_sha256=representative.content_sha256,
            title=representative.title,
            publisher=representative.publisher,
            language=representative.language,
            source_kind=representative.source_kind,
            is_first_hand=representative.is_first_hand,
            access_basis=representative.access_basis,
            publication_date=representative.publication_date,
            last_collected_at=max(event.collected_at for event in events),
            body_bytes=representative.body_bytes,
            content_type=representative.content_type,
            snapshot_reference=representative.snapshot_reference,
            known_source_id=known_source_id,
        )

    representative_by_content: dict[str, str] = {}
    for source_key in sorted(current_items, key=lambda key: first_position[key]):
        content_hash = current_items[source_key].content_sha256
        representative_by_content.setdefault(content_hash, source_key)

    entries: list[DiscoveryManifestEntry] = []
    for source_key, item in current_items.items():
        previous = baseline_by_key.get(source_key)
        if previous is None:
            change_state = MaterialChangeState.NEW
            previous_hash = None
        elif previous.content_sha256 == item.content_sha256:
            change_state = MaterialChangeState.UNCHANGED
            previous_hash = previous.content_sha256
        else:
            change_state = MaterialChangeState.CHANGED
            previous_hash = previous.content_sha256

        event = representatives[source_key]
        is_content_representative = representative_by_content[item.content_sha256] == source_key
        should_intake = (
            change_state in {MaterialChangeState.NEW, MaterialChangeState.CHANGED}
            and is_content_representative
        )
        source_assessment = _source_assessment(item)
        source = SourceEvidence(
            source_id=item.known_source_id or source_key,
            kind=item.source_kind,
            access_basis=item.access_basis,
            publisher=item.publisher,
            title=item.title,
            url=item.canonical_url,
            original_language=item.language,
            captured_at=item.last_collected_at,
            is_first_hand=item.is_first_hand,
            assessment=source_assessment,
        )
        entries.append(
            DiscoveryManifestEntry(
                source_key=source_key,
                query_ids=item.query_ids,
                change_state=change_state,
                canonical_url=item.canonical_url,
                observed_urls=tuple(sorted(raw_urls[source_key])),
                content_sha256=item.content_sha256,
                previous_content_sha256=previous_hash,
                content_group_id=_stable_id("content", item.content_sha256),
                is_content_representative=is_content_representative,
                intake_candidate_id=(
                    _stable_id(
                        "candidate",
                        {"canonical_url": item.canonical_url, "sha256": item.content_sha256},
                    )
                    if should_intake
                    else None
                ),
                source=source,
                publication_date=item.publication_date,
                collected_at=item.last_collected_at,
                body_bytes=item.body_bytes,
                content_type=item.content_type,
                snapshot_reference=item.snapshot_reference,
                policy_state=DiscoveryPolicyState.CLEAR,
                known_source_id=item.known_source_id,
            )
        )

    preserved_baseline: dict[str, DiscoveryInventoryItem] = {}
    current_query_ids = set(query_order)
    stopped_query_ids = {event.query_id for event in stop_events}
    for source_key, item in baseline_by_key.items():
        if source_key in current_items:
            continue
        baseline_query_ids = set(item.query_ids)
        removal_scope_complete = baseline_query_ids.issubset(current_query_ids) and not (
            baseline_query_ids & stopped_query_ids
        )
        if not removal_scope_complete:
            preserved_baseline[source_key] = item
            continue
        source_assessment = _source_assessment(item)
        entries.append(
            DiscoveryManifestEntry(
                source_key=source_key,
                query_ids=item.query_ids,
                change_state=MaterialChangeState.REMOVED,
                canonical_url=item.canonical_url,
                observed_urls=(item.canonical_url,),
                content_sha256=item.content_sha256,
                previous_content_sha256=item.content_sha256,
                content_group_id=_stable_id("content", item.content_sha256),
                is_content_representative=False,
                intake_candidate_id=None,
                source=SourceEvidence(
                    source_id=item.known_source_id or source_key,
                    kind=item.source_kind,
                    access_basis=item.access_basis,
                    publisher=item.publisher,
                    title=item.title,
                    url=item.canonical_url,
                    original_language=item.language,
                    captured_at=item.last_collected_at,
                    is_first_hand=item.is_first_hand,
                    assessment=source_assessment,
                ),
                publication_date=item.publication_date,
                collected_at=item.last_collected_at,
                body_bytes=item.body_bytes,
                content_type=item.content_type,
                snapshot_reference=item.snapshot_reference,
                policy_state=DiscoveryPolicyState.CLEAR,
                known_source_id=item.known_source_id,
            )
        )

    ordered_stops = tuple(
        DiscoveryStopRecord(
            query_id=event.query_id,
            sequence=event.sequence,
            url=str(event.url),
            access_basis=event.access_basis,
            collected_at=event.collected_at,
            policy_state=event.policy_state,
            http_status=event.http_status,
            detail=event.detail,
        )
        for event in sorted(
            stop_events,
            key=lambda event: (query_order[event.query_id], event.sequence, str(event.url)),
        )
    )
    run_state = DiscoveryRunState.STOPPED if ordered_stops else DiscoveryRunState.COMPLETED
    counts = Counter(entry.change_state for entry in entries)
    summary = DiscoverySummary(
        query_count=len(request.queries),
        entry_count=len(entries),
        new_count=counts[MaterialChangeState.NEW],
        changed_count=counts[MaterialChangeState.CHANGED],
        removed_count=counts[MaterialChangeState.REMOVED],
        unchanged_count=counts[MaterialChangeState.UNCHANGED],
        unknown_source_count=sum(entry.known_source_id is None for entry in entries),
        intake_candidate_count=sum(entry.intake_candidate_id is not None for entry in entries),
        stop_count=len(ordered_stops),
        languages=tuple(sorted({query.language for query in request.queries})),
    )
    ordered_entries = tuple(sorted(entries, key=lambda entry: entry.canonical_url))
    manifest_payload = {
        "schema_version": "panda-atlas-discovery-intake/v1",
        "state": run_state.value,
        "entries": [entry.model_dump(mode="json") for entry in ordered_entries],
        "stops": [stop.model_dump(mode="json") for stop in ordered_stops],
        "summary": summary.model_dump(mode="json"),
    }
    manifest = DiscoveryManifest(
        manifest_id=_stable_id("manifest", manifest_payload),
        run_id=request.run_id,
        created_at=request.created_at,
        state=run_state,
        entries=ordered_entries,
        stops=ordered_stops,
        summary=summary,
    )
    inventory_by_key = {**preserved_baseline, **current_items}
    inventory = DiscoveryInventory(
        items=tuple(sorted(inventory_by_key.values(), key=lambda item: item.canonical_url))
    )
    return DiscoveryRunResult(manifest=manifest, inventory=inventory)


def _source_assessment(item: DiscoveryInventoryItem) -> SourceAssessment:
    if item.known_source_id is not None:
        return SourceAssessment(rationale=("known-source-registry-match-unscored",))
    return SourceAssessment()


def canonicalize_discovery_url(url: str) -> str:
    parsed = urlsplit(url)
    if parsed.scheme.casefold() != "https" or not parsed.hostname:
        raise ValueError("discovery material URLs must use HTTPS")
    if parsed.username is not None or parsed.password is not None:
        raise ValueError("discovery material URLs cannot contain credentials")
    hostname = parsed.hostname.casefold()
    port = parsed.port
    if port not in {None, 443}:
        raise ValueError("discovery material URLs cannot use non-HTTPS ports")
    netloc = hostname
    path = parsed.path or "/"
    if path != "/":
        path = path.rstrip("/")
    filtered_query = []
    for key, value in parse_qsl(parsed.query, keep_blank_values=True):
        normalized_key = key.casefold()
        if normalized_key.startswith("utm_") or normalized_key in _TRACKING_QUERY_KEYS:
            continue
        filtered_query.append((key, value))
    query = urlencode(sorted(filtered_query))
    return urlunsplit(("https", netloc, path, query, ""))


def _stable_id(prefix: str, value: object) -> str:
    payload = value if isinstance(value, dict) else {"value": value}
    return f"{prefix}-{sha256(canonical_json_bytes(payload)).hexdigest()}"
