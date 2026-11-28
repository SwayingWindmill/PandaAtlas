"""The adapter seam: fetch what is new for one target, given the cursor the last run left."""

from __future__ import annotations

from collections.abc import Awaitable, Callable, Iterable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Protocol

import httpx

from collector.models import CollectError, ErrorKind, Item, JsonDict, Page, Target


@dataclass(frozen=True)
class FetchContext:
    #: Which of these platform item ids are already stored; adapters use it to skip detail calls.
    known_ids: Callable[[str, Iterable[str]], Awaitable[set[str]]]


class Adapter(Protocol):
    name: str
    platform: str

    async def fetch(self, target: Target, cursor: JsonDict | None, ctx: FetchContext) -> Page: ...


# Incremental cursor ----------------------------------------------------------------------------
#
# Account, keyword and feed targets list newest first. The cursor keeps the newest publish time
# already stored (the watermark). A run pages until it reaches the watermark or `max_pages`, so
# after an outage the next run catches up on what it missed, bounded by `max_pages`.


def watermark(cursor: JsonDict | None) -> datetime | None:
    value = (cursor or {}).get("watermark")
    return datetime.fromisoformat(value) if value else None


def advance(cursor: JsonDict | None, items: Iterable[Item]) -> JsonDict:
    times = [i.published_at for i in items if i.published_at]
    current = watermark(cursor)
    if current:
        times.append(current)
    next_cursor = dict(cursor or {})
    if times:
        next_cursor["watermark"] = max(times).isoformat()
    return next_cursor


def reached(items: Iterable[Item], mark: datetime | None) -> bool:
    """True when this page already contains something no newer than the watermark."""
    return mark is not None and any(i.published_at and i.published_at <= mark for i in items)


def max_pages(target: Target, default: int = 3) -> int:
    return int(target.params.get("max_pages", default))


def from_timestamp(value: float | int | str | None) -> datetime | None:
    """Platform timestamps in seconds or milliseconds."""
    if value in (None, "", 0, "0"):
        return None
    number = float(value)  # type: ignore[arg-type]
    if number > 10**11:
        number /= 1000
    return datetime.fromtimestamp(number, UTC)


def http_error(response: httpx.Response, service: str) -> CollectError:
    """Map an HTTP failure of a local collector service to an error kind."""
    status = response.status_code
    retry_after = response.headers.get("retry-after")
    if status == 401:
        return CollectError(ErrorKind.LOGIN_EXPIRED, f"{service}: 401 unauthorized")
    if status == 404:
        return CollectError(ErrorKind.NOT_FOUND, f"{service}: 404")
    if status == 429:
        return CollectError(
            ErrorKind.RATE_LIMITED,
            f"{service}: 429",
            retry_after_seconds=int(retry_after) if retry_after and retry_after.isdigit() else None,
        )
    return CollectError(ErrorKind.TRANSIENT, f"{service}: HTTP {status} {response.text[:200]}")


async def request(
    client: httpx.AsyncClient, method: str, url: str, service: str, **kwargs: object
) -> httpx.Response:
    try:
        return await client.request(method, url, **kwargs)  # type: ignore[arg-type]
    except httpx.TimeoutException as exc:
        raise CollectError(ErrorKind.TRANSIENT, f"{service}: timeout") from exc
    except httpx.TransportError as exc:
        raise CollectError(ErrorKind.TRANSIENT, f"{service}: {exc!r}") from exc
