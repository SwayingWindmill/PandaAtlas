"""Read-only public Douban panda group adapter (strict group allowlist, zero PII/media).

Scrapes only anonymous discussion listings and public main-post text for three verified
giant-panda groups. Never collects comments, user profiles, or user-uploaded photos, and
immediately pauses on anti-bot or login walls without attempting any bypass.
"""

from __future__ import annotations

import html
import re
from datetime import datetime, timedelta, timezone
from urllib.parse import urljoin

import httpx

from collector.adapters.base import FetchContext, advance, http_error, request
from collector.adapters.rss import text_of
from collector.models import CollectError, ErrorKind, Item, JsonDict, Page, Target

BEIJING = timezone(timedelta(hours=8))
SITE = "https://www.douban.com"
ALLOWED_GROUP_IDS = frozenset({"745379", "740267", "56463"})
NEW_PER_RUN = 10
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)

ANTI_BOT_RE = re.compile(
    r"sec\.douban\.com|accounts\.douban\.com|captcha|滑块|验证码|异常请求",
    re.I,
)
PRIVATE_TOPIC_RE = re.compile(r"<title>\s*没有访问权限\s*</title>", re.I)

ROW_RE = re.compile(r"<tr\b[^>]*>(.*?)</tr>", re.S)
TOPIC_LINK_RE = re.compile(
    r'<a\b[^>]*href="(https://www\.douban\.com/group/topic/(\d+)/[^"]*)"[^>]*title="([^"]*)"[^>]*>(.*?)</a>',
    re.S,
)
ROW_TIME_RE = re.compile(r'<td\b[^>]*class="[^"]*\btime\b[^"]*"[^>]*>(.*?)</td>', re.S)

H1_RE = re.compile(r"<h1[^>]*>(.*?)</h1>", re.S)
CREATE_TIME_RE = re.compile(
    r'<span\b[^>]*class="[^"]*create-time[^"]*"[^>]*>\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})',
    re.S,
)
MAIN_BODY_RE = re.compile(
    r'<div\b[^>]*id="link-report"[^>]*>(.*?)(?:<div\b[^>]*class="topic-opts-bar"|<!--\s*投诉按钮|<div\b[^>]*class="sns-bar")',
    re.S,
)


def _is_challenge(response: httpx.Response) -> bool:
    return bool(ANTI_BOT_RE.search(f"{response.url}\n{response.text[:3000]}"))


def _parse_row_time(raw_time: str) -> datetime | None:
    text = text_of(raw_time)
    if not text:
        return None
    full_date = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})$", text)
    if full_date:
        y, m, d = map(int, full_date.groups())
        return datetime(y, m, d, tzinfo=BEIJING)
    month_day = re.match(r"^(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})$", text)
    if month_day:
        now_cst = datetime.now(BEIJING)
        m, d, hh, mm = map(int, month_day.groups())
        candidate = datetime(now_cst.year, m, d, hh, mm, tzinfo=BEIJING)
        if candidate > now_cst + timedelta(days=2):
            candidate = candidate.replace(year=now_cst.year - 1)
        return candidate
    return None


def parse_discussion_rows(listing_html: str) -> list[tuple[str, str, datetime | None]]:
    """Extract `(topic_id, title, row_time)` from Douban group table rows without author PII."""
    entries: list[tuple[str, str, datetime | None]] = []
    seen: set[str] = set()
    for row_html in ROW_RE.findall(listing_html):
        link = TOPIC_LINK_RE.search(row_html)
        if not link:
            continue
        topic_id = link.group(2)
        if topic_id in seen:
            continue
        seen.add(topic_id)
        title = html.unescape(link.group(3)).strip() or text_of(link.group(4))
        time_match = ROW_TIME_RE.search(row_html)
        parsed_time = _parse_row_time(time_match.group(1)) if time_match else None
        entries.append((topic_id, title, parsed_time))
    return entries


def parse_topic_page(
    group_id: str,
    topic_id: str,
    topic_html: str,
    *,
    listed_title: str,
    row_time: datetime | None,
) -> Item:
    title_match = H1_RE.search(topic_html)
    title = text_of(title_match.group(1)) if title_match else listed_title
    time_match = CREATE_TIME_RE.search(topic_html)
    published_at = (
        datetime.strptime(time_match.group(1), "%Y-%m-%d %H:%M:%S").replace(tzinfo=BEIJING)
        if time_match
        else row_time
    )
    body_match = MAIN_BODY_RE.search(topic_html)
    body = text_of(body_match.group(1)) if body_match else ""
    return Item(
        platform="douban",
        platform_item_id=topic_id,
        url=urljoin(SITE, f"/group/topic/{topic_id}/"),
        title=title or listed_title,
        body=body,
        author_id=None,
        author_name=f"豆瓣公开小组({group_id})",
        published_at=published_at,
        media=[],
        raw={"groupId": group_id, "topicId": topic_id, "titleOnly": not bool(body)},
    )


class DoubanGroupAdapter:
    name = "douban_group"
    platform = "douban"

    def __init__(self, client: httpx.AsyncClient):
        self.client = client

    async def _get(self, url: str) -> httpx.Response:
        response = await request(
            self.client,
            "GET",
            url,
            "douban_group",
            headers={"User-Agent": USER_AGENT, "Referer": f"{SITE}/"},
            follow_redirects=True,
        )
        if _is_challenge(response):
            raise CollectError(ErrorKind.CHALLENGE, f"douban_group: anti-bot wall at {url}")
        if response.status_code == 429:
            raise http_error(response, "douban_group")
        return response

    async def fetch(self, target: Target, cursor: JsonDict | None, ctx: FetchContext) -> Page:
        group_id = target.value.strip()
        if group_id not in ALLOWED_GROUP_IDS:
            raise CollectError(
                ErrorKind.NOT_FOUND,
                f"douban_group: group {group_id!r} is outside ALLOWED_GROUP_IDS",
            )
        listing_url = f"{SITE}/group/{group_id}/discussion?start=0"
        listing_response = await self._get(listing_url)
        if listing_response.status_code == 403:
            raise CollectError(
                ErrorKind.CHALLENGE,
                f"douban_group: HTTP 403 on group {group_id}",
            )
        if listing_response.status_code != 200:
            raise http_error(listing_response, "douban_group")

        entries = parse_discussion_rows(listing_response.text)
        if not entries:
            raise CollectError(
                ErrorKind.UPSTREAM_CHANGED,
                f"douban_group: no topics found on group {group_id}",
            )

        known = await ctx.known_ids(self.platform, [tid for tid, _, _ in entries])
        new_entries = [entry for entry in entries if entry[0] not in known][:NEW_PER_RUN]
        items: list[Item] = []
        for topic_id, listed_title, row_time in new_entries:
            topic_url = f"{SITE}/group/topic/{topic_id}/"
            topic_response = await self._get(topic_url)
            if topic_response.status_code == 200:
                items.append(
                    parse_topic_page(
                        group_id,
                        topic_id,
                        topic_response.text,
                        listed_title=listed_title,
                        row_time=row_time,
                    )
                )
            elif topic_response.status_code == 403 and PRIVATE_TOPIC_RE.search(topic_response.text):
                # Some group topics require member login to view details; keep only public title.
                items.append(
                    Item(
                        platform=self.platform,
                        platform_item_id=topic_id,
                        url=topic_url,
                        title=listed_title,
                        body="",
                        author_id=None,
                        author_name=f"豆瓣公开小组({group_id})",
                        published_at=row_time,
                        media=[],
                        raw={"groupId": group_id, "topicId": topic_id, "titleOnly": True},
                    )
                )
            elif topic_response.status_code == 403:
                raise CollectError(
                    ErrorKind.CHALLENGE,
                    f"douban_group: HTTP 403 on topic {topic_id}",
                )
            elif topic_response.status_code == 404:
                continue
            else:
                raise http_error(topic_response, "douban_group")

        return Page(items, advance(cursor, items), seen=len(entries))
