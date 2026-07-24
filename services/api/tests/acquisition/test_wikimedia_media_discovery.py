from __future__ import annotations

import base64
import importlib.util
import json
import sys
from datetime import date
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pytest

from app.acquisition.models import ResponseEnvelope
from app.acquisition.source_registry import load_source_registry
from app.acquisition.wikimedia_media_discovery import (
    ADAPTER_ID,
    CommonsSearchTask,
    _identity_assessment,
    _rights_assessment,
    build_search_url,
    parse_search_response,
)

REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
COHORT_PATH = (
    REPOSITORY_ROOT
    / "data"
    / "media-library"
    / "discovery"
    / "commons-first-public-five.json"
)
FIXTURE_DIR = Path(__file__).resolve().parent / "fixtures" / "commons-media-discovery"
RUNNER_PATH = REPOSITORY_ROOT / "scripts" / "curation" / "run_commons_media_discovery.py"
RUNNER_SPEC = importlib.util.spec_from_file_location(
    "run_commons_media_discovery_for_tests", RUNNER_PATH
)
assert RUNNER_SPEC and RUNNER_SPEC.loader
RUNNER = importlib.util.module_from_spec(RUNNER_SPEC)
sys.modules[RUNNER_SPEC.name] = RUNNER
RUNNER_SPEC.loader.exec_module(RUNNER)


def load_fixture(slug: str) -> ResponseEnvelope:
    payload = json.loads((FIXTURE_DIR / f"{slug}.json").read_text(encoding="utf-8"))
    return ResponseEnvelope(
        requested_url=payload["requested_url"],
        final_url=payload["final_url"],
        status=payload["status"],
        headers=payload["headers"],
        body=base64.b64decode(payload["body_base64"], validate=True),
    )


def cohort_tasks() -> list[CommonsSearchTask]:
    cohort = json.loads(COHORT_PATH.read_text(encoding="utf-8"))
    return [CommonsSearchTask.from_dict(value) for value in cohort["tasks"]]


def parsed_results():
    registry = load_source_registry(today=date(2026, 7, 24))
    return [
        parse_search_response(
            registry,
            task,
            load_fixture(task.panda_slug),
        )
        for task in cohort_tasks()
    ]


def test_source_registry_allows_bounded_commons_discovery_adapter() -> None:
    registry = load_source_registry(today=date(2026, 7, 24))
    source = registry.get("wikimedia-commons-action-api")
    assert source.allowed_adapter_ids == (
        "wikimedia-commons-xi-lun",
        ADAPTER_ID,
    )
    source.assert_adapter_allowed(ADAPTER_ID)
    assert source.max_requests_per_minute == 6
    assert source.concurrency_per_host == 1


def test_search_url_is_bounded_to_file_namespace_without_continuation() -> None:
    registry = load_source_registry(today=date(2026, 7, 24))
    source = registry.get("wikimedia-commons-action-api")
    task = cohort_tasks()[0]
    url = build_search_url(source, task)
    parsed = urlparse(url)
    query = parse_qs(parsed.query)

    assert parsed.scheme == "https"
    assert parsed.hostname == "commons.wikimedia.org"
    assert parsed.path == "/w/api.php"
    assert query["generator"] == ["search"]
    assert query["gsrnamespace"] == ["6"]
    assert query["gsrlimit"] == ["5"]
    assert query["gsrsearch"] == [task.query]
    assert "gsrcontinue" not in query
    assert "continue" not in query


def test_arbitrary_queries_newlines_and_large_result_sets_fail_closed() -> None:
    base = {
        "task_id": "commons-search-test",
        "panda_slug": "test-panda",
        "name_zh": "测试熊猫",
        "name_en": "Test Panda",
        "query_locale": "en",
        "max_results": 5,
    }
    for query in (
        "panda",
        '"Test Panda" zoo photos',
        '"Test Panda" giant panda\ncontinue',
        '"Test Panda" category search',
    ):
        with pytest.raises(ValueError, match="outside the reviewed name-only form"):
            CommonsSearchTask.from_dict({**base, "query": query})

    with pytest.raises(ValueError, match="at most 5 results"):
        CommonsSearchTask.from_dict(
            {**base, "query": '"Test Panda" giant panda', "max_results": 6}
        )


def test_first_live_fixtures_produce_bounded_internal_candidates() -> None:
    results = parsed_results()
    candidates = [candidate for result in results for candidate in result.candidates]

    assert len(results) == 5
    assert sum(len(result.candidates) for result in results) == 24
    assert all(len(result.candidates) <= 5 for result in results)
    assert all(result.to_dict()["publication_write_targets"] == [] for result in results)
    assert all(candidate.original_image_downloaded is False for candidate in candidates)
    assert all(candidate.review_state == "candidate" for candidate in candidates)
    assert all(candidate.source_id == "wikimedia-commons-action-api" for candidate in candidates)
    assert all(candidate.adapter_id == ADAPTER_ID for candidate in candidates)

    review_ready = [
        candidate
        for candidate in candidates
        if candidate.identity_confidence >= 0.85
        and candidate.rights_state in {"open_license", "public_domain"}
        and candidate.profile_image_eligible
    ]
    assert len(review_ready) == 6
    videos = [candidate for candidate in candidates if candidate.mime == "video/webm"]
    assert videos
    assert all(candidate.profile_image_eligible is False for candidate in videos)


def test_only_mei_xiang_and_xiao_qi_ji_have_high_identity_candidates() -> None:
    candidates = [candidate for result in parsed_results() for candidate in result.candidates]
    high_by_slug: dict[str, list] = {}
    for candidate in candidates:
        if candidate.identity_confidence >= 0.85:
            high_by_slug.setdefault(candidate.panda_slug, []).append(candidate)

    assert set(high_by_slug) == {"mei-xiang", "xiao-qi-ji"}
    assert len(high_by_slug["mei-xiang"]) == 1
    assert high_by_slug["mei-xiang"][0].file_title == (
        "File:Mei Xiang at Smithsonian's National Zoo.jpg"
    )
    assert len(high_by_slug["xiao-qi-ji"]) == 5
    assert any(
        candidate.file_title == "File:Giant Panda Xiao Qi Ji at Smithsonian's National Zoo.jpg"
        and candidate.identity_confidence == 0.95
        for candidate in high_by_slug["xiao-qi-ji"]
    )


def test_reviewed_institution_context_downgrades_cross_institution_name_matches() -> None:
    task = CommonsSearchTask(
        task_id="commons-search-bao-bao",
        panda_slug="bao-bao",
        name_zh="宝宝",
        name_en="Bao Bao",
        query='"Bao Bao" Smithsonian panda',
        query_locale="en",
    )
    confidence, basis = _identity_assessment(
        task,
        "File:Großer Panda Bao Bao Berlin W 10.jpg",
        "Bao Bao was a giant panda at Berlin Zoo.",
    )
    assert confidence == 0.45
    assert basis == "canonical-name-without-reviewed-institution-context"

    for result in parsed_results():
        if result.task.panda_slug in {"bao-bao", "bei-bei", "tian-tian"}:
            assert all(candidate.identity_confidence < 0.85 for candidate in result.candidates)


def test_cc0_public_domain_dedication_is_recognized_even_with_http_metadata_url() -> None:
    state, confidence, basis = _rights_assessment(
        "CC0",
        "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
        "Creative Commons Zero, Public Domain Dedication",
    )
    assert state == "public_domain"
    assert confidence == 0.95
    assert basis == "commons-cc0-public-domain-dedication"


def test_response_url_drift_fails_closed() -> None:
    registry = load_source_registry(today=date(2026, 7, 24))
    task = cohort_tasks()[0]
    response = load_fixture(task.panda_slug)
    drifted = ResponseEnvelope(
        requested_url=response.requested_url,
        final_url="https://commons.wikimedia.org/w/api.php?action=query",
        status=response.status,
        headers=response.headers,
        body=response.body,
    )
    with pytest.raises(ValueError, match="request URL drifted"):
        parse_search_response(registry, task, drifted)


def test_fixture_runner_is_deterministic_and_matches_saved_candidate_semantics() -> None:
    cohort = RUNNER.load_cohort(COHORT_PATH)
    first = RUNNER.build_result(
        cohort,
        fixture_dir=FIXTURE_DIR,
        live=False,
        record_fixtures=False,
    )
    second = RUNNER.build_result(
        cohort,
        fixture_dir=FIXTURE_DIR,
        live=False,
        record_fixtures=False,
    )
    assert first == second
    assert first["mode"] == "fixture"
    assert first["task_count"] == 5
    assert first["candidate_count"] == 24
    assert first["profile_image_candidate_count"] == 21
    assert first["review_ready_candidate_count"] == 6
    assert first["publication_write_targets"] == []

    manifest = RUNNER.build_result_manifest(
        COHORT_PATH,
        cohort,
        FIXTURE_DIR,
        RUNNER.DEFAULT_OUTPUT,
        first,
    )
    assert manifest == RUNNER.build_result_manifest(
        COHORT_PATH,
        cohort,
        FIXTURE_DIR,
        RUNNER.DEFAULT_OUTPUT,
        second,
    )
    assert manifest["result"]["candidate_count"] == 24
    assert manifest["result"]["review_ready_candidate_count"] == 6
    assert len(manifest["inputs"]["fixtures"]) == 5
    assert manifest["publication_write_targets"] == []
