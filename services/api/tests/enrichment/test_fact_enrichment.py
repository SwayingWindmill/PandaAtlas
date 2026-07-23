from __future__ import annotations

from datetime import UTC, date, datetime

import pytest
from pydantic import ValidationError

from app.enrichment import (
    ExtractedFact,
    ExtractedRelationship,
    FactDerivationExtraction,
    FactEnrichmentBatch,
    IdentityFieldEvidence,
    IdentitySubjectExtraction,
    build_fact_enrichment_batch,
    build_identity_candidate_batch,
)
from app.identity_resolution import (
    IdentityFeatureSet,
    IdentityNameClaim,
    IdentityResolutionBatch,
    resolve_identity_batch,
)
from app.knowledge.contracts import (
    AssertionLifecycle,
    ConclusionStatus,
    ConfidenceBand,
    EvidenceMode,
    FactPublicationScope,
    FactQualifier,
    PublicationState,
    RelationshipStatus,
    RelationshipType,
    SourceAccessBasis,
    SourceAssessment,
    SourceEvidence,
    SourceKind,
    evaluate_record_publication,
)


def test_build_fact_enrichment_batch_publishes_supported_facts_and_routes_low_confidence() -> None:
    source = _source(
        source_id="source-profile",
        title="Hua Hua profile",
        confidence=ConfidenceBand.HIGH,
        is_first_hand=True,
    )
    identity_intake = build_identity_candidate_batch(
        (
            IdentitySubjectExtraction(
                source_id=source.source_id,
                intake_candidate_id="intake-profile",
                subject_key="profile:hua-hua",
                names=(
                    IdentityNameClaim(
                        value="Hua Hua",
                        language="en",
                        kind="primary",
                        normalized_forms=("hua hua",),
                    ),
                ),
                features=IdentityFeatureSet(sex="female"),
                evidence=(
                    _identity_evidence(
                        field_path="identity.names",
                        normalized_value="Hua Hua",
                    ),
                    _identity_evidence(
                        field_path="identity.sex",
                        normalized_value="female",
                    ),
                ),
            ),
        )
    )
    resolution = resolve_identity_batch(
        batch_id="identity-resolution-fact-enrichment",
        created_at=datetime(2026, 7, 23, 9, 0, tzinfo=UTC),
        canonical_records=(),
        candidate_records=identity_intake.candidates,
    )
    record_id = identity_intake.candidates[0].record_id
    facts = (
        ExtractedFact(
            record_id=record_id,
            source_id=source.source_id,
            intake_candidate_id="intake-profile",
            field_path="birth.date",
            raw_value="Born on July 4, 2020",
            normalized_value="2020-07-04",
            language="en",
            confidence=ConfidenceBand.HIGH,
            evidence_mode=EvidenceMode.DIRECT,
            last_verified_at=date(2026, 7, 23),
            evidence_snapshot_id="snapshot-profile",
            evidence_body_sha256="a" * 64,
            source_locator={"section": "facts", "label": "Born"},
            parser_name="official-profile-html",
            parser_version="1.0.0",
        ),
        ExtractedFact(
            record_id=record_id,
            source_id=source.source_id,
            intake_candidate_id="intake-profile",
            field_path="behavior.favorite_food",
            raw_value="She seems to enjoy apples",
            normalized_value="apples",
            language="en",
            confidence=ConfidenceBand.LOW,
            evidence_mode=EvidenceMode.DIRECT,
            last_verified_at=date(2026, 7, 23),
            evidence_snapshot_id="snapshot-profile",
            evidence_body_sha256="a" * 64,
            source_locator={"section": "story", "paragraph": 4},
            parser_name="official-profile-html",
            parser_version="1.0.0",
        ),
    )

    batch = build_fact_enrichment_batch(
        created_at=datetime(2026, 7, 23, 9, 5, tzinfo=UTC),
        identity_resolution=resolution,
        sources=(source,),
        facts=facts,
    )

    assert batch.schema_version == "panda-atlas-fact-enrichment/v1"
    assert batch.write_boundary == {
        "trusted_write_targets": (),
        "publication_write_targets": (),
    }
    assert batch.facts == tuple(sorted(facts, key=lambda item: item.fact_id))
    assert batch.knowledge_bundle.records[0].identity.identity_key == record_id

    record = batch.knowledge_bundle.records[0]
    assertions = {assertion.field_path: assertion for assertion in record.assertions}
    assert assertions["birth.date"].publication_scope is FactPublicationScope.PUBLIC
    assert assertions["birth.date"].evidence[0].source_locator == {
        "section": "facts",
        "label": "Born",
    }
    assert assertions["behavior.favorite_food"].publication_scope is (
        FactPublicationScope.REVIEW_ONLY
    )

    conclusions = {conclusion.field_path: conclusion for conclusion in record.conclusions}
    assert conclusions["birth.date"].status is ConclusionStatus.CONFIRMED
    assert conclusions["birth.date"].primary_assertion_id == facts[0].fact_id
    assert conclusions["behavior.favorite_food"].status is ConclusionStatus.UNKNOWN

    decision = evaluate_record_publication(batch.knowledge_bundle, record_id)
    assert decision.state is PublicationState.AUTO_PUBLISH
    assert decision.public_assertion_ids == (facts[0].fact_id,)
    assert decision.review_assertion_ids == (facts[1].fact_id,)


def test_conflicting_facts_preserve_alternatives_and_rank_the_reviewed_source() -> None:
    primary_source = _source(
        source_id="source-primary",
        title="Reviewed panda profile",
        confidence=ConfidenceBand.HIGH,
        is_first_hand=True,
    )
    secondary_source = _source(
        source_id="source-secondary",
        title="Secondary birthday report",
        confidence=ConfidenceBand.LOW,
        is_first_hand=False,
    )
    resolution, record_id = _resolved_identity(primary_source)
    primary_fact = _fact(
        record_id=record_id,
        source_id=primary_source.source_id,
        field_path="birth.date",
        raw_value="Born on July 4, 2020",
        normalized_value="2020-07-04",
        confidence=ConfidenceBand.MEDIUM,
    )
    secondary_fact = _fact(
        record_id=record_id,
        source_id=secondary_source.source_id,
        field_path="birth.date",
        raw_value="Born on July 5, 2020",
        normalized_value="2020-07-05",
        confidence=ConfidenceBand.MEDIUM,
    )

    forward = build_fact_enrichment_batch(
        created_at=datetime(2026, 7, 23, 10, 0, tzinfo=UTC),
        identity_resolution=resolution,
        sources=(primary_source, secondary_source),
        facts=(primary_fact, secondary_fact),
    )
    reverse = build_fact_enrichment_batch(
        created_at=datetime(2026, 7, 23, 10, 0, tzinfo=UTC),
        identity_resolution=resolution,
        sources=(secondary_source, primary_source),
        facts=(secondary_fact, primary_fact),
    )

    assert forward == reverse
    conclusion = forward.knowledge_bundle.records[0].conclusions[0]
    assert conclusion.status is ConclusionStatus.DISPUTED
    assert conclusion.primary_assertion_id == primary_fact.fact_id
    assert conclusion.alternative_assertion_ids == (secondary_fact.fact_id,)
    scores = {score.assertion_id: score for score in forward.selection_scores}
    assert scores[primary_fact.fact_id].total > scores[secondary_fact.fact_id].total
    assert scores[primary_fact.fact_id].first_hand_score == 100
    assert scores[secondary_fact.fact_id].first_hand_score == 0


def test_direct_fact_remains_primary_when_a_higher_scoring_inference_conflicts() -> None:
    source = _source(
        source_id="source-derivation",
        title="Age and birth record",
        confidence=ConfidenceBand.HIGH,
        is_first_hand=True,
    )
    resolution, record_id = _resolved_identity(source)
    direct = _fact(
        record_id=record_id,
        source_id=source.source_id,
        field_path="birth.year",
        raw_value="Born in 2020",
        normalized_value=2020,
        confidence=ConfidenceBand.MEDIUM,
    )
    inferred = ExtractedFact(
        record_id=record_id,
        source_id=source.source_id,
        intake_candidate_id="intake-profile",
        field_path="birth.year",
        raw_value="The article says the panda turned seven in 2026",
        normalized_value=2019,
        language="en",
        confidence=ConfidenceBand.HIGH,
        evidence_mode=EvidenceMode.INFERRED,
        last_verified_at=date(2026, 7, 23),
        evidence_snapshot_id="snapshot-profile",
        evidence_body_sha256="d" * 64,
        source_locator={"section": "age"},
        parser_name="official-profile-html",
        parser_version="1.0.0",
        derivation=FactDerivationExtraction(
            rule="subtract-age-from-reference-year",
            input_fact_ids=(direct.fact_id,),
            explanation="2026 minus seven gives an inferred 2019 birth year.",
        ),
    )

    batch = build_fact_enrichment_batch(
        created_at=datetime(2026, 7, 23, 10, 30, tzinfo=UTC),
        identity_resolution=resolution,
        sources=(source,),
        facts=(inferred, direct),
    )

    conclusion = batch.knowledge_bundle.records[0].conclusions[0]
    assert conclusion.status is ConclusionStatus.DISPUTED
    assert conclusion.primary_assertion_id == direct.fact_id
    assert conclusion.alternative_assertion_ids == (inferred.fact_id,)
    assertions = {
        assertion.assertion_id: assertion
        for assertion in batch.knowledge_bundle.records[0].assertions
    }
    assert assertions[inferred.fact_id].derivation is not None
    assert assertions[inferred.fact_id].derivation.input_assertion_ids == (direct.fact_id,)
    scores = {score.assertion_id: score for score in batch.selection_scores}
    assert scores[inferred.fact_id].total > scores[direct.fact_id].total


def test_corrected_fact_supersedes_history_without_deleting_it() -> None:
    source = _source(
        source_id="source-correction",
        title="Corrected birth record",
        confidence=ConfidenceBand.HIGH,
        is_first_hand=True,
    )
    resolution, record_id = _resolved_identity(source)
    replacement = _fact(
        record_id=record_id,
        source_id=source.source_id,
        field_path="birth.year",
        raw_value="Correction: born in 2020",
        normalized_value=2020,
        confidence=ConfidenceBand.HIGH,
    )
    superseded = ExtractedFact(
        record_id=record_id,
        source_id=source.source_id,
        intake_candidate_id="intake-profile",
        field_path="birth.year",
        raw_value="Earlier profile said 2019",
        normalized_value=2019,
        language="en",
        confidence=ConfidenceBand.HIGH,
        evidence_mode=EvidenceMode.DIRECT,
        last_verified_at=date(2026, 7, 22),
        evidence_snapshot_id="snapshot-old-profile",
        evidence_body_sha256="f" * 64,
        source_locator={"section": "old-facts"},
        parser_name="official-profile-html",
        parser_version="0.9.0",
        lifecycle=AssertionLifecycle.SUPERSEDED,
        superseded_by_fact_id=replacement.fact_id,
    )

    batch = build_fact_enrichment_batch(
        created_at=datetime(2026, 7, 23, 10, 35, tzinfo=UTC),
        identity_resolution=resolution,
        sources=(source,),
        facts=(superseded, replacement),
    )

    assertions = {
        assertion.assertion_id: assertion
        for assertion in batch.knowledge_bundle.records[0].assertions
    }
    assert assertions[superseded.fact_id].lifecycle is AssertionLifecycle.SUPERSEDED
    assert assertions[superseded.fact_id].superseded_by == replacement.fact_id
    assert assertions[replacement.fact_id].lifecycle is AssertionLifecycle.ACTIVE
    conclusion = batch.knowledge_bundle.records[0].conclusions[0]
    assert conclusion.status is ConclusionStatus.CONFIRMED
    assert conclusion.primary_assertion_id == replacement.fact_id


def test_medium_confidence_death_cause_requires_a_reporting_qualifier() -> None:
    with pytest.raises(ValidationError, match="death causes require"):
        ExtractedFact(
            record_id="record-death-cause",
            source_id="source-death-cause",
            intake_candidate_id="intake-death-cause",
            field_path="death.cause",
            raw_value="The report mentioned pneumonia",
            normalized_value="pneumonia",
            language="en",
            confidence=ConfidenceBand.MEDIUM,
            evidence_mode=EvidenceMode.DIRECT,
            last_verified_at=date(2026, 7, 23),
            evidence_snapshot_id="snapshot-death-cause",
            evidence_body_sha256="1" * 64,
            source_locator={"section": "death notice"},
            parser_name="death-notice-parser",
            parser_version="1.0.0",
        )

    qualified = ExtractedFact(
        record_id="record-death-cause",
        source_id="source-death-cause",
        intake_candidate_id="intake-death-cause",
        field_path="death.cause",
        raw_value="The report mentioned pneumonia",
        normalized_value="pneumonia",
        language="en",
        confidence=ConfidenceBand.MEDIUM,
        evidence_mode=EvidenceMode.DIRECT,
        qualifier=FactQualifier.REPORTED,
        last_verified_at=date(2026, 7, 23),
        evidence_snapshot_id="snapshot-death-cause",
        evidence_body_sha256="1" * 64,
        source_locator={"section": "death notice"},
        parser_name="death-notice-parser",
        parser_version="1.0.0",
    )
    assert qualified.qualifier is FactQualifier.REPORTED


def test_relationship_confidence_maps_to_tentative_and_review_only_routes() -> None:
    source = _source(
        source_id="source-parentage",
        title="Parentage record",
        confidence=ConfidenceBand.MEDIUM,
        is_first_hand=False,
    )
    resolution, record_id = _resolved_identity(source)
    tentative = ExtractedRelationship(
        record_id=record_id,
        object_panda_id="panda-mother",
        relationship_type=RelationshipType.MOTHER,
        source_id=source.source_id,
        intake_candidate_id="intake-profile",
        raw_value="Mother: panda-mother",
        language="en",
        confidence=ConfidenceBand.MEDIUM,
        last_verified_at=date(2026, 7, 23),
        evidence_snapshot_id="snapshot-parentage",
        evidence_body_sha256="e" * 64,
        source_locator={"section": "family", "label": "Mother"},
        parser_name="parentage-parser",
        parser_version="1.0.0",
    )
    review_only = ExtractedRelationship(
        record_id=record_id,
        object_panda_id="panda-father-candidate",
        relationship_type=RelationshipType.FATHER,
        source_id=source.source_id,
        intake_candidate_id="intake-profile",
        raw_value="Possible father: panda-father-candidate",
        language="en",
        confidence=ConfidenceBand.LOW,
        last_verified_at=date(2026, 7, 23),
        evidence_snapshot_id="snapshot-parentage",
        evidence_body_sha256="e" * 64,
        source_locator={"section": "family", "label": "Possible father"},
        parser_name="parentage-parser",
        parser_version="1.0.0",
    )

    batch = build_fact_enrichment_batch(
        created_at=datetime(2026, 7, 23, 10, 40, tzinfo=UTC),
        identity_resolution=resolution,
        sources=(source,),
        facts=(),
        relationships=(review_only, tentative),
    )

    record = batch.knowledge_bundle.records[0]
    relationships = {
        relationship.relationship_id: relationship for relationship in record.relationships
    }
    assert relationships[tentative.relationship_id].status is RelationshipStatus.TENTATIVE
    assert relationships[review_only.relationship_id].status is (RelationshipStatus.REVIEW_ONLY)
    assert batch.relationships == tuple(
        sorted((tentative, review_only), key=lambda item: item.relationship_id)
    )
    decision = evaluate_record_publication(batch.knowledge_bundle, record_id)
    assert decision.public_relationship_ids == (tentative.relationship_id,)
    assert decision.review_relationship_ids == (review_only.relationship_id,)


def test_corroboration_is_scoped_to_one_resolved_panda() -> None:
    source_a = _source(
        source_id="source-panda-a",
        title="Panda A profile",
        confidence=ConfidenceBand.HIGH,
        is_first_hand=True,
    )
    source_b = _source(
        source_id="source-panda-b",
        title="Panda B profile",
        confidence=ConfidenceBand.HIGH,
        is_first_hand=True,
    )
    intake = build_identity_candidate_batch(
        (
            _identity_extraction(source_a, subject_key="profile:panda-a", name="Panda A"),
            _identity_extraction(source_b, subject_key="profile:panda-b", name="Panda B"),
        )
    )
    resolution = resolve_identity_batch(
        batch_id="identity-resolution-two-pandas",
        created_at=datetime(2026, 7, 23, 10, 45, tzinfo=UTC),
        canonical_records=(),
        candidate_records=intake.candidates,
    )
    record_ids = tuple(candidate.record_id for candidate in intake.candidates)
    facts = (
        _fact(
            record_id=record_ids[0],
            source_id=source_a.source_id,
            field_path="status.current",
            raw_value="alive",
            normalized_value="alive",
            confidence=ConfidenceBand.HIGH,
        ),
        _fact(
            record_id=record_ids[1],
            source_id=source_b.source_id,
            field_path="status.current",
            raw_value="alive",
            normalized_value="alive",
            confidence=ConfidenceBand.HIGH,
        ),
    )

    batch = build_fact_enrichment_batch(
        created_at=datetime(2026, 7, 23, 10, 50, tzinfo=UTC),
        identity_resolution=resolution,
        sources=(source_a, source_b),
        facts=facts,
    )

    assert all(score.independent_corroboration_score == 0 for score in batch.selection_scores)


def test_unresolved_identity_facts_cannot_enter_knowledge_enrichment() -> None:
    source = _source(
        source_id="source-unresolved",
        title="Name-only mention",
        confidence=ConfidenceBand.LOW,
        is_first_hand=False,
    )
    intake = build_identity_candidate_batch(
        (
            IdentitySubjectExtraction(
                source_id=source.source_id,
                intake_candidate_id="intake-unresolved",
                subject_key="article:name-only",
                names=(
                    IdentityNameClaim(
                        value="Name Only",
                        language="en",
                        kind="primary",
                    ),
                ),
                features=IdentityFeatureSet(),
                evidence=(
                    _identity_evidence(
                        field_path="identity.names",
                        normalized_value="Name Only",
                    ),
                ),
            ),
        )
    )
    resolution = resolve_identity_batch(
        batch_id="identity-resolution-unresolved",
        created_at=datetime(2026, 7, 23, 11, 0, tzinfo=UTC),
        canonical_records=(),
        candidate_records=intake.candidates,
    )
    fact = _fact(
        record_id=intake.candidates[0].record_id,
        source_id=source.source_id,
        field_path="status.current",
        raw_value="alive",
        normalized_value="alive",
        confidence=ConfidenceBand.HIGH,
    )

    with pytest.raises(ValueError, match="high-confidence merge or create"):
        build_fact_enrichment_batch(
            created_at=datetime(2026, 7, 23, 11, 5, tzinfo=UTC),
            identity_resolution=resolution,
            sources=(source,),
            facts=(fact,),
        )


def test_fact_enrichment_batch_rejects_tampered_content_ids() -> None:
    source = _source(
        source_id="source-integrity",
        title="Integrity profile",
        confidence=ConfidenceBand.HIGH,
        is_first_hand=True,
    )
    resolution, record_id = _resolved_identity(source)
    fact = _fact(
        record_id=record_id,
        source_id=source.source_id,
        field_path="status.current",
        raw_value="alive",
        normalized_value="alive",
        confidence=ConfidenceBand.HIGH,
    )
    batch = build_fact_enrichment_batch(
        created_at=datetime(2026, 7, 23, 11, 30, tzinfo=UTC),
        identity_resolution=resolution,
        sources=(source,),
        facts=(fact,),
    )
    payload = batch.model_dump(mode="json")
    payload["batch_id"] = "fact-enrichment-batch-tampered"

    with pytest.raises(ValidationError, match="batch ID does not match"):
        FactEnrichmentBatch.model_validate(payload)


def _identity_extraction(
    source: SourceEvidence,
    *,
    subject_key: str,
    name: str,
) -> IdentitySubjectExtraction:
    return IdentitySubjectExtraction(
        source_id=source.source_id,
        intake_candidate_id=f"intake-{subject_key}",
        subject_key=subject_key,
        names=(
            IdentityNameClaim(
                value=name,
                language="en",
                kind="primary",
                normalized_forms=(name.casefold(),),
            ),
        ),
        features=IdentityFeatureSet(sex="female"),
        evidence=(
            _identity_evidence(
                field_path="identity.names",
                normalized_value=name,
            ),
            _identity_evidence(
                field_path="identity.sex",
                normalized_value="female",
            ),
        ),
    )


def _resolved_identity(source: SourceEvidence) -> tuple[IdentityResolutionBatch, str]:
    intake = build_identity_candidate_batch(
        (
            IdentitySubjectExtraction(
                source_id=source.source_id,
                intake_candidate_id="intake-profile",
                subject_key=f"profile:{source.source_id}",
                names=(
                    IdentityNameClaim(
                        value="Resolved Panda",
                        language="en",
                        kind="primary",
                        normalized_forms=("resolved panda",),
                    ),
                ),
                features=IdentityFeatureSet(sex="female"),
                evidence=(
                    _identity_evidence(
                        field_path="identity.names",
                        normalized_value="Resolved Panda",
                    ),
                    _identity_evidence(
                        field_path="identity.sex",
                        normalized_value="female",
                    ),
                ),
            ),
        )
    )
    resolution = resolve_identity_batch(
        batch_id=f"identity-resolution-{source.source_id}",
        created_at=datetime(2026, 7, 23, 9, 0, tzinfo=UTC),
        canonical_records=(),
        candidate_records=intake.candidates,
    )
    return resolution, intake.candidates[0].record_id


def _fact(
    *,
    record_id: str,
    source_id: str,
    field_path: str,
    raw_value: object,
    normalized_value: object,
    confidence: ConfidenceBand,
) -> ExtractedFact:
    return ExtractedFact(
        record_id=record_id,
        source_id=source_id,
        intake_candidate_id="intake-profile",
        field_path=field_path,
        raw_value=raw_value,
        normalized_value=normalized_value,
        language="en",
        confidence=confidence,
        evidence_mode=EvidenceMode.DIRECT,
        last_verified_at=date(2026, 7, 23),
        evidence_snapshot_id=f"snapshot-{source_id}",
        evidence_body_sha256="c" * 64,
        source_locator={"field_path": field_path, "source_id": source_id},
        parser_name="test-fact-parser",
        parser_version="1.0.0",
    )


def _identity_evidence(*, field_path: str, normalized_value: object) -> IdentityFieldEvidence:
    return IdentityFieldEvidence(
        evidence_snapshot_id="snapshot-profile",
        evidence_body_sha256="a" * 64,
        field_path=field_path,
        raw_value=str(normalized_value),
        normalized_value=normalized_value,
        language="en",
        source_locator={"field_path": field_path},
        parser_name="official-profile-html",
        parser_version="1.0.0",
    )


def _source(
    *,
    source_id: str,
    title: str,
    confidence: ConfidenceBand,
    is_first_hand: bool,
) -> SourceEvidence:
    return SourceEvidence(
        source_id=source_id,
        kind=SourceKind.OFFICIAL_INSTITUTION,
        access_basis=SourceAccessBasis.PUBLIC,
        publisher="Example Panda Institution",
        title=title,
        url=f"https://example.org/{source_id}",
        original_language="en",
        captured_at=datetime(2026, 7, 23, 8, 0, tzinfo=UTC),
        is_first_hand=is_first_hand,
        assessment=SourceAssessment(
            confidence=confidence,
            authority_score=90,
            recency_score=85,
            specificity_score=95,
            consistency_score=90,
            corroboration_score=70,
            rationale=("reviewed-source",),
        ),
    )
