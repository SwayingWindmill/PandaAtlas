from __future__ import annotations

from dataclasses import replace
from types import MappingProxyType

from app.acquisition.contracts import (
    CandidateKind,
    ConflictState,
    CurrentTrustedValue,
    FieldCandidate,
    IdentityMatchState,
    PandaIdentityMatch,
    SourceLocator,
    SourceLocatorKind,
)
from app.acquisition.reconciliation import (
    ReconciliationSnapshot,
    load_reconciliation_snapshot,
    reconcile_candidates,
)
from app.acquisition.source_registry import load_source_registry

_SOURCE_ID = "smithsonian-national-zoo-panda-pages"
_PARSER_NAME = "reconciliation-sanity"
_PARSER_VERSION = "1.0.0"
_EVIDENCE_SHA256 = "0" * 64


def main() -> None:
    source = load_source_registry().get(_SOURCE_ID)
    snapshot = load_reconciliation_snapshot()
    _assert_snapshot_immutable(snapshot)
    candidates = (
        _candidate(
            "bao-li-profile",
            "identity.names.official.en",
            "Bao Li",
        ),
        _candidate(
            "bao-li-profile",
            "identity.sex",
            "male",
        ),
        _candidate(
            "bao-li-profile",
            "identity.sex",
            None,
            locator="$.absent_sex",
        ),
        _candidate(
            "bao-li-profile",
            "identity.sex",
            "female",
            locator="$.contradictory_sex",
        ),
        _candidate(
            "bao-li-profile",
            "relationship.father",
            "An An",
            kind=CandidateKind.RELATIONSHIP,
        ),
        _candidate(
            "bao-li-profile",
            "event",
            {
                "event_type": "public debut",
                "event_date": "2025-01-24",
                "location": "Smithsonian National Zoo, Washington, D.C.",
                "related": ["Bao Bao"],
            },
            kind=CandidateKind.EVENT,
        ),
        _candidate(
            "bao-li-profile",
            "event",
            {
                "event_type": "birth",
                "event_date": "2021-08-04",
                "location": "China Conservation and Research Center for the Giant Panda, Sichuan",
                "related": ["An An"],
            },
            kind=CandidateKind.EVENT,
            locator="$.birth_event_source_text",
        ),
        _candidate(
            "an-an-profile",
            "identity.names.official.en",
            "An An",
        ),
        _candidate(
            "an-an-profile",
            "identity.birth_date",
            "2000-01-01",
        ),
        _candidate(
            "an-an-profile",
            "residency.current_location",
            "China, Sichuan",
            kind=CandidateKind.RESIDENCY,
            locator="$.detailed_location",
        ),
        _candidate(
            "an-an-profile",
            "residency.current_location",
            "Chinatown Zoo",
            kind=CandidateKind.RESIDENCY,
            locator="$.substring_location",
        ),
        _candidate(
            "ling-ling-profile",
            "identity.names.official.en",
            "Ling Ling",
        ),
        _candidate(
            "ling-ling-profile",
            "identity.birth_date",
            "1970-01-01",
        ),
        _candidate(
            "new-profile",
            "identity.names.official.en",
            "A Completely New Panda",
        ),
        _candidate(
            "new-profile",
            "identity.sex",
            "female",
        ),
    )

    first = reconcile_candidates(
        candidates,
        source=source,
        cohort="smithsonian-reviewed-profile-cohort",
        snapshot=snapshot,
    )
    second = reconcile_candidates(
        candidates,
        source=source,
        cohort="smithsonian-reviewed-profile-cohort",
        snapshot=snapshot,
    )
    assert [item.to_dict() for item in first.candidates] == [
        item.to_dict() for item in second.candidates
    ]
    assert first.summary.to_dict() == second.summary.to_dict()

    _assert_candidate(
        first.candidates,
        subject="bao-li-profile",
        locator="$.identity.sex",
        identity=IdentityMatchState.MATCHED,
        conflict=ConflictState.UNCHANGED,
        slug="bao-li",
    )
    _assert_candidate(
        first.candidates,
        subject="bao-li-profile",
        locator="$.absent_sex",
        identity=IdentityMatchState.MATCHED,
        conflict=ConflictState.NOT_COMPARED,
        slug="bao-li",
    )
    _assert_candidate(
        first.candidates,
        subject="bao-li-profile",
        locator="$.contradictory_sex",
        identity=IdentityMatchState.MATCHED,
        conflict=ConflictState.CONTRADICTION,
        slug="bao-li",
    )
    _assert_candidate(
        first.candidates,
        subject="bao-li-profile",
        locator="$.relationship.father",
        identity=IdentityMatchState.MATCHED,
        conflict=ConflictState.NOT_COMPARED,
        slug="bao-li",
    )
    _assert_candidate(
        first.candidates,
        subject="bao-li-profile",
        locator="$.event",
        identity=IdentityMatchState.MATCHED,
        conflict=ConflictState.NEW,
        slug="bao-li",
    )
    event_candidate = next(
        item
        for item in first.candidates
        if item.subject_key == "bao-li-profile" and item.source_locator.value == "$.event"
    )
    assert event_candidate.normalized_value["related_slugs"] == ["Bao Bao"]
    _assert_candidate(
        first.candidates,
        subject="bao-li-profile",
        locator="$.birth_event_source_text",
        identity=IdentityMatchState.MATCHED,
        conflict=ConflictState.ENRICHMENT,
        slug="bao-li",
    )
    _assert_candidate(
        first.candidates,
        subject="an-an-profile",
        locator="$.identity.birth_date",
        identity=IdentityMatchState.MATCHED,
        conflict=ConflictState.MISSING_CURRENT_VALUE,
        slug="an-an",
    )
    _assert_candidate(
        first.candidates,
        subject="an-an-profile",
        locator="$.detailed_location",
        identity=IdentityMatchState.MATCHED,
        conflict=ConflictState.ENRICHMENT,
        slug="an-an",
    )
    _assert_candidate(
        first.candidates,
        subject="an-an-profile",
        locator="$.substring_location",
        identity=IdentityMatchState.MATCHED,
        conflict=ConflictState.CONTRADICTION,
        slug="an-an",
    )
    _assert_candidate(
        first.candidates,
        subject="ling-ling-profile",
        locator="$.identity.birth_date",
        identity=IdentityMatchState.MATCHED,
        conflict=ConflictState.ENRICHMENT,
        slug="ling-ling-smithsonian",
    )
    _assert_candidate(
        first.candidates,
        subject="new-profile",
        locator="$.identity.sex",
        identity=IdentityMatchState.UNMATCHED,
        conflict=ConflictState.NEW,
        slug=None,
    )

    ambiguous_snapshot = _with_ambiguous_identifier(snapshot)
    ambiguous = reconcile_candidates(
        (
            _candidate(
                "ambiguous-profile",
                "identity.external_identifier.demo",
                {"system": "demo", "value": "shared"},
            ),
        ),
        source=source,
        cohort="smithsonian-reviewed-profile-cohort",
        snapshot=ambiguous_snapshot,
    ).candidates[0]
    assert ambiguous.identity_match.state is IdentityMatchState.AMBIGUOUS
    assert len(ambiguous.identity_match.candidate_panda_ids) == 2
    assert ambiguous.conflict_state is ConflictState.NOT_COMPARED

    punctuation_snapshot = _with_external_identifier(
        snapshot,
        key=("demo", "A-1"),
        slugs=("bao-li",),
    )
    punctuation_candidates = reconcile_candidates(
        (
            _candidate(
                "punctuated-profile",
                "identity.external_identifier.demo",
                {"system": "demo", "value": "A-1"},
            ),
            _candidate(
                "collapsed-profile",
                "identity.external_identifier.demo",
                {"system": "demo", "value": "A1"},
            ),
        ),
        source=source,
        cohort="smithsonian-reviewed-profile-cohort",
        snapshot=punctuation_snapshot,
    ).candidates
    assert punctuation_candidates[0].identity_match.state is IdentityMatchState.MATCHED
    assert punctuation_candidates[0].identity_match.matched_canonical_slug == "bao-li"
    assert punctuation_candidates[1].identity_match.state is IdentityMatchState.UNMATCHED

    raw_date_candidate = next(
        item
        for item in first.candidates
        if item.subject_key == "ling-ling-profile" and item.field_path == "identity.birth_date"
    )
    assert raw_date_candidate.raw_value == "1970-01-01"
    assert raw_date_candidate.normalized_value == {
        "value": "1970-01-01",
        "precision": "day",
    }

    print(
        {
            "snapshot_id": first.summary.snapshot_id,
            "candidate_count": first.summary.candidate_count,
            "identity_state_counts": dict(first.summary.identity_state_counts),
            "conflict_state_counts": dict(first.summary.conflict_state_counts),
            "ambiguous_candidates": list(ambiguous.identity_match.candidate_panda_ids),
        }
    )


def _candidate(
    subject_key: str,
    field_path: str,
    value,
    *,
    kind: CandidateKind = CandidateKind.IDENTITY,
    locator: str | None = None,
) -> FieldCandidate:
    return FieldCandidate(
        source_id=_SOURCE_ID,
        evidence_snapshot_id="evidence-reconciliation-sanity",
        evidence_body_sha256=_EVIDENCE_SHA256,
        candidate_kind=kind,
        subject_key=subject_key,
        field_path=field_path,
        source_locator=SourceLocator(
            kind=SourceLocatorKind.JSON_PATH,
            value=locator or f"$.{field_path}",
        ),
        raw_value=value,
        normalized_value=value,
        identity_match=PandaIdentityMatch(
            state=IdentityMatchState.NOT_ATTEMPTED,
            source_identity=subject_key,
        ),
        current_trusted_value=CurrentTrustedValue(present=False),
        parser_name=_PARSER_NAME,
        parser_version=_PARSER_VERSION,
    )


def _assert_snapshot_immutable(snapshot: ReconciliationSnapshot) -> None:
    event_rows = next(iter(snapshot.events_by_panda.values()))
    try:
        event_rows[0]["event_id"] = "mutated"
    except TypeError:
        pass
    else:
        raise AssertionError("reconciliation snapshot event rows must be immutable")


def _assert_candidate(
    candidates: tuple[FieldCandidate, ...],
    *,
    subject: str,
    locator: str,
    identity: IdentityMatchState,
    conflict: ConflictState,
    slug: str | None,
) -> None:
    candidate = next(
        item
        for item in candidates
        if item.subject_key == subject and item.source_locator.value == locator
    )
    assert candidate.identity_match.state is identity
    assert candidate.identity_match.matched_canonical_slug == slug
    assert candidate.conflict_state is conflict


def _with_ambiguous_identifier(
    snapshot: ReconciliationSnapshot,
) -> ReconciliationSnapshot:
    return _with_external_identifier(
        snapshot,
        key=("demo", "shared"),
        slugs=("bao-li", "qing-bao"),
    )


def _with_external_identifier(
    snapshot: ReconciliationSnapshot,
    *,
    key: tuple[str, str],
    slugs: tuple[str, ...],
) -> ReconciliationSnapshot:
    external_index = dict(snapshot.external_identifier_index)
    external_index[key] = slugs
    return replace(
        snapshot,
        external_identifier_index=MappingProxyType(external_index),
    )


if __name__ == "__main__":
    main()
