"""Weibo accounts through weibo-crawler (https://github.com/dataabc/weibo-crawler).

weibo-crawler has no licence, so it is never copied into this repository. It runs from its own
checkout on the collector host (`WEIBO_CRAWLER_DIR`). That checkout is dedicated to the collector:
each run rewrites its `config.json`, and keys left out are filled from its config.json.example.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from collector.adapters import process
from collector.adapters.base import FetchContext, advance, watermark
from collector.models import CollectError, ErrorKind, Item, JsonDict, Page, Target, TargetKind

SERVICE = "weibo-crawler"
#: weibo-crawler writes `created_at` as China local time without an offset.
WEIBO_TZ = ZoneInfo("Asia/Shanghai")
DTFORMAT = "%Y-%m-%dT%H:%M:%S"


def _urls(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(v) for v in value if v]
    return [v for v in str(value or "").split(",") if v.strip()]


def _original_author(weibo: dict[str, Any]) -> JsonDict | None:
    """weibo-crawler nests the reposted post under `retweet`, with its own `user_id`."""
    retweet = weibo.get("retweet")
    account_id = retweet.get("user_id") if isinstance(retweet, dict) else None
    if not account_id:
        return None
    return {"accountId": str(account_id), "name": retweet.get("screen_name")}


def item_from_weibo(weibo: dict[str, Any], user: dict[str, Any]) -> Item:
    created = weibo.get("created_at")
    media: list[JsonDict] = [{"type": "image", "url": u} for u in _urls(weibo.get("pics"))]
    media += [{"type": "video", "url": u} for u in _urls(weibo.get("video_url"))]
    text = weibo.get("text") or ""
    return Item(
        platform="weibo",
        platform_item_id=str(weibo["id"]),
        url=f"https://m.weibo.cn/detail/{weibo['id']}",
        title=text.split("\n", 1)[0][:80],
        body=text,
        author_id=str(weibo.get("user_id") or user.get("id") or "") or None,
        author_name=weibo.get("screen_name") or user.get("screen_name"),
        published_at=datetime.strptime(created, DTFORMAT).replace(tzinfo=WEIBO_TZ)
        if created
        else None,
        media=media,
        metrics={
            "likes": weibo.get("attitudes_count"),
            "comments": weibo.get("comments_count"),
            "reposts": weibo.get("reposts_count"),
        },
        raw={
            **{
                k: weibo.get(k)
                for k in (
                    "bid",
                    "topics",
                    "at_users",
                    "location",
                    "source",
                    "article_url",
                    "retweet",
                )
            },
            "original_author": _original_author(weibo),
        },
    )


def read_output(path: Path) -> list[Item]:
    if not path.is_file():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    user = data.get("user") or {}
    return [item_from_weibo(w, user) for w in data.get("weibo") or [] if w.get("id")]


class WeiboCrawlerAdapter:
    name = "weibo_crawler"
    platform = "weibo"

    def __init__(self, checkout: Path, command: str, cookie: str | None, state_dir: Path):
        self.checkout = checkout
        self.command = command
        self.cookie = cookie
        self.output_dir = state_dir / "weibo-crawler"

    def since(self, target: Target, cursor: JsonDict | None) -> str:
        mark = watermark(cursor)
        if mark:
            # One hour of overlap: posts published around the last run are read again and
            # deduplicated, rather than missed.
            return (mark.astimezone(WEIBO_TZ) - timedelta(hours=1)).strftime(DTFORMAT)
        return str(target.params.get("since_days", 3))

    async def fetch(self, target: Target, cursor: JsonDict | None, ctx: FetchContext) -> Page:
        if target.kind is not TargetKind.ACCOUNT:
            raise CollectError(ErrorKind.NOT_FOUND, f"{self.name} only supports accounts")
        if not self.cookie:
            raise CollectError(ErrorKind.LOGIN_EXPIRED, f"{SERVICE}: WEIBO_COOKIE is not set")
        output = self.output_dir / target.value / f"{target.value}.json"
        output.unlink(missing_ok=True)
        config = {
            "user_id_list": [target.value],
            "only_crawl_original": int(target.params.get("only_original", 0)),
            "since_date": self.since(target, cursor),
            "write_mode": ["json"],
            "output_directory": str(self.output_dir),
            "user_id_as_folder_name": 1,
            "remove_html_tag": 1,
            "original_pic_download": 0,
            "retweet_pic_download": 0,
            "original_video_download": 0,
            "retweet_video_download": 0,
            "original_live_photo_download": 0,
            "retweet_live_photo_download": 0,
            "download_comment": 0,
            "download_repost": 0,
            "cookie": self.cookie,
        }
        (self.checkout / "config.json").write_text(
            json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        await process.run(
            self.command, [], self.checkout, int(target.params.get("timeout", 900)), SERVICE
        )
        items = read_output(output)
        return Page(items, advance(cursor, items))
