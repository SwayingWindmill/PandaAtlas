from __future__ import annotations

from collections import defaultdict
from datetime import datetime

from app.acquisition.contracts import canonical_json_bytes
from app.identity_resolution import IdentityResolutionBatch
from app.knowledge.contracts import (
    AssertionDerivation,
    AssertionLifecycle,
    ConclusionStatus,
    ConfidenceBand,
    EvidenceMode,
    EvidenceReference,
    FactAssertion,
    FactConclusion,
    FactPublicationScope,
    PandaKnowledgeBundle,
    PandaKnowledgeRecord,
    RelationshipAssertion,
    SourceEvidence,
)

from .fact_contracts import (
    ExtractedFact,
    ExtractedRelationship,
    FactEnrichmentBatch,
    FactSelectionScore,
    build_fact_selection_scores,
    fact_enrichment_batch_id,
    fact_knowledge_bundle_id,
)


def build_fact_enrichment_batch(
    *,
    created_at: datetime,
    identity_resolution: IdentityResolutionBatch,
    sources: tuple[SourceEvidence, ...],
    facts: tuple[ExtractedFact, ...],
    relationships: tuple[ExtractedRelationship, ...] = (),
) -> FactEnrichmentBatch:
    """Build traceable fact assertions and conclusions for resolved panda identities."""

    if created_at.tzinfo is None or created_at.utcoffset() is None:
        raise ValueError("fact enrichment creation timestamp must be timezone-aware")

    ordered_sources = tuple(sorted(sources, key=lambda source: source.source_id))
    source_ids = [source.source_id for source in ordered_sources]
    if len(source_ids) != len(set(source_ids)):
        raise ValueError("fact enrichment input contains duplicate source IDs")
    known_source_ids = set(source_ids)

    identity_by_record_id = {
        identity.identity_key: identity for identity in identity_resolution.validation_candidates
    }
    resolved_record_ids = tuple(sorted(identity_by_record_id))
    if resolved_record_ids != tuple(sorted(identity_resolution.public_candidate_record_ids)):
        raise ValueError("identity resolution validation candidates do not match public decisions")

    ordered_facts = tuple(sorted(facts, key=lambda fact: fact.fact_id))
    fact_ids = [fact.fact_id for fact in ordered_facts]
    if len(fact_ids) != len(set(fact_ids)):
        raise ValueError("fact enrichment input contains duplicate extracted facts")
    fact_by_id = {fact.fact_id: fact for fact in ordered_facts}
    ordered_relationships = tuple(
        sorted(relationships, key=lambda relationship: relationship.relationship_id)
    )
    relationship_ids = [relationship.relationship_id for relationship in ordered_relationships]
    if len(relationship_ids) != len(set(relationship_ids)):
        raise ValueError("fact enrichment input contains duplicate relationships")

    for fact in ordered_facts:
        if fact.record_id not in identity_by_record_id:
            raise ValueError(
                "extracted facts require a high-confidence merge or create identity decision"
            )
        if fact.source_id not in known_source_ids:
            raise ValueError("extracted fact references an unknown source ID")
        if fact.derivation is not None:
            for input_fact_id in fact.derivation.input_fact_ids:
                input_fact = fact_by_id.get(input_fact_id)
                if input_fact is None:
                    raise ValueError("fact derivation references an unknown extracted fact")
                if input_fact.record_id != fact.record_id:
                    raise ValueError("fact derivation inputs must belong to the same panda record")

    for relationship in ordered_relationships:
        if relationship.record_id not in identity_by_record_id:
            raise ValueError(
                "extracted relationships require a high-confidence "
                "merge or create identity decision"
            )
        if relationship.source_id not in known_source_ids:
            raise ValueError("extracted relationship references an unknown source ID")

    assertions_by_record: dict[str, list[FactAssertion]] = defaultdict(list)
    relationships_by_record: dict[str, list[RelationshipAssertion]] = defaultdict(list)
    for fact in ordered_facts:
        derivation = (
            AssertionDerivation(
                rule=fact.derivation.rule,
                input_assertion_ids=fact.derivation.input_fact_ids,
                explanation=fact.derivation.explanation,
            )
            if fact.derivation is not None
            else None
        )
        assertions_by_record[fact.record_id].append(
            FactAssertion(
                assertion_id=fact.fact_id,
                subject_id=fact.record_id,
                field_path=fact.field_path,
                raw_value=fact.raw_value,
                normalized_value=fact.normalized_value,
                source_ids=(fact.source_id,),
                evidence=(
                    EvidenceReference(
                        source_id=fact.source_id,
                        evidence_snapshot_id=fact.evidence_snapshot_id,
                        evidence_body_sha256=fact.evidence_body_sha256,
                        source_locator=fact.source_locator,
                        candidate_id=fact.intake_candidate_id,
                        parser_name=fact.parser_name,
                        parser_version=fact.parser_version,
                    ),
                ),
                confidence=fact.confidence,
                publication_scope=fact.publication_scope,
                evidence_mode=fact.evidence_mode,
                qualifier=fact.qualifier,
                last_verified_at=fact.last_verified_at,
                lifecycle=fact.lifecycle,
                derivation=derivation,
                superseded_by=fact.superseded_by_fact_id,
                withdrawal_reason=fact.withdrawal_reason,
            )
        )

    for relationship in ordered_relationships:
        relationships_by_record[relationship.record_id].append(
            RelationshipAssertion(
                relationship_id=relationship.relationship_id,
                subject_id=relationship.record_id,
                object_id=relationship.object_panda_id,
                relationship_type=relationship.relationship_type,
                status=relationship.status,
                confidence=relationship.confidence,
                source_ids=(relationship.source_id,),
                last_verified_at=relationship.last_verified_at,
            )
        )

    provisional_records = tuple(
        PandaKnowledgeRecord(
            identity=identity_by_record_id[record_id],
            assertions=tuple(
                sorted(
                    assertions_by_record.get(record_id, ()),
                    key=lambda assertion: assertion.assertion_id,
                )
            ),
            relationships=tuple(
                sorted(
                    relationships_by_record.get(record_id, ()),
                    key=lambda relationship: relationship.relationship_id,
                )
            ),
        )
        for record_id in resolved_record_ids
    )
    provisional_bundle = PandaKnowledgeBundle(
        bundle_id="knowledge-bundle-pending",
        created_at=created_at,
        sources=ordered_sources,
        records=provisional_records,
    )
    selection_scores = build_fact_selection_scores(provisional_bundle)
    score_by_id = {score.assertion_id: score for score in selection_scores}

    records = tuple(
        PandaKnowledgeRecord(
            identity=record.identity,
            assertions=record.assertions,
            conclusions=_build_fact_conclusions(record.assertions, score_by_id),
            relationships=record.relationships,
        )
        for record in provisional_records
    )
    draft_bundle = PandaKnowledgeBundle(
        bundle_id="knowledge-bundle-pending",
        created_at=created_at,
        sources=ordered_sources,
        records=records,
    )
    knowledge_bundle = PandaKnowledgeBundle(
        bundle_id=fact_knowledge_bundle_id(
            identity_resolution_batch_id=identity_resolution.batch_id,
            bundle=draft_bundle,
        ),
        created_at=created_at,
        sources=ordered_sources,
        records=records,
    )
    final_scores = build_fact_selection_scores(knowledge_bundle)
    return FactEnrichmentBatch(
        batch_id=fact_enrichment_batch_id(
            identity_resolution_batch_id=identity_resolution.batch_id,
            facts=ordered_facts,
            relationships=ordered_relationships,
            knowledge_bundle=knowledge_bundle,
            selection_scores=final_scores,
        ),
        identity_resolution_batch_id=identity_resolution.batch_id,
        resolved_record_ids=resolved_record_ids,
        facts=ordered_facts,
        relationships=ordered_relationships,
        selection_scores=final_scores,
        knowledge_bundle=knowledge_bundle,
    )


def _build_fact_conclusions(
    assertions: tuple[FactAssertion, ...],
    score_by_id: dict[str, FactSelectionScore],
) -> tuple[FactConclusion, ...]:
    assertions_by_field: dict[str, list[FactAssertion]] = defaultdict(list)
    for assertion in assertions:
        assertions_by_field[assertion.field_path].append(assertion)

    conclusions = []
    for field_path, field_assertions in assertions_by_field.items():
        eligible = [
            assertion
            for assertion in field_assertions
            if assertion.lifecycle is AssertionLifecycle.ACTIVE
            and assertion.confidence in {ConfidenceBand.HIGH, ConfidenceBand.MEDIUM}
            and assertion.publication_scope is FactPublicationScope.PUBLIC
        ]
        if not eligible:
            conclusions.append(
                FactConclusion(field_path=field_path, status=ConclusionStatus.UNKNOWN)
            )
            continue

        ranked = sorted(
            eligible,
            key=lambda assertion: (
                -score_by_id[assertion.assertion_id].total,
                assertion.assertion_id,
            ),
        )
        direct_ranked = [
            assertion for assertion in ranked if assertion.evidence_mode is EvidenceMode.DIRECT
        ]
        primary = direct_ranked[0] if direct_ranked else ranked[0]
        primary_value = canonical_json_bytes(primary.normalized_value)
        distinct_values = {
            canonical_json_bytes(assertion.normalized_value) for assertion in eligible
        }
        if len(distinct_values) > 1:
            alternative_ids = tuple(
                assertion.assertion_id
                for assertion in ranked
                if assertion.assertion_id != primary.assertion_id
                and canonical_json_bytes(assertion.normalized_value) != primary_value
            )
            conclusions.append(
                FactConclusion(
                    field_path=field_path,
                    status=ConclusionStatus.DISPUTED,
                    primary_assertion_id=primary.assertion_id,
                    alternative_assertion_ids=alternative_ids,
                )
            )
            continue

        conclusions.append(
            FactConclusion(
                field_path=field_path,
                status=(
                    ConclusionStatus.CONFIRMED
                    if primary.confidence is ConfidenceBand.HIGH
                    else ConclusionStatus.TENTATIVE
                ),
                primary_assertion_id=primary.assertion_id,
            )
        )
    return tuple(sorted(conclusions, key=lambda conclusion: conclusion.field_path))
