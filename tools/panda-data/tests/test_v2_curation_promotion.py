from __future__ import annotations

from datetime import UTC, date, datetime
from uuid import UUID

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
    build_v2_curation_promotion,
)

SOURCE_ID = "institution-source"
PANDA_A = "11111111-1111-4111-8111-111111111111"
PANDA_B = "22222222-2222-4222-8222-222222222222"
PARENT_ID = "33333333-3333-4333-8333-333333333333"
PLACE_ID = "44444444-4444-4444-8444-444444444444"
ARTIFACT_ID = "55555555-5555-4555-8555-555555555555"
EDITOR_ID = "66666666-6666-4666-8666-666666666666"
BODY_SHA = "a" * 64
CREATED_AT = datetime(2026, 8, 28, 12, tzinfo=UTC)
DECIDED_AT = datetime(2026, 8, 28, 13, tzinfo=UTC)
PROMOTED_AT = datetime(2026, 8, 28, 14, tzinfo=UTC)


def _candidate(
    *,
    kind: CandidateKind,
    field_path: str,
    value: object,
    conflict: ConflictState,
    panda_id: str | None = PANDA_A,
    canonical_slug: str | None = "panda-a",
    subject: str = "source:panda-a",
) -> FieldCandidate:
    match = PandaIdentityMatch(
        state=IdentityMatchState.MATCHED,
        source_identity=subject,
        matched_panda_id=panda_id,
        matched_canonical_slug=canonical_slug,
    )
    return FieldCandidate(
        source_id=SOURCE_ID,
        evidence_snapshot_id=_snapshot().snapshot_id,
        evidence_body_sha256=BODY_SHA,
        candidate_kind=kind,
        subject_key=subject,
        field_path=field_path,
        source_locator=SourceLocator(kind=SourceLocatorKind.API_FIELD, value=field_path),
        raw_value=value,  # type: ignore[arg-type]
        normalized_value=value,  # type: ignore[arg-type]
        identity_match=match,
        current_trusted_value=CurrentTrustedValue(present=False),
        parser_name="promotion-test",
        parser_version="1.0.0",
        conflict_state=conflict,
    )


def _snapshot() -> EvidenceSnapshot:
    return EvidenceSnapshot(
        source_id=SOURCE_ID,
        requested_url="https://example.test/pandas",
        final_url="https://example.test/pandas",
        captured_at=datetime(2026, 8, 28, 11, tzinfo=UTC),
        status=200,
        headers={"content-type": "application/json"},
        body_bytes=128,
        body_sha256=BODY_SHA,
        block_state=EvidenceBlockState.CLEAR,
        capability=AcquisitionCapability.PUBLIC_HTTP,
        content_type="application/json",
    )


def _bundle(candidates: tuple[FieldCandidate, ...]) -> AcquisitionBundle:
    return AcquisitionBundle(
        run=AcquisitionRun(
            run_id="promotion-run",
            source_id=SOURCE_ID,
            adapter_id="promotion-test",
            adapter_version="1.0.0",
            parser_name="promotion-test",
            parser_version="1.0.0",
            mode=AcquisitionMode.IMPORTED,
            state=AcquisitionRunState.COMPLETED,
            started_at=datetime(2026, 8, 28, 10, tzinfo=UTC),
            completed_at=datetime(2026, 8, 28, 11, tzinfo=UTC),
            source_reviewed_at=date(2026, 8, 1),
            source_review_expires_at=date(2027, 8, 1),
        ),
        evidence_snapshots=(_snapshot(),),
        candidates=candidates,
        created_at=CREATED_AT,
    )


def _decision_log(bundle: AcquisitionBundle) -> DecisionLog:
    return DecisionLog(
        acquisition_bundle_id=bundle.bundle_id,
        created_at=CREATED_AT,
        updated_at=DECIDED_AT,
        decisions=tuple(
            CuratorDecision(
                candidate_id=candidate.candidate_id,
                evidence_snapshot_id=candidate.evidence_snapshot_id,
                reviewer="archive-editor@example.test",
                decided_at=DECIDED_AT,
                action=DecisionAction.ACCEPTED,
            )
            for candidate in bundle.candidates
        ),
    )


def test_builds_owner_routed_recommendations_and_groups_by_panda() -> None:
    candidates = (
        _candidate(
            kind=CandidateKind.IDENTITY,
            field_path="identity.sex",
            value="female",
            conflict=ConflictState.UNCHANGED,
        ),
        _candidate(
            kind=CandidateKind.IDENTITY,
            field_path="identity.birth_date",
            value={"value": "2020-08-21", "precision": "day"},
            conflict=ConflictState.ENRICHMENT,
        ),
        _candidate(
            kind=CandidateKind.IDENTITY,
            field_path="identity.life_status",
            value="deceased",
            conflict=ConflictState.CONTRADICTION,
        ),
        _candidate(
            kind=CandidateKind.IDENTITY,
            field_path="identity.aliases.en",
            value="Sunny",
            conflict=ConflictState.ENRICHMENT,
        ),
        _candidate(
            kind=CandidateKind.IDENTITY,
            field_path="identity.external_identifiers.studbook",
            value={"system": "studbook", "value": "SB-42"},
            conflict=ConflictState.UNCHANGED,
        ),
        _candidate(
            kind=CandidateKind.RELATIONSHIP,
            field_path="relationship.mother",
            value={"parent_id": PARENT_ID, "status": "confirmed"},
            conflict=ConflictState.NEW,
        ),
        _candidate(
            kind=CandidateKind.RESIDENCY,
            field_path="residency.current_location",
            value={
                "place_id": PLACE_ID,
                "start": {"value": "2021", "precision": "year"},
                "status": "confirmed",
            },
            conflict=ConflictState.NEW,
        ),
        _candidate(
            kind=CandidateKind.EVENT,
            field_path="event",
            value={
                "event_type": "arrival",
                "event_date": {"value": "2024-05", "precision": "month"},
                "place_id": PLACE_ID,
                "location": "Resolved facility",
            },
            conflict=ConflictState.NEW,
        ),
        _candidate(
            kind=CandidateKind.IDENTITY,
            field_path="identity.sex",
            value="male",
            conflict=ConflictState.NEW,
            panda_id=PANDA_B,
            canonical_slug="panda-b",
            subject="source:panda-b",
        ),
    )
    bundle = _bundle(candidates)

    promotion = build_v2_curation_promotion(
        bundle,
        _decision_log(bundle),
        pipeline_artifact_id=ARTIFACT_ID,
        recommended_by_account_id=EDITOR_ID,
        reason="Promote reviewed breadth-first candidates through V2 Curation.",
        created_at=PROMOTED_AT,
    )

    assert [item.target_panda_id for item in promotion.recommendations] == [PANDA_A, PANDA_B]
    primary = promotion.recommendations[0]
    operations = {change.operation: change for change in primary.changes}
    assert operations["fact.corroborate"].payload == {
        "fieldKey": "profile.sex",
        "value": "female",
        "certainty": "confirmed",
    }
    assert operations["fact.refine"].payload["fieldKey"] == "profile.birth_date"
    assert operations["fact.dispute"].payload["fieldKey"] == "profile.life_status"
    assert operations["name.add"].payload == {
        "languageTag": "en",
        "nameKind": "alias",
        "value": "Sunny",
    }
    assert operations["external_identifier.corroborate"].payload == {
        "system": "studbook",
        "value": "SB-42",
    }
    assert operations["parentage.create"].payload["parentId"] == PARENT_ID
    assert operations["residency.create"].payload["startOn"] == "2021-01-01"
    assert operations["residency.create"].payload["startPrecision"] == "year"
    assert operations["event.create"].payload["occurredOn"] == "2024-05-01"
    assert operations["event.create"].payload["occurredPrecision"] == "month"
    assert operations["event.create"].payload["toPlaceId"] == PLACE_ID
    assert all(change.last_verified_on == "2026-08-28" for change in primary.changes)

    rendered = promotion.to_dict()
    assert rendered["schemaVersion"] == "panda-atlas-v2-curation-promotion/v1"
    assert rendered["recommendations"][0]["pipelineArtifactId"] == ARTIFACT_ID
    assert rendered["recommendations"][0]["targetPandaId"] == PANDA_A
    assert rendered["writeBoundary"] == {"authoritativeWrites": [], "publicationWrites": []}


@pytest.mark.parametrize(
    ("candidate", "message"),
    [
        (
            _candidate(
                kind=CandidateKind.IDENTITY,
                field_path="identity.sex",
                value="female",
                conflict=ConflictState.NEW,
                panda_id=None,
            ),
            "authoritative Panda UUID",
        ),
        (
            _candidate(
                kind=CandidateKind.RELATIONSHIP,
                field_path="relationship.mother",
                value={"canonical_slug": "mother-panda"},
                conflict=ConflictState.NEW,
            ),
            "resolved parent UUID",
        ),
        (
            _candidate(
                kind=CandidateKind.RESIDENCY,
                field_path="residency.current_location",
                value={"place": "Chengdu"},
                conflict=ConflictState.NEW,
            ),
            "resolved place UUID",
        ),
        (
            _candidate(
                kind=CandidateKind.EVENT,
                field_path="event",
                value={
                    "event_type": "arrival",
                    "event_date": {"value": "2024", "precision": "year"},
                    "location": "Unresolved facility",
                },
                conflict=ConflictState.NEW,
            ),
            "source location text but no resolved place UUID",
        ),
    ],
)
def test_fails_closed_when_authoritative_references_are_not_resolved(
    candidate: FieldCandidate,
    message: str,
) -> None:
    bundle = _bundle((candidate,))
    with pytest.raises(ValueError, match=message):
        build_v2_curation_promotion(
            bundle,
            _decision_log(bundle),
            pipeline_artifact_id=ARTIFACT_ID,
            recommended_by_account_id=EDITOR_ID,
            reason="Reviewed promotion.",
            created_at=PROMOTED_AT,
        )


def test_unknown_event_date_precision_never_invents_a_day() -> None:
    candidate = _candidate(
        kind=CandidateKind.EVENT,
        field_path="event",
        value={
            "event_type": "observation",
            "event_date": {"value": "spring 2024", "precision": "unknown"},
        },
        conflict=ConflictState.NEW,
    )
    bundle = _bundle((candidate,))

    promotion = build_v2_curation_promotion(
        bundle,
        _decision_log(bundle),
        pipeline_artifact_id=ARTIFACT_ID,
        recommended_by_account_id=EDITOR_ID,
        reason="Preserve unknown precision.",
        created_at=PROMOTED_AT,
    )

    payload = promotion.recommendations[0].changes[0].payload
    assert payload["occurredPrecision"] == "unknown"
    assert "occurredOn" not in payload


def test_ids_used_by_fixture_are_valid_uuids() -> None:
    for value in (PANDA_A, PANDA_B, PARENT_ID, PLACE_ID, ARTIFACT_ID, EDITOR_ID):
        assert str(UUID(value)) == value
