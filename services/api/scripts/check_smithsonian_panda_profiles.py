from __future__ import annotations

import shutil
import tempfile
from collections import Counter
from pathlib import Path

from app.acquisition.adapters import DEFAULT_ADAPTER_REGISTRY
from app.acquisition.contracts import (
    AcquisitionMode,
    AcquisitionRunState,
    ConflictState,
    IdentityMatchState,
)
from app.acquisition.runner import AdapterRunRequest, AdapterRunStopped, run_adapter
from app.acquisition.smithsonian_pandas import ADAPTER_ID, SOURCE_ID

_EXPECTED_SLUGS = {
    "an-an",
    "bao-bao",
    "bao-li",
    "bei-bei",
    "hsing-hsing",
    "jia-mei",
    "ling-ling-smithsonian",
    "mei-xiang",
    "qing-bao",
    "qing-qing",
    "tai-shan",
    "tian-tian",
    "xiao-qi-ji",
}


def main() -> None:
    first = _run("smithsonian-profile-sanity-a.json")
    second = _run("smithsonian-profile-sanity-b.json")

    first_candidates = tuple(candidate.to_dict() for candidate in first.bundle.candidates)
    second_candidates = tuple(candidate.to_dict() for candidate in second.bundle.candidates)
    assert first_candidates == second_candidates

    bundle = first.bundle
    assert len(bundle.evidence_snapshots) == 3
    assert len(bundle.candidates) == 74
    assert not bundle.trusted_write_targets
    assert not bundle.publication_write_targets

    identity_states = Counter(candidate.identity_match.state for candidate in bundle.candidates)
    assert identity_states == {IdentityMatchState.MATCHED: 74}
    matched_slugs = {
        candidate.identity_match.matched_canonical_slug for candidate in bundle.candidates
    }
    assert matched_slugs == _EXPECTED_SLUGS

    conflict_states = Counter(candidate.conflict_state for candidate in bundle.candidates)
    assert ConflictState.CONTRADICTION not in conflict_states
    assert conflict_states == {
        ConflictState.UNCHANGED: 39,
        ConflictState.NOT_COMPARED: 14,
        ConflictState.NEW: 9,
        ConflictState.MISSING_CURRENT_VALUE: 8,
        ConflictState.ENRICHMENT: 4,
    }

    for candidate in bundle.candidates:
        assert candidate.source_locator.value
        assert candidate.source_locator.kind.value == "css-selector"
        assert candidate.evidence_body_sha256
        assert candidate.parser_name == bundle.run.parser_name
        assert candidate.parser_version == bundle.run.parser_version

    absent_status = _one(
        bundle.candidates,
        slug="bao-li",
        field_path="identity.life_status",
        raw_value=None,
    )
    assert absent_status.conflict_state is ConflictState.NOT_COMPARED
    assert any("not current life status" in note for note in absent_status.notes)

    parent = _one(
        bundle.candidates,
        slug="bao-li",
        field_path="relationship.father",
        raw_value="An An",
    )
    assert parent.normalized_value == "An An"
    assert parent.conflict_state is ConflictState.NOT_COMPARED
    assert parent.current_trusted_value.value == "an-an"

    deceased = _one(
        bundle.candidates,
        slug="hsing-hsing",
        field_path="identity.life_status",
        raw_value="euthanized",
    )
    assert deceased.normalized_value == "deceased"
    assert deceased.conflict_state is ConflictState.UNCHANGED

    bao_bao_birth = _one_event(
        bundle.candidates,
        slug="bao-bao",
        event_type="birth",
        raw_date="Aug. 23, 2013",
    )
    assert bao_bao_birth.raw_value["source_date_text"] == "Aug. 23"
    assert bao_bao_birth.raw_value["section_year"] == "2013"
    assert bao_bao_birth.normalized_value["event_date"] == {
        "value": "2013-08-23",
        "precision": "day",
    }

    first_pair_arrival = _one_event(
        bundle.candidates,
        slug="ling-ling-smithsonian",
        event_type="arrival",
        raw_date="April 16, 1972",
    )
    assert first_pair_arrival.raw_value["source_location_text"] == "their new home"
    assert first_pair_arrival.normalized_value["location"] is None
    assert first_pair_arrival.conflict_state is ConflictState.UNCHANGED

    second_pair_arrival = _one_event(
        bundle.candidates,
        slug="mei-xiang",
        event_type="arrival",
        raw_date="Dec. 6, 2000",
    )
    assert second_pair_arrival.raw_value["source_location_text"] == "the Zoo"
    assert second_pair_arrival.normalized_value["location"] is None
    assert second_pair_arrival.conflict_state is ConflictState.MISSING_CURRENT_VALUE

    departure = _one_event(
        bundle.candidates,
        slug="xiao-qi-ji",
        event_type="transfer",
        raw_date="Nov. 8, 2023",
    )
    assert departure.normalized_value["location"] is None
    assert departure.raw_value["source_location_text"].startswith("Smithsonian's")
    assert departure.conflict_state is ConflictState.UNCHANGED

    habitat = _one(
        bundle.candidates,
        slug="bao-li",
        field_path="residency.current_location",
    )
    assert habitat.raw_value == {
        "facility": "David M. Rubenstein and Family Giant Panda Habitat",
        "institution": "Smithsonian National Zoo",
    }
    assert habitat.conflict_state is ConflictState.ENRICHMENT

    bei_birthplace = _one(
        bundle.candidates,
        slug="bei-bei",
        field_path="identity.birthplace",
    )
    assert bei_birthplace.raw_value["institution"] == "Smithsonian National Zoo"
    assert bei_birthplace.conflict_state is ConflictState.ENRICHMENT

    evidence_ids = {snapshot.snapshot_id for snapshot in bundle.evidence_snapshots}
    assert all(candidate.evidence_snapshot_id in evidence_ids for candidate in bundle.candidates)

    _assert_parser_drift_fails_closed()

    print(
        {
            "candidate_count": len(bundle.candidates),
            "matched_slugs": sorted(matched_slugs),
            "conflict_state_counts": {
                state.value: count for state, count in sorted(conflict_states.items())
            },
            "evidence_snapshot_count": len(bundle.evidence_snapshots),
            "deterministic_candidates": first_candidates == second_candidates,
            "parser_drift_zero_candidates": True,
            "trusted_write_targets": [],
            "publication_write_targets": [],
        }
    )


def _assert_parser_drift_fails_closed() -> None:
    fixture_root = Path(__file__).resolve().parents[1] / "tests" / "acquisition" / "fixtures"
    acquisition_root = Path(".acquisition")
    acquisition_root.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(
        prefix="smithsonian-drift-",
        dir=acquisition_root,
    ) as temporary:
        temporary_root = Path(temporary)
        for name in (
            "smithsonian-giant-panda.html",
            "smithsonian-giant-panda-faqs.html",
            "smithsonian-panda-pages.manifest.json",
        ):
            shutil.copy2(fixture_root / name, temporary_root / name)

        history_name = "smithsonian-history-giant-pandas.html"
        history = (fixture_root / history_name).read_text(encoding="utf-8")
        reviewed_heading = "Welcoming the new panda pair: Bao Li and Qing Bao"
        assert reviewed_heading in history
        (temporary_root / history_name).write_text(
            history.replace(reviewed_heading, "Changed history heading", 1),
            encoding="utf-8",
        )

        try:
            run_adapter(
                AdapterRunRequest(
                    source_id=SOURCE_ID,
                    adapter_id=ADAPTER_ID,
                    mode=AcquisitionMode.FIXTURE,
                    fixture=temporary_root / "smithsonian-panda-pages.manifest.json",
                    output_bundle=Path("smithsonian-profile-drift.json"),
                    overwrite=True,
                ),
                adapter_registry=DEFAULT_ADAPTER_REGISTRY,
            )
        except AdapterRunStopped as error:
            bundle = error.result.bundle
            assert bundle.run.state is AcquisitionRunState.FAILED
            assert len(bundle.evidence_snapshots) == 3
            assert not bundle.candidates
            assert not bundle.trusted_write_targets
            assert not bundle.publication_write_targets
        else:
            raise AssertionError("parser drift must fail with an evidence-only bundle")


def _run(output_name: str):
    return run_adapter(
        AdapterRunRequest(
            source_id=SOURCE_ID,
            adapter_id=ADAPTER_ID,
            mode=AcquisitionMode.FIXTURE,
            output_bundle=Path(output_name),
            overwrite=True,
        ),
        adapter_registry=DEFAULT_ADAPTER_REGISTRY,
    )


def _one(
    candidates,
    *,
    slug: str,
    field_path: str,
    raw_value=...,
):
    matches = [
        candidate
        for candidate in candidates
        if candidate.identity_match.matched_canonical_slug == slug
        and candidate.field_path == field_path
        and (raw_value is ... or candidate.raw_value == raw_value)
    ]
    if len(matches) != 1:
        raise AssertionError(
            f"expected one candidate for {slug} {field_path}; found {len(matches)}"
        )
    return matches[0]


def _one_event(
    candidates,
    *,
    slug: str,
    event_type: str,
    raw_date: str,
):
    matches = [
        candidate
        for candidate in candidates
        if candidate.identity_match.matched_canonical_slug == slug
        and candidate.field_path == "event"
        and isinstance(candidate.raw_value, dict)
        and candidate.raw_value.get("event_type") == event_type
        and candidate.raw_value.get("event_date") == raw_date
    ]
    if len(matches) != 1:
        raise AssertionError(
            f"expected one {event_type} event for {slug} on {raw_date}; found {len(matches)}"
        )
    return matches[0]


if __name__ == "__main__":
    main()
