"""Store, scheduler, AIHOT push and report against a real PostgreSQL."""

from __future__ import annotations

import asyncio
import json
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import pytest

from collector import aihot, report
from collector.adapters.base import FetchContext
from collector.models import CollectError, ErrorKind, Item, JsonDict, Page, Target, TargetKind, Tier
from collector.scheduler import Scheduler
from collector.store import Store

pytestmark = pytest.mark.anyio


def make_target(adapter: str, value: str, tier: Tier = Tier.KEY_ACCOUNT, **params: Any) -> Target:
    return Target(
        f"{adapter}:{value}", adapter, TargetKind.ACCOUNT, value, f"label {value}", tier, 60, params
    )


def item(item_id: str, body: str = "福宝在吃竹子", published: datetime | None = None) -> Item:
    return Item(
        "weibo",
        item_id,
        f"https://m.weibo.cn/detail/{item_id}",
        body[:10],
        body,
        author_id="1",
        author_name="基地",
        published_at=published or datetime.now(UTC) - timedelta(minutes=5),
        media=[{"type": "image", "url": f"https://signed/{item_id}?t=1"}],
    )


class FakeAdapter:
    platform = "weibo"

    def __init__(self, name: str, pages: list[Page | CollectError]):
        self.name = name
        self.pages = pages
        self.cursors: list[JsonDict | None] = []

    async def fetch(self, target: Target, cursor: JsonDict | None, ctx: FetchContext) -> Page:
        self.cursors.append(cursor)
        result = self.pages.pop(0)
        if isinstance(result, CollectError):
            raise result
        return result


def tagger(it: Item) -> list[str]:
    return ["fu-bao"] if "福宝" in it.body else []


async def count(store: Store, table: str) -> int:
    return (await store.query(f"SELECT count(*) AS n FROM {table}"))[0]["n"]


async def test_sync_disables_removed_targets_and_keeps_history(store: Store) -> None:
    a, b = make_target("rss", "a"), make_target("rss", "b")
    assert await store.sync_targets([a, b]) == (2, 0)
    assert await store.sync_targets([a]) == (1, 1)
    rows = await store.query("SELECT id, enabled FROM targets ORDER BY id")
    assert [(r["id"], r["enabled"]) for r in rows] == [("rss:a", True), ("rss:b", False)]


async def test_versions_outbox_and_sightings(store: Store) -> None:
    t1, t2 = make_target("weibo_crawler", "1"), make_target("rss", "feed")
    await store.sync_targets([t1, t2])

    first = await store.save_page(t1, Page([item("100")], {"watermark": "x"}), tagger)
    assert (first.created, first.revised) == (1, 0)
    # Same text, new signed media URL and counters from another collector: not a new version.
    again = await store.save_page(t2, Page([item("100")]), tagger)
    assert (again.created, again.revised) == (0, 0)
    edited = await store.save_page(t1, Page([item("100", body="福宝在睡觉")]), tagger)
    assert edited.revised == 1

    [row] = await store.query("SELECT version, body, panda_slugs FROM items")
    assert (row["version"], row["body"], row["panda_slugs"]) == (2, "福宝在睡觉", ["fu-bao"])
    assert await count(store, "item_versions") == 2
    assert await count(store, "outbox") == 2
    sightings = await store.query("SELECT target_id FROM item_sightings ORDER BY target_id")
    assert [s["target_id"] for s in sightings] == ["rss:feed", "weibo_crawler:1"]
    [cursor] = await store.query("SELECT cursor FROM targets WHERE id = 'weibo_crawler:1'")
    assert cursor["cursor"] is None  # The last save carried no cursor.


async def test_login_expiry_pauses_only_that_adapter(store: Store) -> None:
    weibo = [make_target("weibo_crawler", "1"), make_target("weibo_crawler", "2")]
    feed = make_target("rss", "feed", Tier.OFFICIAL)
    await store.sync_targets([*weibo, feed])
    broken = FakeAdapter(
        "weibo_crawler",
        [
            CollectError(ErrorKind.LOGIN_EXPIRED, "cookie expired"),
            Page([item("never")]),
        ],
    )
    healthy = FakeAdapter("rss", [Page([item("200")])])
    scheduler = Scheduler(store, {"weibo_crawler": broken, "rss": healthy}, tagger)

    results = await scheduler.tick()
    # The second weibo target waited behind the first and was skipped once the pause landed.
    assert sorted(results) == ["failed", "ok", "skipped"]
    assert len(broken.cursors) == 1
    assert await store.paused_until("weibo_crawler") is not None
    [alert] = await store.query("SELECT adapter, target_id, kind FROM alerts")
    assert alert == {"adapter": "weibo_crawler", "target_id": None, "kind": "login_expired"}

    # Paused targets are not claimed; nothing else is due yet.
    assert await scheduler.tick() == []
    await store.resume_adapter("weibo_crawler")
    broken.pages = [Page([item("300")]), Page([item("301")])]
    assert sorted(await scheduler.tick()) == ["ok", "ok"]
    await store.resolve_alerts("weibo_crawler", None)
    assert (await store.query("SELECT count(*) AS n FROM alerts WHERE resolved_at IS NULL"))[0][
        "n"
    ] == 0


async def test_failures_back_off_and_alert_after_three(store: Store) -> None:
    t = make_target("douyin_api", "sec")
    await store.sync_targets([t])
    adapter = FakeAdapter("douyin_api", [CollectError(ErrorKind.TRANSIENT, "502")] * 3)
    scheduler = Scheduler(store, {"douyin_api": adapter}, tagger)
    for expected_alerts in (0, 0, 1):
        await store.force_due(t.id)
        assert await scheduler.tick() == ["failed"]
        assert await count(store, "alerts") == expected_alerts
    [row] = await store.query(
        "SELECT consecutive_failures, next_run_at - now() AS wait FROM targets"
    )
    assert row["consecutive_failures"] == 3
    assert row["wait"] > timedelta(minutes=60 * 7)  # 60 min * 2^3, not the plain interval


async def test_consecutive_empty_runs_raise_one_alert(store: Store) -> None:
    t = make_target("rss", "quiet", empty_alert_after=2)
    await store.sync_targets([t])
    adapter = FakeAdapter("rss", [Page([]), Page([]), Page([])])
    scheduler = Scheduler(store, {"rss": adapter}, tagger)
    for _ in range(3):
        await store.force_due(t.id)
        assert await scheduler.tick() == ["empty"]
    alerts = await store.query("SELECT kind FROM alerts")
    assert [a["kind"] for a in alerts] == ["empty"]


async def test_cursor_is_handed_back_and_unconfigured_adapters_wait(store: Store) -> None:
    t, other = make_target("rss", "f"), make_target("mediacrawler", "kw")
    await store.sync_targets([t, other])
    adapter = FakeAdapter("rss", [Page([item("1")], {"watermark": "w1"}), Page([], {"w": 2})])
    scheduler = Scheduler(store, {"rss": adapter}, tagger)
    await scheduler.tick(only={t.id})
    await store.force_due(t.id)
    await scheduler.tick(only={t.id})
    assert adapter.cursors == [None, {"watermark": "w1"}]
    [row] = await store.query("SELECT consecutive_failures FROM targets WHERE id = %s", (other.id,))
    assert row["consecutive_failures"] == 0


async def test_push_to_aihot_batches_per_source_and_marks_pushed(store: Store) -> None:
    t = make_target("weibo_crawler", "1", Tier.OFFICIAL)
    await store.sync_targets([t])
    await store.save_page(t, Page([item(str(i)) for i in range(60)]), tagger)
    requests: list[dict[str, Any]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["authorization"] == "Bearer ingest-token-123456"
        requests.append(json.loads(request.content))
        return httpx.Response(200, json={"ok": True, "created": 1})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        pushed = await aihot.push(store, client, "http://aihot:3000", "ingest-token-123456")
    assert pushed == 60
    assert [len(r["items"]) for r in requests] == [50, 10]
    body = requests[0]
    assert body["sourceId"] == "zhipanda-weibo-crawler-1"
    assert body["sourceName"] == "label 1（官方）"
    first = body["items"][0]
    assert first["raw"]["pandaSlugs"] == ["fu-bao"] and first["raw"]["_aihot"]["backfill"] is False
    assert first["raw"]["externalId"] == "weibo:0" and first["bodyText"] == "福宝在吃竹子"
    assert first["raw"]["author"] == {"platform": "weibo", "accountId": "1", "name": "基地"}
    assert (await store.pending_outbox(10)) == []


async def test_aihot_paused_source_is_retried_later(store: Store) -> None:
    t = make_target("rss", "f")
    await store.sync_targets([t])
    await store.save_page(t, Page([item("1")]), tagger)

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda r: httpx.Response(409, json={"ok": False}))
    ) as client:
        assert await aihot.push(store, client, "http://aihot", "token-token-token") == 0
    [row] = await store.query("SELECT attempts, last_error, pushed_at FROM outbox")
    assert row["attempts"] == 1 and row["pushed_at"] is None and "409" in row["last_error"]
    assert [a["kind"] for a in await store.query("SELECT kind FROM alerts")] == ["push_failed"]


async def test_report_counts_latency_from_first_run(store: Store) -> None:
    t = make_target("weibo_crawler", "1", Tier.OFFICIAL)
    await store.sync_targets([t])
    backlog = item("old", published=datetime.now(UTC) - timedelta(days=30))
    fresh = item("new", published=datetime.now(UTC) + timedelta(seconds=5))
    adapter = FakeAdapter("weibo_crawler", [Page([backlog, fresh])])
    await Scheduler(store, {"weibo_crawler": adapter}, tagger).tick()
    text = await report.build(store, 14)
    assert "| weibo_crawler | 1 | 100% | 0 | 0 | — | 2 | 0 |" in text
    # Only the item published after the first run counts towards latency.
    assert "| official | 1 |" in text
    assert "| weibo_crawler | 2 |" in text  # completeness covers both


async def test_run_forever_claims_only_free_slots_per_adapter(store: Store) -> None:


    slow_targets = [make_target("weibo_crawler", str(i)) for i in range(3)]
    await store.sync_targets([*slow_targets, make_target("rss", "f")])
    release = asyncio.Event()
    started: list[str] = []

    class Slow(FakeAdapter):
        async def fetch(self, target: Target, cursor: JsonDict | None, ctx: FetchContext) -> Page:
            started.append(target.id)
            await release.wait()
            return Page([])

    scheduler = Scheduler(
        store,
        {"weibo_crawler": Slow("weibo_crawler", []), "rss": FakeAdapter("rss", [Page([])])},
        tagger,
    )
    housekeeping_calls = 0

    async def housekeeping() -> None:
        nonlocal housekeeping_calls
        housekeeping_calls += 1

    stop = asyncio.Event()
    loop = asyncio.create_task(scheduler.run_forever(housekeeping, poll_seconds=0.05, stop=stop))
    await asyncio.sleep(0.5)
    # One weibo target at a time; the other two stay due in the table instead of holding a lease.
    assert len(started) == 1
    leased = await store.query(
        "SELECT count(*) AS n FROM targets WHERE adapter = 'weibo_crawler' AND next_run_at > now()"
    )
    assert leased[0]["n"] == 1
    assert [r["status"] for r in await store.query("SELECT status FROM runs")] == ["empty"]
    release.set()
    await asyncio.sleep(0.5)
    stop.set()
    await loop
    assert len(started) == 3 and housekeeping_calls > 1
