"""Beijing Zoo (bjzoo.com): each list page writes its articles into `var config = { newsList }`.

AIHOT cannot read this site: its server folds the Content-Security-Policy header over bare line
feeds, which undici refuses (HPE_CR_EXPECTED) and httpx accepts. A target's value is the list
page's name (`activityNewsInsideOutsidePark`, `activityParkAnnouncement`). The list holds only ids
and titles, so each new article's own page gives its date, text and images.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone
from urllib.parse import urljoin

import httpx

from collector.adapters.base import FetchContext, advance, http_error, request
from collector.adapters.rss import IMG, text_of
from collector.models import CollectError, ErrorKind, Item, JsonDict, Page, Target

SITE = "https://www.bjzoo.com/"
BEIJING = timezone(timedelta(hours=8))
COMMENT = re.compile(r"<!--.*?-->", re.S)
ENTRY = re.compile(r'\{\s*id:\s*(\d+),\s*title:\s*"((?:[^"\\]|\\.)*)"\s*\}')
TITLE = re.compile(r'<div class="announcement[^"]*">\s*<h2>(.*?)</h2>', re.S)
DAY = re.compile(r'<p class="time">\s*(\d{4})年(\d{1,2})月(\d{1,2})日')
# The article runs from its first content paragraph to the end of the announcement block.
BODY = re.compile(r'<p class="time">.*?</p>(.*?)</div>', re.S)
#: Articles read per run; the list goes back years, and the first run should not read all of it.
NEW_PER_RUN = 10


class BjzooAdapter:
    name = "bjzoo"
    platform = "web"

    def __init__(self, client: httpx.AsyncClient):
        self.client = client

    async def _get(self, url: str) -> str:
        response = await request(self.client, "GET", url, "bjzoo", follow_redirects=True)
        if response.status_code != 200:
            raise http_error(response, "bjzoo")
        return response.text

    async def fetch(self, target: Target, cursor: JsonDict | None, ctx: FetchContext) -> Page:
        listing = await self._get(urljoin(SITE, f"{target.value}.html"))
        start = listing.find("newsList")
        entries = (
            [(i, json.loads(f'"{t}"')) for i, t in ENTRY.findall(listing[start:])]
            if start >= 0
            else []
        )
        if not entries:
            raise CollectError(ErrorKind.UPSTREAM_CHANGED, f"bjzoo: no newsList on {target.value}")
        known = await ctx.known_ids(self.platform, [f"bjzoo:{i}" for i, _ in entries])
        new = [(i, t) for i, t in entries if f"bjzoo:{i}" not in known][:NEW_PER_RUN]
        items = [await self._article(article_id, title) for article_id, title in new]
        return Page(items, advance(cursor, items), seen=len(entries))

    async def _article(self, article_id: str, listed_title: str) -> Item:
        url = urljoin(SITE, f"content_{article_id}.html")
        # Commented-out template markup (`<!-- </div>-->`) would end the body early.
        page = COMMENT.sub("", await self._get(url))
        title = TITLE.search(page)
        day = DAY.search(page)
        body = BODY.search(page)
        markup = body.group(1) if body else ""
        return Item(
            platform=self.platform,
            platform_item_id=f"bjzoo:{article_id}",
            url=url,
            title=text_of(title.group(1)) if title else listed_title,
            body=text_of(markup),
            author_name="北京动物园",
            published_at=datetime(*map(int, day.groups()), tzinfo=BEIJING) if day else None,
            media=[{"type": "image", "url": urljoin(url, src)} for src in IMG.findall(markup)],
            raw={"id": article_id, "listed_title": listed_title},
        )
