from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from app.acquisition import bundles as bundle_io
from app.acquisition.adapters import DEFAULT_ADAPTER_REGISTRY
from app.acquisition.chengdu_newborns import ADAPTER_ID as NEWBORNS_2021_ADAPTER_ID
from app.acquisition.chengdu_newborns_2017 import ADAPTER_ID as NEWBORNS_2017_ADAPTER_ID
from app.acquisition.contracts import AcquisitionMode, CandidateKind, ConflictState
from app.acquisition.curation import (
    DecisionAction,
    ReviewLane,
    build_collection_decision_log,
    collection_policy_decision,
    export_curation_patch,
    review_lane_for_candidate,
)
from app.acquisition.runner import AdapterRunRequest, run_adapter
from tests.support.chengdu_preapplication import install_chengdu_preapplication_reconciliation

_SOURCE_ID = "chengdu-panda-base-international-cooperation"


class IncrementingClock:
    def __init__(self, start: datetime) -> None:
        self.current = start

    def __call__(self) -> datetime:
        value = self.current
        self.current += timedelta(seconds=1)
        return value


def _bundle(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    adapter_id: str,
):
    install_chengdu_preapplication_reconciliation(tmp_path / "preapplication", monkeypatch)
    monkeypatch.setattr(bundle_io, "LOCAL_BUNDLE_ROOT", tmp_path / "bundles")
    return run_adapter(
        AdapterRunRequest(
            source_id=_SOURCE_ID,
            adapter_id=adapter_id,
            mode=AcquisitionMode.FIXTURE,
            output_bundle=f"{adapter_id}.json",
        ),
        adapter_registry=DEFAULT_ADAPTER_REGISTRY,
        clock=IncrementingClock(datetime(2026, 7, 24, 5, 0, tzinfo=UTC)),
    ).bundle


def test_collection_policy_accepts_patchable_fields_and_defers_relationship_names(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    bundle = _bundle(tmp_path, monkeypatch, NEWBORNS_2017_ADAPTER_ID)
    decided_at = datetime(2026, 7, 24, 6, 0, tzinfo=UTC)

    log, summary = build_collection_decision_log(bundle, decided_at=decided_at)
    patch = export_curation_patch(bundle, log, created_at=decided_at)
    effective = log.effective_decisions()

    assert summary.candidate_count == len(bundle.candidates)
    assert sum(summary.action_counts.values()) == len(bundle.candidates)
    assert patch.proposals
    assert all(
        effective[proposal.provenance.candidate_id].action is DecisionAction.ACCEPTED
        for proposal in patch.proposals
    )
    assert all(
        proposal.provenance.conflict_state is not ConflictState.CONTRADICTION
        for proposal in patch.proposals
    )

    for candidate in bundle.candidates:
        action = effective[candidate.candidate_id].action
        lane = review_lane_for_candidate(candidate)
        if candidate.candidate_kind is CandidateKind.RELATIONSHIP:
            assert action is DecisionAction.DEFERRED
            assert lane in {
                ReviewLane.MANUAL_RELATIONSHIP_RESOLUTION,
                ReviewLane.BLOCKED_ON_CREATE,
            }
        if candidate.conflict_state is ConflictState.CONTRADICTION:
            assert action is DecisionAction.DEFERRED
        if lane is ReviewLane.MANUAL_CREATE_IDENTITY:
            assert action is DecisionAction.ACCEPTED

    accepted_fields = {
        candidate.field_path
        for candidate in bundle.candidates
        if effective[candidate.candidate_id].action is DecisionAction.ACCEPTED
    }
    assert accepted_fields >= {
        "identity.names.official.zh",
        "identity.names.official.en",
        "identity.birth_date",
        "identity.sex",
        "event",
    }
    assert "identity.aliases.en" not in accepted_fields


def test_collection_policy_is_deterministic_and_keeps_unmatched_events_deferred(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    bundle = _bundle(tmp_path, monkeypatch, NEWBORNS_2021_ADAPTER_ID)
    decided_at = datetime(2026, 7, 24, 6, 0, tzinfo=UTC)

    first, first_summary = build_collection_decision_log(bundle, decided_at=decided_at)
    second, second_summary = build_collection_decision_log(bundle, decided_at=decided_at)

    assert first.decision_log_id == second.decision_log_id
    assert first.to_dict() == second.to_dict()
    assert first_summary.to_dict() == second_summary.to_dict()

    effective = first.effective_decisions()
    bao_xin_candidates = [
        candidate for candidate in bundle.candidates if candidate.subject_key == "chengdu:bao-xin"
    ]
    assert bao_xin_candidates
    for candidate in bao_xin_candidates:
        action, _ = collection_policy_decision(candidate)
        if candidate.candidate_kind is CandidateKind.IDENTITY:
            assert action is DecisionAction.ACCEPTED
        else:
            assert action is DecisionAction.DEFERRED
            assert effective[candidate.candidate_id].action is DecisionAction.DEFERRED
