from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

from app.acquisition.discovery import (
    DiscoveryMaterialEvent,
    DiscoveryPolicyState,
    DiscoveryQuery,
    DiscoveryRunRequest,
    DiscoveryRunResult,
    DiscoveryStopEvent,
    run_discovery,
)
from app.knowledge.contracts import SourceAccessBasis, SourceKind

ROOT = Path(__file__).resolve().parents[3]
SCHEMA_PATH = ROOT / "contracts" / "panda-discovery-intake.v1.json"
FIXTURE_DIR = ROOT / "contracts" / "panda-discovery-intake-fixtures" / "v1"
CREATED_AT = datetime(2026, 7, 23, 0, 0, tzinfo=UTC)


def _query(query_id: str = "query-en", language: str = "en") -> DiscoveryQuery:
    return DiscoveryQuery(
        query_id=query_id,
        text="giant panda profile",
        language=language,
        provider_id="public-search",
        access_basis=SourceAccessBasis.PUBLIC,
    )


def _material(
    *,
    query_id: str,
    sequence: int,
    url: str,
    content_sha256: str,
    language: str,
) -> DiscoveryMaterialEvent:
    return DiscoveryMaterialEvent(
        query_id=query_id,
        sequence=sequence,
        url=url,
        title=f"Panda discovery material {sequence}",
        publisher="Example Panda Publisher",
        language=language,
        source_kind=SourceKind.MATURE_DATABASE,
        is_first_hand=False,
        access_basis=SourceAccessBasis.PUBLIC,
        collected_at=CREATED_AT,
        content_sha256=content_sha256,
        body_bytes=1000 + sequence,
        content_type="text/html",
        snapshot_reference=f"snapshot://discovery/{query_id}/{sequence}",
        policy_state=DiscoveryPolicyState.CLEAR,
        http_status=200,
    )


def build_fixtures() -> dict[str, DiscoveryRunResult]:
    completed = run_discovery(
        DiscoveryRunRequest(
            run_id="discovery-fixture-completed",
            created_at=CREATED_AT,
            queries=(
                _query("query-zh", "zh-CN"),
                _query("query-en", "en"),
                _query("query-ja", "ja"),
                _query("query-ko", "ko"),
            ),
            events=(
                _material(
                    query_id="query-zh",
                    sequence=1,
                    url="https://unknown.example.cn/pandas/xing-xing?utm_source=fixture",
                    content_sha256="a" * 64,
                    language="zh-CN",
                ),
                _material(
                    query_id="query-en",
                    sequence=1,
                    url="https://unknown.example.cn/pandas/xing-xing?utm_medium=fixture",
                    content_sha256="a" * 64,
                    language="en",
                ),
                _material(
                    query_id="query-ja",
                    sequence=1,
                    url="https://archive.example.jp/pandas/xing-xing",
                    content_sha256="a" * 64,
                    language="ja",
                ),
                _material(
                    query_id="query-ko",
                    sequence=1,
                    url="https://zoo.example.kr/pandas/panda-42",
                    content_sha256="b" * 64,
                    language="ko",
                ),
            ),
        ),
        known_source_hosts={"zoo.example.kr": "known-korean-zoo"},
    )
    stopped = run_discovery(
        DiscoveryRunRequest(
            run_id="discovery-fixture-stopped",
            created_at=CREATED_AT,
            queries=(_query(),),
            events=(
                DiscoveryStopEvent(
                    query_id="query-en",
                    sequence=1,
                    url="https://search.example.org/pandas",
                    access_basis=SourceAccessBasis.PUBLIC,
                    collected_at=CREATED_AT,
                    policy_state=DiscoveryPolicyState.HTTP_429,
                    http_status=429,
                    detail="Rate limit boundary reached.",
                ),
            ),
        )
    )
    first = run_discovery(
        DiscoveryRunRequest(
            run_id="discovery-fixture-baseline",
            created_at=CREATED_AT,
            queries=(_query(),),
            events=(
                _material(
                    query_id="query-en",
                    sequence=1,
                    url="https://example.org/pandas/unchanged",
                    content_sha256="1" * 64,
                    language="en",
                ),
                _material(
                    query_id="query-en",
                    sequence=2,
                    url="https://example.org/pandas/changed",
                    content_sha256="2" * 64,
                    language="en",
                ),
                _material(
                    query_id="query-en",
                    sequence=3,
                    url="https://example.org/pandas/removed",
                    content_sha256="3" * 64,
                    language="en",
                ),
            ),
        )
    )
    incremental = run_discovery(
        DiscoveryRunRequest(
            run_id="discovery-fixture-incremental",
            created_at=CREATED_AT,
            queries=(_query(),),
            events=(
                _material(
                    query_id="query-en",
                    sequence=1,
                    url="https://example.org/pandas/unchanged",
                    content_sha256="1" * 64,
                    language="en",
                ),
                _material(
                    query_id="query-en",
                    sequence=2,
                    url="https://example.org/pandas/changed",
                    content_sha256="4" * 64,
                    language="en",
                ),
                _material(
                    query_id="query-en",
                    sequence=3,
                    url="https://example.org/pandas/new",
                    content_sha256="5" * 64,
                    language="en",
                ),
            ),
        ),
        baseline=first.inventory,
    )
    return {
        "completed.valid.json": completed,
        "incremental.valid.json": incremental,
        "stopped.valid.json": stopped,
    }


def write_contract_files() -> None:
    SCHEMA_PATH.parent.mkdir(parents=True, exist_ok=True)
    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)
    SCHEMA_PATH.write_text(
        json.dumps(
            DiscoveryRunResult.model_json_schema(),
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )
    for name, result in build_fixtures().items():
        (FIXTURE_DIR / name).write_text(
            json.dumps(
                result.model_dump(mode="json"),
                ensure_ascii=False,
                indent=2,
                sort_keys=True,
            )
            + "\n",
            encoding="utf-8",
        )


if __name__ == "__main__":
    write_contract_files()
