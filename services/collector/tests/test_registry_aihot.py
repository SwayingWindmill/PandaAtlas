"""AIHOT payload and account registry. No database needed."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from collector import aihot, registry
from collector.aihot import source_id
from collector.config import REPO_ROOT, load_targets
from collector.models import Role, Target, TargetKind, Tier


def row(**overrides: Any) -> dict[str, Any]:
    base = {
        "item_id": 7,
        "version": 1,
        "target_tier": "official",
        "platform": "weibo",
        "platform_item_id": "5012",
        "url": "https://m.weibo.cn/detail/5012",
        "title": "和花",
        "body": "和" * 300,
        "author_id": "1798176285",
        "author_name": "成都大熊猫繁育研究基地",
        "published_at": datetime(2026, 11, 5, 1, 30, tzinfo=UTC),
        "media": [
            {"type": "image", "url": "https://w/1.jpg", "width": 640, "height": 480},
            {"type": "video", "url": "http://w/2.mp4"},
            {"type": "image", "url": "file:///etc/passwd"},
            {"type": "cover", "url": "https://w/3.jpg"},
            {"type": "image"},
        ],
        "metrics": {},
        "panda_slugs": ["he-hua"],
        "item_raw": {},
    }
    return {**base, **overrides}


def test_item_carries_body_excerpt_media_and_author() -> None:
    item = aihot.to_item(row())
    assert item["bodyText"] == "和" * 300
    assert item["excerpt"] == "和" * 200
    assert item["media"] == [
        {"kind": "image", "url": "https://w/1.jpg", "width": 640, "height": 480},
        {"kind": "video", "url": "http://w/2.mp4"},
    ]
    raw = item["raw"]
    assert raw["externalId"] == "weibo:5012"
    assert raw["author"] == {
        "platform": "weibo",
        "accountId": "1798176285",
        "name": "成都大熊猫繁育研究基地",
    }
    assert "originalAuthor" not in raw
    assert raw["pandaSlugs"] == ["he-hua"] and raw["_aihot"] == {"backfill": False}


def test_repost_carries_the_original_author() -> None:
    original = {"accountId": "2741831927", "name": "北京动物园"}
    item = aihot.to_item(row(item_raw={"original_author": original}))
    assert item["raw"]["originalAuthor"] == {"platform": "weibo", **original}


FIXTURE = """
targets:
  - {adapter: xhs_mcp, kind: account, value: xhs2, label: 小红书基地, tier: official,
     role: institution, institution: ccrcgp, params: {xsec_token: t}}
  - {adapter: weibo_crawler, kind: account, value: "2", label: 微博官方, role: official}
  - {adapter: douyin_api, kind: account, value: sec3, label: 抖音粉丝, role: fan}
  - {adapter: weibo_crawler, kind: account, value: "1", label: 微博媒体, role: media}
  - {adapter: weibo_crawler, kind: account, value: "9", label: 未分类}
keyword_groups:
  - adapters: [xhs_mcp]
    terms: [福宝]
"""


def test_registry_lists_accounts_and_sources_in_stable_order(tmp_path: Path) -> None:
    source = tmp_path / "targets.yaml"
    source.write_text(FIXTURE, encoding="utf-8")
    targets = load_targets(source)
    out = tmp_path / "registry.json"
    registry.write(targets, out)
    doc = json.loads(out.read_text(encoding="utf-8"))
    assert registry.build(list(reversed(targets))) == doc
    assert doc["accounts"] == [
        {"platform": "douyin", "accountId": "sec3", "role": "fan", "label": "抖音粉丝"},
        {"platform": "weibo", "accountId": "1", "role": "media", "label": "微博媒体"},
        {"platform": "weibo", "accountId": "2", "role": "official", "label": "微博官方"},
        {
            "platform": "xiaohongshu",
            "accountId": "xhs2",
            "role": "institution",
            "institution": "ccrcgp",
            "label": "小红书基地",
        },
    ]
    tiers = {s["id"]: s["tier"] for s in doc["sources"]}
    assert tiers == {
        aihot.source_id("xhs_mcp:account:xhs2"): "T1",
        aihot.source_id("weibo_crawler:account:2"): "T1_5",
        aihot.source_id("douyin_api:account:sec3"): "T2",
        aihot.source_id("weibo_crawler:account:1"): "T2",
        aihot.source_id("weibo_crawler:account:9"): "T2",
        aihot.source_id("xhs_mcp:keyword:福宝"): "T2",
    }
    assert all(s["participation_mode"] == "editorial" for s in doc["sources"])
    assert [s["id"] for s in doc["sources"]] == sorted(tiers)


def test_sources_sql_upserts_every_target_as_editorial() -> None:
    targets = [
        Target(
            "weibo_crawler:account:1",
            "weibo_crawler",
            TargetKind.ACCOUNT,
            "1",
            "北京动物园（微博）",
            Tier.OFFICIAL,
            30,
            {},
            role=Role.INSTITUTION,
        ),
        Target(
            "rss:feed:x", "rss", TargetKind.KEYWORD, "福宝", "粉丝's 关键词", Tier.KEYWORD, 180, {}
        ),
    ]
    sql = registry.sources_sql(targets)
    assert sql.startswith("INSERT INTO sources")
    assert "'zhipanda-weibo-crawler-account-1', '北京动物园（微博）（官方）', 'external'" in sql
    assert "'T1', 'editorial'" in sql and "'T2', 'editorial'" in sql
    assert "'粉丝''s 关键词（关键词）'" in sql
    assert sql.rstrip().endswith("participation_mode = EXCLUDED.participation_mode;")


def test_every_target_gets_its_own_aihot_source() -> None:
    targets = load_targets(REPO_ROOT / "data/collector/targets.yaml")
    assert len({source_id(t.id) for t in targets}) == len(targets)
    assert source_id("weibo_crawler:account:123") == "zhipanda-weibo-crawler-account-123"
