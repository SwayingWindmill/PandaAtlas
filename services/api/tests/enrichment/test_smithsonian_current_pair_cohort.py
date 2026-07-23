from __future__ import annotations

from dataclasses import replace
from datetime import UTC, date, datetime

import pytest

from app.acquisition import bundles as bundle_io
from app.acquisition.adapters import DEFAULT_ADAPTER_REGISTRY
from app.acquisition.contracts import (
    AcquisitionBundle,
    AcquisitionMode,
    ConflictState,
    IdentityMatchState,
    PandaIdentityMatch,
)
from app.acquisition.curation import (
    CuratorDecision,
    DecisionAction,
    DecisionLog,
)
from app.acquisition.runner import AdapterRunRequest, run_adapter
from app.acquisition.smithsonian_pandas import ADAPTER_ID, SOURCE_ID
from app.enrichment import (
    build_smithsonian_current_pair_cohort,
    build_smithsonian_current_pair_curation_review_plan,
    export_smithsonian_current_pair_curation_patch,
)
from app.identity_resolution import (
    CanonicalIdentityRecord,
    IdentityDecisionKind,
    IdentityFeatureSet,
    IdentityNameClaim,
)
from app.knowledge.contracts import (
    ConfidenceBand,
    PublicationState,
    SourceAccessBasis,
    SourceAssessment,
    SourceEvidence,
    SourceKind,
    evaluate_record_publication,
)
from scripts.check_smithsonian_current_pair_enrichment import _candidate_projection


def test_smithsonian_current_pair_fixture_runs_through_bilingual_enrichment(
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    acquisition = _run_fixture(
        tmp_path,
        monkeypatch,
        output_name="smithsonian-current-pair.json",
    )

    cohort = build_smithsonian_current_pair_cohort(
        acquisition_bundle=acquisition,
        canonical_records=(
            _canonical(
                panda_id="panda-bao-li",
                slug="bao-li",
                name="Bao Li",
                birth_date=date(2021, 8, 4),
                sex="male",
                parent_names=("An An", "Bao Bao"),
            ),
            _canonical(
                panda_id="panda-qing-bao",
                slug="qing-bao",
                name="Qing Bao",
                birth_date=date(2021, 9, 12),
                sex="female",
                parent_names=("Jia Mei", "Qing Qing"),
            ),
        ),
        canonical_sources=(_canonical_source(),),
        created_at=datetime(2026, 7, 23, 18, 5, tzinfo=UTC),
        generated_at=datetime(2026, 7, 23, 18, 10, tzinfo=UTC),
        generator_version="smithsonian-bilingual-summary/v1",
    )

    assert cohort.selected_slugs == ("bao-li", "qing-bao")
    assert len(cohort.acquisition_bundle.candidates) == 74
    assert len(cohort.identity_candidates.extractions) == 2
    assert cohort.identity_resolution.summary.merge_count == 2
    assert cohort.identity_resolution.summary.create_count == 0
    assert {decision.kind for decision in cohort.identity_resolution.decisions} == {
        IdentityDecisionKind.MERGE
    }
    assert {decision.canonical_panda_id for decision in cohort.identity_resolution.decisions} == {
        "panda-bao-li",
        "panda-qing-bao",
    }

    assert len(cohort.fact_enrichment.knowledge_bundle.records) == 2
    assertions = {
        (record.identity.canonical_slug, assertion.field_path, str(assertion.normalized_value))
        for record in cohort.fact_enrichment.knowledge_bundle.records
        for assertion in record.assertions
    }
    assert ("bao-li", "birth.date", "2021-08-04") in assertions
    assert ("qing-bao", "birth.date", "2021-09-12") in assertions
    assert ("bao-li", "identity.sex", "male") in assertions
    assert ("qing-bao", "identity.sex", "female") in assertions
    assert any(field_path == "events.arrival" for _, field_path, _ in assertions)
    assert any(field_path == "residence.current" for _, field_path, _ in assertions)

    sentences = {
        (sentence.record_id, sentence.field_path, sentence.en_text)
        for sentence in cohort.bilingual_summary.sentences
    }
    assert any(
        field == "birth.date" and text == "Birth date: August 4, 2021."
        for _, field, text in sentences
    )
    assert any(
        field == "birth.date" and text == "Birth date: September 12, 2021."
        for _, field, text in sentences
    )
    assert any(field == "identity.sex" and text == "Sex: male." for _, field, text in sentences)
    assert any(field == "identity.sex" and text == "Sex: female." for _, field, text in sentences)

    for record in cohort.bilingual_summary.knowledge_bundle.records:
        decision = evaluate_record_publication(
            cohort.bilingual_summary.knowledge_bundle,
            record.identity.identity_key,
        )
        assert decision.state is PublicationState.AUTO_PUBLISH

    selected_ids = set(cohort.selected_candidate_ids)
    deferred_ids = set(cohort.deferred_candidate_ids)
    out_of_scope_ids = set(cohort.out_of_scope_candidate_ids)
    all_ids = {candidate.candidate_id for candidate in acquisition.candidates}
    assert selected_ids | deferred_ids | out_of_scope_ids == all_ids
    assert not selected_ids & deferred_ids
    assert not selected_ids & out_of_scope_ids
    assert not deferred_ids & out_of_scope_ids
    assert any(
        candidate.field_path.startswith("relationship.") and candidate.candidate_id in deferred_ids
        for candidate in acquisition.candidates
        if candidate.identity_match.matched_canonical_slug in cohort.selected_slugs
    )
    assert cohort.write_boundary == {
        "trusted_write_targets": (),
        "publication_write_targets": (),
    }


def test_smithsonian_current_pair_requires_complete_canonical_source_inventory(
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    acquisition = _run_fixture(
        tmp_path,
        monkeypatch,
        output_name="smithsonian-missing-source.json",
    )

    with pytest.raises(ValueError, match="canonical source inventory"):
        build_smithsonian_current_pair_cohort(
            acquisition_bundle=acquisition,
            canonical_records=_canonical_records(),
            canonical_sources=(),
            created_at=datetime(2026, 7, 23, 18, 5, tzinfo=UTC),
            generated_at=datetime(2026, 7, 23, 18, 10, tzinfo=UTC),
            generator_version="smithsonian-bilingual-summary/v1",
        )


def test_smithsonian_current_pair_fails_closed_on_identity_birth_conflict(
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    acquisition = _run_fixture(
        tmp_path,
        monkeypatch,
        output_name="smithsonian-identity-conflict.json",
    )
    canonical_records = (
        _canonical(
            panda_id="panda-bao-li",
            slug="bao-li",
            name="Bao Li",
            birth_date=date(2020, 8, 4),
            sex="male",
            parent_names=("An An", "Bao Bao"),
        ),
        _canonical(
            panda_id="panda-qing-bao",
            slug="qing-bao",
            name="Qing Bao",
            birth_date=date(2021, 9, 12),
            sex="female",
            parent_names=("Jia Mei", "Qing Qing"),
        ),
    )

    with pytest.raises(ValueError, match="high-confidence merges"):
        build_smithsonian_current_pair_cohort(
            acquisition_bundle=acquisition,
            canonical_records=canonical_records,
            canonical_sources=(_canonical_source(),),
            created_at=datetime(2026, 7, 23, 18, 5, tzinfo=UTC),
            generated_at=datetime(2026, 7, 23, 18, 10, tzinfo=UTC),
            generator_version="smithsonian-bilingual-summary/v1",
        )


def test_smithsonian_current_pair_ignores_unrelated_ambiguous_candidate(
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    acquisition = _run_fixture(
        tmp_path,
        monkeypatch,
        output_name="smithsonian-unrelated-ambiguous.json",
    )
    target = next(
        candidate
        for candidate in acquisition.candidates
        if candidate.subject_key not in {"smithsonian:bao-li", "smithsonian:qing-bao"}
    )
    ambiguous = replace(
        target,
        identity_match=PandaIdentityMatch(
            state=IdentityMatchState.AMBIGUOUS,
            source_identity=target.identity_match.source_identity,
            candidate_panda_ids=("panda-candidate-a", "panda-candidate-b"),
            notes=("test-unrelated-ambiguity",),
        ),
    )
    ambiguous_bundle = replace(
        acquisition,
        candidates=tuple(
            ambiguous if candidate.candidate_id == target.candidate_id else candidate
            for candidate in acquisition.candidates
        ),
    )

    cohort = build_smithsonian_current_pair_cohort(
        acquisition_bundle=ambiguous_bundle,
        canonical_records=_canonical_records(),
        canonical_sources=(_canonical_source(),),
        created_at=datetime(2026, 7, 23, 18, 5, tzinfo=UTC),
        generated_at=datetime(2026, 7, 23, 18, 10, tzinfo=UTC),
        generator_version="smithsonian-bilingual-summary/v1",
    )

    assert cohort.identity_resolution.summary.merge_count == 2
    assert target.candidate_id in cohort.out_of_scope_candidate_ids


def test_smithsonian_current_pair_fails_closed_on_candidate_contradiction(
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    acquisition = _run_fixture(
        tmp_path,
        monkeypatch,
        output_name="smithsonian-candidate-contradiction.json",
    )
    target = next(
        candidate
        for candidate in acquisition.candidates
        if candidate.subject_key == "smithsonian:bao-li" and candidate.field_path == "identity.sex"
    )
    contradictory = replace(target, conflict_state=ConflictState.CONTRADICTION)
    contradictory_bundle = replace(
        acquisition,
        candidates=tuple(
            contradictory if candidate.candidate_id == target.candidate_id else candidate
            for candidate in acquisition.candidates
        ),
    )

    with pytest.raises(ValueError, match="contains contradictions"):
        build_smithsonian_current_pair_cohort(
            acquisition_bundle=contradictory_bundle,
            canonical_records=_canonical_records(),
            canonical_sources=(_canonical_source(),),
            created_at=datetime(2026, 7, 23, 18, 5, tzinfo=UTC),
            generated_at=datetime(2026, 7, 23, 18, 10, tzinfo=UTC),
            generator_version="smithsonian-bilingual-summary/v1",
        )


def test_smithsonian_replay_projection_ignores_evidence_identity_only(
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    acquisition = _run_fixture(
        tmp_path,
        monkeypatch,
        output_name="smithsonian-replay-projection.json",
    )
    target = next(
        candidate
        for candidate in acquisition.candidates
        if candidate.subject_key == "smithsonian:bao-li" and candidate.field_path == "identity.sex"
    )
    evidence_refresh = replace(
        target,
        evidence_snapshot_id="evidence-live-refresh",
        evidence_body_sha256="0" * 64,
    )
    semantic_drift = replace(target, normalized_value="female")

    assert _candidate_projection((target,)) == _candidate_projection((evidence_refresh,))
    assert _candidate_projection((target,)) != _candidate_projection((semantic_drift,))


def test_smithsonian_curation_review_plan_partitions_verified_candidates(
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    acquisition = _run_fixture(
        tmp_path,
        monkeypatch,
        output_name="smithsonian-curation-review.json",
    )
    cohort = _verified_cohort(acquisition)

    plan = build_smithsonian_current_pair_curation_review_plan(
        cohort,
        created_at=datetime(2026, 7, 23, 18, 15, tzinfo=UTC),
    )

    assert plan.recommendation_counts() == {
        "propose-accept": 16,
        "required-defer": 6,
        "supporting-evidence-only": 6,
    }
    assert len(plan.out_of_scope_candidate_ids) == 46
    assert {item.fact_field_path for item in plan.items if item.fact_field_path is not None} == {
        "birth.date",
        "birth.place",
        "events.arrival",
        "events.public_debut",
        "identity.sex",
        "residence.current",
    }
    deferred_items = {
        item.candidate_id: item
        for item in plan.items
        if item.candidate_id in plan.required_defer_candidate_ids
    }
    assert (
        sum(item.source_field_path.startswith("relationship.") for item in deferred_items.values())
        == 4
    )
    assert sum(item.normalized_value is None for item in deferred_items.values()) == 2
    assert set(plan.proposed_accept_candidate_ids).isdisjoint(plan.required_defer_candidate_ids)
    assert set(plan.proposed_accept_candidate_ids).isdisjoint(
        plan.supporting_evidence_candidate_ids
    )
    assert plan.to_dict()["write_boundary"] == {
        "canonical_curation_write_targets": [],
        "trusted_write_targets": [],
        "publication_write_targets": [],
    }


def test_smithsonian_curation_patch_exports_only_explicitly_reviewed_facts(
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    acquisition = _run_fixture(
        tmp_path,
        monkeypatch,
        output_name="smithsonian-curation-patch.json",
    )
    cohort = _verified_cohort(acquisition)
    reviewed_at = datetime(2026, 7, 23, 18, 20, tzinfo=UTC)
    plan = build_smithsonian_current_pair_curation_review_plan(
        cohort,
        created_at=reviewed_at,
    )
    decision_log = _decision_log_for_plan(
        acquisition,
        proposed_accept_ids=plan.proposed_accept_candidate_ids,
        required_defer_ids=plan.required_defer_candidate_ids,
        decided_at=reviewed_at,
    )

    patch = export_smithsonian_current_pair_curation_patch(
        cohort,
        decision_log,
        created_at=datetime(2026, 7, 23, 18, 25, tzinfo=UTC),
    )

    assert len(patch.proposals) == 16
    assert patch.proposal_counts() == {
        "event": 4,
        "panda": 10,
        "residency": 2,
    }
    assert {proposal.provenance.candidate_id for proposal in patch.proposals} == set(
        plan.proposed_accept_candidate_ids
    )
    assert not any(proposal.intake_kind.value == "relationship" for proposal in patch.proposals)
    assert patch.canonical_curation_write_targets == ()
    assert patch.trusted_write_targets == ()
    assert patch.publication_write_targets == ()


def test_smithsonian_curation_patch_requires_complete_review(
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    acquisition = _run_fixture(
        tmp_path,
        monkeypatch,
        output_name="smithsonian-incomplete-curation-review.json",
    )
    cohort = _verified_cohort(acquisition)
    reviewed_at = datetime(2026, 7, 23, 18, 20, tzinfo=UTC)
    plan = build_smithsonian_current_pair_curation_review_plan(
        cohort,
        created_at=reviewed_at,
    )
    incomplete_log = _decision_log_for_plan(
        acquisition,
        proposed_accept_ids=plan.proposed_accept_candidate_ids[:-1],
        required_defer_ids=plan.required_defer_candidate_ids,
        decided_at=reviewed_at,
    )

    with pytest.raises(ValueError, match="explicit decisions for all proposed facts"):
        export_smithsonian_current_pair_curation_patch(
            cohort,
            incomplete_log,
            created_at=datetime(2026, 7, 23, 18, 25, tzinfo=UTC),
        )


def test_smithsonian_curation_patch_refuses_accepting_deferred_parent_name(
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    acquisition = _run_fixture(
        tmp_path,
        monkeypatch,
        output_name="smithsonian-invalid-deferred-accept.json",
    )
    cohort = _verified_cohort(acquisition)
    reviewed_at = datetime(2026, 7, 23, 18, 20, tzinfo=UTC)
    plan = build_smithsonian_current_pair_curation_review_plan(
        cohort,
        created_at=reviewed_at,
    )
    invalid_id = next(
        item.candidate_id
        for item in plan.items
        if item.source_field_path.startswith("relationship.")
    )
    decision_log = _decision_log_for_plan(
        acquisition,
        proposed_accept_ids=(*plan.proposed_accept_candidate_ids, invalid_id),
        required_defer_ids=tuple(
            candidate_id
            for candidate_id in plan.required_defer_candidate_ids
            if candidate_id != invalid_id
        ),
        decided_at=reviewed_at,
    )

    with pytest.raises(ValueError, match="cannot accept deferred"):
        export_smithsonian_current_pair_curation_patch(
            cohort,
            decision_log,
            created_at=datetime(2026, 7, 23, 18, 25, tzinfo=UTC),
        )


def _verified_cohort(acquisition: AcquisitionBundle):
    return build_smithsonian_current_pair_cohort(
        acquisition_bundle=acquisition,
        canonical_records=_canonical_records(),
        canonical_sources=(_canonical_source(),),
        created_at=datetime(2026, 7, 23, 18, 5, tzinfo=UTC),
        generated_at=datetime(2026, 7, 23, 18, 10, tzinfo=UTC),
        generator_version="smithsonian-bilingual-summary/v1",
    )


def _decision_log_for_plan(
    acquisition: AcquisitionBundle,
    *,
    proposed_accept_ids: tuple[str, ...],
    required_defer_ids: tuple[str, ...],
    decided_at: datetime,
) -> DecisionLog:
    candidates = {candidate.candidate_id: candidate for candidate in acquisition.candidates}
    decisions = tuple(
        CuratorDecision(
            candidate_id=candidate_id,
            evidence_snapshot_id=candidates[candidate_id].evidence_snapshot_id,
            reviewer="curator-test",
            decided_at=decided_at,
            action=action,
            note=(
                "verified Smithsonian fact"
                if action is DecisionAction.ACCEPTED
                else "source relationship or omission remains deferred"
            ),
        )
        for action, candidate_ids in (
            (DecisionAction.ACCEPTED, proposed_accept_ids),
            (DecisionAction.DEFERRED, required_defer_ids),
        )
        for candidate_id in candidate_ids
    )
    return DecisionLog(
        acquisition_bundle_id=acquisition.bundle_id,
        created_at=decided_at,
        updated_at=decided_at,
        decisions=decisions,
    )


def _run_fixture(
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
    *,
    output_name: str,
) -> AcquisitionBundle:
    monkeypatch.setattr(bundle_io, "LOCAL_BUNDLE_ROOT", tmp_path / "bundles")
    now = datetime(2026, 7, 23, 18, 0, tzinfo=UTC)
    return run_adapter(
        AdapterRunRequest(
            source_id=SOURCE_ID,
            adapter_id=ADAPTER_ID,
            mode=AcquisitionMode.FIXTURE,
            cohort="issue-131-current-pair",
            output_bundle=output_name,
            overwrite=True,
        ),
        adapter_registry=DEFAULT_ADAPTER_REGISTRY,
        clock=lambda: now,
        sleeper=lambda _seconds: None,
    ).bundle


def _canonical_records() -> tuple[CanonicalIdentityRecord, ...]:
    return (
        _canonical(
            panda_id="panda-bao-li",
            slug="bao-li",
            name="Bao Li",
            birth_date=date(2021, 8, 4),
            sex="male",
            parent_names=("An An", "Bao Bao"),
        ),
        _canonical(
            panda_id="panda-qing-bao",
            slug="qing-bao",
            name="Qing Bao",
            birth_date=date(2021, 9, 12),
            sex="female",
            parent_names=("Jia Mei", "Qing Qing"),
        ),
    )


def _canonical_source() -> SourceEvidence:
    return SourceEvidence(
        source_id="reviewed-curation",
        kind=SourceKind.MATURE_DATABASE,
        access_basis=SourceAccessBasis.PUBLIC,
        publisher="Panda Atlas reviewed curation",
        title="Reviewed canonical identity inventory",
        url="https://example.org/panda-atlas/reviewed-curation",
        original_language="en",
        captured_at=datetime(2026, 7, 23, 17, 0, tzinfo=UTC),
        is_first_hand=False,
        assessment=SourceAssessment(
            confidence=ConfidenceBand.HIGH,
            authority_score=90,
            recency_score=90,
            specificity_score=100,
            consistency_score=100,
            corroboration_score=90,
            rationale=("reviewed-canonical-identity-inventory",),
        ),
    )


def _canonical(
    *,
    panda_id: str,
    slug: str,
    name: str,
    birth_date: date,
    sex: str,
    parent_names: tuple[str, ...],
) -> CanonicalIdentityRecord:
    return CanonicalIdentityRecord(
        panda_id=panda_id,
        canonical_slug=slug,
        names=(
            IdentityNameClaim(
                value=name,
                language="en",
                kind="official",
                normalized_forms=(name.casefold(),),
            ),
        ),
        features=IdentityFeatureSet(
            birth_date=birth_date,
            sex=sex,
            parent_names=tuple(sorted(parent_names)),
        ),
        source_ids=("reviewed-curation",),
    )
