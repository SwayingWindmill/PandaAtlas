"""PostgreSQL persistence: targets as task queue, raw items with versions, runs, alerts."""

from __future__ import annotations

from collections.abc import Callable, Iterable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from importlib.resources import files
from typing import Any

from psycopg import AsyncConnection
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from psycopg_pool import AsyncConnectionPool

from collector.models import Item, JsonDict, Page, Target, TargetKind, Tier

#: How long a claimed target is reserved before another worker may pick it up again.
CLAIM_LEASE = timedelta(minutes=30)

PandaTagger = Callable[[Item], list[str]]


@dataclass(frozen=True)
class SaveResult:
    fetched: int
    created: int
    revised: int


@dataclass(frozen=True)
class TargetState:
    target: Target
    cursor: JsonDict | None
    consecutive_failures: int
    consecutive_empty: int


@dataclass(frozen=True)
class Alert:
    id: int
    raised_at: datetime
    adapter: str
    target_id: str | None
    kind: str
    message: str


def _target(row: dict[str, Any]) -> Target:
    return Target(
        id=row["id"],
        adapter=row["adapter"],
        kind=TargetKind(row["kind"]),
        value=row["value"],
        label=row["label"],
        tier=Tier(row["tier"]),
        interval_minutes=row["interval_minutes"],
        params=row["params"],
    )


class Store:
    def __init__(self, pool: AsyncConnectionPool[AsyncConnection[dict[str, Any]]]):
        self.pool = pool

    @classmethod
    async def open(cls, dsn: str) -> Store:
        pool = AsyncConnectionPool(
            dsn, min_size=1, max_size=8, open=False, kwargs={"row_factory": dict_row}
        )
        await pool.open(wait=True)
        return cls(pool)

    async def close(self) -> None:
        await self.pool.close()

    async def migrate(self) -> None:
        sql = files("collector").joinpath("schema.sql").read_text(encoding="utf-8")
        async with self.pool.connection() as conn:
            await conn.execute(sql)

    # Targets -------------------------------------------------------------------------------

    async def sync_targets(self, targets: Iterable[Target]) -> tuple[int, int]:
        """Make the table match the configuration. Removed targets are disabled, never deleted,
        so their runs and sightings stay. Returns (upserted, disabled)."""
        targets = list(targets)
        async with self.pool.connection() as conn, conn.transaction():
            for t in targets:
                await conn.execute(
                    """
                    INSERT INTO targets (id, adapter, kind, value, label, tier, params,
                                         interval_minutes, enabled)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, true)
                    ON CONFLICT (id) DO UPDATE SET
                      adapter = EXCLUDED.adapter, kind = EXCLUDED.kind, value = EXCLUDED.value,
                      label = EXCLUDED.label, tier = EXCLUDED.tier, params = EXCLUDED.params,
                      interval_minutes = EXCLUDED.interval_minutes, enabled = true,
                      updated_at = now()
                    """,
                    (
                        t.id,
                        t.adapter,
                        t.kind,
                        t.value,
                        t.label,
                        t.tier,
                        Jsonb(t.params),
                        t.interval_minutes,
                    ),
                )
            cur = await conn.execute(
                "UPDATE targets SET enabled = false, updated_at = now() "
                "WHERE enabled AND NOT (id = ANY(%s))",
                ([t.id for t in targets],),
            )
            return len(targets), cur.rowcount

    async def claim_due(
        self, limit: int, *, adapter: str | None = None, only: set[str] | None = None
    ) -> list[TargetState]:
        """Reserve due targets whose adapter is not paused. Safe with several workers."""
        ids = list(only) if only else None
        async with self.pool.connection() as conn:
            cur = await conn.execute(
                """
                UPDATE targets t SET next_run_at = now() + %s
                WHERE t.id IN (
                  SELECT id FROM targets
                  WHERE enabled AND next_run_at <= now()
                    AND (%s::text IS NULL OR adapter = %s::text)
                    AND (%s::text[] IS NULL OR id = ANY(%s::text[]))
                    AND adapter NOT IN (
                      SELECT adapter FROM adapter_state WHERE paused_until > now())
                  ORDER BY next_run_at
                  LIMIT %s
                  FOR UPDATE SKIP LOCKED)
                RETURNING t.*
                """,
                (CLAIM_LEASE, adapter, adapter, ids, ids, limit),
            )
            rows = await cur.fetchall()
        return [
            TargetState(_target(r), r["cursor"], r["consecutive_failures"], r["consecutive_empty"])
            for r in rows
        ]

    async def force_due(self, target_id: str) -> None:
        async with self.pool.connection() as conn:
            await conn.execute("UPDATE targets SET next_run_at = now() WHERE id = %s", (target_id,))

    async def known_ids(self, platform: str, ids: Iterable[str]) -> set[str]:
        ids = list(ids)
        if not ids:
            return set()
        async with self.pool.connection() as conn:
            cur = await conn.execute(
                "SELECT platform_item_id FROM items "
                "WHERE platform = %s AND platform_item_id = ANY(%s)",
                (platform, ids),
            )
            return {r["platform_item_id"] for r in await cur.fetchall()}

    # Saving a page -------------------------------------------------------------------------

    async def save_page(self, target: Target, page: Page, tagger: PandaTagger) -> SaveResult:
        created = revised = 0
        async with self.pool.connection() as conn, conn.transaction():
            for item in page.items:
                outcome = await self._upsert_item(conn, target, item, tagger(item))
                created += outcome == "created"
                revised += outcome == "revised"
            await conn.execute(
                "UPDATE targets SET cursor = %s, updated_at = now() WHERE id = %s",
                (Jsonb(page.cursor) if page.cursor is not None else None, target.id),
            )
        return SaveResult(len(page.items), created, revised)

    async def _upsert_item(
        self, conn: AsyncConnection[dict[str, Any]], target: Target, item: Item, pandas: list[str]
    ) -> str:
        digest = item.content_hash()
        cur = await conn.execute(
            """
            INSERT INTO items (platform, platform_item_id, url, title, body, author_id,
                               author_name, published_at, media, metrics, raw, content_hash,
                               panda_slugs)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (platform, platform_item_id) DO NOTHING
            RETURNING id
            """,
            (
                item.platform,
                item.platform_item_id,
                item.url,
                item.title,
                item.body,
                item.author_id,
                item.author_name,
                item.published_at,
                Jsonb(item.media),
                Jsonb(item.metrics),
                Jsonb(item.raw),
                digest,
                pandas,
            ),
        )
        row = await cur.fetchone()
        if row:
            item_id, version, outcome = row["id"], 1, "created"
        else:
            cur = await conn.execute(
                "SELECT id, content_hash, version FROM items "
                "WHERE platform = %s AND platform_item_id = %s FOR UPDATE",
                (item.platform, item.platform_item_id),
            )
            existing = await cur.fetchone()
            assert existing is not None
            item_id = existing["id"]
            if existing["content_hash"] == digest:
                # Same content: refresh counters and fill gaps a richer collector may provide.
                await conn.execute(
                    """
                    UPDATE items SET last_seen_at = now(), metrics = metrics || %s,
                      published_at = coalesce(published_at, %s),
                      author_id = coalesce(author_id, %s), author_name = coalesce(author_name, %s)
                    WHERE id = %s
                    """,
                    (
                        Jsonb(item.metrics),
                        item.published_at,
                        item.author_id,
                        item.author_name,
                        item_id,
                    ),
                )
                await self._sighting(conn, item_id, target)
                return "unchanged"
            version, outcome = existing["version"] + 1, "revised"
            await conn.execute(
                """
                UPDATE items SET url = %s, title = %s, body = %s, media = %s,
                  metrics = metrics || %s, raw = %s, content_hash = %s, version = %s,
                  panda_slugs = %s, published_at = coalesce(%s, published_at),
                  author_id = coalesce(%s, author_id), author_name = coalesce(%s, author_name),
                  last_seen_at = now()
                WHERE id = %s
                """,
                (
                    item.url,
                    item.title,
                    item.body,
                    Jsonb(item.media),
                    Jsonb(item.metrics),
                    Jsonb(item.raw),
                    digest,
                    version,
                    pandas,
                    item.published_at,
                    item.author_id,
                    item.author_name,
                    item_id,
                ),
            )
        await conn.execute(
            "INSERT INTO item_versions (item_id, version, content_hash, title, body, media, raw) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s)",
            (item_id, version, digest, item.title, item.body, Jsonb(item.media), Jsonb(item.raw)),
        )
        await conn.execute(
            "INSERT INTO outbox (item_id, version, target_id) VALUES (%s, %s, %s) "
            "ON CONFLICT DO NOTHING",
            (item_id, version, target.id),
        )
        await self._sighting(conn, item_id, target)
        return outcome

    @staticmethod
    async def _sighting(
        conn: AsyncConnection[dict[str, Any]], item_id: int, target: Target
    ) -> None:
        await conn.execute(
            "INSERT INTO item_sightings (item_id, target_id, adapter) VALUES (%s, %s, %s) "
            "ON CONFLICT DO NOTHING",
            (item_id, target.id, target.adapter),
        )

    # Run bookkeeping -----------------------------------------------------------------------

    async def finish_run(
        self,
        state: TargetState,
        *,
        started_at: datetime,
        status: str,
        next_run_at: datetime,
        result: SaveResult | None = None,
        error_kind: str | None = None,
        error: str | None = None,
    ) -> None:
        ok = status in ("ok", "empty")
        async with self.pool.connection() as conn, conn.transaction():
            await conn.execute(
                """
                INSERT INTO runs (target_id, adapter, started_at, finished_at, status, error_kind,
                                  error, fetched, created, revised)
                VALUES (%s, %s, %s, now(), %s, %s, %s, %s, %s, %s)
                """,
                (
                    state.target.id,
                    state.target.adapter,
                    started_at,
                    status,
                    error_kind,
                    error,
                    result.fetched if result else 0,
                    result.created if result else 0,
                    result.revised if result else 0,
                ),
            )
            await conn.execute(
                """
                UPDATE targets SET next_run_at = %s,
                  consecutive_failures = CASE WHEN %s THEN 0
                                              WHEN %s = 'failed' THEN consecutive_failures + 1
                                              ELSE consecutive_failures END,
                  consecutive_empty = CASE WHEN %s = 'empty' THEN consecutive_empty + 1
                                           WHEN %s = 'ok' THEN 0 ELSE consecutive_empty END,
                  last_success_at = CASE WHEN %s THEN now() ELSE last_success_at END,
                  last_error = CASE WHEN %s THEN NULL ELSE %s END,
                  updated_at = now()
                WHERE id = %s
                """,
                (next_run_at, ok, status, status, status, ok, ok, error, state.target.id),
            )

    async def pause_adapter(self, adapter: str, until: datetime, reason: str) -> None:
        async with self.pool.connection() as conn:
            await conn.execute(
                """
                INSERT INTO adapter_state (adapter, paused_until, reason) VALUES (%s, %s, %s)
                ON CONFLICT (adapter) DO UPDATE SET paused_until = EXCLUDED.paused_until,
                  reason = EXCLUDED.reason, updated_at = now()
                """,
                (adapter, until, reason),
            )

    async def paused_until(self, adapter: str) -> datetime | None:
        async with self.pool.connection() as conn:
            cur = await conn.execute(
                "SELECT paused_until FROM adapter_state WHERE adapter = %s "
                "AND paused_until > now()",
                (adapter,),
            )
            row = await cur.fetchone()
            return row["paused_until"] if row else None

    async def resume_adapter(self, adapter: str) -> None:
        async with self.pool.connection() as conn:
            await conn.execute(
                "UPDATE adapter_state SET paused_until = NULL, reason = NULL, updated_at = now() "
                "WHERE adapter = %s",
                (adapter,),
            )
            # Targets pushed past the pause run again right away and catch up from their cursor.
            await conn.execute(
                "UPDATE targets SET next_run_at = now() WHERE enabled AND adapter = %s", (adapter,)
            )

    # Alerts --------------------------------------------------------------------------------

    async def raise_alert(
        self, adapter: str, target_id: str | None, kind: str, message: str
    ) -> bool:
        """Open an alert; False when the same one is already open."""
        async with self.pool.connection() as conn:
            cur = await conn.execute(
                """
                INSERT INTO alerts (adapter, target_id, kind, message) VALUES (%s, %s, %s, %s)
                ON CONFLICT (adapter, coalesce(target_id, ''), kind) WHERE resolved_at IS NULL
                DO NOTHING RETURNING id
                """,
                (adapter, target_id, kind, message),
            )
            return await cur.fetchone() is not None

    async def resolve_alerts(
        self, adapter: str, target_id: str | None, *, keep: tuple[str, ...] = ()
    ) -> None:
        """A success clears the target's alerts and the adapter-wide ones, except kinds in
        `keep` (an empty run fixes a failure but not an "empty" alert)."""
        async with self.pool.connection() as conn:
            await conn.execute(
                "UPDATE alerts SET resolved_at = now() WHERE resolved_at IS NULL "
                "AND adapter = %s AND (target_id = %s OR target_id IS NULL) "
                "AND NOT (kind = ANY(%s))",
                (adapter, target_id, list(keep)),
            )

    async def unnotified_alerts(self) -> list[Alert]:
        async with self.pool.connection() as conn:
            cur = await conn.execute(
                "SELECT id, raised_at, adapter, target_id, kind, message FROM alerts "
                "WHERE notified_at IS NULL ORDER BY raised_at"
            )
            return [Alert(**r) for r in await cur.fetchall()]

    async def mark_notified(self, ids: list[int]) -> None:
        async with self.pool.connection() as conn:
            await conn.execute("UPDATE alerts SET notified_at = now() WHERE id = ANY(%s)", (ids,))

    # Outbox --------------------------------------------------------------------------------

    async def pending_outbox(self, limit: int) -> list[dict[str, Any]]:
        async with self.pool.connection() as conn:
            cur = await conn.execute(
                """
                SELECT o.item_id, o.version, o.target_id, t.label AS target_label,
                       t.tier AS target_tier, i.platform, i.url, i.title, i.body, i.author_name,
                       i.published_at, i.media, i.metrics, i.panda_slugs, i.first_seen_at,
                       (v.version > 1) AS is_revision
                FROM outbox o
                JOIN items i ON i.id = o.item_id
                JOIN item_versions v ON v.item_id = o.item_id AND v.version = o.version
                JOIN targets t ON t.id = o.target_id
                WHERE o.pushed_at IS NULL
                -- Rows a paused AIHOT source keeps refusing sink behind fresh ones.
                ORDER BY o.attempts, o.created_at
                LIMIT %s
                """,
                (limit,),
            )
            return await cur.fetchall()

    async def mark_pushed(self, keys: list[tuple[int, int]]) -> None:
        async with self.pool.connection() as conn:
            await conn.execute(
                "UPDATE outbox SET pushed_at = now(), attempts = attempts + 1, last_error = NULL "
                "WHERE (item_id, version) IN (SELECT * FROM unnest(%s::bigint[], %s::int[]))",
                ([k[0] for k in keys], [k[1] for k in keys]),
            )

    async def mark_push_failed(self, keys: list[tuple[int, int]], error: str) -> None:
        async with self.pool.connection() as conn:
            await conn.execute(
                "UPDATE outbox SET attempts = attempts + 1, last_error = %s "
                "WHERE (item_id, version) IN (SELECT * FROM unnest(%s::bigint[], %s::int[]))",
                (error, [k[0] for k in keys], [k[1] for k in keys]),
            )

    async def query(self, sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
        async with self.pool.connection() as conn:
            cur = await conn.execute(sql, params)
            return await cur.fetchall()


def now() -> datetime:
    return datetime.now(UTC)
