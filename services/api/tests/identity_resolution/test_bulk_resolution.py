from __future__ import annotations

import json
from datetime import UTC, date, datetime
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.identity_resolution import (
    IDENTITY_PACKAGE_FILENAME,
    CanonicalIdentityRecord,
    IdentityCandidateRecord,
    IdentityChangeSet,
    IdentityDecisionKind,
    IdentityFeatureSet,
    IdentityIdentifierClaim,
    IdentityNameClaim,
    IdentityRiskLevel,
    build_identity_resolution_package,
    canonical_record_from_panda_identity,
    plan_identity_merge,
    plan_identity_split,
    resolve_identity_batch,
    write_identity_resolution_package,
)
from app.knowledge.contracts import (
    ConfidenceBand,
    ExternalIdentifier,
    IdentityName,
    IdentityResolution,
    IdentityResolutionState,
    PandaIdentity,
    PopulationContext,
)


def _name(
    value: str,
    language: str,
    *,
    kind: str = "official",
    normalized_forms: tuple[str, ...] = (),
) -> IdentityNameClaim:
    return IdentityNameClaim(
        value=value,
        language=language,
        kind=kind,
        normalized_forms=normalized_forms,
    )


def _canonical(
    panda_id: str,
    slug: str,
    names: tuple[IdentityNameClaim, ...],
    *,
    birth_date: date | None = None,
    birth_year: int | None = None,
    sex: str | None = None,
    parent_ids: tuple[str, ...] = (),
    institution_ids: tuple[str, ...] = (),
    external_identifiers: tuple[IdentityIdentifierClaim, ...] = (),
) -> CanonicalIdentityRecord:
    return CanonicalIdentityRecord(
        panda_id=panda_id,
        canonical_slug=slug,
        names=names,
        features=IdentityFeatureSet(
            birth_date=birth_date,
            birth_year=birth_year,
            sex=sex,
            parent_ids=parent_ids,
            institution_ids=institution_ids,
            external_identifiers=external_identifiers,
        ),
        source_ids=(f"source-{panda_id}",),
        population_context=PopulationContext.CAPTIVE,
    )


def _candidate(
    record_id: str,
    names: tuple[IdentityNameClaim, ...],
    *,
    birth_date: date | None = None,
    birth_year: int | None = None,
    sex: str | None = None,
    parent_ids: tuple[str, ...] = (),
    institution_ids: tuple[str, ...] = (),
    external_identifiers: tuple[IdentityIdentifierClaim, ...] = (),
    stable_wild_identifier: str | None = None,
    is_group_observation: bool = False,
) -> IdentityCandidateRecord:
    return IdentityCandidateRecord(
        record_id=record_id,
        names=names,
        features=IdentityFeatureSet(
            birth_date=birth_date,
            birth_year=birth_year,
            sex=sex,
            parent_ids=parent_ids,
            institution_ids=institution_ids,
            external_identifiers=external_identifiers,
            stable_wild_identifier=stable_wild_identifier,
            is_group_observation=is_group_observation,
        ),
        source_ids=(f"source-{record_id}",),
        population_context=(
            PopulationContext.WILD if stable_wild_identifier else PopulationContext.CAPTIVE
        ),
    )


def test_exact_alias_translated_and_changed_names_merge_with_auxiliary_evidence() -> None:
    canonical = (
        _canonical(
            "panda-1",
            "xing-xing",
            (
                _name("星星", "zh-CN"),
                _name("Xing Xing", "en", kind="romanized"),
                _name("シンシン", "ja", kind="translated", normalized_forms=("xingxing",)),
                _name("新星", "zh-CN", kind="historical"),
            ),
            birth_year=2017,
            parent_ids=("parent-a",),
        ),
    )
    candidates = (
        _candidate("exact", (_name("星星", "zh-CN"),), birth_year=2017),
        _candidate("alias", (_name("Xing-Xing", "en"),), parent_ids=("parent-a",)),
        _candidate(
            "translated",
            (_name("싱싱", "ko", normalized_forms=("xingxing",)),),
            birth_year=2017,
        ),
        _candidate("changed", (_name("新星", "zh-CN"),), birth_year=2017),
    )

    batch = resolve_identity_batch(
        batch_id="identity-batch-names",
        created_at=datetime(2026, 7, 23, 8, 0, tzinfo=UTC),
        canonical_records=canonical,
        candidate_records=candidates,
    )

    assert {decision.kind for decision in batch.decisions} == {IdentityDecisionKind.MERGE}
    assert {decision.canonical_panda_id for decision in batch.decisions} == {"panda-1"}
    assert all(decision.confidence is ConfidenceBand.HIGH for decision in batch.decisions)
    assert all(decision.public_eligible for decision in batch.decisions)
    assert all(decision.scores[0].evidence for decision in batch.decisions)
    assert batch.public_candidate_record_ids == ("alias", "changed", "exact", "translated")
    assert tuple(identity.identity_key for identity in batch.validation_candidates) == (
        "alias",
        "changed",
        "exact",
        "translated",
    )
    assert all(
        identity.resolution.state is IdentityResolutionState.MATCHED
        for identity in batch.validation_candidates
    )


def test_exact_birth_date_and_year_only_records_share_candidate_scope() -> None:
    canonical = (
        _canonical(
            "panda-date",
            "panda-date",
            (_name("Former Name", "en"),),
            birth_date=date(2017, 8, 8),
            parent_ids=("parent-a",),
        ),
    )
    candidate = _candidate(
        "year-only",
        (_name("Completely New Name", "en"),),
        birth_year=2017,
        parent_ids=("parent-a",),
    )

    batch = resolve_identity_batch(
        batch_id="identity-batch-date-year",
        created_at=datetime(2026, 7, 23, 8, 30, tzinfo=UTC),
        canonical_records=canonical,
        candidate_records=(candidate,),
    )

    decision = batch.decisions[0]
    assert decision.kind is IdentityDecisionKind.REVIEW
    assert decision.candidate_panda_ids == ("panda-date",)
    assert decision.scores[0].score > 0


def test_same_name_with_conflicting_birth_creates_separate_identity() -> None:
    canonical = (
        _canonical(
            "panda-old",
            "le-le-old",
            (_name("乐乐", "zh-CN"),),
            birth_date=date(2005, 8, 8),
            sex="male",
        ),
    )
    candidate = _candidate(
        "le-le-young",
        (_name("乐乐", "zh-CN"),),
        birth_date=date(2020, 7, 21),
        sex="female",
        institution_ids=("institution-b",),
    )

    batch = resolve_identity_batch(
        batch_id="identity-batch-collision",
        created_at=datetime(2026, 7, 23, 9, 0, tzinfo=UTC),
        canonical_records=canonical,
        candidate_records=(candidate,),
    )

    decision = batch.decisions[0]
    assert decision.kind is IdentityDecisionKind.CREATE
    assert decision.created_panda_id is not None
    assert decision.created_panda_id != "panda-old"
    assert decision.confidence is ConfidenceBand.HIGH
    assert decision.public_eligible
    assert decision.scores[0].hard_conflicts == ("birth-date-conflict", "sex-conflict")


def test_name_only_and_ambiguous_matches_stay_internal() -> None:
    canonical = (
        _canonical("panda-a", "an-an-a", (_name("安安", "zh-CN"),), birth_year=2015),
        _canonical("panda-b", "an-an-b", (_name("安安", "zh-CN"),), birth_year=2018),
    )
    name_only = _candidate("name-only", (_name("安安", "zh-CN"),))
    ambiguous = _candidate("ambiguous", (_name("安安", "zh-CN"),), sex="male")

    batch = resolve_identity_batch(
        batch_id="identity-batch-ambiguous",
        created_at=datetime(2026, 7, 23, 10, 0, tzinfo=UTC),
        canonical_records=canonical,
        candidate_records=(name_only, ambiguous),
    )

    by_id = {decision.record_id: decision for decision in batch.decisions}
    assert by_id["name-only"].kind is IdentityDecisionKind.UNRESOLVED
    assert by_id["ambiguous"].kind is IdentityDecisionKind.REVIEW
    assert not by_id["name-only"].public_eligible
    assert not by_id["ambiguous"].public_eligible
    assert batch.public_candidate_record_ids == ()
    assert batch.validation_candidates == ()
    assert batch.unresolved_record_ids == ("name-only",)
    assert batch.review_record_ids == ("ambiguous",)


def test_external_identifier_and_wild_identifier_are_stable_identity_evidence() -> None:
    canonical = (
        _canonical(
            "panda-tagged",
            "wild-w-42",
            (_name("W-42", "und", kind="field-name"),),
            external_identifiers=(IdentityIdentifierClaim(system="reserve-tag", value="W-42"),),
        ),
    )
    exact_identifier = _candidate(
        "tag-match",
        (_name("Temporary name", "en"),),
        external_identifiers=(IdentityIdentifierClaim(system="reserve-tag", value="W-42"),),
    )
    new_wild = _candidate(
        "new-wild",
        (_name("W-99", "und", kind="field-name"),),
        stable_wild_identifier="W-99",
    )

    batch = resolve_identity_batch(
        batch_id="identity-batch-wild",
        created_at=datetime(2026, 7, 23, 11, 0, tzinfo=UTC),
        canonical_records=canonical,
        candidate_records=(exact_identifier, new_wild),
    )

    by_id = {decision.record_id: decision for decision in batch.decisions}
    assert by_id["tag-match"].kind is IdentityDecisionKind.MERGE
    assert by_id["tag-match"].canonical_panda_id == "panda-tagged"
    assert by_id["new-wild"].kind is IdentityDecisionKind.CREATE
    assert by_id["new-wild"].created_panda_id is not None


def test_matching_stable_identifier_with_conflicting_birth_requires_review() -> None:
    canonical = (
        _canonical(
            "panda-tagged",
            "tagged-panda",
            (_name("Tagged Panda", "en"),),
            birth_year=2012,
            external_identifiers=(IdentityIdentifierClaim(system="studbook", value="SB-42"),),
        ),
    )
    candidate = _candidate(
        "tag-conflict",
        (_name("Different local name", "en"),),
        birth_year=2020,
        external_identifiers=(IdentityIdentifierClaim(system="studbook", value="SB-42"),),
    )

    batch = resolve_identity_batch(
        batch_id="identity-batch-identifier-conflict",
        created_at=datetime(2026, 7, 23, 11, 30, tzinfo=UTC),
        canonical_records=canonical,
        candidate_records=(candidate,),
    )

    decision = batch.decisions[0]
    assert decision.kind is IdentityDecisionKind.REVIEW
    assert decision.candidate_panda_ids == ("panda-tagged",)
    assert not decision.public_eligible
    assert batch.validation_candidates == ()


def test_group_observation_never_creates_an_individual() -> None:
    candidate = _candidate(
        "wild-group",
        (_name("Group near valley", "en"),),
        stable_wild_identifier="group-observation-77",
        is_group_observation=True,
    )

    batch = resolve_identity_batch(
        batch_id="identity-batch-group",
        created_at=datetime(2026, 7, 23, 12, 0, tzinfo=UTC),
        canonical_records=(),
        candidate_records=(candidate,),
    )

    decision = batch.decisions[0]
    assert decision.kind is IdentityDecisionKind.REJECT_GROUP
    assert not decision.public_eligible
    assert batch.public_candidate_record_ids == ()


def test_merge_and_split_changesets_are_high_risk_and_reversible() -> None:
    before_a = _canonical(
        "panda-a",
        "xing-xing-old",
        (_name("星星", "zh-CN"),),
        birth_year=2017,
    )
    before_b = _canonical(
        "panda-b",
        "xing-xing-duplicate",
        (_name("Xing Xing", "en"),),
        birth_year=2017,
    )
    merged = _canonical(
        "panda-a",
        "xing-xing",
        (_name("星星", "zh-CN"), _name("Xing Xing", "en")),
        birth_year=2017,
    )
    decided_at = datetime(2026, 7, 23, 13, 0, tzinfo=UTC)

    merge = plan_identity_merge(
        operation_id="merge-a-b",
        before_records=(before_a, before_b),
        merged_record=merged,
        decided_at=decided_at,
        actor="identity-resolution-agent",
        evidence=("same birth year", "cross-language alias evidence"),
    )

    assert merge.audit.risk is IdentityRiskLevel.HIGH
    assert merge.rollback.restore_records == (before_a, before_b)
    assert merge.rollback.remove_panda_ids == ("panda-a",)
    assert merge.before_hashes != merge.after_hashes

    split_a = before_a
    split_b = before_b
    split = plan_identity_split(
        operation_id="split-a-b",
        before_record=merged,
        split_records=(split_a, split_b),
        decided_at=decided_at,
        actor="identity-resolution-agent",
        evidence=("birth evidence correction",),
    )

    assert split.audit.risk is IdentityRiskLevel.HIGH
    assert split.rollback.restore_records == (merged,)
    assert split.rollback.remove_panda_ids == ("panda-a", "panda-b")
    assert split.before_hashes == merge.after_hashes


def test_canonical_knowledge_identity_converts_without_losing_names_or_identifiers() -> None:
    identity = PandaIdentity(
        identity_key="knowledge-panda-1",
        canonical_panda_id="panda-knowledge-1",
        canonical_slug="xing-xing",
        population_context=PopulationContext.CAPTIVE,
        resolution=IdentityResolution(
            state=IdentityResolutionState.MATCHED,
            confidence=ConfidenceBand.HIGH,
            source_ids=("source-a",),
            auxiliary_features={
                "birth_date": "2017-08-08",
                "sex": "female",
                "parent_ids": ["parent-a", "parent-b"],
                "institution_ids": ["institution-a"],
            },
        ),
        names=(
            IdentityName(
                value="星星",
                language="zh-CN",
                kind="official",
                is_primary=True,
                source_ids=("source-a",),
            ),
        ),
        aliases=(
            IdentityName(
                value="Xing Xing",
                language="en",
                kind="romanized",
                is_primary=False,
                source_ids=("source-b",),
            ),
        ),
        external_identifiers=(
            ExternalIdentifier(
                system="institution-id",
                value="XX-2017",
                source_ids=("source-c",),
            ),
        ),
    )

    record = canonical_record_from_panda_identity(identity)

    assert record.panda_id == "panda-knowledge-1"
    assert tuple(name.value for name in record.names) == ("星星", "Xing Xing")
    assert record.features.birth_date == date(2017, 8, 8)
    assert record.features.birth_year == 2017
    assert record.features.parent_ids == ("parent-a", "parent-b")
    assert record.features.external_identifiers[0].value == "XX-2017"
    assert record.source_ids == ("source-a", "source-b", "source-c")


def test_indexed_bulk_resolution_is_deterministic_at_scale() -> None:
    canonical_records = tuple(
        _canonical(
            f"panda-{index:03d}",
            f"panda-{index:03d}",
            (_name(f"Panda {index:03d}", "en"),),
            birth_year=1900 + index,
        )
        for index in range(300)
    )
    candidate_records = tuple(
        _candidate(
            f"candidate-{index:03d}",
            (_name(f"Panda {index:03d}", "en"),),
            birth_year=1900 + index,
        )
        for index in reversed(range(300))
    )
    created_at = datetime(2026, 7, 23, 14, 0, tzinfo=UTC)

    first = resolve_identity_batch(
        batch_id="identity-batch-scale",
        created_at=created_at,
        canonical_records=canonical_records,
        candidate_records=candidate_records,
    )
    second = resolve_identity_batch(
        batch_id="identity-batch-scale",
        created_at=created_at,
        canonical_records=tuple(reversed(canonical_records)),
        candidate_records=tuple(reversed(candidate_records)),
    )

    assert first == second
    assert first.summary.merge_count == 300
    assert len(first.validation_candidates) == 300
    assert max(len(decision.scores) for decision in first.decisions) == 1
    assert all(decision.kind is IdentityDecisionKind.MERGE for decision in first.decisions)


def test_identity_package_is_deterministic_idempotent_and_tamper_evident(
    tmp_path: Path,
) -> None:
    before_a = _canonical(
        "panda-a",
        "xing-xing-old",
        (_name("星星", "zh-CN"),),
        birth_year=2017,
    )
    before_b = _canonical(
        "panda-b",
        "xing-xing-copy",
        (_name("Xing Xing", "en"),),
        birth_year=2017,
    )
    merged = _canonical(
        "panda-a",
        "xing-xing",
        (_name("星星", "zh-CN"), _name("Xing Xing", "en")),
        birth_year=2017,
    )
    decided_at = datetime(2026, 7, 23, 15, 0, tzinfo=UTC)
    merge = plan_identity_merge(
        operation_id="merge-a-b",
        before_records=(before_b, before_a),
        merged_record=merged,
        decided_at=decided_at,
        actor="identity-reviewer",
        evidence=("duplicate stable identity",),
    )
    batch = resolve_identity_batch(
        batch_id="identity-batch-package",
        created_at=decided_at,
        canonical_records=(merged,),
        candidate_records=(
            _candidate(
                "candidate-package",
                (_name("星星", "zh-CN"),),
                birth_year=2017,
            ),
        ),
    )

    package = build_identity_resolution_package(batch, changesets=(merge,))
    duplicate = build_identity_resolution_package(batch, changesets=(merge,))
    first_path = write_identity_resolution_package(package, tmp_path / "first")
    second_path = write_identity_resolution_package(duplicate, tmp_path / "second")
    repeated_path = write_identity_resolution_package(package, tmp_path / "first")

    assert package == duplicate
    assert first_path.package_path.read_bytes() == second_path.package_path.read_bytes()
    assert repeated_path == first_path
    payload = json.loads(first_path.package_path.read_text(encoding="utf-8"))
    assert first_path.package_path.name == IDENTITY_PACKAGE_FILENAME
    assert payload["batch"]["validation_candidates"][0]["identity_key"] == ("candidate-package")

    tampered_snapshot = package.model_dump(mode="json")
    tampered_snapshot["changesets"][0]["after_records"][0]["canonical_slug"] = "tampered"
    with pytest.raises(ValidationError, match="after hashes do not match"):
        type(package).model_validate(tampered_snapshot)

    tampered_public_boundary = package.model_dump(mode="json")
    tampered_public_boundary["batch"]["public_candidate_record_ids"] = []
    with pytest.raises(ValidationError, match="public identity candidate IDs"):
        type(package).model_validate(tampered_public_boundary)

    tampered_audit = merge.model_dump(mode="json")
    tampered_audit["audit"]["evidence"] = ["changed evidence"]
    with pytest.raises(ValidationError, match="audit ID does not match"):
        IdentityChangeSet.model_validate(tampered_audit)
