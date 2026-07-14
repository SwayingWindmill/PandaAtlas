from __future__ import annotations

from dataclasses import dataclass
from typing import Literal
from uuid import UUID

from app.domain.archive_residency import ArchiveDate, PlaceReference
from app.domain.trusted_identity import PublicationStatus

EventType = Literal["transfer"]
EventStatus = Literal["announced", "completed", "cancelled", "disputed"]


@dataclass(frozen=True)
class DomainEvent:
    id: str
    event_type: EventType
    status: EventStatus
    occurred_on: ArchiveDate
    participant_ids: tuple[UUID, ...]
    from_place: PlaceReference | None
    to_place: PlaceReference | None
    publication_status: PublicationStatus
    source_ids: tuple[str, ...]


def index_events_by_participant(
    events: tuple[DomainEvent, ...],
) -> dict[UUID, tuple[DomainEvent, ...]]:
    indexed: dict[UUID, list[DomainEvent]] = {}
    for event in events:
        if event.publication_status != "published" or not event.source_ids:
            continue
        for participant_id in set(event.participant_ids):
            indexed.setdefault(participant_id, []).append(event)
    return {
        participant_id: tuple(sorted(items, key=lambda item: (item.occurred_on.value, item.id)))
        for participant_id, items in indexed.items()
    }
