from __future__ import annotations

from dataclasses import replace
from datetime import UTC, date, datetime

import pytest

from panda_data.acquisition.contracts import (
    AcquisitionBundle,
    AcquisitionCapability,
    AcquisitionMode,
    AcquisitionRun,
    AcquisitionRunState,
    CandidateKind,
    ConflictState,
    CurrentTrustedValue,
    EvidenceBlockState,
    EvidenceSnapshot,
    FieldCandidate,
    IdentityMatchState,
    PandaIdentityMatch,
    SourceLocator,
    SourceLocatorKind,
)
from panda_data.acquisition.curation import (
    CuratorDecision,
    DecisionAction,
    DecisionLog,
    V2CurationResolutionContext,
    build_acquisition_curation_recommendations,
)

TARGET_ID = "11111111-1111-4111-8111-111111111111"
PARENT_ID = "22222222-2222-4222-8222-222222222222"
PLACE_ID = "33333333-3333-4333-8333-333333333333"
ARTIFACT_ID = "44444444-4444-4444-8444-444444444444"
EDITOR_ID = "55555555-5555-4555-8555-555555555555"
CREATED_AT = datetime(2026, 8, 28, 12, tzinfo=UTC)
DECIDED_AT = datetime(2026, 8, 28, 13, tzinfo=UTC)
EXPORTED_AT = datetime(2026, 8, 28, 14, tzinfo=UTC)


def _bundle(candidates: tuple[FieldCandidate, ...]) -> AcquisitionBundle:
    snapshot = EvidenceSnapshot.from_http_response(
        source_id="source-fixture",
        requested_url="https://example.org/pandas",
        final_url="https://example.org/pandas",
        captured_at=datetime(2026, 8, 28, 11, tzinfo=UTC),
        status=200,
        headers={"content-type": "text/html"},
        body=b"fixture evidence",
        block_state=EvidenceBlockState.CLEAR,
        capability=AcquisitionCapability.PUBLIC_HTTP,
    )
    candidates = tuple(
        replace(
            candidate,
            evidence_snapshot_id=snapshot.snapshot_id,
            evidence_body_sha256=snapshot.body_sha256,
        )
        for candidate in candidates
    )
    return AcquisitionBundle(
        run=AcquisitionRun(
            run_id="run-fixture",
            source_id="source-fixture",
            adapter_id="fixture-adapter",
            adapter_version="1",
            parser_name="fixture-parser",
            parser_version="1",
            mode=AcquisitionMode.LIVE,
            state=AcquisitionRunState.COMPLETED,
            started_at=datetime(2026, 8, 28, 10, tzinfo=UTC),
            completed_at=datetime(2026, 8, 28, 11, tzinfo=UTC),
            source_reviewed_at=date(2026, 8, 1),
            source_review_expires_at=date(2026, 12, 31),
        ),
        evidence_snapshots=(snapshot,),
        candidates=candidates,
        created_at=CREATED_AT,
    )


def _candidate(
    *,
    kind: CandidateKind,
    field_path: str,
    normalized_value: object,
    conflict_state: ConflictState = ConflictState.NEW,
    current_value: object | None = None,
    identity_match: PandaIdentityMatch | None = None,
) -> FieldCandidate:
    return FieldCandidate(
        source_id="source-fixture",
        evidence_snapshot_id="placeholder",
        evidence_body_sha256="a" * 64,
        candidate_kind=kind,
        subject_key="fixture-panda",
        field_path=field_path,
        source_locator=SourceLocator(kind=SourceLocatorKind.TEXT_SPAN, value=field_path),
        raw_value=normalized_value,
        normalized_value=normalized_value,
        identity_match=identity_match
        or PandaIdentityMatch(
            state=IdentityMatchState.MATCHED,
            source_identity="fixture-panda",
            matched_panda_id=TARGET_ID,
            matched_canonical_slug="fixture-panda",
        ),
        current_trusted_value=CurrentTrustedValue(
            present=current_value is not None,
            value=current_value,
        ),
        parser_name="fixture-parser",
        parser_version="1",
        conflict_state=conflict_state,
    )


def _accepted_log(bundle: AcquisitionBundle) -> DecisionLog:
    return DecisionLog(
        acquisition_bundle_id=bundle.bundle_id,
        created_at=DECIDED_AT,
        updated_at=DECIDED_AT,
        decisions=tuple(
            CuratorDecision(
                candidate_id=candidate.candidate_id,
                evidence_snapshot_id=candidate.evidence_snapshot_id,
                reviewer="fixture-reviewer",
                decided_at=DECIDED_AT,
                action=DecisionAction.ACCEPTED,
            )
            for candidate in bundle.candidates
        ),
    )


def _resolution() -> V2CurationResolutionContext:
    return V2CurationResolutionContext(
        panda_ids_by_slug={"mother-panda": PARENT_ID},
        place_ids_by_key={"chengdu": PLACE_ID},
    )


def test_adapter_maps_reviewed_candidates_to_v2_owner_operations_and_preserves_date_precision() -> (
    None
):
    bundle = _bundle(
        (
            _candidate(
                kind=CandidateKind.IDENTITY,
                field_path="identity.sex",
                normalized_value="male",
                conflict_state=ConflictState.UNCHANGED,
                current_value="male",
            ),
            _candidate(
                kind=CandidateKind.IDENTITY,
                field_path="identity.life_status",
                normalized_value="deceased",
                conflict_state=ConflictState.CONTRADICTION,
                current_value="alive",
            ),
            _candidate(
                kind=CandidateKind.IDENTITY,
                field_path="identity.aliases.en",
                normalized_value="Historic Name",
            ),
            _candidate(
                kind=CandidateKind.IDENTITY,
                field_path="identity.external_identifier.studbook",
                normalized_value={"system": "studbook", "value": "398"},
            ),
            _candidate(
                kind=CandidateKind.RELATIONSHIP,
                field_path="relationship.mother",
                normalized_value={"canonical_slug": "mother-panda"},
            ),
            _candidate(
                kind=CandidateKind.RESIDENCY,
                field_path="residency.primary",
                normalized_value={
                    "place": "chengdu",
                    "start": "2021",
                    "start_precision": "year",
                },
            ),
            _candidate(
                kind=CandidateKind.EVENT,
                field_path="event",
                normalized_value={
                    "event_type": "arrival",
                    "event_date": {"value": "2024-05", "precision": "month"},
                    "location": "chengdu",
                },
            ),
        )
    )

    recommendations = build_acquisition_curation_recommendations(
        bundle,
        _accepted_log(bundle),
        pipeline_artifact_id=ARTIFACT_ID,
        recommended_by_account_id=EDITOR_ID,
        reason="Promote reviewed breadth-first candidates into their V2 owners.",
        resolution=_resolution(),
        created_at=EXPORTED_AT,
    )

    assert len(recommendations) == 1
    wire = recommendations[0].to_wire()
    assert wire["targetPandaId"] == TARGET_ID
    changes = {change["candidateId"]: change for change in wire["changes"]}

    sex = next(
        change for change in changes.values() if change["payload"].get("fieldKey") == "profile.sex"
    )
    assert sex["operation"] == "fact.corroborate"

    status = next(
        change
        for change in changes.values()
        if change["payload"].get("fieldKey") == "profile.life_status"
    )
    assert status["operation"] == "fact.dispute"
    assert status["payload"]["certainty"] == "provisional"

    name = next(change for change in changes.values() if change["operation"] == "name.add")
    assert name["payload"] == {
        "languageTag": "en",
        "nameKind": "alias",
        "value": "Historic Name",
    }

    identifier = next(
        change for change in changes.values() if change["operation"] == "external_identifier.add"
    )
    assert identifier["payload"] == {"system": "studbook", "value": "398"}

    parentage = next(
        change for change in changes.values() if change["operation"] == "parentage.create"
    )
    assert parentage["payload"] == {
        "parentId": PARENT_ID,
        "parentRole": "mother",
        "status": "confirmed",
    }

    residency = next(
        change for change in changes.values() if change["operation"] == "residency.create"
    )
    assert residency["payload"]["placeId"] == PLACE_ID
    assert residency["payload"]["startOn"] == "2021-01-01"
    assert residency["payload"]["startPrecision"] == "year"

    event = next(change for change in changes.values() if change["operation"] == "event.create")
    assert event["payload"]["occurredOn"] == "2024-05-01"
    assert event["payload"]["occurredPrecision"] == "month"
    assert event["payload"]["toPlaceId"] == PLACE_ID


def test_adapter_preserves_unknown_event_date_without_fabricating_a_day() -> None:
    bundle = _bundle(
        (
            _candidate(
                kind=CandidateKind.EVENT,
                field_path="event",
                normalized_value={
                    "event_type": "observation",
                    "event_date": {"value": None, "precision": "unknown"},
                },
            ),
        )
    )

    wire = build_acquisition_curation_recommendations(
        bundle,
        _accepted_log(bundle),
        pipeline_artifact_id=ARTIFACT_ID,
        recommended_by_account_id=EDITOR_ID,
        reason="Retain reviewed event precision without inventing a date.",
        resolution=_resolution(),
        created_at=EXPORTED_AT,
    )[0].to_wire()

    payload = wire["changes"][0]["payload"]
    assert payload["occurredPrecision"] == "unknown"
    assert "occurredOn" not in payload


def test_adapter_fails_closed_for_ambiguous_target_identity() -> None:
    ambiguous = PandaIdentityMatch(
        state=IdentityMatchState.AMBIGUOUS,
        source_identity="same-name-panda",
        candidate_panda_ids=(TARGET_ID, PARENT_ID),
    )
    bundle = _bundle(
        (
            _candidate(
                kind=CandidateKind.IDENTITY,
                field_path="identity.sex",
                normalized_value="female",
                identity_match=ambiguous,
            ),
        )
    )

    with pytest.raises(ValueError, match="ambiguous panda identity"):
        build_acquisition_curation_recommendations(
            bundle,
            _accepted_log(bundle),
            pipeline_artifact_id=ARTIFACT_ID,
            recommended_by_account_id=EDITOR_ID,
            reason="This must not auto-merge an ambiguous Panda identity.",
            resolution=_resolution(),
            created_at=EXPORTED_AT,
        )


def test_adapter_fails_closed_for_unresolved_parent_source_text() -> None:
    bundle = _bundle(
        (
            _candidate(
                kind=CandidateKind.RELATIONSHIP,
                field_path="relationship.father",
                normalized_value={"source_name": "Unknown Father"},
            ),
        )
    )

    with pytest.raises(ValueError, match="source text is unresolved"):
        build_acquisition_curation_recommendations(
            bundle,
            _accepted_log(bundle),
            pipeline_artifact_id=ARTIFACT_ID,
            recommended_by_account_id=EDITOR_ID,
            reason="This must not infer a parent from source text alone.",
            resolution=_resolution(),
            created_at=EXPORTED_AT,
        )
