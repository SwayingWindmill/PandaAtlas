from __future__ import annotations

from datetime import date
from uuid import UUID

from app.domain.archive_events import DomainEvent, index_events_by_participant
from app.domain.archive_residency import ArchiveDate, PlaceReference

MEI_XIANG = UUID("2939c16f-1938-5629-928c-b36b1d5cd6ed")
TIAN_TIAN = UUID("38cd1cad-3e34-5511-bc35-a091ece74e11")
XIAO_QI_JI = UUID("926abc78-1e79-55c6-b24a-d33b4e5f6443")
SMITHSONIAN = UUID("afb0f227-dd5e-5076-88e3-74e9807a6049")
CHINA = UUID("108f227d-2510-554a-98fb-395e58ca4433")


def test_one_domain_event_is_linked_to_every_participant() -> None:
    departure = DomainEvent(
        id="smithsonian-departure-2023",
        event_type="transfer",
        status="completed",
        occurred_on=ArchiveDate(date(2023, 11, 8), precision="day"),
        participant_ids=(MEI_XIANG, TIAN_TIAN, XIAO_QI_JI),
        from_place=PlaceReference(kind="facility", id=SMITHSONIAN),
        to_place=PlaceReference(kind="coarse_location", id=CHINA),
        publication_status="published",
        source_ids=("src-smithsonian",),
    )

    by_participant = index_events_by_participant((departure,))

    assert by_participant[MEI_XIANG] == (departure,)
    assert by_participant[TIAN_TIAN] == (departure,)
    assert by_participant[XIAO_QI_JI] == (departure,)
    assert departure.occurred_on.precision == "day"
