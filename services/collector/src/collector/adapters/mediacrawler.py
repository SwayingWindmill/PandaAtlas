"""MediaCrawler (https://github.com/NanmiCoder/MediaCrawler) as the phase-one comparison collector.

Its NON-COMMERCIAL LEARNING LICENSE forbids commercial use and large-scale crawling, so it is off
unless `MEDIACRAWLER_DIR` is set and must not become the production collector (ADR 0004). It also
hashes creator ids and masks nicknames in its output, so its items cannot be tied to an account.

It runs from its own checkout and appends to `data/<platform>/jsonl/<type>_contents_<date>.jsonl`.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from collector.adapters import process
from collector.adapters.base import FetchContext, advance, from_timestamp
from collector.models import CollectError, ErrorKind, Item, JsonDict, Page, Target, TargetKind

SERVICE = "mediacrawler"

#: MediaCrawler platform flag -> (our platform, output directory names it writes under data/).
PLATFORMS: dict[str, tuple[str, tuple[str, ...]]] = {
    "xhs": ("xiaohongshu", ("xhs",)),
    "dy": ("douyin", ("douyin",)),
    "wb": ("weibo", ("weibo",)),
    "bili": ("bilibili", ("bili", "bilibili")),
}


def _split(value: Any) -> list[str]:
    return [v for v in str(value or "").split(",") if v.strip()]


def item_from_row(flag: str, row: dict[str, Any]) -> Item | None:
    platform = PLATFORMS[flag][0]
    author = {
        "author_id": f"hash:{row['creator_hash']}" if row.get("creator_hash") else None,
        "author_name": row.get("nickname"),
    }
    if flag == "xhs" and row.get("note_id"):
        media = [{"type": "image", "url": u} for u in _split(row.get("image_list"))]
        if row.get("video_url"):
            media.append({"type": "video", "url": row["video_url"]})
        return Item(
            platform,
            row["note_id"],
            row.get("note_url") or f"https://www.xiaohongshu.com/explore/{row['note_id']}",
            row.get("title") or "",
            row.get("desc") or "",
            published_at=from_timestamp(row.get("time")),
            media=media,
            metrics=_counts(row, "liked_count", "comment_count", "collected_count", "share_count"),
            raw={"tags": row.get("tag_list"), "ip_location": row.get("ip_location")},
            **author,
        )
    if flag == "dy" and row.get("aweme_id"):
        media = (
            [{"type": "video", "url": row["video_download_url"]}]
            if row.get("video_download_url")
            else []
        )
        return Item(
            platform,
            str(row["aweme_id"]),
            row.get("aweme_url") or f"https://www.douyin.com/video/{row['aweme_id']}",
            (row.get("title") or "")[:80],
            row.get("desc") or "",
            published_at=from_timestamp(row.get("create_time")),
            media=media,
            metrics=_counts(row, "liked_count", "comment_count", "collected_count", "share_count"),
            raw={"cover_url": row.get("cover_url")},
            **author,
        )
    if flag == "wb" and row.get("note_id"):
        text = row.get("content") or ""
        return Item(
            platform,
            str(row["note_id"]),
            row.get("note_url") or f"https://m.weibo.cn/detail/{row['note_id']}",
            text.split("\n", 1)[0][:80],
            text,
            published_at=from_timestamp(row.get("create_time")),
            metrics=_counts(row, "liked_count", "comments_count", "shared_count"),
            raw={"source_keyword": row.get("source_keyword")},
            **author,
        )
    if flag == "bili" and row.get("video_id"):
        return Item(
            platform,
            str(row["video_id"]),
            row.get("video_url") or f"https://www.bilibili.com/video/av{row['video_id']}",
            row.get("title") or "",
            row.get("desc") or "",
            published_at=from_timestamp(row.get("create_time")),
            metrics=_counts(
                row, "liked_count", "video_play_count", "video_comment", "video_favorite_count"
            ),
            **author,
        )
    return None


def _counts(row: dict[str, Any], *keys: str) -> JsonDict:
    return {k: row[k] for k in keys if row.get(k) not in (None, "")}


def read_new_rows(files: list[Path], offsets: dict[str, int]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for path in files:
        start = offsets.get(path.name, 0)
        with path.open("rb") as handle:
            handle.seek(start)
            chunk = handle.read()
        # Only whole lines; a line still being written is read next time.
        complete = chunk[: chunk.rfind(b"\n") + 1]
        for line in complete.decode("utf-8").splitlines():
            if line.strip():
                rows.append(json.loads(line))
    return rows


class MediaCrawlerAdapter:
    name = "mediacrawler"
    platform = "multi"

    def __init__(self, checkout: Path, command: str):
        self.checkout = checkout
        self.command = command

    def _args(self, flag: str, target: Target) -> tuple[str, list[str]]:
        common = [
            "--platform",
            flag,
            "--lt",
            target.params.get("login_type", "qrcode"),
            "--save_data_option",
            "jsonl",
            "--get_comment",
            "no",
        ]
        if target.kind is TargetKind.KEYWORD:
            return "search", [*common, "--type", "search", "--keywords", target.value]
        if target.kind is TargetKind.ACCOUNT:
            return "creator", [*common, "--type", "creator", "--creator_id", target.value]
        raise CollectError(ErrorKind.NOT_FOUND, f"{self.name} does not support {target.kind}")

    async def fetch(self, target: Target, cursor: JsonDict | None, ctx: FetchContext) -> Page:
        flag = target.params.get("platform")
        if flag not in PLATFORMS:
            raise CollectError(
                ErrorKind.NOT_FOUND, f"params.platform must be one of {list(PLATFORMS)}"
            )
        crawler_type, args = self._args(flag, target)
        # Every target of a type appends to the same daily file, so what this run wrote is what
        # lies past the sizes measured just before it. The scheduler runs one target per adapter
        # at a time, which keeps that true.
        before = {p.name: p.stat().st_size for p in self._outputs(flag, crawler_type)}
        await process.run(
            self.command, args, self.checkout, int(target.params.get("timeout", 1200)), SERVICE
        )
        rows = read_new_rows(self._outputs(flag, crawler_type), before)
        items = [i for i in (item_from_row(flag, r) for r in rows) if i]
        return Page(items, advance(cursor, items))

    def _outputs(self, flag: str, crawler_type: str) -> list[Path]:
        return sorted(
            path
            for directory in PLATFORMS[flag][1]
            for path in (self.checkout / "data" / directory / "jsonl").glob(
                f"{crawler_type}_contents_*.jsonl"
            )
        )
