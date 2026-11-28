"""Option B single-pass LLM extraction and direct API news_ingest tests."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

import httpx
import pytest

from collector import news_ingest
from collector.extractor import (
    ExtractedFactChange,
    ExtractionError,
    ExtractionResult,
    LlmExtractor,
    parse_extraction_json,
)
from collector.models import Role, Target, TargetKind, Tier

pytestmark = pytest.mark.anyio


def _targets() -> list[Target]:
    return [
        Target(
            "weibo_rsshub:account:1798176285",
            "weibo_rsshub",
            TargetKind.ACCOUNT,
            "1798176285",
            "成都大熊猫繁育研究基地（微博）",
            Tier.OFFICIAL,
            60,
            {},
            role=Role.INSTITUTION,
            institution="chengdu-research-base",
        ),
        Target(
            "weibo_rsshub:account:1001",
            "weibo_rsshub",
            TargetKind.ACCOUNT,
            "1001",
            "大熊猫粉丝站",
            Tier.KEY_ACCOUNT,
            90,
            {},
            role=Role.FAN,
        ),
    ]


def _outbox_row(
    item_id: int,
    *,
    platform: str = "weibo",
    author_id: str | None = "1798176285",
    url: str = "https://weibo.com/1798176285/post1",
    tier: str = "official",
    media: list[dict[str, Any]] | None = None,
    original_author: dict[str, str] | None = None,
) -> dict[str, Any]:
    return {
        "item_id": item_id,
        "version": 1,
        "target_id": "weibo_rsshub:account:1798176285",
        "target_label": "成都大熊猫繁育研究基地（微博）",
        "target_tier": tier,
        "platform": platform,
        "platform_item_id": f"post-{item_id}",
        "url": url,
        "title": "幼年别墅今起临时闭馆公告",
        "body": "成都基地幼年大熊猫别墅因设施维护今起临时闭馆一天。",
        "author_id": author_id,
        "author_name": "成都大熊猫繁育研究基地",
        "item_raw": {"original_author": original_author} if original_author else {},
        "published_at": datetime(2026, 11, 28, 1, 0, tzinfo=UTC),
        "first_seen_at": datetime(2026, 11, 28, 1, 1, tzinfo=UTC),
        "media": media or [{"type": "image", "url": "https://img.example.org/official.jpg"}],
    }


class FakeStore:
    def __init__(self, rows: list[dict[str, Any]]):
        self.rows = rows
        self.pushed: list[tuple[int, int]] = []
        self.failed: list[tuple[list[tuple[int, int]], str]] = []
        self.released: list[tuple[int, int]] = []
        self.alerts: list[tuple[str, str | None, str, str]] = []
        self.resolved: list[tuple[str, str | None]] = []

    async def claim_outbox(self, limit: int) -> list[dict[str, Any]]:
        return self.rows[:limit]

    async def mark_pushed(self, keys: list[tuple[int, int]]) -> None:
        self.pushed.extend(keys)

    async def mark_push_failed(self, keys: list[tuple[int, int]], error: str) -> None:
        self.failed.append((keys, error))

    async def release_outbox(self, keys: list[tuple[int, int]]) -> None:
        self.released.extend(keys)

    async def raise_alert(
        self, adapter: str, target_id: str | None, kind: str, message: str
    ) -> bool:
        self.alerts.append((adapter, target_id, kind, message))
        return True

    async def resolve_alerts(self, adapter: str, target_id: str | None) -> None:
        self.resolved.append((adapter, target_id))


def test_parse_extraction_json_handles_closure_notices_and_rejects_junk() -> None:
    parsed = parse_extraction_json(
        """```json
        {
          "relevant": "pass",
          "worthyForNews": true,
          "scope": "single",
          "kind": "closure",
          "zhTitle": "成都基地幼年别墅今起临时闭馆",
          "zhSummary": "成都大熊猫繁育研究基地宣布幼年别墅因设施维护今日临时闭馆。",
          "pandaNames": ["和花", "和花", "和叶"],
          "institutionName": "成都大熊猫繁育研究基地",
          "factChange": {
            "kind": "none",
            "phase": null,
            "namingStatus": null,
            "date": "2026-11-28",
            "motherName": null,
            "toPlace": null
          },
          "evidenceQuote": "幼年大熊猫别墅因设施维护今起临时闭馆一天。"
        }
        ```"""
    )
    assert parsed.kind == "closure"
    assert parsed.worthy_for_news is True
    assert parsed.panda_names == ["和花", "和叶"]

    with pytest.raises(ExtractionError):
        parse_extraction_json("not json")


def test_cover_url_strictly_restricted_to_t1_institutions() -> None:
    row = _outbox_row(
        1,
        media=[
            {"type": "image", "url": "http://insecure.example.org/a.jpg"},
            {"type": "image", "url": "https://cdn.example.org/t1-cover.jpg"},
        ],
    )
    assert news_ingest.extract_t1_cover_url(row, "institution") == "https://cdn.example.org/t1-cover.jpg"
    assert news_ingest.extract_t1_cover_url(row, "official") is None
    assert news_ingest.extract_t1_cover_url(row, "media") is None
    assert news_ingest.extract_t1_cover_url(row, "fan") is None


def test_repost_uses_original_author_tier() -> None:
    account_map = news_ingest.build_account_map(_targets())
    repost_from_fan = _outbox_row(
        1,
        author_id="1798176285",
        original_author={"accountId": "1001", "name": "大熊猫粉丝站"},
    )
    assert news_ingest.resolve_author_tier(repost_from_fan, account_map) == ("fan", None)

    repost_from_inst = _outbox_row(
        2,
        author_id="1001",
        original_author={"accountId": "1798176285", "name": "成都基地"},
    )
    assert news_ingest.resolve_author_tier(repost_from_inst, account_map) == (
        "institution",
        "chengdu-research-base",
    )


async def test_news_ingest_pushes_structured_items_and_skips_noise() -> None:
    rows = [
        _outbox_row(1, author_id="1798176285"),
        _outbox_row(2, author_id="1001", url="https://weibo.com/1001/post2"),
        _outbox_row(3, tier="backfill"),
        _outbox_row(4, url="http://not-https.example.org/4"),
    ]
    store = FakeStore(rows)
    ingested_batches: list[dict[str, Any]] = []
    call_idx = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal call_idx
        if request.url.path.endswith("/chat/completions"):
            call_idx += 1
            if call_idx == 1:
                body = {
                    "relevant": "pass",
                    "worthyForNews": True,
                    "scope": "single",
                    "kind": "closure",
                    "zhTitle": "幼年别墅今起临时闭馆",
                    "zhSummary": "成都基地发布幼年大熊猫别墅临时闭馆公告。",
                    "pandaNames": ["和花"],
                    "institutionName": "成都大熊猫繁育研究基地",
                    "factChange": {"kind": "none"},
                    "evidenceQuote": "幼年大熊猫别墅今起临时闭馆一天。",
                }
            else:
                body = {
                    "relevant": "pass",
                    "worthyForNews": False,
                    "scope": "single",
                    "kind": "other",
                    "zhTitle": "路人吃笋日常",
                    "zhSummary": "粉丝日常分享。",
                    "pandaNames": [],
                    "institutionName": None,
                    "factChange": {"kind": "none"},
                    "evidenceQuote": None,
                }
            return httpx.Response(
                200,
                json={"choices": [{"message": {"content": json.dumps(body, ensure_ascii=False)}}]},
            )
        if request.url.path == "/api/v2/news/ingest":
            assert request.headers["authorization"] == "Bearer ingest-secret-token"
            ingested_batches.append(json.loads(request.content))
            return httpx.Response(200, json={"accepted": 1})
        raise AssertionError(request.url)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        extractor = LlmExtractor(
            client,
            base_url="https://llm.example.test/v1",
            api_key="llm-key",
            model="deepseek-flash",
        )
        pushed = await news_ingest.push(
            store,  # type: ignore[arg-type]
            client,
            api_url="https://api.example.test",
            token="ingest-secret-token",
            targets=_targets(),
            extractor=extractor,
        )

    assert pushed == 1
    assert len(ingested_batches) == 1
    sent_item = ingested_batches[0]["items"][0]
    assert sent_item["sourceTier"] == "institution"
    assert sent_item["authorInstitutionSlug"] == "chengdu-research-base"
    assert sent_item["coverUrl"] == "https://img.example.org/official.jpg"
    assert sent_item["kind"] == "closure"
    assert sorted(store.pushed) == [(1, 1), (2, 1), (3, 1), (4, 1)]
    assert store.failed == []
    assert store.released == []


async def test_news_ingest_releases_on_429_and_alerts_on_500() -> None:
    store_429 = FakeStore([_outbox_row(1)])

    def handler_429(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/chat/completions"):
            return httpx.Response(
                200,
                json={
                    "choices": [
                        {
                            "message": {
                                "content": json.dumps(
                                    {
                                        "relevant": "pass",
                                        "worthyForNews": True,
                                        "scope": "single",
                                        "kind": "event",
                                        "zhTitle": "新动态",
                                        "zhSummary": "摘要",
                                        "pandaNames": ["和花"],
                                        "institutionName": "成都基地",
                                        "factChange": {"kind": "none"},
                                        "evidenceQuote": "原文原话",
                                    }
                                )
                            }
                        }
                    ]
                },
            )
        return httpx.Response(429)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler_429)) as client:
        extractor = LlmExtractor(
            client,
            base_url="https://llm.example.test/v1",
            api_key="k",
            model="m",
        )
        count = await news_ingest.push(
            store_429,  # type: ignore[arg-type]
            client,
            api_url="https://api.example.test",
            token="tok-12345678901234",
            targets=_targets(),
            extractor=extractor,
        )
    assert count == 0
    assert store_429.released == [(1, 1)]
    assert store_429.failed == []


def test_to_ingest_item_guards_blank_and_oversized_fields() -> None:
    blank_row = {
        **_outbox_row(9),
        "title": "   ",
        "author_name": "   ",
        "target_label": "",
    }
    blank_extracted = ExtractionResult(
        relevant="pass",
        worthy_for_news=False,
        scope="single",
        kind="event",
        zh_title="",
        zh_summary="",
        panda_names=["和花"],
        institution_name=None,
        fact_change=ExtractedFactChange("none", None, None, None, None, None),
        evidence_quote=None,
    )
    payload = news_ingest.to_ingest_item(blank_row, blank_extracted, "fan", None)
    assert payload["titleZh"] == "熊猫动态"
    assert payload["summaryZh"] == "熊猫动态"
    assert payload["sourcePublisher"] == "weibo"

    long_extracted = ExtractionResult(
        relevant="pass",
        worthy_for_news=True,
        scope="single",
        kind="event",
        zh_title="标" * 120,
        zh_summary="摘" * 400,
        panda_names=[],
        institution_name=None,
        fact_change=ExtractedFactChange("none", None, None, None, None, None),
        evidence_quote=None,
    )
    clamped = news_ingest.to_ingest_item(blank_row, long_extracted, "fan", None)
    assert len(clamped["titleZh"]) == 80
    assert len(clamped["summaryZh"]) == 300
