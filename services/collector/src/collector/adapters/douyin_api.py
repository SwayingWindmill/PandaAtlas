"""Douyin (and Bilibili) through a self-hosted Douyin_TikTok_Download_API v5
(https://github.com/Evil0ctal/Douyin_TikTok_Download_API).

Data endpoints are asynchronous: `?wait=` holds the request up to the server limit (30 s by
default); a 202 means still running, and the task is polled rather than resubmitted.
"""

from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any

import httpx

from collector.adapters.base import (
    FetchContext,
    advance,
    http_error,
    max_pages,
    reached,
    request,
    watermark,
)
from collector.models import CollectError, ErrorKind, Item, JsonDict, Page, Target, TargetKind

SERVICE = "douyin-api"
WAIT_SECONDS = 25
POLLS = 4

ERROR_KINDS = {
    "UNAUTHENTICATED": ErrorKind.LOGIN_EXPIRED,
    "IDENTITY_LOGIN_REQUIRED": ErrorKind.LOGIN_EXPIRED,
    "RATE_LIMITED": ErrorKind.RATE_LIMITED,
    "IDENTITY_POOL_EXHAUSTED": ErrorKind.RATE_LIMITED,
    "ENDPOINT_CIRCUIT_OPEN": ErrorKind.RATE_LIMITED,
    "QUEUE_FULL": ErrorKind.RATE_LIMITED,
    "UPSTREAM_RISK_CONTROL": ErrorKind.CHALLENGE,
    "UPSTREAM_CHANGED": ErrorKind.UPSTREAM_CHANGED,
    "SIGNING_FAILED": ErrorKind.UPSTREAM_CHANGED,
    "NOT_FOUND": ErrorKind.NOT_FOUND,
    "CONTENT_PRIVATE": ErrorKind.NOT_FOUND,
    "INVALID_PARAM": ErrorKind.NOT_FOUND,
}


def error_from(payload: dict[str, Any] | None, fallback: str) -> CollectError:
    payload = payload or {}
    code = payload.get("code") or "UNKNOWN"
    return CollectError(
        ERROR_KINDS.get(code, ErrorKind.TRANSIENT),
        f"{SERVICE}: {code} {payload.get('message', fallback)}",
        retry_after_seconds=payload.get("retry_after"),
    )


def item_from_content(content: dict[str, Any]) -> Item:
    author = content.get("author") or {}
    created = content.get("created_at")
    return Item(
        platform=content.get("platform") or "douyin",
        platform_item_id=str(content["content_id"]),
        url=content.get("web_url") or "",
        title=content.get("title") or (content.get("description") or "")[:80],
        body=content.get("description") or "",
        author_id=author.get("uid"),
        author_name=author.get("nickname"),
        published_at=datetime.fromisoformat(created) if created else None,
        media=[{"type": content.get("kind") or "video", **(content.get("media") or {})}],
        metrics=content.get("stats") or {},
        raw={k: content.get(k) for k in ("kind", "tags", "location", "duration_ms", "music")},
    )


class DouyinApiAdapter:
    name = "douyin_api"
    platform = "douyin"

    def __init__(self, client: httpx.AsyncClient, base_url: str, api_key: str | None):
        self.client = client
        self.base_url = base_url.rstrip("/")
        self.headers = {"X-API-Key": api_key} if api_key else {}

    async def _get(self, path: str, params: dict[str, Any]) -> dict[str, Any]:
        response = await request(
            self.client,
            "GET",
            self.base_url + path,
            SERVICE,
            headers=self.headers,
            params={**params, "wait": WAIT_SECONDS},
            timeout=WAIT_SECONDS + 15,
        )
        for _ in range(POLLS):
            body = _json(response)
            if response.status_code == 200 and body.get("success"):
                data = body.get("data") or {}
                if "state" not in data:
                    return data
                if data["state"] == "done":
                    return data.get("data") or {}
                if data["state"] == "failed":
                    raise error_from(data.get("error"), "task failed")
            elif response.status_code != 202:
                if body.get("error"):
                    raise error_from(body["error"], response.text[:200])
                raise http_error(response, SERVICE)
            task_id = (body.get("data") or {}).get("task_id")
            if not task_id:
                raise CollectError(ErrorKind.UPSTREAM_CHANGED, f"{SERVICE}: 202 without task_id")
            await asyncio.sleep(1)
            response = await request(
                self.client,
                "GET",
                f"{self.base_url}/api/v1/tasks/{task_id}",
                SERVICE,
                headers=self.headers,
                timeout=30,
            )
        raise CollectError(ErrorKind.TRANSIENT, f"{SERVICE}: task still running")

    def _endpoint(self, target: Target) -> tuple[str, dict[str, Any]]:
        platform = target.params.get("platform", self.platform)
        if target.kind is TargetKind.ACCOUNT:
            return f"/api/v1/{platform}/user/posts", {"sec_user_id": target.value}
        if target.kind is TargetKind.KEYWORD:
            return f"/api/v1/{platform}/search/posts", {"keyword": target.value}
        raise CollectError(ErrorKind.NOT_FOUND, f"{self.name} does not support {target.kind}")

    async def fetch(self, target: Target, cursor: JsonDict | None, ctx: FetchContext) -> Page:
        path, params = self._endpoint(target)
        mark = watermark(cursor)
        items: list[Item] = []
        page_cursor: str | None = None
        for _ in range(max_pages(target)):
            query = {**params, "count": target.params.get("count", 20)}
            if page_cursor:
                query["cursor"] = page_cursor
            data = await self._get(path, query)
            page = [item_from_content(c) for c in data.get("items") or [] if c.get("content_id")]
            items.extend(page)
            page_cursor = data.get("cursor")
            # Keyword results are ranked, not dated, so only the first page is read.
            if (
                target.kind is TargetKind.KEYWORD
                or not data.get("has_more")
                or not page_cursor
                or reached(page, mark)
            ):
                break
        return Page(items, advance(cursor, items))


def _json(response: httpx.Response) -> dict[str, Any]:
    try:
        body = response.json()
    except ValueError:
        return {}
    return body if isinstance(body, dict) else {}
