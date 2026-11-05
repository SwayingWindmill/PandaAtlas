"""Xiaohongshu through a local xiaohongshu-mcp server (https://github.com/xpzouying/xiaohongshu-mcp).

The server drives a logged-in browser, so every call is slow (seconds) and list entries carry no
publish time. New notes get one detail call each, capped per run by `detail_limit`.
"""

from __future__ import annotations

import re
from typing import Any

import httpx

from collector.adapters.base import (
    FetchContext,
    advance,
    from_timestamp,
    http_error,
    request,
)
from collector.models import CollectError, ErrorKind, Item, JsonDict, Page, Target, TargetKind

SERVICE = "xiaohongshu-mcp"
CHALLENGE_TEXT = re.compile(r"验证码|安全验证|滑块|captcha|风控", re.I)


def note_url(note_id: str, xsec_token: str | None) -> str:
    url = f"https://www.xiaohongshu.com/explore/{note_id}"
    return f"{url}?xsec_token={xsec_token}&xsec_source=pc_feed" if xsec_token else url


def item_from_feed(feed: dict[str, Any]) -> Item:
    card = feed.get("noteCard") or {}
    user = card.get("user") or {}
    cover = (card.get("cover") or {}).get("urlDefault") or (card.get("cover") or {}).get("url")
    return Item(
        platform="xiaohongshu",
        platform_item_id=feed["id"],
        url=note_url(feed["id"], feed.get("xsecToken")),
        title=card.get("displayTitle") or "",
        author_id=user.get("userId"),
        author_name=user.get("nickname") or user.get("nickName"),
        media=[{"type": "image", "url": cover}] if cover else [],
        metrics=_metrics(card.get("interactInfo")),
        raw={"feed": feed},
    )


def item_from_detail(note: dict[str, Any], feed: dict[str, Any]) -> Item:
    user = note.get("user") or {}
    media: list[JsonDict] = [
        {"type": "image", "url": img.get("urlDefault") or img.get("urlPre")}
        for img in note.get("imageList") or []
        if img.get("urlDefault") or img.get("urlPre")
    ]
    if note.get("video"):
        media.append(
            {"type": "video", "duration": (note["video"].get("capa") or {}).get("duration")}
        )
    note_id = note.get("noteId") or feed["id"]
    return Item(
        platform="xiaohongshu",
        platform_item_id=note_id,
        url=note_url(note_id, note.get("xsecToken") or feed.get("xsecToken")),
        title=note.get("title") or (feed.get("noteCard") or {}).get("displayTitle") or "",
        body=note.get("desc") or "",
        author_id=user.get("userId"),
        author_name=user.get("nickname") or user.get("nickName"),
        published_at=from_timestamp(note.get("time")),
        media=media,
        metrics=_metrics(note.get("interactInfo")),
        raw={"note": note, "ip_location": note.get("ipLocation")},
    )


def _metrics(info: dict[str, Any] | None) -> JsonDict:
    info = info or {}
    keys = {
        "likedCount": "likes",
        "commentCount": "comments",
        "collectedCount": "collects",
        "sharedCount": "shares",
    }
    return {ours: info[theirs] for theirs, ours in keys.items() if info.get(theirs) is not None}


class XhsMcpAdapter:
    name = "xhs_mcp"
    platform = "xiaohongshu"

    def __init__(self, client: httpx.AsyncClient, base_url: str, token: str | None):
        self.client = client
        self.base_url = base_url.rstrip("/")
        self.headers = {"Authorization": f"Bearer {token}"} if token else {}

    async def _call(self, method: str, path: str, **kwargs: Any) -> Any:
        response = await request(
            self.client,
            method,
            self.base_url + path,
            SERVICE,
            headers=self.headers,
            timeout=180,
            **kwargs,
        )
        if response.status_code == 200:
            body = response.json()
            if body.get("success"):
                return body.get("data")
        await self._raise(response)

    async def _raise(self, response: httpx.Response) -> None:
        text = response.text
        if CHALLENGE_TEXT.search(text):
            raise CollectError(ErrorKind.CHALLENGE, f"{SERVICE}: {text[:300]}")
        if response.status_code >= 500 and not await self.logged_in():
            raise CollectError(ErrorKind.LOGIN_EXPIRED, f"{SERVICE}: not logged in")
        raise http_error(response, SERVICE)

    async def logged_in(self) -> bool:
        response = await request(
            self.client,
            "GET",
            f"{self.base_url}/api/v1/login/status",
            SERVICE,
            headers=self.headers,
            timeout=120,
        )
        if response.status_code != 200:
            return True  # Unknown; let the original error stand.
        return bool((response.json().get("data") or {}).get("is_logged_in"))

    async def list_feeds(self, target: Target) -> list[dict[str, Any]]:
        if target.kind is TargetKind.ACCOUNT:
            token = target.params.get("xsec_token")
            if not token:
                raise CollectError(ErrorKind.NOT_FOUND, "account target needs params.xsec_token")
            data = await self._call(
                "POST",
                "/api/v1/user/profile",
                json={"user_id": target.value, "xsec_token": token},
            )
            return ((data or {}).get("data") or {}).get("feeds") or []
        if target.kind is TargetKind.KEYWORD:
            filters = {"sort_by": "最新", **target.params.get("filters", {})}
            data = await self._call(
                "POST", "/api/v1/feeds/search", json={"keyword": target.value, "filters": filters}
            )
            return (data or {}).get("feeds") or []
        raise CollectError(ErrorKind.NOT_FOUND, f"{self.name} does not support {target.kind}")

    async def fetch(self, target: Target, cursor: JsonDict | None, ctx: FetchContext) -> Page:
        feeds = [f for f in await self.list_feeds(target) if f.get("id")]
        known = await ctx.known_ids(self.platform, [f["id"] for f in feeds])
        budget = int(target.params.get("detail_limit", 10))
        items = []
        for feed in feeds:
            # A list entry has no body, so saving it over a stored detail would look like an
            # edit. Known notes are skipped; unknown ones over budget get their detail next run.
            if feed["id"] in known or budget <= 0:
                continue
            budget -= 1
            data = await self._call(
                "POST",
                "/api/v1/feeds/detail",
                json={"feed_id": feed["id"], "xsec_token": feed.get("xsecToken", "")},
            )
            note = (((data or {}).get("data") or {}).get("note")) or {}
            items.append(item_from_detail(note, feed) if note else item_from_feed(feed))
        return Page(items, advance(cursor, items), seen=len(feeds))
