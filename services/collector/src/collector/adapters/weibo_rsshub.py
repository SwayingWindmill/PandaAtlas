"""Weibo accounts through RSSHub's `/weibo/user/<uid>` route, which needs no login.

RSSHub reads the account with Weibo's visitor cookie, so only the latest page (about ten posts)
comes back and nothing older. That covers what a scheduled run needs; history still waits for a
logged-in weibo-crawler. A target's value is the numeric uid, as for weibo_crawler, so the account
registry and AIHOT see the same account either way.
"""

from __future__ import annotations

import html
import re
from dataclasses import replace

from collector.adapters.rss import RssAdapter, parse_feed
from collector.models import CollectError, ErrorKind, Item, Target, TargetKind

#: RSSHub's guid and link: https://weibo.com/<uid>/<bid>.
POST = re.compile(r"weibo\.com/\d+/([A-Za-z0-9]+)")
#: RSSHub writes a repost as `<blockquote> - 转发 <a href="https://weibo.com/<uid>">@name</a>:`.
REPOST = re.compile(r"转发\s*<a[^>]+href=\"https?://weibo\.com/(\d+)\"[^>]*>@([^<]+)</a>")
FEED_SUFFIX = "的微博"


def weibo_item(item: Item, uid: str) -> Item:
    post = POST.search(item.url) or POST.search(str(item.raw.get("id", "")))
    markup = str(item.raw.get("summary", ""))
    repost = REPOST.search(markup)
    author = item.author_name or ""
    return replace(
        item,
        platform="weibo",
        platform_item_id=post.group(1) if post else item.platform_item_id,
        author_id=uid,
        author_name=author.removesuffix(FEED_SUFFIX) or None,
        raw={
            **item.raw,
            "original_author": {
                "accountId": repost.group(1),
                "name": html.unescape(repost.group(2)),
            }
            if repost
            else None,
        },
    )


class WeiboRsshubAdapter(RssAdapter):
    name = "weibo_rsshub"
    platform = "weibo"

    def feed_url(self, target: Target) -> str:
        if target.kind is not TargetKind.ACCOUNT:
            raise CollectError(ErrorKind.NOT_FOUND, "weibo_rsshub reads accounts only")
        if not self.rsshub_url:
            raise CollectError(ErrorKind.NOT_FOUND, "RSSHUB_URL is not set")
        return f"{self.rsshub_url}/weibo/user/{target.value}"

    def parse(self, content: bytes, target: Target) -> list[Item]:
        return [weibo_item(item, target.value) for item in parse_feed(content, self.platform)]
