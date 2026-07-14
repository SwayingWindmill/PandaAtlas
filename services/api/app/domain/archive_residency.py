from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import TYPE_CHECKING, Literal
from uuid import UUID

from app.domain.trusted_identity import PublicationStatus

if TYPE_CHECKING:
    from app.domain.archive_events import DomainEvent

DatePrecision = Literal["day", "month", "year"]
PlaceKind = Literal["facility", "coarse_location"]
ResidencyType = Literal["primary", "temporary", "transit", "quarantine"]
ResidencyStatus = Literal["confirmed", "confirmed_country_level", "provisional"]


@dataclass(frozen=True)
class ArchiveDate:
    value: date
    precision: DatePrecision


@dataclass(frozen=True)
class PlaceReference:
    kind: PlaceKind
    id: UUID


@dataclass(frozen=True)
class Residency:
    id: str
    panda_id: UUID
    place: PlaceReference
    residency_type: ResidencyType
    start: ArchiveDate
    end: ArchiveDate | None
    status: ResidencyStatus
    publication_status: PublicationStatus
    source_ids: tuple[str, ...]


class OverlappingResidencyError(ValueError):
    pass


def validate_residencies(residencies: tuple[Residency, ...]) -> None:
    primary_by_panda: dict[UUID, list[Residency]] = {}
    for residency in residencies:
        if residency.residency_type == "primary":
            primary_by_panda.setdefault(residency.panda_id, []).append(residency)

    for panda_residencies in primary_by_panda.values():
        ordered = sorted(panda_residencies, key=lambda item: item.start.value)
        for current, following in zip(ordered, ordered[1:], strict=False):
            if current.end is None or following.start.value < current.end.value:
                raise OverlappingResidencyError(
                    f"Primary residencies {current.id} and {following.id} overlap"
                )


def derive_current_place(
    residencies: tuple[Residency, ...],
    *,
    events: tuple[DomainEvent, ...] = (),
    as_of: date,
) -> Residency | None:
    del events
    validate_residencies(residencies)
    effective = [
        residency
        for residency in residencies
        if residency.residency_type == "primary"
        and residency.publication_status == "published"
        and residency.status in {"confirmed", "confirmed_country_level"}
        and residency.source_ids
        and residency.start.value <= as_of
        and (residency.end is None or as_of < residency.end.value)
    ]
    return max(effective, key=lambda item: item.start.value, default=None)
