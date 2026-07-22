from __future__ import annotations

import json
from dataclasses import replace
from datetime import UTC, date, datetime, timedelta
from hashlib import sha256
from pathlib import Path

from curate_acquisition_candidates import build_parser

from app.acquisition.bundles import write_local_bundle
from app.acquisition.contracts import (
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
from app.acquisition.curation import (
    DecisionAction,
    export_curation_patch,
    load_acquisition_bundle,
    load_decision_log,
    record_decision,
    resolve_acquisition_bundle_path,
    resolve_decision_path,
    resolve_patch_path,
    summarize_candidates,
    write_curation_patch,
    write_decision_log,
)

_REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
_CURATION_FILES = tuple(
    _REPOSITORY_ROOT / "data" / "curation" / "pandas" / name
    for name in ("pandas.csv", "sources.csv", "events.csv", "media.csv")
)


def main() -> None:
    hashes_before = _file_hashes(_CURATION_FILES)
    bundle = _build_bundle()
    bundle_name = "curator-decision-sanity.bundle.json"
    decision_name = "curator-decision-sanity.decisions.json"
    patch_name = "curator-decision-sanity.patch.json"
    tampered_name = "curator-decision-sanity.tampered.json"
    paths = (
        resolve_acquisition_bundle_path(bundle_name),
        resolve_decision_path(decision_name),
        resolve_patch_path(patch_name),
        resolve_acquisition_bundle_path(tampered_name),
    )
    for path in paths:
        path.unlink(missing_ok=True)

    try:
        bundle_path = write_local_bundle(bundle, bundle_name, overwrite=False)
        loaded_bundle = load_acquisition_bundle(bundle_path)
        assert loaded_bundle.bundle_id == bundle.bundle_id
        _assert_cli_parsing(bundle_name, decision_name, patch_name)

        log = _record_decisions(loaded_bundle)
        decision_path = write_decision_log(log, decision_name, overwrite=False)
        loaded_log = load_decision_log(decision_path)
        assert loaded_log.decision_log_id == log.decision_log_id
        assert len(loaded_log.decisions) == 5
        truncated_log = replace(
            loaded_log,
            decisions=loaded_log.decisions[:-1],
        )
        _expect_refusal(
            lambda: write_decision_log(
                truncated_log,
                decision_path,
                overwrite=True,
            )
        )
        assert len(load_decision_log(decision_path).decisions) == 5

        summary = summarize_candidates(loaded_bundle, loaded_log)
        assert summary.candidate_count == 4
        assert summary.decision_counts == {"accepted": 4}
        assert {group.panda_key for group in summary.groups} == {"bao-li"}

        patch = export_curation_patch(
            loaded_bundle,
            loaded_log,
            created_at=_time(10),
        )
        assert patch.proposal_counts() == {
            "event": 1,
            "panda": 1,
            "relationship": 1,
            "residency": 1,
        }
        patch_path = write_curation_patch(patch, patch_name, overwrite=False)
        payload = json.loads(patch_path.read_text(encoding="utf-8"))
        assert all(
            len(payload["proposals"][section]) == 1
            for section in ("pandas", "events", "relationships", "residencies")
        )
        assert payload["write_boundary"] == {
            "canonical_curation_write_targets": [],
            "trusted_write_targets": [],
            "publication_write_targets": [],
        }
        assert len(payload["sources"]) == 1
        assert payload["sources"][0]["body_sha256"] == _evidence_hash()
        for section in payload["proposals"].values():
            for proposal in section:
                provenance = proposal["provenance"]
                assert provenance["raw_value"] is not None
                assert provenance["normalized_value"] is not None
                assert provenance["parser_version"] == "1.0.0"
                assert provenance["evidence_body_sha256"] == _evidence_hash()
                assert proposal["payload"]["source_ids"] == ["official-source"]

        _assert_refusals(loaded_bundle)
        _assert_tampered_bundle_refused(bundle_path, paths[3])
        _assert_path_confinement()
        assert _file_hashes(_CURATION_FILES) == hashes_before

        print(
            {
                "candidate_count": summary.candidate_count,
                "summary_group_count": len(summary.groups),
                "decision_history_count": len(loaded_log.decisions),
                "effective_decision_counts": summary.decision_counts,
                "proposal_counts": patch.proposal_counts(),
                "source_evidence_count": len(patch.sources),
                "refusal_cases": 9,
                "canonical_curation_write_targets": [],
                "trusted_write_targets": [],
                "publication_write_targets": [],
            }
        )
    finally:
        for path in paths:
            path.unlink(missing_ok=True)


def _build_bundle() -> AcquisitionBundle:
    snapshot = EvidenceSnapshot(
        source_id="official-source",
        requested_url="https://example.org/pandas",
        final_url="https://example.org/pandas",
        captured_at=_time(0),
        status=200,
        headers={"content-type": "text/html"},
        body_bytes=len(b"official fixture"),
        body_sha256=_evidence_hash(),
        block_state=EvidenceBlockState.CLEAR,
        capability=AcquisitionCapability.PUBLIC_HTTP,
        content_type="text/html",
    )
    match = PandaIdentityMatch(
        state=IdentityMatchState.MATCHED,
        source_identity="official:bao-li",
        matched_panda_id="uuid-bao-li",
        matched_canonical_slug="bao-li",
    )
    locator = SourceLocator(
        kind=SourceLocatorKind.CSS_SELECTOR,
        value="#facts p:nth-of-type(1)",
    )

    def candidate(
        kind: CandidateKind,
        field_path: str,
        raw_value: object,
        normalized_value: object,
        conflict_state: ConflictState,
        current: CurrentTrustedValue | None = None,
    ) -> FieldCandidate:
        return FieldCandidate(
            source_id=snapshot.source_id,
            evidence_snapshot_id=snapshot.snapshot_id,
            evidence_body_sha256=snapshot.body_sha256,
            candidate_kind=kind,
            subject_key="official:bao-li",
            field_path=field_path,
            source_locator=locator,
            raw_value=raw_value,
            normalized_value=normalized_value,
            identity_match=match,
            current_trusted_value=current or CurrentTrustedValue(present=False),
            parser_name="official-profile-parser",
            parser_version="1.0.0",
            conflict_state=conflict_state,
        )

    candidates = (
        candidate(
            CandidateKind.IDENTITY,
            "identity.name_en",
            "Bao Li",
            "Bao Li",
            ConflictState.NEW,
        ),
        candidate(
            CandidateKind.EVENT,
            "event.arrival",
            {"event_type": "arrival", "event_date": "2024-10-15"},
            {
                "event_type": "arrival",
                "event_date": {"value": "2024-10-15", "precision": "day"},
                "location": "Zoo",
            },
            ConflictState.MISSING_CURRENT_VALUE,
        ),
        candidate(
            CandidateKind.RELATIONSHIP,
            "relationship.father",
            "An An",
            {"name": "An An"},
            ConflictState.NOT_COMPARED,
            CurrentTrustedValue(present=True, value="an-an"),
        ),
        candidate(
            CandidateKind.RESIDENCY,
            "residency.current_location",
            "Panda House",
            {"facility": "Panda House", "institution": "Zoo"},
            ConflictState.ENRICHMENT,
            CurrentTrustedValue(present=True, value="Zoo"),
        ),
    )
    run = AcquisitionRun(
        run_id="run-curator-decision-sanity",
        source_id=snapshot.source_id,
        adapter_id="official-profile-adapter",
        adapter_version="1.0.0",
        parser_name="official-profile-parser",
        parser_version="1.0.0",
        mode=AcquisitionMode.FIXTURE,
        state=AcquisitionRunState.COMPLETED,
        started_at=_time(0),
        completed_at=_time(1),
        cohort="official-profile-sanity",
        source_reviewed_at=date(2026, 7, 22),
        source_review_expires_at=date(2099, 1, 1),
    )
    return AcquisitionBundle(
        run=run,
        evidence_snapshots=(snapshot,),
        candidates=candidates,
        created_at=_time(1),
    )


def _record_decisions(bundle: AcquisitionBundle):
    first = bundle.candidates[0]
    log, _ = record_decision(
        bundle,
        existing_log=None,
        candidate_id=first.candidate_id,
        action=DecisionAction.REJECTED,
        reviewer="curator@example.org",
        decided_at=_time(2),
        recorded_at=_time(2),
        note="Initial review rejected the candidate.",
    )
    for minute, candidate in enumerate(bundle.candidates, start=3):
        log, _ = record_decision(
            bundle,
            existing_log=log,
            candidate_id=candidate.candidate_id,
            action=DecisionAction.ACCEPTED,
            reviewer="curator@example.org",
            decided_at=_time(minute),
            recorded_at=_time(minute),
            note="Reviewed against preserved source evidence.",
        )
    return log


def _assert_refusals(bundle: AcquisitionBundle) -> None:
    first = bundle.candidates[0]
    bad_candidates = (
        replace(
            first,
            identity_match=PandaIdentityMatch(
                state=IdentityMatchState.AMBIGUOUS,
                source_identity="ambiguous",
                candidate_panda_ids=("panda-a", "panda-b"),
            ),
        ),
        replace(first, conflict_state=ConflictState.CONTRADICTION),
        replace(
            bundle.candidates[1],
            identity_match=PandaIdentityMatch(
                state=IdentityMatchState.UNMATCHED,
                source_identity="unknown-event-panda",
            ),
        ),
        replace(first, normalized_value=None),
        replace(
            first,
            candidate_kind=CandidateKind.MEDIA_METADATA,
            field_path="media.license",
        ),
    )
    for candidate in bad_candidates:
        bad_bundle = replace(bundle, candidates=(candidate,))
        decisions, _ = record_decision(
            bad_bundle,
            existing_log=None,
            candidate_id=candidate.candidate_id,
            action=DecisionAction.ACCEPTED,
            reviewer="curator@example.org",
            decided_at=_time(2),
            recorded_at=_time(2),
        )
        _expect_refusal(
            lambda bad_bundle=bad_bundle, decisions=decisions: export_curation_patch(
                bad_bundle,
                decisions,
                created_at=_time(10),
            )
        )

    expired_bundle = replace(
        bundle,
        run=replace(bundle.run, source_review_expires_at=date(2026, 7, 22)),
    )
    decisions, _ = record_decision(
        expired_bundle,
        existing_log=None,
        candidate_id=expired_bundle.candidates[0].candidate_id,
        action=DecisionAction.ACCEPTED,
        reviewer="curator@example.org",
        decided_at=_time(2),
        recorded_at=_time(2),
    )
    _expect_refusal(
        lambda: export_curation_patch(
            expired_bundle,
            decisions,
            created_at=datetime(2026, 7, 23, tzinfo=UTC),
        )
    )

    unmatched_identity = replace(
        first,
        identity_match=PandaIdentityMatch(
            state=IdentityMatchState.UNMATCHED,
            source_identity="new-panda",
        ),
    )
    unmatched_bundle = replace(bundle, candidates=(unmatched_identity,))
    decisions, _ = record_decision(
        unmatched_bundle,
        existing_log=None,
        candidate_id=unmatched_identity.candidate_id,
        action=DecisionAction.ACCEPTED,
        reviewer="curator@example.org",
        decided_at=_time(2),
        recorded_at=_time(2),
    )
    assert export_curation_patch(
        unmatched_bundle,
        decisions,
        created_at=_time(10),
    ).proposal_counts() == {"panda": 1}


def _assert_tampered_bundle_refused(bundle_path: Path, tampered_path: Path) -> None:
    payload = json.loads(bundle_path.read_text(encoding="utf-8"))
    payload["evidence_snapshots"] = []
    tampered_path.write_text(json.dumps(payload), encoding="utf-8")
    _expect_refusal(lambda: load_acquisition_bundle(tampered_path))


def _assert_path_confinement() -> None:
    _expect_refusal(lambda: resolve_decision_path("../outside.json"))
    _expect_refusal(lambda: resolve_patch_path("../../outside.json"))


def _assert_cli_parsing(bundle: str, decisions: str, patch: str) -> None:
    parser = build_parser()
    assert parser.parse_args(["summary", "--bundle", bundle]).command == "summary"
    assert (
        parser.parse_args(
            [
                "decide",
                "--bundle",
                bundle,
                "--decisions",
                decisions,
                "--candidate-id",
                "candidate-" + "0" * 64,
                "--decision",
                "deferred",
                "--reviewer",
                "curator@example.org",
            ]
        ).command
        == "decide"
    )
    assert (
        parser.parse_args(
            [
                "export",
                "--bundle",
                bundle,
                "--decisions",
                decisions,
                "--output",
                patch,
            ]
        ).command
        == "export"
    )


def _expect_refusal(action) -> None:
    try:
        action()
    except (FileNotFoundError, ValueError):
        return
    raise AssertionError("operation should have failed closed")


def _file_hashes(paths: tuple[Path, ...]) -> dict[str, str]:
    return {
        str(path.relative_to(_REPOSITORY_ROOT)): sha256(path.read_bytes()).hexdigest()
        for path in paths
    }


def _evidence_hash() -> str:
    return sha256(b"official fixture").hexdigest()


def _time(minutes: int) -> datetime:
    return datetime(2026, 7, 22, 8, 0, tzinfo=UTC) + timedelta(minutes=minutes)


if __name__ == "__main__":
    main()
