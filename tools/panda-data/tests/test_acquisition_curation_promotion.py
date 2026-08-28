from __future__ import annotations

from datetime import UTC, date, datetime
from uuid import uuid4

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
    CurationOwnerOperation,
    CuratorDecision,
    DecisionAction,
    DecisionLog,
    build_acquisition_curation_recommendations,
)

SOURCE_ID = "promotion-fixture"
BODY = b"reviewed acquisition fixture"
STARTED_AT = datetime(2026, 8, 28, 9, 0, tzinfo=UTC)
COMPLETED_AT = datetime(2026, 8, 28, 9, 1, tzinfo=UTC)
BUNDLE_AT = datetime(2026, 8, 28, 9, 2, tzinfo=UTC)
DECIDED_AT = datetime(2026, 8, 28, 10, 0, tzinfo=UTC)


def _snapshot() -> EvidenceSnapshot:
    return EvidenceSnapshot.from_http_response(
        source_id=SOURCE_ID,
        requested_url="https://example.test/pandas",
        final_url="https://example.test/pandas",
        captured_at=COMPLETED_AT,
        status=200,
        headers={"content-type": "application/json"},
        body=BODY,
        block_state=EvidenceBlockState.CLEAR,
        capability=AcquisitionCapability.PUBLIC_HTTP,
    )


def _candidate(
    snapshot: EvidenceSnapshot,
    *,
    target_panda_id: str | None,
    matched_slug: str | None = None,
    kind: CandidateKind,
    field_path: str,
    normalized_value: object,
    conflict_state: ConflictState,
    current_value: object | None = None,
) -> FieldCandidate:
    match = PandaIdentityMatch(
        state=IdentityMatchState.MATCHED,
        source_identity="fixture:panda",
        matched_panda_id=target_panda_id,
        matched_canonical_slug=matched_slug,
    )
    return FieldCandidate(
        source_id=SOURCE_ID,
        evidence_snapshot_id=snapshot.snapshot_id,
        evidence_body_sha256=snapshot.body_sha256,
        candidate_kind=kind,
        subject_key="fixture:panda",
        field_path=field_path,
        source_locator=SourceLocator(kind=SourceLocatorKind.JSON_PATH, value=f"$.{field_path}"),
        raw_value=normalized_value,
        normalized_value=normalized_value,
        identity_match=match,
        current_trusted_value=CurrentTrustedValue(
            present=current_value is not None,
            value=current_value,
            assertion_ids=("existing-assertion",) if current_value is not None else (),
        ),
        parser_name="fixture-parser",
        parser_version="1",
        conflict_state=conflict_state,
    )


def _bundle(snapshot: EvidenceSnapshot, candidates: tuple[FieldCandidate, ...]) -> AcquisitionBundle:
    run = AcquisitionRun(
        run_id="promotion-run",
        source_id=SOURCE_ID,
        adapter_id="promotion-fixture",
        adapter_version="1",
        parser_name="fixture-parser",
        parser_version="1",
        mode=AcquisitionMode.FIXTURE,
        state=AcquisitionRunState.COMPLETED,
        started_at=STARTED_AT,
        completed_at=COMPLETED_AT,
        source_reviewed_at=date(2026, 8, 28),
        source_review_expires_at=date(2027, 8, 28),
    )
    return AcquisitionBundle(
        run=run,
        evidence_snapshots=(snapshot,),
        candidates=candidates,
        created_at=BUNDLE_AT,
    )


def _accepted_log(bundle: AcquisitionBundle) -> DecisionLog:
    decisions = tuple(
        CuratorDecision(
            candidate_id=candidate.candidate_id,
            evidence_snapshot_id=candidate.evidence_snapshot_id,
            reviewer="archive-editor-fixture",
            decided_at=DECIDED_AT,
            action=DecisionAction.ACCEPTED,
        )
        for candidate in bundle.candidates
    )
    return DecisionLog(
        acquisition_bundle_id=bundle.bundle_id,
        created_at=DECIDED_AT,
        updated_at=DECIDED_AT,
        decisions=decisions,
    )


def test_builds_typed_v2_owner_recommendation_with_corroboration_and_dispute() -> None:
    snapshot = _snapshot()
    target_id = str(uuid4())
    parent_id = str(uuid4())
    place_id = str(uuid4())
    candidates = (
        _candidate(
            snapshot,
            target_panda_id=target_id,
            kind=CandidateKind.IDENTITY,
            field_path="identity.sex",
            normalized_value="male",
            conflict_state=ConflictState.UNCHANGED,
            current_value="male",
        ),
        _candidate(
            snapshot,
            target_panda_id=target_id,
            kind=CandidateKind.IDENTITY,
            field_path="identity.life_status",
            normalized_value="deceased",
            conflict_state=ConflictState.CONTRADICTION,
            current_value="alive",
        ),
        _candidate(
            snapshot,
            target_panda_id=target_id,
            kind=CandidateKind.RELATIONSHIP,
            field_path="relationship.father",
            normalized_value={"parent_id": parent_id, "status": "confirmed"},
            conflict_state=ConflictState.NEW,
        ),
        _candidate(
            snapshot,
            target_panda_id=target_id,
            kind=CandidateKind.RESIDENCY,
            field_path="residency.primary",
            normalized_value={
                "place_id": place_id,
                "start_precision": "year",
                "start": "2021",
                "status": "confirmed",
            },
            conflict_state=ConflictState.NEW,
        ),
        _candidate(
            snapshot,
            target_panda_id=target_id,
            kind=CandidateKind.EVENT,
            field_path="event.arrival",
            normalized_value={
                "event_type": "arrival",
                "event_date": {"precision": "month", "value": "2024-05"},
                "to_place_id": place_id,
            },
            conflict_state=ConflictState.NEW,
        ),
    )
    bundle = _bundle(snapshot, candidates)

    recommendations = build_acquisition_curation_recommendations(
        bundle,
        _accepted_log(bundle),
        pipeline_artifact_id=str(uuid4()),
        recommended_by_account_id=str(uuid4()),
    )

    assert len(recommendations) == 1
    recommendation = recommendations[0]
    assert recommendation.target_panda_id == target_id
    by_operation = {change.operation: change for change in recommendation.changes}

    corroboration = by_operation[CurationOwnerOperation.FACT_CORROBORATE]
    assert corroboration.payload == {
        "fieldKey": "profile.sex",
        "value": "male",
        "certainty": "confirmed",
    }
    assert corroboration.last_verified_on == date(2026, 8, 28)
    assert corroboration.source_ids == (SOURCE_ID,)

    dispute = by_operation[CurationOwnerOperation.FACT_DISPUTE]
    assert dispute.payload == {
        "fieldKey": "profile.life_status",
        "value": "deceased",
        "certainty": "provisional",
    }

    parentage = by_operation[CurationOwnerOperation.PARENTAGE_CREATE]
    assert parentage.payload == {
        "parentId": parent_id,
        "parentRole": "father",
        "status": "confirmed",
    }

    residency = by_operation[CurationOwnerOperation.RESIDENCY_CREATE]
    assert residency.payload["startOn"] == "2021-01-01"
    assert residency.payload["startPrecision"] == "year"
    assert residency.payload["placeId"] == place_id

    event = by_operation[CurationOwnerOperation.EVENT_CREATE]
    assert event.payload["occurredOn"] == "2024-05-01"
    assert event.payload["occurredPrecision"] == "month"
    assert event.payload["toPlaceId"] == place_id

    serialized = recommendation.to_dict()
    assert serialized["acquisitionBundleId"] == bundle.bundle_id
    assert serialized["targetPandaId"] == target_id
    assert serialized["changes"]


def test_requires_resolved_target_panda_uuid_instead_of_guessing_from_slug() -> None:
    snapshot = _snapshot()
    candidate = _candidate(
        snapshot,
        target_panda_id=None,
        matched_slug="known-panda",
        kind=CandidateKind.IDENTITY,
        field_path="identity.sex",
        normalized_value="female",
        conflict_state=ConflictState.NEW,
    )
    bundle = _bundle(snapshot, (candidate,))

    with pytest.raises(ValueError, match="no resolved target Panda UUID"):
        build_acquisition_curation_recommendations(
            bundle,
            _accepted_log(bundle),
            pipeline_artifact_id=str(uuid4()),
            recommended_by_account_id=str(uuid4()),
        )


def test_requires_resolved_parent_uuid_instead_of_inferring_from_name_or_slug() -> None:
    snapshot = _snapshot()
    candidate = _candidate(
        snapshot,
        target_panda_id=str(uuid4()),
        kind=CandidateKind.RELATIONSHIP,
        field_path="relationship.mother",
        normalized_value={"canonical_slug": "possible-mother"},
        conflict_state=ConflictState.NEW,
    )
    bundle = _bundle(snapshot, (candidate,))

    with pytest.raises(ValueError, match="no resolved parent Panda UUID"):
        build_acquisition_curation_recommendations(
            bundle,
            _accepted_log(bundle),
            pipeline_artifact_id=str(uuid4()),
            recommended_by_account_id=str(uuid4()),
        )
