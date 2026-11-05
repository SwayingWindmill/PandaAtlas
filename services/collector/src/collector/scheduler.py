"""Runs due targets, one adapter's failures never holding up another's."""

from __future__ import annotations

import asyncio
import logging
import random
from collections.abc import Awaitable, Callable, Mapping
from datetime import datetime, timedelta

from collector.adapters.base import Adapter, FetchContext
from collector.models import ADAPTER_WIDE, CollectError, ErrorKind, Tier
from collector.store import PandaTagger, Store, TargetState, now

log = logging.getLogger(__name__)

MAX_BACKOFF = timedelta(hours=24)
#: Consecutive failures before a target-level failure pages someone.
FAILURE_ALERT_AFTER = 3
#: Consecutive empty runs before an alert, per tier. An official feed going quiet for a day is
#: news; a niche keyword returning nothing for a while is not.
EMPTY_ALERT_AFTER = {Tier.OFFICIAL: 96, Tier.KEY_ACCOUNT: 8, Tier.KEYWORD: 8, Tier.BACKFILL: 3}


def jittered(minutes: float) -> timedelta:
    """±10 % so targets added together do not stay in lockstep."""
    return timedelta(minutes=minutes * random.uniform(0.9, 1.1))


def backoff(interval_minutes: int, failures: int) -> timedelta:
    return min(timedelta(minutes=interval_minutes * 2 ** min(failures, 10)), MAX_BACKOFF)


class Scheduler:
    def __init__(
        self,
        store: Store,
        adapters: Mapping[str, Adapter],
        tagger: PandaTagger,
        *,
        concurrency: Mapping[str, int] | None = None,
    ):
        self.store = store
        self.adapters = adapters
        self.tagger = tagger
        self.ctx = FetchContext(known_ids=store.known_ids)
        # Browser- and account-driven collectors run one target at a time per adapter.
        self.concurrency = {name: (concurrency or {}).get(name, 1) for name in adapters}
        self.limits = {name: asyncio.Semaphore(n) for name, n in self.concurrency.items()}

    async def run_target(self, state: TargetState) -> str:
        target = state.target
        adapter = self.adapters.get(target.adapter)
        started = now()
        if adapter is None:
            await self.store.finish_run(
                state,
                started_at=started,
                status="skipped",
                next_run_at=started + timedelta(hours=1),
                error_kind=ErrorKind.NOT_FOUND,
                error=f"adapter {target.adapter} is not configured on this host",
            )
            return "skipped"
        async with self.limits[target.adapter]:
            # Another target of this adapter may have paused it while this one waited.
            paused = await self.store.paused_until(target.adapter)
            if paused:
                await self.store.finish_run(
                    state,
                    started_at=started,
                    status="skipped",
                    next_run_at=paused,
                    error="adapter paused",
                )
                return "skipped"
            try:
                page = await adapter.fetch(target, state.cursor, self.ctx)
                result = await self.store.save_page(target, page, self.tagger)
            except CollectError as exc:
                await self._failed(state, started, exc)
                return "failed"
            except Exception as exc:  # A bug in one adapter must not stop the loop.
                log.exception("adapter %s crashed on %s", target.adapter, target.id)
                await self._failed(
                    state, started, CollectError(ErrorKind.UPSTREAM_CHANGED, repr(exc))
                )
                return "failed"
        status = "empty" if page.empty else "ok"
        await self.store.finish_run(
            state,
            started_at=started,
            status=status,
            result=result,
            next_run_at=now() + jittered(target.interval_minutes),
        )
        await self.store.resolve_alerts(
            target.adapter, target.id, keep=("empty",) if status == "empty" else ()
        )
        if status == "empty" and state.consecutive_empty + 1 >= int(
            target.params.get("empty_alert_after", EMPTY_ALERT_AFTER[target.tier])
        ):
            await self.store.raise_alert(
                target.adapter,
                target.id,
                "empty",
                f"{target.label} 已连续 {state.consecutive_empty + 1} 次没有返回内容",
            )
        log.info(
            "%s %s: %s fetched=%d created=%d revised=%d",
            target.adapter,
            target.id,
            status,
            result.fetched,
            result.created,
            result.revised,
        )
        return status

    async def _failed(self, state: TargetState, started: datetime, exc: CollectError) -> None:
        target = state.target
        failures = state.consecutive_failures + 1
        log.warning("%s %s failed (%s): %s", target.adapter, target.id, exc.kind, exc)
        if exc.kind in ADAPTER_WIDE:
            pause = timedelta(seconds=exc.retry_after_seconds or ADAPTER_WIDE[exc.kind])
            until = now() + pause
            await self.store.pause_adapter(target.adapter, until, f"{exc.kind}: {exc}")
            await self.store.raise_alert(
                target.adapter,
                None,
                exc.kind,
                f"{exc}\n已暂停到 {until:%m-%d %H:%M} UTC；恢复后从游标处补采。",
            )
            next_run = until
        else:
            next_run = now() + backoff(target.interval_minutes, failures)
            if exc.kind is ErrorKind.NOT_FOUND or failures >= FAILURE_ALERT_AFTER:
                await self.store.raise_alert(target.adapter, target.id, exc.kind, str(exc))
        await self.store.finish_run(
            state,
            started_at=started,
            status="failed",
            next_run_at=next_run,
            error_kind=exc.kind,
            error=str(exc)[:2000],
        )

    async def tick(self, *, only: set[str] | None = None, limit: int = 50) -> list[str]:
        due = await self.store.claim_due(limit, only=only)
        return list(await asyncio.gather(*(self.run_target(s) for s in due)))

    async def run_forever(
        self,
        housekeeping: Callable[[], Awaitable[None]],
        *,
        poll_seconds: float = 30,
        stop: asyncio.Event | None = None,
    ) -> None:
        stop = stop or asyncio.Event()
        running: dict[str, set[asyncio.Task[str]]] = {name: set() for name in self.adapters}
        while not stop.is_set():
            # Claim per adapter only what can start now. A claim is a lease; a target left
            # queuing behind a slow browser collector would outlive it and be claimed twice.
            for name, tasks in running.items():
                free = self.concurrency[name] - len(tasks)
                for state in await self.store.claim_due(free, adapter=name) if free > 0 else []:
                    task = asyncio.create_task(self.run_target(state))
                    tasks.add(task)
                    task.add_done_callback(tasks.discard)
            try:
                await housekeeping()
            except Exception:
                log.exception("housekeeping failed")
            try:
                await asyncio.wait_for(stop.wait(), poll_seconds)
            except TimeoutError:
                pass
        remaining = set().union(*running.values())
        if remaining:
            await asyncio.wait(remaining)
