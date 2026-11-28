"""RSS and Atom feeds: official sites with a feed, and RSSHub routes for sites without one."""

from __future__ import annotations

import calendar
import html
import re
from datetime import UTC, datetime
from typing import Any

import feedparser
import httpx

from collector.adapters.base import FetchContext, advance, http_error, request
from collector.models import CollectError, ErrorKind, Item, JsonDict, Page, Target

TAG = re.compile(r"<[^>]+>")
IMG = re.compile(r"<img[^>]+src=[\"']([^\"']+)", re.I)


def text_of(markup: str) -> str:
    text = TAG.sub(" ", markup.replace("<br>", "\n").replace("<br/>", "\n"))
    return re.sub(r"[ \t　]+", " ", html.unescape(text)).strip()


def _published(entry: Any) -> datetime | None:
    parsed = entry.get("published_parsed") or entry.get("updated_parsed")
    return datetime.fromtimestamp(calendar.timegm(parsed), UTC) if parsed else None


def parse_feed(content: bytes, platform: str) -> list[Item]:
    feed = feedparser.parse(content)
    if feed.bozo and not feed.entries:
        raise CollectError(ErrorKind.UPSTREAM_CHANGED, f"unparseable feed: {feed.bozo_exception!r}")
    items = []
    for entry in feed.entries:
        link = entry.get("link") or ""
        identity = entry.get("id") or link
        if not identity or not link:
            continue
        markup = (entry.get("content") or [{}])[0].get("value") or entry.get("summary", "")
        media = [{"type": "image", "url": u} for u in IMG.findall(markup)]
        media += [
            {"type": (e.get("type") or "file").split("/")[0], "url": e["href"]}
            for e in entry.get("enclosures", [])
            if e.get("href")
        ]
        body = text_of(markup)
        items.append(
            Item(
                platform=platform,
                platform_item_id=identity,
                url=link,
                title=text_of(entry.get("title", "")) or body[:80],
                body=body,
                author_name=entry.get("author") or feed.feed.get("title"),
                published_at=_published(entry),
                media=media,
                raw={k: entry[k] for k in ("id", "link", "title", "summary") if k in entry},
            )
        )
    return items


class RssAdapter:
    name = "rss"
    platform = "web"

    def __init__(self, client: httpx.AsyncClient, rsshub_url: str | None):
        self.client = client
        self.rsshub_url = (rsshub_url or "").rstrip("/")

    def feed_url(self, target: Target) -> str:
        # An RSSHub route is written as "rsshub:/weibo/user/123" so the host stays configurable.
        if target.value.startswith("rsshub:"):
            if not self.rsshub_url:
                raise CollectError(ErrorKind.NOT_FOUND, "RSSHUB_URL is not set")
            return self.rsshub_url + target.value.removeprefix("rsshub:")
        return target.value

    def parse(self, content: bytes, target: Target) -> list[Item]:
        return parse_feed(content, target.params.get("platform", self.platform))

    async def fetch(self, target: Target, cursor: JsonDict | None, ctx: FetchContext) -> Page:
        cursor = dict(cursor or {})
        headers = {}
        if cursor.get("etag"):
            headers["If-None-Match"] = cursor["etag"]
        if cursor.get("last_modified"):
            headers["If-Modified-Since"] = cursor["last_modified"]
        response = await request(
            self.client,
            "GET",
            self.feed_url(target),
            "rss",
            headers=headers,
            follow_redirects=True,
        )
        if response.status_code == 304:
            return Page([], cursor, not_modified=True)
        if response.status_code != 200:
            raise http_error(response, "rss")
        items = self.parse(response.content, target)
        cursor = advance(cursor, items)
        for header, key in (("etag", "etag"), ("last-modified", "last_modified")):
            if response.headers.get(header):
                cursor[key] = response.headers[header]
        return Page(items, cursor)
