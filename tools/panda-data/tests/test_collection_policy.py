from __future__ import annotations

import pytest

from panda_data.acquisition.contracts import (
    CandidateKind,
    ConflictState,
    CurrentTrustedValue,
    FieldCandidate,
    IdentityMatchState,
    PandaIdentityMatch,
    SourceLocator,
    SourceLocatorKind,
)
from panda_data.acquisition.curation import DecisionAction, collection_policy_decision


def _candidate(
    *,
    kind: CandidateKind,
    field_path: str,
    normalized_value: object,
    conflict_state: ConflictState = ConflictState.NEW,
    identity_state: IdentityMatchState = IdentityMatchState.MATCHED,
) -> FieldCandidate:
    match = PandaIdentityMatch(
        state=identity_state,
        source_identity="source:panda-1",
        matched_canonical_slug=("panda-1" if identity_state is IdentityMatchState.MATCHED else None),
    )
    current_value = CurrentTrustedValue(
        present=conflict_state is ConflictState.UNCHANGED,
        value=normalized_value if conflict_state is ConflictState.UNCHANGED else None,
    )
    return FieldCandidate(
        source_id="source-fixture",
        evidence_snapshot_id="evidence-fixture",
        evidence_body_sha256="a" * 64,
        candidate_kind=kind,
        subject_key="source:panda-1",
        field_path=field_path,
        source_locator=SourceLocator(kind=SourceLocatorKind.TEXT_SPAN, value="fixture"),
        raw_value=normalized_value,
        normalized_value=normalized_value,
        identity_match=match,
        current_trusted_value=current_value,
        parser_name="fixture-parser",
        parser_version="1",
        conflict_state=conflict_state,
    )


@pytest.mark.parametrize(
    ("precision", "value"),
    [
        ("month", "2024-05"),
        ("year", "2024"),
        ("unknown", None),
    ],
)
def test_collection_policy_accepts_structured_events_without_inventing_day_precision(
    precision: str,
    value: str | None,
) -> None:
    candidate = _candidate(
        kind=CandidateKind.EVENT,
        field_path="event",
        normalized_value={
            "event_type": "arrival",
            "event_date": {"precision": precision, "value": value},
        },
    )

    action, _ = collection_policy_decision(candidate)

    assert action is DecisionAction.ACCEPTED
    assert candidate.normalized_value["event_date"] == {"precision": precision, "value": value}


def test_collection_policy_uses_v2_representability_instead_of_legacy_csv_whitelists() -> None:
    candidates = (
        _candidate(
            kind=CandidateKind.IDENTITY,
            field_path="identity.aliases.en",
            normalized_value="Historic Name",
        ),
        _candidate(
            kind=CandidateKind.RELATIONSHIP,
            field_path="relationship.mother",
            normalized_value={"canonical_slug": "mother-panda"},
        ),
        _candidate(
            kind=CandidateKind.RESIDENCY,
            field_path="residency.primary",
            normalized_value={"place": "chengdu", "start_precision": "year", "start": "2021"},
        ),
    )

    assert all(
        collection_policy_decision(candidate)[0] is DecisionAction.ACCEPTED
        for candidate in candidates
    )


def test_collection_policy_keeps_new_identity_creation_reviewable_but_not_promotable() -> None:
    candidate = _candidate(
        kind=CandidateKind.IDENTITY,
        field_path="identity.external_identifiers.studbook",
        normalized_value="398",
        identity_state=IdentityMatchState.UNMATCHED,
    )

    action, note = collection_policy_decision(candidate)

    assert action is DecisionAction.DEFERRED
    assert "target Panda UUID" in note


def test_collection_policy_keeps_unresolved_parentage_and_contradictions_review_only() -> None:
    unresolved_parent = _candidate(
        kind=CandidateKind.RELATIONSHIP,
        field_path="relationship.father",
        normalized_value={"source_name": "Unknown Father"},
    )
    contradiction = _candidate(
        kind=CandidateKind.IDENTITY,
        field_path="identity.sex",
        normalized_value="female",
        conflict_state=ConflictState.CONTRADICTION,
    )

    assert collection_policy_decision(unresolved_parent)[0] is DecisionAction.DEFERRED
    assert collection_policy_decision(contradiction)[0] is DecisionAction.DEFERRED


def test_collection_policy_accepts_corroboration_without_expanding_media_scope() -> None:
    media = _candidate(
        kind=CandidateKind.MEDIA_METADATA,
        field_path="media.caption",
        normalized_value={"caption": "fixture"},
    )
    unchanged = _candidate(
        kind=CandidateKind.IDENTITY,
        field_path="identity.sex",
        normalized_value="male",
        conflict_state=ConflictState.UNCHANGED,
    )

    assert collection_policy_decision(media)[0] is DecisionAction.DEFERRED
    action, note = collection_policy_decision(unchanged)
    assert action is DecisionAction.ACCEPTED
    assert "corroborating V2 provenance" in note
