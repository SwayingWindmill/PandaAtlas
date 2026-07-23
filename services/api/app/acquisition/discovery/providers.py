from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from .contracts import (
    DiscoveryEvent,
    DiscoveryInventory,
    DiscoveryQuery,
    DiscoveryRunRequest,
    DiscoveryRunResult,
)
from .runner import run_discovery


class DiscoveryProvider(Protocol):
    provider_id: str

    def discover(self, query: DiscoveryQuery) -> tuple[DiscoveryEvent, ...]: ...


@dataclass(frozen=True, slots=True)
class DiscoveryProviderRegistry:
    providers: tuple[DiscoveryProvider, ...]

    def __post_init__(self) -> None:
        provider_ids = [provider.provider_id for provider in self.providers]
        if len(provider_ids) != len(set(provider_ids)):
            raise ValueError("discovery provider registry contains duplicate provider IDs")
        if any(not provider_id.strip() for provider_id in provider_ids):
            raise ValueError("discovery provider IDs cannot be empty")

    def get(self, provider_id: str) -> DiscoveryProvider:
        matches = [provider for provider in self.providers if provider.provider_id == provider_id]
        if len(matches) != 1:
            raise KeyError(f"discovery provider {provider_id!r} was not found exactly once")
        return matches[0]


def run_discovery_providers(
    *,
    run_id: str,
    created_at: datetime,
    queries: tuple[DiscoveryQuery, ...],
    provider_registry: DiscoveryProviderRegistry,
    baseline: DiscoveryInventory | None = None,
    known_source_hosts: Mapping[str, str] | None = None,
) -> DiscoveryRunResult:
    """Execute all query providers in stable query order and build one intake run."""

    events: list[DiscoveryEvent] = []
    for query in queries:
        provider = provider_registry.get(query.provider_id)
        discovered = provider.discover(query)
        for event in discovered:
            if event.query_id != query.query_id:
                raise ValueError("discovery provider emitted an event for a different query")
            if event.access_basis is not query.access_basis:
                raise ValueError("discovery provider changed the reviewed access basis")
        events.extend(discovered)
    return run_discovery(
        DiscoveryRunRequest(
            run_id=run_id,
            created_at=created_at,
            queries=queries,
            events=tuple(events),
        ),
        baseline=baseline,
        known_source_hosts=known_source_hosts,
    )
