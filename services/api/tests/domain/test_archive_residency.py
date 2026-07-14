from __future__ import annotations

from datetime import date
from uuid import UUID

import pytest

from app.domain.archive_events import DomainEvent
from app.domain.archive_residency import (
    ArchiveDate,
    OverlappingResidencyError,
    PlaceReference,
    Residency,
    derive_current_place,
    validate_residencies,
)

MEI_XIANG = UUID("2939c16f-1938-5629-928c-b36b1d5cd6ed")
SMITHSONIAN = UUID("afb0f227-dd5e-5076-88e3-74e9807a6049")
CHINA = UUID("108f227d-2510-554a-98fb-395e58ca4433")


def test_primary_residency_intervals_cannot_overlap() -> None:
    residencies = (
        Residency(
            id="smithsonian",
            panda_id=MEI_XIANG,
            place=PlaceReference(kind="facility", id=SMITHSONIAN),
            residency_type="primary",
            start=ArchiveDate(date(2000, 12, 6), precision="day"),
            end=ArchiveDate(date(2023, 11, 8), precision="day"),
            status="confirmed",
            publication_status="published",
            source_ids=("src-smithsonian",),
        ),
        Residency(
            id="china",
            panda_id=MEI_XIANG,
            place=PlaceReference(kind="coarse_location", id=CHINA),
            residency_type="primary",
            start=ArchiveDate(date(2023, 11, 7), precision="day"),
            end=None,
            status="confirmed",
            publication_status="published",
            source_ids=("src-smithsonian",),
        ),
    )

    with pytest.raises(OverlappingResidencyError):
        validate_residencies(residencies)


def test_announced_move_does_not_change_current_place() -> None:
    smithsonian_residency = Residency(
        id="smithsonian",
        panda_id=MEI_XIANG,
        place=PlaceReference(kind="facility", id=SMITHSONIAN),
        residency_type="primary",
        start=ArchiveDate(date(2000, 12, 6), precision="day"),
        end=ArchiveDate(date(2023, 11, 8), precision="day"),
        status="confirmed",
        publication_status="published",
        source_ids=("src-smithsonian",),
    )
    announced_return = DomainEvent(
        id="return-plan",
        event_type="transfer",
        status="announced",
        occurred_on=ArchiveDate(date(2020, 12, 7), precision="day"),
        participant_ids=(MEI_XIANG,),
        from_place=PlaceReference(kind="facility", id=SMITHSONIAN),
        to_place=PlaceReference(kind="coarse_location", id=CHINA),
        publication_status="published",
        source_ids=("src-agreement",),
    )

    current = derive_current_place(
        (smithsonian_residency,),
        events=(announced_return,),
        as_of=date(2021, 1, 1),
    )

    assert current is not None
    assert current.place == PlaceReference(kind="facility", id=SMITHSONIAN)
    assert current.start.precision == "day"
