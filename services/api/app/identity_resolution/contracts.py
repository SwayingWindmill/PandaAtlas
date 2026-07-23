from __future__ import annotations

from collections import Counter
from datetime import date, datetime
from enum import StrEnum
from hashlib import sha256
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, JsonValue, model_validator

from app.acquisition.contracts import canonical_json_bytes
from app.knowledge.contracts import (
    ConfidenceBand,
    IdentityResolutionState,
    PandaIdentity,
    PopulationContext,
)

SCHEMA_VERSION = "panda-atlas-identity-resolution/v1"
HIGH_MATCH_SCORE = 550
MEDIUM_MATCH_SCORE = 350
MATCH_AMBIGUITY_MARGIN = 75


class IdentityModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, validate_default=True)


class IdentityDecisionKind(StrEnum):
    MERGE = "merge"
    REVIEW = "review"
    CREATE = "create"
    UNRESOLVED = "unresolved"
    REJECT_GROUP = "reject-group"


class IdentityChangeKind(StrEnum):
    MERGE = "merge"
    SPLIT = "split"


class IdentityRiskLevel(StrEnum):
    HIGH = "high"


class IdentityNameClaim(IdentityModel):
    value: str = Field(min_length=1)
    language: str = Field(min_length=1)
    kind: str = Field(min_length=1)
    normalized_forms: tuple[str, ...] = ()

    @model_validator(mode="after")
    def validate_forms(self) -> IdentityNameClaim:
        if self.normalized_forms != tuple(sorted(set(self.normalized_forms))):
            raise ValueError("identity normalized forms must be unique and sorted")
        return self


class IdentityIdentifierClaim(IdentityModel):
    system: str = Field(min_length=1)
    value: str = Field(min_length=1)


class IdentityFeatureSet(IdentityModel):
    birth_date: date | None = None
    birth_year: int | None = Field(default=None, ge=1800, le=2200)
    sex: str | None = None
    parent_ids: tuple[str, ...] = ()
    parent_names: tuple[str, ...] = ()
    institution_ids: tuple[str, ...] = ()
    movement_institution_ids: tuple[str, ...] = ()
    source_relationship_ids: tuple[str, ...] = ()
    external_identifiers: tuple[IdentityIdentifierClaim, ...] = ()
    stable_wild_identifier: str | None = None
    is_group_observation: bool = False

    @model_validator(mode="after")
    def validate_features(self) -> IdentityFeatureSet:
        if self.birth_date is not None:
            if self.birth_year is not None and self.birth_year != self.birth_date.year:
                raise ValueError("birth year must match birth date")
            object.__setattr__(self, "birth_year", self.birth_date.year)
        for field_name in (
            "parent_ids",
            "parent_names",
            "institution_ids",
            "movement_institution_ids",
            "source_relationship_ids",
        ):
            values = getattr(self, field_name)
            if values != tuple(sorted(set(values))):
                raise ValueError(f"{field_name} must be unique and sorted")
        identifier_keys = [
            (identifier.system.casefold(), identifier.value.casefold())
            for identifier in self.external_identifiers
        ]
        if len(identifier_keys) != len(set(identifier_keys)):
            raise ValueError("external identity identifiers must be unique")
        if identifier_keys != sorted(identifier_keys):
            raise ValueError("external identity identifiers must be sorted")
        return self

    def has_auxiliary_identity_feature(self) -> bool:
        return any(
            (
                self.birth_date is not None,
                self.birth_year is not None,
                self.sex is not None,
                bool(self.parent_ids),
                bool(self.parent_names),
                bool(self.institution_ids),
                bool(self.movement_institution_ids),
                bool(self.source_relationship_ids),
                bool(self.external_identifiers),
                self.stable_wild_identifier is not None,
            )
        )


class CanonicalIdentityRecord(IdentityModel):
    panda_id: str = Field(min_length=1)
    canonical_slug: str = Field(min_length=1)
    names: tuple[IdentityNameClaim, ...] = Field(min_length=1)
    features: IdentityFeatureSet
    source_ids: tuple[str, ...] = Field(min_length=1)
    population_context: PopulationContext = PopulationContext.UNKNOWN

    @model_validator(mode="after")
    def validate_record(self) -> CanonicalIdentityRecord:
        if self.source_ids != tuple(sorted(set(self.source_ids))):
            raise ValueError("canonical source IDs must be unique and sorted")
        return self


class IdentityCandidateRecord(IdentityModel):
    record_id: str = Field(min_length=1)
    names: tuple[IdentityNameClaim, ...] = Field(min_length=1)
    features: IdentityFeatureSet
    source_ids: tuple[str, ...] = Field(min_length=1)
    population_context: PopulationContext = PopulationContext.UNKNOWN

    @model_validator(mode="after")
    def validate_record(self) -> IdentityCandidateRecord:
        if self.source_ids != tuple(sorted(set(self.source_ids))):
            raise ValueError("candidate source IDs must be unique and sorted")
        return self


class IdentityEvidence(IdentityModel):
    code: str = Field(min_length=1)
    label: str = Field(min_length=1)
    weight: int
    detail: str = Field(min_length=1)
    conflict: bool = False


class IdentityMatchScore(IdentityModel):
    panda_id: str = Field(min_length=1)
    score: int
    confidence: ConfidenceBand
    evidence: tuple[IdentityEvidence, ...] = Field(min_length=1)
    hard_conflicts: tuple[str, ...] = ()

    @model_validator(mode="after")
    def validate_score(self) -> IdentityMatchScore:
        evidence_keys = [(item.code, item.detail) for item in self.evidence]
        if evidence_keys != sorted(set(evidence_keys)):
            raise ValueError("identity score evidence must be unique and sorted")
        if self.score != sum(item.weight for item in self.evidence):
            raise ValueError("identity score does not equal its evidence weights")
        conflict_codes = tuple(sorted(item.code for item in self.evidence if item.conflict))
        if self.hard_conflicts != tuple(sorted(set(self.hard_conflicts))):
            raise ValueError("identity hard conflicts must be unique and sorted")
        if self.hard_conflicts != conflict_codes:
            raise ValueError("identity hard conflicts do not match conflict evidence")
        expected_confidence = (
            ConfidenceBand.LOW
            if self.hard_conflicts
            else ConfidenceBand.HIGH
            if self.score >= HIGH_MATCH_SCORE
            else ConfidenceBand.MEDIUM
            if self.score >= MEDIUM_MATCH_SCORE
            else ConfidenceBand.LOW
        )
        if self.confidence is not expected_confidence:
            raise ValueError("identity confidence does not match deterministic score thresholds")
        return self


class IdentityDecision(IdentityModel):
    record_id: str = Field(min_length=1)
    kind: IdentityDecisionKind
    confidence: ConfidenceBand
    canonical_panda_id: str | None = None
    created_panda_id: str | None = None
    candidate_panda_ids: tuple[str, ...] = ()
    scores: tuple[IdentityMatchScore, ...] = ()
    public_eligible: bool
    rationale: tuple[str, ...] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_decision(self) -> IdentityDecision:
        if len(self.candidate_panda_ids) != len(set(self.candidate_panda_ids)):
            raise ValueError("identity decision candidate IDs must be unique")
        score_ids = [score.panda_id for score in self.scores]
        if len(score_ids) != len(set(score_ids)):
            raise ValueError("identity decision contains duplicate match scores")
        if self.scores != tuple(
            sorted(self.scores, key=lambda score: (-score.score, score.panda_id))
        ):
            raise ValueError("identity decision scores must use deterministic ordering")
        if any(panda_id not in score_ids for panda_id in self.candidate_panda_ids):
            raise ValueError("identity decision candidates must have match scores")
        candidate_set = set(self.candidate_panda_ids)
        if self.candidate_panda_ids != tuple(
            panda_id for panda_id in score_ids if panda_id in candidate_set
        ):
            raise ValueError("identity decision candidates must follow score ordering")

        expected_confidence = {
            IdentityDecisionKind.MERGE: ConfidenceBand.HIGH,
            IdentityDecisionKind.CREATE: ConfidenceBand.HIGH,
            IdentityDecisionKind.REVIEW: ConfidenceBand.MEDIUM,
            IdentityDecisionKind.UNRESOLVED: ConfidenceBand.LOW,
            IdentityDecisionKind.REJECT_GROUP: ConfidenceBand.LOW,
        }[self.kind]
        if self.confidence is not expected_confidence:
            raise ValueError("identity decision confidence does not match its routing kind")

        if self.kind is IdentityDecisionKind.MERGE:
            if not self.canonical_panda_id or self.created_panda_id is not None:
                raise ValueError("merge decisions require one canonical panda ID")
            if self.candidate_panda_ids != (self.canonical_panda_id,):
                raise ValueError("merge decision must identify exactly its canonical panda")
            if not self.scores or self.scores[0].panda_id != self.canonical_panda_id:
                raise ValueError("merge decision canonical panda must be the highest score")
            if self.scores[0].confidence is not ConfidenceBand.HIGH:
                raise ValueError("automatic merge requires a high-confidence score")
        elif self.kind is IdentityDecisionKind.CREATE:
            if not self.created_panda_id or self.canonical_panda_id is not None:
                raise ValueError("create decisions require one created panda ID")
            if self.candidate_panda_ids:
                raise ValueError("create decisions cannot retain canonical candidates")
        elif self.canonical_panda_id is not None or self.created_panda_id is not None:
            raise ValueError("internal decisions cannot expose a resolved panda ID")

        if self.kind is IdentityDecisionKind.REVIEW and not self.candidate_panda_ids:
            raise ValueError("review decisions require at least one canonical candidate")
        if self.kind is IdentityDecisionKind.REJECT_GROUP and (
            self.candidate_panda_ids or self.scores
        ):
            raise ValueError("group observations cannot contain individual match candidates")
        if self.public_eligible != (
            self.kind
            in {
                IdentityDecisionKind.MERGE,
                IdentityDecisionKind.CREATE,
            }
        ):
            raise ValueError("only merge and create decisions are public eligible")
        return self


class IdentityBatchSummary(IdentityModel):
    canonical_count: int = Field(ge=0)
    candidate_count: int = Field(ge=0)
    merge_count: int = Field(ge=0)
    review_count: int = Field(ge=0)
    create_count: int = Field(ge=0)
    unresolved_count: int = Field(ge=0)
    rejected_group_count: int = Field(ge=0)


class IdentityResolutionBatch(IdentityModel):
    schema_version: Literal[SCHEMA_VERSION] = SCHEMA_VERSION
    batch_id: str = Field(min_length=1)
    created_at: datetime
    decisions: tuple[IdentityDecision, ...]
    validation_candidates: tuple[PandaIdentity, ...]
    public_candidate_record_ids: tuple[str, ...]
    unresolved_record_ids: tuple[str, ...]
    review_record_ids: tuple[str, ...]
    summary: IdentityBatchSummary
    write_boundary: dict[str, tuple[str, ...]] = Field(
        default_factory=lambda: {
            "trusted_write_targets": (),
            "publication_write_targets": (),
        }
    )

    @model_validator(mode="after")
    def validate_batch(self) -> IdentityResolutionBatch:
        if self.created_at.tzinfo is None or self.created_at.utcoffset() is None:
            raise ValueError("identity resolution batch timestamp must be timezone-aware")
        if self.write_boundary != {
            "trusted_write_targets": (),
            "publication_write_targets": (),
        }:
            raise ValueError("identity resolution batches cannot write trusted or public data")
        decision_ids = [decision.record_id for decision in self.decisions]
        if len(decision_ids) != len(set(decision_ids)):
            raise ValueError("identity resolution batch contains duplicate candidate records")
        if tuple(decision_ids) != tuple(sorted(decision_ids)):
            raise ValueError("identity resolution decisions must be sorted by record ID")
        expected_public = tuple(
            decision.record_id for decision in self.decisions if decision.public_eligible
        )
        expected_unresolved = tuple(
            decision.record_id
            for decision in self.decisions
            if decision.kind is IdentityDecisionKind.UNRESOLVED
        )
        expected_review = tuple(
            decision.record_id
            for decision in self.decisions
            if decision.kind is IdentityDecisionKind.REVIEW
        )
        if self.public_candidate_record_ids != expected_public:
            raise ValueError("public identity candidate IDs do not match resolved decisions")
        if self.unresolved_record_ids != expected_unresolved:
            raise ValueError("unresolved identity IDs do not match decisions")
        if self.review_record_ids != expected_review:
            raise ValueError("review identity IDs do not match decisions")
        validation_keys = tuple(identity.identity_key for identity in self.validation_candidates)
        if validation_keys != expected_public:
            raise ValueError("batch-validation identities do not match public candidate decisions")
        if any(
            identity.resolution.state
            not in {IdentityResolutionState.MATCHED, IdentityResolutionState.CREATED}
            for identity in self.validation_candidates
        ):
            raise ValueError("only matched or created identities may enter batch validation")
        expected_counts = Counter(decision.kind for decision in self.decisions)
        if self.summary.candidate_count != len(self.decisions):
            raise ValueError("identity summary candidate count does not match decisions")
        if (
            self.summary.merge_count != expected_counts[IdentityDecisionKind.MERGE]
            or self.summary.review_count != expected_counts[IdentityDecisionKind.REVIEW]
            or self.summary.create_count != expected_counts[IdentityDecisionKind.CREATE]
            or self.summary.unresolved_count != expected_counts[IdentityDecisionKind.UNRESOLVED]
            or self.summary.rejected_group_count
            != expected_counts[IdentityDecisionKind.REJECT_GROUP]
        ):
            raise ValueError("identity summary decision counts do not match decisions")
        return self


class IdentityRollbackPlan(IdentityModel):
    remove_panda_ids: tuple[str, ...] = Field(min_length=1)
    restore_records: tuple[CanonicalIdentityRecord, ...] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_rollback(self) -> IdentityRollbackPlan:
        if self.remove_panda_ids != tuple(sorted(set(self.remove_panda_ids))):
            raise ValueError("rollback removal IDs must be unique and sorted")
        restore_ids = [record.panda_id for record in self.restore_records]
        if restore_ids != sorted(set(restore_ids)):
            raise ValueError("rollback restore records must have unique sorted panda IDs")
        return self


class IdentityAuditRecord(IdentityModel):
    audit_id: str = Field(pattern="^identity-audit-[0-9a-f]{64}$")
    operation_id: str = Field(min_length=1)
    kind: IdentityChangeKind
    risk: IdentityRiskLevel
    decided_at: datetime
    actor: str = Field(min_length=1)
    evidence: tuple[str, ...] = Field(min_length=1)
    before_hashes: tuple[str, ...] = Field(min_length=1)
    after_hashes: tuple[str, ...] = Field(min_length=1)
    rollback_payload: dict[str, JsonValue]

    @model_validator(mode="after")
    def validate_audit(self) -> IdentityAuditRecord:
        if self.decided_at.tzinfo is None or self.decided_at.utcoffset() is None:
            raise ValueError("identity audit timestamp must be timezone-aware")
        if self.risk is not IdentityRiskLevel.HIGH:
            raise ValueError("merge and split identity audits must be high risk")
        for hashes in (self.before_hashes, self.after_hashes):
            if any(
                len(value) != 64 or any(ch not in "0123456789abcdef" for ch in value)
                for value in hashes
            ):
                raise ValueError("identity audit snapshot hashes must be SHA-256 values")
        payload = {
            "operation_id": self.operation_id,
            "kind": self.kind.value,
            "decided_at": self.decided_at.isoformat(),
            "actor": self.actor,
            "evidence": list(self.evidence),
            "before_hashes": list(self.before_hashes),
            "after_hashes": list(self.after_hashes),
            "rollback": self.rollback_payload,
        }
        expected_id = f"identity-audit-{sha256(canonical_json_bytes(payload)).hexdigest()}"
        if self.audit_id != expected_id:
            raise ValueError("identity audit ID does not match its immutable payload")
        return self


class IdentityChangeSet(IdentityModel):
    operation_id: str = Field(min_length=1)
    kind: IdentityChangeKind
    before_records: tuple[CanonicalIdentityRecord, ...] = Field(min_length=1)
    after_records: tuple[CanonicalIdentityRecord, ...] = Field(min_length=1)
    before_hashes: tuple[str, ...] = Field(min_length=1)
    after_hashes: tuple[str, ...] = Field(min_length=1)
    audit: IdentityAuditRecord
    rollback: IdentityRollbackPlan

    @model_validator(mode="after")
    def validate_changeset(self) -> IdentityChangeSet:
        if self.audit.operation_id != self.operation_id or self.audit.kind is not self.kind:
            raise ValueError("identity audit does not match its change set")
        before_ids = [record.panda_id for record in self.before_records]
        after_ids = [record.panda_id for record in self.after_records]
        if before_ids != sorted(set(before_ids)) or after_ids != sorted(set(after_ids)):
            raise ValueError("identity change records must have unique sorted panda IDs")
        actual_before_hashes = tuple(
            sha256(canonical_json_bytes(record.model_dump(mode="json"))).hexdigest()
            for record in self.before_records
        )
        actual_after_hashes = tuple(
            sha256(canonical_json_bytes(record.model_dump(mode="json"))).hexdigest()
            for record in self.after_records
        )
        if self.before_hashes != actual_before_hashes:
            raise ValueError("identity before hashes do not match record snapshots")
        if self.after_hashes != actual_after_hashes:
            raise ValueError("identity after hashes do not match record snapshots")
        if self.audit.before_hashes != self.before_hashes:
            raise ValueError("identity audit before hashes do not match")
        if self.audit.after_hashes != self.after_hashes:
            raise ValueError("identity audit after hashes do not match")
        if self.audit.rollback_payload != self.rollback.model_dump(mode="json"):
            raise ValueError("identity audit rollback payload does not match rollback plan")
        if self.kind is IdentityChangeKind.MERGE:
            if len(self.before_records) < 2 or len(self.after_records) != 1:
                raise ValueError("merge change sets require at least two inputs and one output")
        if self.kind is IdentityChangeKind.SPLIT:
            if len(self.before_records) != 1 or len(self.after_records) < 2:
                raise ValueError("split change sets require one input and at least two outputs")
        expected_rollback = IdentityRollbackPlan(
            remove_panda_ids=tuple(after_ids),
            restore_records=self.before_records,
        )
        if self.rollback != expected_rollback:
            raise ValueError("identity rollback plan does not reverse the change set")
        return self


class IdentityResolutionPackage(IdentityModel):
    schema_version: Literal[SCHEMA_VERSION] = SCHEMA_VERSION
    package_id: str = Field(pattern="^identity-package-[0-9a-f]{64}$")
    batch: IdentityResolutionBatch
    changesets: tuple[IdentityChangeSet, ...] = ()

    @model_validator(mode="after")
    def validate_package(self) -> IdentityResolutionPackage:
        operation_ids = [changeset.operation_id for changeset in self.changesets]
        if operation_ids != sorted(set(operation_ids)):
            raise ValueError("identity package operations must be unique and sorted")
        payload = {
            "schema_version": self.schema_version,
            "batch": self.batch.model_dump(mode="json"),
            "changesets": [changeset.model_dump(mode="json") for changeset in self.changesets],
        }
        expected_id = f"identity-package-{sha256(canonical_json_bytes(payload)).hexdigest()}"
        if self.package_id != expected_id:
            raise ValueError("identity package ID does not match its immutable payload")
        return self
