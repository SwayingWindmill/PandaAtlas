"""Beijing Zoo's site: a news list written into a script, and one page per article."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import httpx
import pytest

from collector.adapters.base import FetchContext
from collector.adapters.bjzoo import BjzooAdapter
from collector.models import CollectError, ErrorKind, Target, TargetKind, Tier

pytestmark = pytest.mark.anyio

LISTING = """<html><body><script>var config = { newsList: [
  { id: 8406, title: "\\u91CD\\u78C5!\\u5927\\u718A\\u732B\\u65B0\\u9986" },
  { id: 8405, title: "\\u56ED\\u5185\\u516C\\u544A" },
  { id: 8403, title: "older" }
] };</script></body></html>"""

ARTICLE = """<html><body><div class="announcement noBg">
<h2>重磅官宣!北京动物园大熊猫新馆于7月16日正式开放</h2>
<p class="time">2026年07月16日</p> <p class="content"></p>
<!-- <div th:if="${img != null}">-->
<!-- <img th:src="${img}" th:alt="${title}></img>--> <!-- </div>-->
<p class="content">
<p><img src="/uploadedFiles/dxm3.jpg" alt=""></p>
<p>&nbsp;欢迎广大游客前来参观游览，近距离邂逅可爱的大熊猫们！</p><p><br></p></p> </div>
<div class="footer"><p>友情链接</p></div></body></html>"""


def target(value: str) -> Target:
    return Target(
        f"bjzoo:account:{value}",
        "bjzoo",
        TargetKind.ACCOUNT,
        value,
        "北京动物园",
        Tier.OFFICIAL,
        240,
        {},
    )


async def test_reads_the_script_list_and_only_new_articles() -> None:
    fetched: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        fetched.append(request.url.path)
        if request.url.path == "/activityParkAnnouncement.html":
            return httpx.Response(200, text=LISTING)
        if request.url.path == "/content_8406.html":
            return httpx.Response(200, text=ARTICLE)
        raise AssertionError(request.url)

    async def known(platform: str, ids: Any) -> set[str]:
        assert platform == "web"
        return {"bjzoo:8405", "bjzoo:8403"}

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        page = await BjzooAdapter(client).fetch(
            target("activityParkAnnouncement"), None, FetchContext(known_ids=known)
        )

    assert fetched == ["/activityParkAnnouncement.html", "/content_8406.html"]
    assert page.seen == 3
    [item] = page.items
    assert item.platform_item_id == "bjzoo:8406"
    assert item.url == "https://www.bjzoo.com/content_8406.html"
    assert item.title == "重磅官宣!北京动物园大熊猫新馆于7月16日正式开放"
    assert item.body == "欢迎广大游客前来参观游览，近距离邂逅可爱的大熊猫们！"
    assert item.media == [{"type": "image", "url": "https://www.bjzoo.com/uploadedFiles/dxm3.jpg"}]
    # The page prints the day in Beijing.
    assert item.published_at == datetime(2026, 7, 15, 16, tzinfo=UTC)
    assert item.author_name == "北京动物园"


async def test_a_page_without_the_list_is_an_upstream_change() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text="<html><body>redesigned</body></html>")

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(CollectError) as caught:
            await BjzooAdapter(client).fetch(
                target("activityParkAnnouncement"),
                None,
                FetchContext(known_ids=lambda p, i: _none()),
            )
    assert caught.value.kind is ErrorKind.UPSTREAM_CHANGED


async def _none() -> set[str]:
    return set()
