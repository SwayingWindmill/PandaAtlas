from __future__ import annotations

from collections import defaultdict
from datetime import date
from hashlib import sha256
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, JsonValue, model_validator

from app.acquisition.contracts import canonical_json_bytes
from app.knowledge.contracts import (
    AssertionLifecycle,
    ConfidenceBand,
    EvidenceMode,
    FactAssertion,
    FactPublicationScope,
    FactQualifier,
    PandaKnowledgeBundle,
    RelationshipStatus,
    RelationshipType,
    SourceEvidence,
)

FACT_ENRICHMENT_SCHEMA_VERSION = "panda-atlas-fact-enrichment/v1"


class FactEnrichmentModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, validate_default=True)


class FactDerivationExtraction(FactEnrichmentModel):
    rule: str = Field(min_length=1)
    input_fact_ids: tuple[str, ...] = Field(min_length=1)
    explanation: str = Field(min_length=1)

    @model_validator(mode="after")
    def validate_inputs(self) -> FactDerivationExtraction:
        if self.input_fact_ids != tuple(sorted(set(self.input_fact_ids))):
            raise ValueError("fact derivation input IDs must be unique and sorted")
        return self


class ExtractedFact(FactEnrichmentModel):
    record_id: str = Field(min_length=1)
    source_id: str = Field(min_length=1)
    intake_candidate_id: str = Field(min_length=1)
    field_path: str = Field(min_length=1)
    raw_value: JsonValue
    normalized_value: JsonValue
    language: str = Field(min_length=1)
    confidence: ConfidenceBand
    evidence_mode: EvidenceMode
    publication_scope: FactPublicationScope | None = None
    qualifier: FactQualifier | None = None
    last_verified_at: date
    lifecycle: AssertionLifecycle = AssertionLifecycle.ACTIVE
    superseded_by_fact_id: str | None = None
    withdrawal_reason: str | None = None
    evidence_snapshot_id: str = Field(min_length=1)
    evidence_body_sha256: str = Field(pattern="^[0-9a-f]{64}$")
    source_locator: dict[str, JsonValue] = Field(min_length=1)
    parser_name: str = Field(min_length=1)
    parser_version: str = Field(min_length=1)
    derivation: FactDerivationExtraction | None = None

    @property
    def fact_id(self) -> str:
        payload = {
            "record_id": self.record_id,
            "source_id": self.source_id,
            "intake_candidate_id": self.intake_candidate_id,
            "field_path": self.field_path,
            "raw_value": self.raw_value,
            "normalized_value": self.normalized_value,
            "language": self.language,
            "evidence_snapshot_id": self.evidence_snapshot_id,
            "evidence_body_sha256": self.evidence_body_sha256,
            "source_locator": self.source_locator,
            "parser_name": self.parser_name,
            "parser_version": self.parser_version,
        }
        digest = sha256(canonical_json_bytes(payload)).hexdigest()
        return f"fact-assertion-{digest}"

    @model_validator(mode="after")
    def validate_fact(self) -> ExtractedFact:
        if self.evidence_mode is EvidenceMode.INFERRED and self.derivation is None:
            raise ValueError("inferred extracted facts require derivation metadata")
        if self.evidence_mode is EvidenceMode.DIRECT and self.derivation is not None:
            raise ValueError("direct extracted facts cannot carry derivation metadata")

        expected_scope = (
            FactPublicationScope.REVIEW_ONLY
            if self.confidence is ConfidenceBand.LOW
            else FactPublicationScope.PUBLIC
        )
        if self.publication_scope is None:
            object.__setattr__(self, "publication_scope", expected_scope)
        elif (
            self.confidence is ConfidenceBand.LOW
            and self.publication_scope is FactPublicationScope.PUBLIC
        ):
            raise ValueError("low-confidence extracted facts cannot be public")

        if (
            self.field_path == "death.cause"
            and self.confidence is ConfidenceBand.MEDIUM
            and self.qualifier not in {FactQualifier.REPORTED, FactQualifier.UNCONFIRMED}
        ):
            raise ValueError("medium-confidence death causes require a reporting qualifier")

        if self.lifecycle is AssertionLifecycle.SUPERSEDED:
            if self.superseded_by_fact_id is None:
                raise ValueError("superseded extracted facts require a replacement fact ID")
            if self.superseded_by_fact_id == self.fact_id:
                raise ValueError("extracted facts cannot supersede themselves")
        elif self.superseded_by_fact_id is not None:
            raise ValueError("replacement fact IDs are only valid for superseded facts")
        if self.lifecycle is AssertionLifecycle.WITHDRAWN:
            if self.withdrawal_reason is None or not self.withdrawal_reason.strip():
                raise ValueError("withdrawn extracted facts require a withdrawal reason")
        elif self.withdrawal_reason is not None:
            raise ValueError("withdrawal reasons are only valid for withdrawn facts")
        return self


class ExtractedRelationship(FactEnrichmentModel):
    record_id: str = Field(min_length=1)
    object_panda_id: str = Field(min_length=1)
    relationship_type: RelationshipType
    source_id: str = Field(min_length=1)
    intake_candidate_id: str = Field(min_length=1)
    raw_value: JsonValue
    language: str = Field(min_length=1)
    confidence: ConfidenceBand
    status: RelationshipStatus | None = None
    last_verified_at: date
    evidence_snapshot_id: str = Field(min_length=1)
    evidence_body_sha256: str = Field(pattern="^[0-9a-f]{64}$")
    source_locator: dict[str, JsonValue] = Field(min_length=1)
    parser_name: str = Field(min_length=1)
    parser_version: str = Field(min_length=1)

    @property
    def relationship_id(self) -> str:
        payload = {
            "record_id": self.record_id,
            "object_panda_id": self.object_panda_id,
            "relationship_type": self.relationship_type.value,
            "source_id": self.source_id,
            "intake_candidate_id": self.intake_candidate_id,
            "raw_value": self.raw_value,
            "language": self.language,
            "evidence_snapshot_id": self.evidence_snapshot_id,
            "evidence_body_sha256": self.evidence_body_sha256,
            "source_locator": self.source_locator,
            "parser_name": self.parser_name,
            "parser_version": self.parser_version,
        }
        digest = sha256(canonical_json_bytes(payload)).hexdigest()
        return f"relationship-assertion-{digest}"

    @model_validator(mode="after")
    def validate_relationship(self) -> ExtractedRelationship:
        default_status = {
            ConfidenceBand.HIGH: RelationshipStatus.CONFIRMED,
            ConfidenceBand.MEDIUM: RelationshipStatus.TENTATIVE,
            ConfidenceBand.LOW: RelationshipStatus.REVIEW_ONLY,
        }[self.confidence]
        if self.status is None:
            object.__setattr__(self, "status", default_status)
        allowed_statuses = {
            ConfidenceBand.HIGH: {
                RelationshipStatus.CONFIRMED,
                RelationshipStatus.DISPUTED,
            },
            ConfidenceBand.MEDIUM: {
                RelationshipStatus.TENTATIVE,
                RelationshipStatus.DISPUTED,
            },
            ConfidenceBand.LOW: {RelationshipStatus.REVIEW_ONLY},
        }
        if self.status not in allowed_statuses[self.confidence]:
            raise ValueError("extracted relationship status does not match confidence")
        return self


class FactSelectionScore(FactEnrichmentModel):
    assertion_id: str = Field(min_length=1)
    field_path: str = Field(min_length=1)
    confidence_score: int = Field(ge=0)
    direct_evidence_score: int = Field(ge=0)
    source_confidence_score: int = Field(ge=0)
    first_hand_score: int = Field(ge=0)
    authority_score: int = Field(ge=0)
    recency_score: int = Field(ge=0)
    specificity_score: int = Field(ge=0)
    consistency_score: int = Field(ge=0)
    source_corroboration_score: int = Field(ge=0)
    independent_corroboration_score: int = Field(ge=0)
    total: int = Field(ge=0)

    @model_validator(mode="after")
    def validate_total(self) -> FactSelectionScore:
        expected = sum(
            (
                self.confidence_score,
                self.direct_evidence_score,
                self.source_confidence_score,
                self.first_hand_score,
                self.authority_score,
                self.recency_score,
                self.specificity_score,
                self.consistency_score,
                self.source_corroboration_score,
                self.independent_corroboration_score,
            )
        )
        if self.total != expected:
            raise ValueError("fact selection score total does not match its components")
        return self


def build_fact_selection_scores(
    bundle: PandaKnowledgeBundle,
) -> tuple[FactSelectionScore, ...]:
    source_by_id = {source.source_id: source for source in bundle.sources}
    assertions = tuple(assertion for record in bundle.records for assertion in record.assertions)
    corroboration_counts: dict[tuple[str, str, bytes], set[str]] = defaultdict(set)
    for assertion in assertions:
        if (
            assertion.lifecycle is AssertionLifecycle.ACTIVE
            and assertion.confidence in {ConfidenceBand.HIGH, ConfidenceBand.MEDIUM}
            and assertion.publication_scope is FactPublicationScope.PUBLIC
        ):
            key = (
                assertion.subject_id,
                assertion.field_path,
                canonical_json_bytes(assertion.normalized_value),
            )
            corroboration_counts[key].update(assertion.source_ids)

    scores = []
    for assertion in assertions:
        sources = tuple(source_by_id[source_id] for source_id in assertion.source_ids)
        key = (
            assertion.subject_id,
            assertion.field_path,
            canonical_json_bytes(assertion.normalized_value),
        )
        independent_count = len(corroboration_counts.get(key, set()))
        scores.append(
            score_fact_assertion(
                assertion,
                sources=sources,
                independent_corroboration_count=independent_count,
            )
        )
    return tuple(sorted(scores, key=lambda score: score.assertion_id))


def score_fact_assertion(
    assertion: FactAssertion,
    *,
    sources: tuple[SourceEvidence, ...],
    independent_corroboration_count: int,
) -> FactSelectionScore:
    confidence_score = {
        ConfidenceBand.HIGH: 1000,
        ConfidenceBand.MEDIUM: 600,
        ConfidenceBand.LOW: 0,
    }[assertion.confidence]
    direct_evidence_score = 120 if assertion.evidence_mode is EvidenceMode.DIRECT else 0
    source_confidence_score = max(
        (
            {
                ConfidenceBand.HIGH: 200,
                ConfidenceBand.MEDIUM: 100,
                ConfidenceBand.LOW: 0,
            }[source.assessment.confidence]
            for source in sources
        ),
        default=0,
    )
    first_hand_score = 100 if any(source.is_first_hand for source in sources) else 0
    authority_score = max((source.assessment.authority_score for source in sources), default=0)
    recency_score = max((source.assessment.recency_score for source in sources), default=0)
    specificity_score = max((source.assessment.specificity_score for source in sources), default=0)
    consistency_score = max((source.assessment.consistency_score for source in sources), default=0)
    source_corroboration_score = max(
        (source.assessment.corroboration_score for source in sources),
        default=0,
    )
    independent_corroboration_score = max(0, independent_corroboration_count - 1) * 75
    components = (
        confidence_score,
        direct_evidence_score,
        source_confidence_score,
        first_hand_score,
        authority_score,
        recency_score,
        specificity_score,
        consistency_score,
        source_corroboration_score,
        independent_corroboration_score,
    )
    return FactSelectionScore(
        assertion_id=assertion.assertion_id,
        field_path=assertion.field_path,
        confidence_score=confidence_score,
        direct_evidence_score=direct_evidence_score,
        source_confidence_score=source_confidence_score,
        first_hand_score=first_hand_score,
        authority_score=authority_score,
        recency_score=recency_score,
        specificity_score=specificity_score,
        consistency_score=consistency_score,
        source_corroboration_score=source_corroboration_score,
        independent_corroboration_score=independent_corroboration_score,
        total=sum(components),
    )


def fact_knowledge_bundle_id(
    *,
    identity_resolution_batch_id: str,
    bundle: PandaKnowledgeBundle,
) -> str:
    payload = {
        "identity_resolution_batch_id": identity_resolution_batch_id,
        "created_at": bundle.created_at.isoformat(),
        "sources": [source.model_dump(mode="json") for source in bundle.sources],
        "records": [record.model_dump(mode="json") for record in bundle.records],
    }
    return f"knowledge-bundle-{sha256(canonical_json_bytes(payload)).hexdigest()}"


def fact_enrichment_batch_id(
    *,
    identity_resolution_batch_id: str,
    facts: tuple[ExtractedFact, ...],
    relationships: tuple[ExtractedRelationship, ...],
    knowledge_bundle: PandaKnowledgeBundle,
    selection_scores: tuple[FactSelectionScore, ...],
) -> str:
    payload = {
        "identity_resolution_batch_id": identity_resolution_batch_id,
        "facts": [fact.model_dump(mode="json") for fact in facts],
        "relationships": [relationship.model_dump(mode="json") for relationship in relationships],
        "knowledge_bundle": knowledge_bundle.model_dump(mode="json"),
        "selection_scores": [score.model_dump(mode="json") for score in selection_scores],
    }
    return f"fact-enrichment-batch-{sha256(canonical_json_bytes(payload)).hexdigest()}"


class FactEnrichmentBatch(FactEnrichmentModel):
    schema_version: Literal[FACT_ENRICHMENT_SCHEMA_VERSION] = FACT_ENRICHMENT_SCHEMA_VERSION
    batch_id: str = Field(min_length=1)
    identity_resolution_batch_id: str = Field(min_length=1)
    resolved_record_ids: tuple[str, ...]
    facts: tuple[ExtractedFact, ...]
    relationships: tuple[ExtractedRelationship, ...]
    selection_scores: tuple[FactSelectionScore, ...]
    knowledge_bundle: PandaKnowledgeBundle
    write_boundary: dict[str, tuple[str, ...]] = Field(
        default_factory=lambda: {
            "trusted_write_targets": (),
            "publication_write_targets": (),
        }
    )

    @model_validator(mode="after")
    def validate_batch(self) -> FactEnrichmentBatch:
        if self.write_boundary != {
            "trusted_write_targets": (),
            "publication_write_targets": (),
        }:
            raise ValueError("fact enrichment batches cannot write trusted or public data")
        fact_ids = tuple(fact.fact_id for fact in self.facts)
        if fact_ids != tuple(sorted(set(fact_ids))):
            raise ValueError("extracted facts must be unique and sorted by fact ID")
        if self.resolved_record_ids != tuple(sorted(set(self.resolved_record_ids))):
            raise ValueError("resolved record IDs must be unique and sorted")
        relationship_ids = tuple(
            relationship.relationship_id for relationship in self.relationships
        )
        if relationship_ids != tuple(sorted(set(relationship_ids))):
            raise ValueError("extracted relationships must be unique and sorted by relationship ID")
        bundle_record_ids = tuple(
            record.identity.identity_key for record in self.knowledge_bundle.records
        )
        if bundle_record_ids != self.resolved_record_ids:
            raise ValueError("knowledge bundle records do not match resolved record IDs")
        assertion_ids = tuple(
            sorted(
                assertion.assertion_id
                for record in self.knowledge_bundle.records
                for assertion in record.assertions
            )
        )
        if assertion_ids != fact_ids:
            raise ValueError("knowledge assertions do not map one-to-one to extracted facts")
        bundle_relationship_ids = tuple(
            sorted(
                relationship.relationship_id
                for record in self.knowledge_bundle.records
                for relationship in record.relationships
            )
        )
        if bundle_relationship_ids != relationship_ids:
            raise ValueError(
                "knowledge relationships do not map one-to-one to extracted relationships"
            )
        expected_scores = build_fact_selection_scores(self.knowledge_bundle)
        if self.selection_scores != expected_scores:
            raise ValueError("fact selection scores do not match knowledge assertions")
        expected_bundle_id = fact_knowledge_bundle_id(
            identity_resolution_batch_id=self.identity_resolution_batch_id,
            bundle=self.knowledge_bundle,
        )
        if self.knowledge_bundle.bundle_id != expected_bundle_id:
            raise ValueError("knowledge bundle ID does not match its content")
        expected_batch_id = fact_enrichment_batch_id(
            identity_resolution_batch_id=self.identity_resolution_batch_id,
            facts=self.facts,
            relationships=self.relationships,
            knowledge_bundle=self.knowledge_bundle,
            selection_scores=self.selection_scores,
        )
        if self.batch_id != expected_batch_id:
            raise ValueError("fact enrichment batch ID does not match its content")
        return self
