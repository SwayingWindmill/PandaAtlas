from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.acquisition.discovery import (
    INVENTORY_FILENAME,
    MANIFEST_FILENAME,
    DiscoveryMaterialEvent,
    DiscoveryPolicyState,
    DiscoveryProviderRegistry,
    DiscoveryQuery,
    DiscoveryRunRequest,
    DiscoveryRunState,
    DiscoveryStopEvent,
    MaterialChangeState,
    canonicalize_discovery_url,
    run_discovery,
    run_discovery_providers,
    write_discovery_artifacts,
)
from app.knowledge.contracts import SourceAccessBasis, SourceKind


def _public_query(query_id: str = "query-en") -> DiscoveryQuery:
    return DiscoveryQuery(
        query_id=query_id,
        text="giant panda profile",
        language="en",
        provider_id="public-search",
        access_basis=SourceAccessBasis.PUBLIC,
    )


def _material(
    *,
    url: str,
    content_sha256: str,
    sequence: int,
    collected_at: datetime,
    query_id: str = "query-en",
) -> DiscoveryMaterialEvent:
    return DiscoveryMaterialEvent(
        query_id=query_id,
        sequence=sequence,
        url=url,
        title=f"Profile {sequence}",
        publisher="Example Publisher",
        language="en",
        source_kind=SourceKind.MAINSTREAM_MEDIA,
        is_first_hand=False,
        access_basis=SourceAccessBasis.PUBLIC,
        collected_at=collected_at,
        content_sha256=content_sha256,
        body_bytes=1000 + sequence,
        content_type="text/html",
        policy_state=DiscoveryPolicyState.CLEAR,
        http_status=200,
    )


def test_bulk_multilingual_run_discovers_unknown_sources_and_deduplicates_material() -> None:
    collected_at = datetime(2026, 7, 23, 8, 0, tzinfo=UTC)
    queries = (
        DiscoveryQuery(
            query_id="query-zh",
            text="大熊猫 最新 档案",
            language="zh-CN",
            provider_id="public-search",
            access_basis=SourceAccessBasis.PUBLIC,
        ),
        DiscoveryQuery(
            query_id="query-en",
            text="giant panda profile",
            language="en",
            provider_id="public-search",
            access_basis=SourceAccessBasis.PUBLIC,
        ),
        DiscoveryQuery(
            query_id="query-ja",
            text="ジャイアントパンダ 個体情報",
            language="ja",
            provider_id="public-search",
            access_basis=SourceAccessBasis.PUBLIC,
        ),
        DiscoveryQuery(
            query_id="query-ko",
            text="자이언트판다 개체 정보",
            language="ko",
            provider_id="public-search",
            access_basis=SourceAccessBasis.PUBLIC,
        ),
        DiscoveryQuery(
            query_id="query-es",
            text="panda gigante zoológico",
            language="es",
            provider_id="public-search",
            access_basis=SourceAccessBasis.PUBLIC,
        ),
    )
    events = (
        DiscoveryMaterialEvent(
            query_id="query-zh",
            sequence=1,
            url="https://unknown.example.cn/pandas/xing-xing?utm_source=search",
            title="大熊猫星星档案",
            publisher="未知熊猫资料站",
            language="zh-CN",
            source_kind=SourceKind.MATURE_DATABASE,
            is_first_hand=False,
            access_basis=SourceAccessBasis.PUBLIC,
            collected_at=collected_at,
            content_sha256="a" * 64,
            body_bytes=1200,
            content_type="text/html",
            policy_state=DiscoveryPolicyState.CLEAR,
            http_status=200,
        ),
        DiscoveryMaterialEvent(
            query_id="query-en",
            sequence=1,
            url="https://unknown.example.cn/pandas/xing-xing?utm_medium=referral",
            title="Xing Xing panda profile",
            publisher="Unknown Panda Database",
            language="en",
            source_kind=SourceKind.MATURE_DATABASE,
            is_first_hand=False,
            access_basis=SourceAccessBasis.PUBLIC,
            collected_at=collected_at,
            content_sha256="a" * 64,
            body_bytes=1200,
            content_type="text/html",
            policy_state=DiscoveryPolicyState.CLEAR,
            http_status=200,
        ),
        DiscoveryMaterialEvent(
            query_id="query-ja",
            sequence=1,
            url="https://archive.example.jp/panda/xing-xing",
            title="星星の個体記録",
            publisher="Example Archive",
            language="ja",
            source_kind=SourceKind.RESEARCH,
            is_first_hand=False,
            access_basis=SourceAccessBasis.PUBLIC,
            collected_at=collected_at,
            content_sha256="a" * 64,
            body_bytes=1200,
            content_type="text/html",
            policy_state=DiscoveryPolicyState.CLEAR,
            http_status=200,
        ),
        DiscoveryMaterialEvent(
            query_id="query-ko",
            sequence=1,
            url="https://zoo.example.kr/news/panda-42",
            title="판다 42 소식",
            publisher="Example Zoo Korea",
            language="ko",
            source_kind=SourceKind.OFFICIAL_INSTITUTION,
            is_first_hand=True,
            access_basis=SourceAccessBasis.PUBLIC,
            collected_at=collected_at,
            content_sha256="b" * 64,
            body_bytes=900,
            content_type="text/html",
            policy_state=DiscoveryPolicyState.CLEAR,
            http_status=200,
        ),
        DiscoveryMaterialEvent(
            query_id="query-es",
            sequence=1,
            url="https://zoo.example.es/animales/panda-43",
            title="Ficha del panda 43",
            publisher="Example Zoo España",
            language="es",
            source_kind=SourceKind.OFFICIAL_INSTITUTION,
            is_first_hand=True,
            access_basis=SourceAccessBasis.PUBLIC,
            collected_at=collected_at,
            content_sha256="c" * 64,
            body_bytes=800,
            content_type="text/html",
            policy_state=DiscoveryPolicyState.CLEAR,
            http_status=200,
        ),
    )
    request = DiscoveryRunRequest(
        run_id="discovery-run-multilingual",
        created_at=collected_at,
        queries=queries,
        events=events,
    )

    result = run_discovery(
        request,
        known_source_hosts={"zoo.example.kr": "known-korean-zoo"},
    )

    assert len(result.manifest.entries) == 4
    assert {entry.change_state for entry in result.manifest.entries} == {MaterialChangeState.NEW}
    assert result.manifest.summary.languages == ("en", "es", "ja", "ko", "zh-CN")
    assert result.manifest.summary.unknown_source_count == 3
    assert result.manifest.summary.intake_candidate_count == 3

    unknown_entry = next(
        entry
        for entry in result.manifest.entries
        if entry.canonical_url == "https://unknown.example.cn/pandas/xing-xing"
    )
    assert unknown_entry.source.assessment.confidence.value == "low"
    assert unknown_entry.observed_urls == (
        "https://unknown.example.cn/pandas/xing-xing?utm_medium=referral",
        "https://unknown.example.cn/pandas/xing-xing?utm_source=search",
    )

    duplicate_entry = next(
        entry
        for entry in result.manifest.entries
        if entry.canonical_url == "https://archive.example.jp/panda/xing-xing"
    )
    assert duplicate_entry.content_group_id == unknown_entry.content_group_id
    assert duplicate_entry.is_content_representative is False
    assert duplicate_entry.intake_candidate_id is None

    known_entry = next(
        entry for entry in result.manifest.entries if entry.known_source_id == "known-korean-zoo"
    )
    assert known_entry.source.assessment.confidence.value == "low"
    assert known_entry.source.assessment.rationale == ("known-source-registry-match-unscored",)


def test_repeated_runs_identify_new_changed_removed_and_unchanged_material() -> None:
    first_collected_at = datetime(2026, 7, 23, 9, 0, tzinfo=UTC)
    first = run_discovery(
        DiscoveryRunRequest(
            run_id="discovery-run-first",
            created_at=first_collected_at,
            queries=(_public_query(),),
            events=(
                _material(
                    url="https://example.org/pandas/unchanged",
                    content_sha256="1" * 64,
                    sequence=1,
                    collected_at=first_collected_at,
                ),
                _material(
                    url="https://example.org/pandas/changed",
                    content_sha256="2" * 64,
                    sequence=2,
                    collected_at=first_collected_at,
                ),
                _material(
                    url="https://example.org/pandas/removed",
                    content_sha256="3" * 64,
                    sequence=3,
                    collected_at=first_collected_at,
                ),
            ),
        )
    )

    second_collected_at = datetime(2026, 7, 24, 9, 0, tzinfo=UTC)
    second = run_discovery(
        DiscoveryRunRequest(
            run_id="discovery-run-second",
            created_at=second_collected_at,
            queries=(_public_query(),),
            events=(
                _material(
                    url="https://example.org/pandas/unchanged",
                    content_sha256="1" * 64,
                    sequence=1,
                    collected_at=second_collected_at,
                ),
                _material(
                    url="https://example.org/pandas/changed",
                    content_sha256="4" * 64,
                    sequence=2,
                    collected_at=second_collected_at,
                ),
                _material(
                    url="https://example.org/pandas/new",
                    content_sha256="5" * 64,
                    sequence=3,
                    collected_at=second_collected_at,
                ),
            ),
        ),
        baseline=first.inventory,
    )

    states = {entry.canonical_url: entry.change_state for entry in second.manifest.entries}
    assert states == {
        "https://example.org/pandas/changed": MaterialChangeState.CHANGED,
        "https://example.org/pandas/new": MaterialChangeState.NEW,
        "https://example.org/pandas/removed": MaterialChangeState.REMOVED,
        "https://example.org/pandas/unchanged": MaterialChangeState.UNCHANGED,
    }
    assert second.manifest.summary.intake_candidate_count == 2
    assert {item.canonical_url for item in second.inventory.items} == {
        "https://example.org/pandas/changed",
        "https://example.org/pandas/new",
        "https://example.org/pandas/unchanged",
    }

    changed = next(
        entry
        for entry in second.manifest.entries
        if entry.change_state is MaterialChangeState.CHANGED
    )
    removed = next(
        entry
        for entry in second.manifest.entries
        if entry.change_state is MaterialChangeState.REMOVED
    )
    unchanged = next(
        entry
        for entry in second.manifest.entries
        if entry.change_state is MaterialChangeState.UNCHANGED
    )
    assert changed.previous_content_sha256 == "2" * 64
    assert removed.intake_candidate_id is None
    assert unchanged.intake_candidate_id is None

    third_collected_at = datetime(2026, 7, 25, 9, 0, tzinfo=UTC)
    third = run_discovery(
        DiscoveryRunRequest(
            run_id="discovery-run-third",
            created_at=third_collected_at,
            queries=(_public_query(),),
            events=(
                _material(
                    url="https://example.org/pandas/unchanged",
                    content_sha256="1" * 64,
                    sequence=1,
                    collected_at=third_collected_at,
                ),
                _material(
                    url="https://example.org/pandas/changed",
                    content_sha256="4" * 64,
                    sequence=2,
                    collected_at=third_collected_at,
                ),
                _material(
                    url="https://example.org/pandas/new",
                    content_sha256="5" * 64,
                    sequence=3,
                    collected_at=third_collected_at,
                ),
            ),
        ),
        baseline=second.inventory,
    )

    assert {entry.change_state for entry in third.manifest.entries} == {
        MaterialChangeState.UNCHANGED
    }
    assert third.manifest.summary.intake_candidate_count == 0


@pytest.mark.parametrize(
    ("policy_state", "http_status"),
    (
        (DiscoveryPolicyState.CAPTCHA, 200),
        (DiscoveryPolicyState.AUTH_MISMATCH, 401),
        (DiscoveryPolicyState.PAYWALL, 402),
        (DiscoveryPolicyState.ACCESS_CONTROL, 401),
        (DiscoveryPolicyState.POLICY_MISMATCH, None),
        (DiscoveryPolicyState.HTTP_403, 403),
        (DiscoveryPolicyState.HTTP_429, 429),
        (DiscoveryPolicyState.HTTP_451, 451),
        (DiscoveryPolicyState.UNEXPECTED_BLOCKING, 503),
    ),
)
def test_stop_boundaries_are_explicit_and_end_the_query(
    policy_state: DiscoveryPolicyState,
    http_status: int | None,
) -> None:
    collected_at = datetime(2026, 7, 23, 10, 0, tzinfo=UTC)
    stop = DiscoveryStopEvent(
        query_id="query-en",
        sequence=2,
        url="https://blocked.example.org/pandas",
        access_basis=SourceAccessBasis.PUBLIC,
        collected_at=collected_at,
        policy_state=policy_state,
        http_status=http_status,
        detail="Discovery stopped at the reviewed access boundary.",
    )
    request = DiscoveryRunRequest(
        run_id=f"discovery-run-{policy_state.value}",
        created_at=collected_at,
        queries=(_public_query(),),
        events=(
            _material(
                url="https://example.org/pandas/before-stop",
                content_sha256="6" * 64,
                sequence=1,
                collected_at=collected_at,
            ),
            stop,
        ),
    )

    result = run_discovery(request)

    assert result.manifest.state is DiscoveryRunState.STOPPED
    assert result.manifest.summary.stop_count == 1
    assert result.manifest.stops[0].policy_state is policy_state
    assert result.manifest.stops[0].http_status == http_status
    assert result.manifest.entries[0].intake_candidate_id is not None

    with pytest.raises(ValidationError, match="cannot continue after a stop event"):
        DiscoveryRunRequest(
            run_id=f"invalid-run-{policy_state.value}",
            created_at=collected_at,
            queries=(_public_query(),),
            events=(
                stop,
                _material(
                    url="https://example.org/pandas/after-stop",
                    content_sha256="7" * 64,
                    sequence=3,
                    collected_at=collected_at,
                ),
            ),
        )


def test_discovery_artifacts_are_deterministic_idempotent_and_complete(tmp_path: Path) -> None:
    collected_at = datetime(2026, 7, 23, 11, 0, tzinfo=UTC)
    request = DiscoveryRunRequest(
        run_id="discovery-run-artifacts",
        created_at=collected_at,
        queries=(_public_query(),),
        events=(
            DiscoveryMaterialEvent(
                query_id="query-en",
                sequence=1,
                url="https://example.org/pandas/artifact",
                title="Artifact Panda",
                publisher="Example Publisher",
                language="en",
                source_kind=SourceKind.RESEARCH,
                is_first_hand=False,
                access_basis=SourceAccessBasis.PUBLIC,
                collected_at=collected_at,
                content_sha256="8" * 64,
                body_bytes=2048,
                content_type="application/json",
                snapshot_reference="snapshot://artifact-panda",
                policy_state=DiscoveryPolicyState.CLEAR,
                http_status=200,
            ),
        ),
    )
    result = run_discovery(request)

    first_paths = write_discovery_artifacts(result, tmp_path / "first")
    second_paths = write_discovery_artifacts(result, tmp_path / "second")
    repeated_paths = write_discovery_artifacts(result, tmp_path / "first")

    assert first_paths.manifest_path.read_bytes() == second_paths.manifest_path.read_bytes()
    assert first_paths.inventory_path.read_bytes() == second_paths.inventory_path.read_bytes()
    assert repeated_paths == first_paths

    manifest = json.loads(first_paths.manifest_path.read_text(encoding="utf-8"))
    inventory = json.loads(first_paths.inventory_path.read_text(encoding="utf-8"))
    entry = manifest["entries"][0]
    item = inventory["items"][0]
    assert entry["canonical_url"] == "https://example.org/pandas/artifact"
    assert entry["source"]["original_language"] == "en"
    assert entry["collected_at"] == "2026-07-23T11:00:00Z"
    assert entry["content_sha256"] == "8" * 64
    assert entry["source"]["access_basis"] == "public"
    assert entry["policy_state"] == "clear"
    assert entry["snapshot_reference"] == "snapshot://artifact-panda"
    assert item["content_sha256"] == "8" * 64

    conflict_dir = tmp_path / "conflict"
    conflict_dir.mkdir()
    (conflict_dir / INVENTORY_FILENAME).write_text("different inventory\n", encoding="utf-8")
    with pytest.raises(FileExistsError, match="different content"):
        write_discovery_artifacts(result, conflict_dir)
    assert not (conflict_dir / MANIFEST_FILENAME).exists()


def test_stopped_run_does_not_report_unvisited_baseline_material_as_removed() -> None:
    first_collected_at = datetime(2026, 7, 23, 12, 0, tzinfo=UTC)
    first = run_discovery(
        DiscoveryRunRequest(
            run_id="discovery-run-before-stop",
            created_at=first_collected_at,
            queries=(_public_query(),),
            events=(
                _material(
                    url="https://example.org/pandas/preserved",
                    content_sha256="9" * 64,
                    sequence=1,
                    collected_at=first_collected_at,
                ),
            ),
        )
    )
    stopped_at = datetime(2026, 7, 24, 12, 0, tzinfo=UTC)
    stopped = run_discovery(
        DiscoveryRunRequest(
            run_id="discovery-run-stopped-before-material",
            created_at=stopped_at,
            queries=(_public_query(),),
            events=(
                DiscoveryStopEvent(
                    query_id="query-en",
                    sequence=1,
                    url="https://search.example.org/query",
                    access_basis=SourceAccessBasis.PUBLIC,
                    collected_at=stopped_at,
                    policy_state=DiscoveryPolicyState.HTTP_429,
                    http_status=429,
                    detail="Rate limit boundary reached.",
                ),
            ),
        ),
        baseline=first.inventory,
    )

    assert stopped.manifest.state is DiscoveryRunState.STOPPED
    assert stopped.manifest.entries == ()
    assert stopped.manifest.summary.removed_count == 0
    assert stopped.inventory == first.inventory


def test_partial_query_scope_preserves_uncovered_baseline_material() -> None:
    first_collected_at = datetime(2026, 7, 23, 12, 30, tzinfo=UTC)
    first = run_discovery(
        DiscoveryRunRequest(
            run_id="discovery-run-multiscope-baseline",
            created_at=first_collected_at,
            queries=(
                _public_query("query-en"),
                DiscoveryQuery(
                    query_id="query-ja",
                    text="ジャイアントパンダ 個体情報",
                    language="ja",
                    provider_id="public-search",
                    access_basis=SourceAccessBasis.PUBLIC,
                ),
            ),
            events=(
                _material(
                    url="https://example.org/pandas/en-record",
                    content_sha256="e" * 64,
                    sequence=1,
                    collected_at=first_collected_at,
                    query_id="query-en",
                ),
                _material(
                    url="https://example.jp/pandas/ja-record",
                    content_sha256="f" * 64,
                    sequence=1,
                    collected_at=first_collected_at,
                    query_id="query-ja",
                ),
            ),
        )
    )
    second_collected_at = datetime(2026, 7, 24, 12, 30, tzinfo=UTC)
    partial = run_discovery(
        DiscoveryRunRequest(
            run_id="discovery-run-en-only",
            created_at=second_collected_at,
            queries=(_public_query("query-en"),),
            events=(
                _material(
                    url="https://example.org/pandas/en-record",
                    content_sha256="e" * 64,
                    sequence=1,
                    collected_at=second_collected_at,
                    query_id="query-en",
                ),
            ),
        ),
        baseline=first.inventory,
    )

    assert partial.manifest.summary.removed_count == 0
    assert {entry.change_state for entry in partial.manifest.entries} == {
        MaterialChangeState.UNCHANGED
    }
    assert {item.canonical_url for item in partial.inventory.items} == {
        "https://example.jp/pandas/ja-record",
        "https://example.org/pandas/en-record",
    }
    japanese_item = next(
        item
        for item in partial.inventory.items
        if item.canonical_url == "https://example.jp/pandas/ja-record"
    )
    assert japanese_item.query_ids == ("query-ja",)


@pytest.mark.parametrize(
    ("access_basis", "access_reference"),
    (
        (SourceAccessBasis.PUBLIC, None),
        (SourceAccessBasis.LICENSED_API, "licensed-search-api-reference"),
        (SourceAccessBasis.AUTHORIZED_ACCOUNT, "authorized-account-reference"),
        (SourceAccessBasis.MANUAL_PERMISSION, "manual-permission-reference"),
    ),
)
def test_supported_access_bases_are_preserved_without_exposing_access_references(
    access_basis: SourceAccessBasis,
    access_reference: str | None,
) -> None:
    collected_at = datetime(2026, 7, 23, 13, 0, tzinfo=UTC)
    query = DiscoveryQuery(
        query_id="query-access",
        text="giant panda source",
        language="en",
        provider_id="discovery-provider",
        access_basis=access_basis,
        access_reference=access_reference,
    )
    event = DiscoveryMaterialEvent(
        query_id=query.query_id,
        sequence=1,
        url="https://example.org/pandas/access-basis",
        title="Access basis profile",
        publisher="Example Publisher",
        language="en",
        source_kind=SourceKind.OFFICIAL_INSTITUTION,
        is_first_hand=True,
        access_basis=access_basis,
        collected_at=collected_at,
        content_sha256="a" * 64,
        body_bytes=512,
        content_type="text/html",
        policy_state=DiscoveryPolicyState.CLEAR,
        http_status=200,
    )

    result = run_discovery(
        DiscoveryRunRequest(
            run_id=f"discovery-run-{access_basis.value}",
            created_at=collected_at,
            queries=(query,),
            events=(event,),
        )
    )

    entry = result.manifest.entries[0]
    assert entry.source.access_basis is access_basis
    if access_reference is not None:
        assert access_reference not in entry.model_dump_json()


def test_provider_registry_executes_one_bulk_run_beyond_known_sources() -> None:
    collected_at = datetime(2026, 7, 23, 14, 0, tzinfo=UTC)

    class PublicSearchProvider:
        provider_id = "public-search"

        def discover(self, query: DiscoveryQuery) -> tuple[DiscoveryMaterialEvent, ...]:
            return (
                DiscoveryMaterialEvent(
                    query_id=query.query_id,
                    sequence=1,
                    url=f"https://unknown.example.org/{query.language}/panda-42",
                    title=f"Panda 42 ({query.language})",
                    publisher="Unknown Panda Source",
                    language=query.language,
                    source_kind=SourceKind.UNKNOWN,
                    is_first_hand=False,
                    access_basis=query.access_basis,
                    collected_at=collected_at,
                    content_sha256=("b" if query.language == "en" else "c") * 64,
                    body_bytes=600,
                    content_type="text/html",
                    policy_state=DiscoveryPolicyState.CLEAR,
                    http_status=200,
                ),
            )

    queries = (
        _public_query("query-provider-en"),
        DiscoveryQuery(
            query_id="query-provider-ja",
            text="ジャイアントパンダ 個体情報",
            language="ja",
            provider_id="public-search",
            access_basis=SourceAccessBasis.PUBLIC,
        ),
    )

    result = run_discovery_providers(
        run_id="discovery-run-provider-registry",
        created_at=collected_at,
        queries=queries,
        provider_registry=DiscoveryProviderRegistry(providers=(PublicSearchProvider(),)),
        known_source_hosts={},
    )

    assert result.manifest.state is DiscoveryRunState.COMPLETED
    assert result.manifest.summary.query_count == 2
    assert result.manifest.summary.entry_count == 2
    assert result.manifest.summary.unknown_source_count == 2
    assert result.manifest.summary.intake_candidate_count == 2


def test_discovery_url_rejects_embedded_credentials() -> None:
    with pytest.raises(ValueError, match="cannot contain credentials"):
        canonicalize_discovery_url("https://user:password@example.org/pandas/xing-xing")


def test_manifest_validation_rejects_drifted_counts_and_write_targets() -> None:
    collected_at = datetime(2026, 7, 23, 15, 0, tzinfo=UTC)
    result = run_discovery(
        DiscoveryRunRequest(
            run_id="discovery-run-validation",
            created_at=collected_at,
            queries=(_public_query(),),
            events=(
                _material(
                    url="https://example.org/pandas/validation",
                    content_sha256="d" * 64,
                    sequence=1,
                    collected_at=collected_at,
                ),
            ),
        )
    )

    drifted_counts = result.model_dump(mode="json")
    drifted_counts["manifest"]["summary"]["entry_count"] = 99
    with pytest.raises(ValidationError, match="entry count does not match"):
        type(result).model_validate(drifted_counts)

    forbidden_write = result.model_dump(mode="json")
    forbidden_write["manifest"]["write_boundary"]["publication_write_targets"] = ["public-pandas"]
    with pytest.raises(ValidationError, match="cannot declare trusted or publication writes"):
        type(result).model_validate(forbidden_write)
