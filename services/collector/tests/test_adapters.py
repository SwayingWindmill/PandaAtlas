"""Adapters against the payload shapes their upstream projects document, over a mock transport."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx
import pytest

from collector.adapters import process
from collector.adapters.base import FetchContext
from collector.adapters.douyin_api import DouyinApiAdapter
from collector.adapters.mediacrawler import item_from_row, read_new_rows
from collector.adapters.rss import RssAdapter
from collector.adapters.weibo_crawler import read_output
from collector.adapters.xhs_mcp import XhsMcpAdapter
from collector.models import CollectError, ErrorKind, Target, TargetKind, Tier

pytestmark = pytest.mark.anyio


def target(adapter: str, kind: TargetKind, value: str, **params: Any) -> Target:
    return Target(f"{adapter}:{value}", adapter, kind, value, value, Tier.KEY_ACCOUNT, 60, params)


async def nothing_known(platform: str, ids: Any) -> set[str]:
    return set()


CTX = FetchContext(known_ids=nothing_known)

FEED = b"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Panda Base</title>
<item><title>Fu Bao &amp; friends</title><link>https://example.org/news/1</link>
<guid>news-1</guid><pubDate>Wed, 04 Nov 2026 08:00:00 GMT</pubDate>
<description><![CDATA[<p>\xe7\xa6\x8f\xe5\xae\x9d today<br/><img src="https://example.org/a.jpg"></p>]]></description>
</item></channel></rss>"""


async def test_rss_parses_and_uses_conditional_get() -> None:
    seen_headers: list[httpx.Headers] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen_headers.append(request.headers)
        if request.headers.get("if-none-match") == '"v1"':
            return httpx.Response(304)
        return httpx.Response(200, content=FEED, headers={"etag": '"v1"'})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        adapter = RssAdapter(client, "http://rsshub:1200")
        feed = target("rss", TargetKind.FEED, "rsshub:/weibo/user/1", platform="weibo")
        page = await adapter.fetch(feed, None, CTX)
        assert str(seen_headers[0]) and page.items[0].platform == "weibo"
        item = page.items[0]
        assert item.title == "Fu Bao & friends"
        assert item.body == "福宝 today"
        assert item.media == [{"type": "image", "url": "https://example.org/a.jpg"}]
        assert item.published_at == datetime(2026, 11, 4, 8, tzinfo=UTC)
        assert page.cursor and page.cursor["etag"] == '"v1"'

        again = await adapter.fetch(feed, page.cursor, CTX)
        assert again.not_modified and not again.empty


def xhs_feed(note_id: str) -> dict[str, Any]:
    return {
        "id": note_id,
        "xsecToken": "tok",
        "modelType": "note",
        "noteCard": {"displayTitle": "t", "user": {"userId": "u1", "nickname": "n"}},
    }


async def test_xhs_fetches_detail_only_for_new_notes() -> None:
    detail_calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["authorization"] == "Bearer secret"
        body = json.loads(request.content or b"{}")
        if request.url.path == "/api/v1/user/profile":
            feeds = [xhs_feed("old"), xhs_feed("new")]
            return httpx.Response(200, json={"success": True, "data": {"data": {"feeds": feeds}}})
        if request.url.path == "/api/v1/feeds/detail":
            detail_calls.append(body["feed_id"])
            note = {
                "noteId": body["feed_id"],
                "title": "福宝",
                "desc": "吃竹子",
                "time": 1762243200000,
                "user": {"userId": "u1", "nickname": "n"},
                "imageList": [{"urlDefault": "https://img/1"}],
            }
            return httpx.Response(
                200,
                json={
                    "success": True,
                    "data": {"feed_id": body["feed_id"], "data": {"note": note, "comments": {}}},
                },
            )
        raise AssertionError(request.url)

    async def known(platform: str, ids: Any) -> set[str]:
        return {"old"}

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        adapter = XhsMcpAdapter(client, "http://xhs:18060", "secret")
        page = await adapter.fetch(
            target("xhs_mcp", TargetKind.ACCOUNT, "u1", xsec_token="t"),
            None,
            FetchContext(known_ids=known),
        )
    assert detail_calls == ["new"]
    assert [i.platform_item_id for i in page.items] == ["new"]
    assert page.seen == 2 and not page.empty
    assert page.items[0].body == "吃竹子"
    assert page.items[0].published_at == datetime(2025, 11, 4, 8, tzinfo=UTC)


async def test_xhs_server_error_while_logged_out_is_login_expired() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/v1/login/status":
            return httpx.Response(200, json={"success": True, "data": {"is_logged_in": False}})
        return httpx.Response(500, json={"error": "搜索Feeds失败", "code": "SEARCH_FEEDS_FAILED"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        adapter = XhsMcpAdapter(client, "http://xhs:18060", None)
        with pytest.raises(CollectError) as exc:
            await adapter.fetch(target("xhs_mcp", TargetKind.KEYWORD, "福宝"), None, CTX)
    assert exc.value.kind is ErrorKind.LOGIN_EXPIRED


def dy_content(content_id: str, created: str) -> dict[str, Any]:
    return {
        "platform": "douyin",
        "content_id": content_id,
        "kind": "video",
        "web_url": f"https://www.douyin.com/video/{content_id}",
        "title": "福宝",
        "description": "福宝 #熊猫",
        "created_at": created,
        "author": {"uid": "sec1", "nickname": "基地"},
        "stats": {"digg_count": 3},
        "media": {"cover": "https://c"},
        "fetched_at": created,
    }


async def test_douyin_polls_task_and_stops_paging_at_watermark() -> None:
    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(f"{request.url.path}?{request.url.query.decode()}")
        assert request.headers["x-api-key"] == "key"
        if request.url.path == "/api/v1/douyin/user/posts":
            if "cursor=" not in str(request.url):
                return httpx.Response(
                    202,
                    json={
                        "success": True,
                        "data": {"task_id": "t1", "state": "running"},
                        "error": None,
                        "meta": {},
                    },
                )
            page = {
                "items": [dy_content("2", "2026-11-01T00:00:00+00:00")],
                "cursor": "c2",
                "has_more": True,
            }
            return httpx.Response(200, json={"success": True, "data": page, "meta": {}})
        if request.url.path == "/api/v1/tasks/t1":
            page = {
                "items": [dy_content("3", "2026-11-05T00:00:00+00:00")],
                "cursor": "c1",
                "has_more": True,
            }
            return httpx.Response(
                200,
                json={"success": True, "data": {"task_id": "t1", "state": "done", "data": page}},
            )
        raise AssertionError(request.url)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        adapter = DouyinApiAdapter(client, "http://dtk:8000", "key")
        cursor = {"watermark": "2026-11-02T00:00:00+00:00"}
        page = await adapter.fetch(target("douyin_api", TargetKind.ACCOUNT, "sec1"), cursor, CTX)
    assert [i.platform_item_id for i in page.items] == ["3", "2"]
    assert len([c for c in calls if "user/posts" in c]) == 2  # stopped: page 2 reached the mark
    assert page.cursor == {"watermark": "2026-11-05T00:00:00+00:00"}


async def test_douyin_risk_control_is_a_challenge() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            502,
            json={
                "success": False,
                "data": None,
                "error": {"code": "UPSTREAM_RISK_CONTROL", "message": "blocked"},
                "meta": {},
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        adapter = DouyinApiAdapter(client, "http://dtk:8000", None)
        with pytest.raises(CollectError) as exc:
            await adapter.fetch(target("douyin_api", TargetKind.KEYWORD, "福宝"), None, CTX)
    assert exc.value.kind is ErrorKind.CHALLENGE


def test_weibo_output_is_read_in_china_time(tmp_path: Path) -> None:
    path = tmp_path / "1.json"
    path.write_text(
        json.dumps(
            {
                "user": {"id": "1", "screen_name": "成都大熊猫繁育研究基地"},
                "weibo": [
                    {
                        "id": 5012,
                        "bid": "Pabc",
                        "user_id": 1,
                        "screen_name": "成都大熊猫繁育研究基地",
                        "text": "和花今天\n很好",
                        "pics": "https://w/1.jpg,https://w/2.jpg",
                        "video_url": "",
                        "created_at": "2026-11-05T09:30:00",
                        "attitudes_count": 10,
                        "comments_count": 2,
                        "reposts_count": 1,
                    }
                ],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    [item] = read_output(path)
    assert item.url == "https://m.weibo.cn/detail/5012"
    assert item.title == "和花今天"
    assert item.published_at == datetime(2026, 11, 5, 1, 30, tzinfo=UTC)
    assert [m["url"] for m in item.media] == ["https://w/1.jpg", "https://w/2.jpg"]
    assert read_output(tmp_path / "missing.json") == []


def test_weibo_repost_exposes_the_original_author(tmp_path: Path) -> None:
    path = tmp_path / "1.json"
    post = {"id": 1, "user_id": 1, "text": "转发", "created_at": "2026-11-05T09:30:00"}
    path.write_text(
        json.dumps(
            {
                "user": {"id": "1"},
                "weibo": [
                    {**post, "retweet": {"id": 9, "user_id": 77, "screen_name": "北京动物园"}},
                    {**post, "id": 2},
                ],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    repost, original = read_output(path)
    assert repost.raw["original_author"] == {"accountId": "77", "name": "北京动物园"}
    assert original.raw["original_author"] is None


def test_mediacrawler_reads_only_new_complete_lines(tmp_path: Path) -> None:
    path = tmp_path / "search_contents_2026-11-05.jsonl"
    first = {
        "note_id": "a",
        "title": "福宝",
        "desc": "d",
        "time": 1762300000000,
        "creator_hash": "h",
        "nickname": "n**",
        "image_list": "https://i/1,https://i/2",
    }
    path.write_text(json.dumps(first) + "\n", encoding="utf-8")
    before = {path.name: path.stat().st_size}
    second = {**first, "note_id": "b"}
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(second) + "\n" + '{"note_id": "c", "par')  # c is half-written
    rows = read_new_rows([path], before)
    assert [r["note_id"] for r in rows] == ["b"]
    item = item_from_row("xhs", rows[0])
    assert item and item.author_id == "hash:h" and len(item.media) == 2
    assert item.url == "https://www.xiaohongshu.com/explore/b"


@pytest.mark.parametrize(
    ("log", "kind"),
    [
        ("Cookie 已失效，请重新登录", ErrorKind.LOGIN_EXPIRED),
        ("出现滑块验证", ErrorKind.CHALLENGE),
        ("HTTP 418 I'm a teapot", ErrorKind.RATE_LIMITED),
        ("共抓取 20 条微博", None),
    ],
)
def test_process_output_classification(log: str, kind: ErrorKind | None) -> None:
    assert process.classify(log) is kind
