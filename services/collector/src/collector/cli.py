"""`collector` command line."""

from __future__ import annotations

import argparse
import asyncio
import logging
import signal
import sys
import time
from collections.abc import Awaitable, Callable
from pathlib import Path

import httpx

from collector import aihot, alerts, registry, report
from collector.config import Settings, build_adapters, load_targets
from collector.lexicon import Lexicon
from collector.scheduler import Scheduler
from collector.store import Store

log = logging.getLogger("collector")

PUSH_EVERY_SECONDS = 60


async def _open(settings: Settings) -> Store:
    store = await Store.open(settings.database_url)
    await store.migrate()
    return store


async def cmd_sync(settings: Settings, _: argparse.Namespace) -> None:
    store = await _open(settings)
    try:
        upserted, disabled = await store.sync_targets(load_targets(settings.targets_file))
        print(f"targets: {upserted} active, {disabled} disabled")
    finally:
        await store.close()


def _scheduler(settings: Settings, store: Store, client: httpx.AsyncClient) -> Scheduler:
    lexicon = Lexicon.load(settings.pandas_csv, settings.aliases_file)
    adapters = build_adapters(settings, client)
    log.info("adapters on this host: %s", ", ".join(sorted(adapters)))
    return Scheduler(store, adapters, lexicon.tag, concurrency={"rss": settings.rss_concurrency})


def _housekeeping(
    settings: Settings, store: Store, client: httpx.AsyncClient
) -> Callable[[], Awaitable[None]]:
    last_push = 0.0

    async def run() -> None:
        nonlocal last_push
        await alerts.notify(store, client, settings.alert_webhook, settings.alert_format)
        due = time.monotonic() - last_push > PUSH_EVERY_SECONDS
        if settings.aihot_url and settings.aihot_token and due:
            last_push = time.monotonic()
            pushed = await aihot.push(store, client, settings.aihot_url, settings.aihot_token)
            if pushed:
                log.info("pushed %d versions to AIHOT", pushed)

    return run


async def cmd_run(settings: Settings, _: argparse.Namespace) -> None:
    store = await _open(settings)
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, stop.set)
        except NotImplementedError:  # Windows: Ctrl+C raises KeyboardInterrupt instead.
            pass
    async with httpx.AsyncClient(
        timeout=60, headers={"User-Agent": "ZhiPandaCollector/0.1"}
    ) as client:
        try:
            await store.sync_targets(load_targets(settings.targets_file))
            scheduler = _scheduler(settings, store, client)
            await scheduler.run_forever(_housekeeping(settings, store, client), stop=stop)
        finally:
            await store.close()


async def cmd_once(settings: Settings, args: argparse.Namespace) -> None:
    """Run due targets once (or the named ones right now), then push and notify."""
    store = await _open(settings)
    async with httpx.AsyncClient(
        timeout=60, headers={"User-Agent": "ZhiPandaCollector/0.1"}
    ) as client:
        try:
            await store.sync_targets(load_targets(settings.targets_file))
            for target_id in args.target or []:
                await store.force_due(target_id)
            results = await _scheduler(settings, store, client).tick(
                only=set(args.target) if args.target else None
            )
            print(
                f"ran {len(results)} targets: "
                + ", ".join(f"{s}={results.count(s)}" for s in sorted(set(results)))
                if results
                else "nothing due"
            )
            await _housekeeping(settings, store, client)()
        finally:
            await store.close()


async def cmd_report(settings: Settings, args: argparse.Namespace) -> None:
    store = await _open(settings)
    try:
        text = await report.build(store, args.days)
    finally:
        await store.close()
    if args.out:
        Path(args.out).write_text(text, encoding="utf-8")
        print(f"wrote {args.out}")
    else:
        sys.stdout.write(text)


async def cmd_registry(settings: Settings, args: argparse.Namespace) -> None:
    targets = load_targets(settings.targets_file)
    registry.write(targets, Path(args.out))
    print(f"wrote {args.out}")


async def cmd_status(settings: Settings, _: argparse.Namespace) -> None:
    store = await _open(settings)
    try:
        paused = await store.query(
            "SELECT adapter, paused_until, reason FROM adapter_state WHERE paused_until > now()"
        )
        rows = await store.query(
            "SELECT id, tier, next_run_at, consecutive_failures, consecutive_empty, last_error "
            "FROM targets WHERE enabled ORDER BY consecutive_failures DESC, next_run_at"
        )
    finally:
        await store.close()
    for p in paused:
        print(f"PAUSED {p['adapter']} until {p['paused_until']:%Y-%m-%d %H:%M} UTC: {p['reason']}")
    for r in rows:
        if r["consecutive_failures"]:
            flag = "FAIL"
        elif r["last_error"]:
            flag = "WAIT"  # Skipped: adapter paused or not configured on this host.
        else:
            flag = "EMPTY" if r["consecutive_empty"] else "ok"
        print(
            f"{flag:5} {r['id']}  next {r['next_run_at']:%m-%d %H:%M}  "
            f"fail={r['consecutive_failures']} empty={r['consecutive_empty']}"
            + (f"  {r['last_error'][:120]}" if r["last_error"] else "")
        )


async def cmd_resume(settings: Settings, args: argparse.Namespace) -> None:
    """After re-login: lift an adapter's pause and run its targets now."""
    store = await _open(settings)
    try:
        await store.resume_adapter(args.adapter)
        await store.resolve_alerts(args.adapter, None)
        print(f"{args.adapter} resumed")
    finally:
        await store.close()


def cmd_tag(settings: Settings, args: argparse.Namespace) -> None:
    lexicon = Lexicon.load(settings.pandas_csv, settings.aliases_file)
    print(", ".join(lexicon.slugs(args.text)) or "(no panda names)")


def main(argv: list[str] | None = None) -> None:
    # Reports and statuses are Chinese; a GBK Windows console cannot print all of it.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    parser = argparse.ArgumentParser(prog="collector", description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("migrate", help="create or update the database schema")
    commands.add_parser("sync", help="load data/collector/targets.yaml into the database")
    commands.add_parser("run", help="run continuously")
    once = commands.add_parser("once", help="run due targets once")
    once.add_argument("--target", action="append", help="run this target id now (repeatable)")
    rep = commands.add_parser("report", help="collector comparison report (Markdown)")
    rep.add_argument("--days", type=int, default=14)
    rep.add_argument("--out")
    reg = commands.add_parser("registry", help="account registry and AIHOT sources (JSON)")
    reg.add_argument("--out", required=True)
    commands.add_parser("status", help="paused adapters and failing targets")
    resume = commands.add_parser("resume", help="lift an adapter pause after fixing its login")
    resume.add_argument("adapter")
    tag = commands.add_parser("tag", help="show which pandas a text mentions")
    tag.add_argument("text")
    args = parser.parse_args(argv)
    settings = Settings.from_env()

    if args.command == "tag":
        cmd_tag(settings, args)
        return
    if args.command == "migrate":

        async def migrate(s: Settings, _: argparse.Namespace) -> None:
            await (await _open(s)).close()
            print("schema up to date")

        handler = migrate
    else:
        handler = {
            "sync": cmd_sync,
            "run": cmd_run,
            "once": cmd_once,
            "report": cmd_report,
            "registry": cmd_registry,
            "status": cmd_status,
            "resume": cmd_resume,
        }[args.command]
    # psycopg's async mode needs the selector loop on Windows.
    loop_factory = asyncio.SelectorEventLoop if sys.platform == "win32" else None
    try:
        asyncio.run(handler(settings, args), loop_factory=loop_factory)
    except KeyboardInterrupt:
        pass
