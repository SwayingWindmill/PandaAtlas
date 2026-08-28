from __future__ import annotations

import json
from collections import Counter
from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from enum import StrEnum
from hashlib import sha256

from ..contracts import (
    ConflictState,
    CurrentTrustedValue,
    IdentityMatchState,
    SourceLocator,
    canonical_json_bytes,
)
from ..contracts.v1 import JsonValue

DECISION_SCHEMA_VERSION = "panda-atlas-curator-decisions/v1"
PATCH_SCHEMA_VERSION = "panda-atlas-curation-patch/v1"
SUMMARY_SCHEMA_VERSION = "panda-atlas-curator-review-summary/v1"


class DecisionAction(StrEnum):
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    DEFERRED = "deferred"


class IntakeKind(StrEnum):
    PANDA = "panda"
    EVENT = "event"
    RELATIONSHIP = "relationship"
    RESIDENCY = "residency"


@dataclass(frozen=True, slots=True)
class CuratorDecision:
    candidate_id: str
    evidence_snapshot_id: str
    reviewer: str
    decided_at: datetime
    action: DecisionAction
    note: str | None = None

    def __post_init__(self) -> None:
        for label, value in (
            ("candidate_id", self.candidate_id),
            ("evidence_snapshot_id", self.evidence_snapshot_id),
            ("reviewer", self.reviewer),
        ):
            _require_non_empty(label, value)
        if self.reviewer != self.reviewer.strip():
            raise ValueError("reviewer identity cannot contain leading or trailing whitespace")
        _require_aware_datetime("decided_at", self.decided_at)
        if self.note is not None and not self.note.strip():
            raise ValueError("decision note must be omitted instead of blank")

    @property
    def decision_id(self) -> str:
        return _stable_id(
            "decision",
            {
                "candidate_id": self.candidate_id,
                "evidence_snapshot_id": self.evidence_snapshot_id,
                "reviewer": self.reviewer,
                "decided_at": _format_datetime(self.decided_at),
                "action": self.action.value,
                "note": self.note,
            },
        )

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "decision_id": self.decision_id,
            "candidate_id": self.candidate_id,
            "evidence_snapshot_id": self.evidence_snapshot_id,
            "reviewer": self.reviewer,
            "decided_at": _format_datetime(self.decided_at),
            "action": self.action.value,
            "note": self.note,
        }


@dataclass(frozen=True, slots=True)
class DecisionLog:
    acquisition_bundle_id: str
    created_at: datetime
    updated_at: datetime
    decisions: tuple[CuratorDecision, ...] = ()
    schema_version: str = DECISION_SCHEMA_VERSION
    canonical_curation_write_targets: tuple[str, ...] = field(default=(), repr=False)
    trusted_write_targets: tuple[str, ...] = field(default=(), repr=False)
    publication_write_targets: tuple[str, ...] = field(default=(), repr=False)

    def __post_init__(self) -> None:
        if self.schema_version != DECISION_SCHEMA_VERSION:
            raise ValueError(f"schema_version must equal {DECISION_SCHEMA_VERSION}")
        _require_non_empty("acquisition_bundle_id", self.acquisition_bundle_id)
        _require_aware_datetime("created_at", self.created_at)
        _require_aware_datetime("updated_at", self.updated_at)
        if self.updated_at < self.created_at:
            raise ValueError("decision log updated_at cannot precede created_at")
        if (
            self.canonical_curation_write_targets
            or self.trusted_write_targets
            or self.publication_write_targets
        ):
            raise ValueError("decision logs cannot expose curation, trusted, or publication writes")

        decision_ids: set[str] = set()
        candidate_timestamps: set[tuple[str, datetime]] = set()
        for decision in self.decisions:
            if decision.decision_id in decision_ids:
                raise ValueError("decision log contains a duplicate decision ID")
            timestamp_key = (decision.candidate_id, decision.decided_at)
            if timestamp_key in candidate_timestamps:
                raise ValueError(
                    "one candidate cannot have multiple decisions at the same timestamp"
                )
            if decision.decided_at > self.updated_at:
                raise ValueError("decision timestamp cannot follow decision log updated_at")
            decision_ids.add(decision.decision_id)
            candidate_timestamps.add(timestamp_key)

    @property
    def decision_log_id(self) -> str:
        return _stable_id(
            "decision-log",
            {
                "schema_version": self.schema_version,
                "acquisition_bundle_id": self.acquisition_bundle_id,
                "decisions": [item.to_dict() for item in self.decisions],
            },
        )

    def effective_decisions(self) -> dict[str, CuratorDecision]:
        result: dict[str, CuratorDecision] = {}
        for decision in self.decisions:
            current = result.get(decision.candidate_id)
            if current is None or current.decided_at < decision.decided_at:
                result[decision.candidate_id] = decision
        return result

    def append(self, decision: CuratorDecision, *, updated_at: datetime) -> DecisionLog:
        _require_aware_datetime("updated_at", updated_at)
        if updated_at < self.updated_at:
            raise ValueError("decision log updated_at cannot move backwards")
        if updated_at < decision.decided_at:
            raise ValueError("decision log cannot be updated before the appended decision")
        return DecisionLog(
            acquisition_bundle_id=self.acquisition_bundle_id,
            created_at=self.created_at,
            updated_at=updated_at,
            decisions=(*self.decisions, decision),
        )

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "schema_version": self.schema_version,
            "decision_log_id": self.decision_log_id,
            "acquisition_bundle_id": self.acquisition_bundle_id,
            "created_at": _format_datetime(self.created_at),
            "updated_at": _format_datetime(self.updated_at),
            "decisions": [item.to_dict() for item in self.decisions],
            "write_boundary": {
                "canonical_curation_write_targets": [],
                "trusted_write_targets": [],
                "publication_write_targets": [],
            },
        }


@dataclass(frozen=True, slots=True)
class PandaReference:
    state: IdentityMatchState
    source_identity: str
    matched_panda_id: str | None = None
    matched_canonical_slug: str | None = None

    def __post_init__(self) -> None:
        _require_non_empty("source_identity", self.source_identity)
        if self.state is IdentityMatchState.MATCHED:
            if not self.matched_panda_id and not self.matched_canonical_slug:
                raise ValueError("matched patch subjects require a panda ID or canonical slug")
        elif self.state is IdentityMatchState.UNMATCHED:
            if self.matched_panda_id or self.matched_canonical_slug:
                raise ValueError("unmatched patch subjects cannot contain a matched identity")
        else:
            raise ValueError("patch subjects must be matched or explicitly unmatched")

    @property
    def identity_key(self) -> str:
        return self.matched_canonical_slug or self.matched_panda_id or self.source_identity

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "state": self.state.value,
            "source_identity": self.source_identity,
            "matched_panda_id": self.matched_panda_id,
            "matched_canonical_slug": self.matched_canonical_slug,
        }


@dataclass(frozen=True, slots=True)
class PatchSourceEvidence:
    source_id: str
    evidence_snapshot_id: str
    requested_url: str
    final_url: str
    captured_at: datetime
    body_sha256: str
    body_bytes: int
    content_type: str | None
    candidate_ids: tuple[str, ...]

    def __post_init__(self) -> None:
        for label, value in (
            ("source_id", self.source_id),
            ("evidence_snapshot_id", self.evidence_snapshot_id),
            ("requested_url", self.requested_url),
            ("final_url", self.final_url),
        ):
            _require_non_empty(label, value)
        _require_aware_datetime("captured_at", self.captured_at)
        _require_sha256("body_sha256", self.body_sha256)
        if self.body_bytes < 0:
            raise ValueError("body_bytes cannot be negative")
        if not self.candidate_ids:
            raise ValueError("patch source evidence must reference at least one candidate")
        if len(set(self.candidate_ids)) != len(self.candidate_ids):
            raise ValueError("patch source evidence contains duplicate candidate IDs")

    @property
    def source_evidence_id(self) -> str:
        return _stable_id(
            "patch-source",
            {
                "source_id": self.source_id,
                "evidence_snapshot_id": self.evidence_snapshot_id,
                "body_sha256": self.body_sha256,
                "candidate_ids": list(self.candidate_ids),
            },
        )

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "source_evidence_id": self.source_evidence_id,
            "source_id": self.source_id,
            "evidence_snapshot_id": self.evidence_snapshot_id,
            "requested_url": self.requested_url,
            "final_url": self.final_url,
            "captured_at": _format_datetime(self.captured_at),
            "body_sha256": self.body_sha256,
            "body_bytes": self.body_bytes,
            "content_type": self.content_type,
            "candidate_ids": list(self.candidate_ids),
        }


@dataclass(frozen=True, slots=True)
class PatchProvenance:
    acquisition_bundle_id: str
    acquisition_run_id: str
    candidate_id: str
    decision: CuratorDecision
    source_id: str
    evidence_snapshot_id: str
    evidence_body_sha256: str
    parser_name: str
    parser_version: str
    source_locator: SourceLocator
    raw_value: JsonValue
    normalized_value: JsonValue
    prior_trusted_value: CurrentTrustedValue
    conflict_state: ConflictState
    candidate_notes: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        for label, value in (
            ("acquisition_bundle_id", self.acquisition_bundle_id),
            ("acquisition_run_id", self.acquisition_run_id),
            ("candidate_id", self.candidate_id),
            ("source_id", self.source_id),
            ("evidence_snapshot_id", self.evidence_snapshot_id),
            ("parser_name", self.parser_name),
            ("parser_version", self.parser_version),
        ):
            _require_non_empty(label, value)
        _require_sha256("evidence_body_sha256", self.evidence_body_sha256)
        _validate_json_value(self.raw_value)
        _validate_json_value(self.normalized_value)
        if self.decision.candidate_id != self.candidate_id:
            raise ValueError("patch provenance decision does not match its candidate")
        if self.decision.evidence_snapshot_id != self.evidence_snapshot_id:
            raise ValueError("patch provenance decision does not match its evidence snapshot")
        if self.decision.action is not DecisionAction.ACCEPTED:
            raise ValueError("patch proposals require an accepted curator decision")

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "acquisition_bundle_id": self.acquisition_bundle_id,
            "acquisition_run_id": self.acquisition_run_id,
            "candidate_id": self.candidate_id,
            "decision": self.decision.to_dict(),
            "source_id": self.source_id,
            "evidence_snapshot_id": self.evidence_snapshot_id,
            "evidence_body_sha256": self.evidence_body_sha256,
            "parser_name": self.parser_name,
            "parser_version": self.parser_version,
            "source_locator": self.source_locator.to_dict(),
            "raw_value": self.raw_value,
            "normalized_value": self.normalized_value,
            "prior_trusted_value": self.prior_trusted_value.to_dict(),
            "conflict_state": self.conflict_state.value,
            "candidate_notes": list(self.candidate_notes),
        }


@dataclass(frozen=True, slots=True)
class CurationPatchProposal:
    intake_kind: IntakeKind
    subject: PandaReference
    payload: dict[str, JsonValue]
    provenance: PatchProvenance

    def __post_init__(self) -> None:
        _validate_json_value(self.payload)
        if not self.payload:
            raise ValueError("curation patch proposal payload cannot be empty")

    @property
    def proposal_id(self) -> str:
        return _stable_id(
            "proposal",
            {
                "intake_kind": self.intake_kind.value,
                "subject": self.subject.to_dict(),
                "payload": self.payload,
                "candidate_id": self.provenance.candidate_id,
                "decision_id": self.provenance.decision.decision_id,
            },
        )

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "proposal_id": self.proposal_id,
            "intake_kind": self.intake_kind.value,
            "subject": self.subject.to_dict(),
            "payload": self.payload,
            "provenance": self.provenance.to_dict(),
        }


@dataclass(frozen=True, slots=True)
class CurationPatchBundle:
    acquisition_bundle_id: str
    decision_log_id: str
    created_at: datetime
    source_reviewed_at: date
    source_review_expires_at: date
    sources: tuple[PatchSourceEvidence, ...]
    proposals: tuple[CurationPatchProposal, ...]
    schema_version: str = PATCH_SCHEMA_VERSION
    canonical_curation_write_targets: tuple[str, ...] = field(default=(), repr=False)
    trusted_write_targets: tuple[str, ...] = field(default=(), repr=False)
    publication_write_targets: tuple[str, ...] = field(default=(), repr=False)

    def __post_init__(self) -> None:
        if self.schema_version != PATCH_SCHEMA_VERSION:
            raise ValueError(f"schema_version must equal {PATCH_SCHEMA_VERSION}")
        _require_non_empty("acquisition_bundle_id", self.acquisition_bundle_id)
        _require_non_empty("decision_log_id", self.decision_log_id)
        _require_aware_datetime("created_at", self.created_at)
        if self.source_review_expires_at < self.source_reviewed_at:
            raise ValueError("source review expiry cannot precede its review date")
        if (
            self.canonical_curation_write_targets
            or self.trusted_write_targets
            or self.publication_write_targets
        ):
            raise ValueError("curation patches cannot write curation, trusted, or public targets")
        if not self.proposals:
            raise ValueError("curation patch bundle requires at least one accepted proposal")

        source_by_snapshot = {source.evidence_snapshot_id: source for source in self.sources}
        if len(source_by_snapshot) != len(self.sources):
            raise ValueError("curation patch bundle contains duplicate source evidence")

        proposal_ids: set[str] = set()
        candidate_ids: set[str] = set()
        for proposal in self.proposals:
            if proposal.proposal_id in proposal_ids:
                raise ValueError("curation patch bundle contains duplicate proposal IDs")
            candidate_id = proposal.provenance.candidate_id
            if candidate_id in candidate_ids:
                raise ValueError("one accepted candidate may produce only one patch proposal")
            source = source_by_snapshot.get(proposal.provenance.evidence_snapshot_id)
            if source is None:
                raise ValueError("curation patch proposal references missing source evidence")
            if candidate_id not in source.candidate_ids:
                raise ValueError("patch source evidence does not list its proposal candidate")
            proposal_ids.add(proposal.proposal_id)
            candidate_ids.add(candidate_id)

    @property
    def patch_id(self) -> str:
        return _stable_id(
            "curation-patch",
            {
                "schema_version": self.schema_version,
                "acquisition_bundle_id": self.acquisition_bundle_id,
                "decision_log_id": self.decision_log_id,
                "source_reviewed_at": self.source_reviewed_at.isoformat(),
                "source_review_expires_at": self.source_review_expires_at.isoformat(),
                "sources": [item.to_dict() for item in self.sources],
                "proposals": [item.to_dict() for item in self.proposals],
            },
        )

    def proposal_counts(self) -> dict[str, int]:
        counts = Counter(proposal.intake_kind.value for proposal in self.proposals)
        return dict(sorted(counts.items()))

    def to_dict(self) -> dict[str, JsonValue]:
        sections: dict[str, list[JsonValue]] = {
            "pandas": [],
            "events": [],
            "relationships": [],
            "residencies": [],
        }
        section_by_kind = {
            IntakeKind.PANDA: "pandas",
            IntakeKind.EVENT: "events",
            IntakeKind.RELATIONSHIP: "relationships",
            IntakeKind.RESIDENCY: "residencies",
        }
        for proposal in self.proposals:
            sections[section_by_kind[proposal.intake_kind]].append(proposal.to_dict())

        return {
            "schema_version": self.schema_version,
            "patch_id": self.patch_id,
            "created_at": _format_datetime(self.created_at),
            "acquisition_bundle_id": self.acquisition_bundle_id,
            "decision_log_id": self.decision_log_id,
            "source_review": {
                "reviewed_at": self.source_reviewed_at.isoformat(),
                "expires_at": self.source_review_expires_at.isoformat(),
            },
            "sources": [item.to_dict() for item in self.sources],
            "proposals": sections,
            "proposal_counts": self.proposal_counts(),
            "write_boundary": {
                "canonical_curation_write_targets": [],
                "trusted_write_targets": [],
                "publication_write_targets": [],
            },
        }


@dataclass(frozen=True, slots=True)
class ReviewSummaryGroup:
    panda_key: str
    identity_state: IdentityMatchState
    source_id: str
    fact_kind: str
    conflict_state: ConflictState
    candidate_ids: tuple[str, ...]
    decision_counts: dict[str, int]

    def __post_init__(self) -> None:
        for label, value in (
            ("panda_key", self.panda_key),
            ("source_id", self.source_id),
            ("fact_kind", self.fact_kind),
        ):
            _require_non_empty(label, value)
        if not self.candidate_ids:
            raise ValueError("review summary groups cannot be empty")

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "panda_key": self.panda_key,
            "identity_state": self.identity_state.value,
            "source_id": self.source_id,
            "fact_kind": self.fact_kind,
            "conflict_state": self.conflict_state.value,
            "candidate_count": len(self.candidate_ids),
            "candidate_ids": list(self.candidate_ids),
            "decision_counts": dict(sorted(self.decision_counts.items())),
        }


@dataclass(frozen=True, slots=True)
class ReviewSummary:
    acquisition_bundle_id: str
    candidate_count: int
    groups: tuple[ReviewSummaryGroup, ...]
    identity_state_counts: dict[str, int]
    conflict_state_counts: dict[str, int]
    fact_kind_counts: dict[str, int]
    decision_counts: dict[str, int]
    schema_version: str = SUMMARY_SCHEMA_VERSION

    def __post_init__(self) -> None:
        if self.schema_version != SUMMARY_SCHEMA_VERSION:
            raise ValueError(f"schema_version must equal {SUMMARY_SCHEMA_VERSION}")
        _require_non_empty("acquisition_bundle_id", self.acquisition_bundle_id)
        if self.candidate_count < 0:
            raise ValueError("candidate_count cannot be negative")
        if sum(group.to_dict()["candidate_count"] for group in self.groups) != self.candidate_count:
            raise ValueError("review summary group counts do not match candidate_count")

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "schema_version": self.schema_version,
            "acquisition_bundle_id": self.acquisition_bundle_id,
            "candidate_count": self.candidate_count,
            "identity_state_counts": dict(sorted(self.identity_state_counts.items())),
            "conflict_state_counts": dict(sorted(self.conflict_state_counts.items())),
            "fact_kind_counts": dict(sorted(self.fact_kind_counts.items())),
            "decision_counts": dict(sorted(self.decision_counts.items())),
            "groups": [group.to_dict() for group in self.groups],
        }


def _stable_id(prefix: str, payload: JsonValue) -> str:
    return f"{prefix}-{sha256(canonical_json_bytes(payload)).hexdigest()}"


def _format_datetime(value: datetime) -> str:
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def _require_aware_datetime(label: str, value: datetime) -> None:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{label} must include a timezone")


def _require_non_empty(label: str, value: str) -> None:
    if not value.strip():
        raise ValueError(f"{label} cannot be empty")


def _require_sha256(label: str, value: str) -> None:
    normalized = value.lower()
    if len(normalized) != 64 or any(
        character not in "0123456789abcdef" for character in normalized
    ):
        raise ValueError(f"{label} must be a lowercase SHA-256 digest")
    if value != normalized:
        raise ValueError(f"{label} must be lowercase")


def _validate_json_value(value: JsonValue) -> None:
    try:
        json.dumps(value, ensure_ascii=False, allow_nan=False, sort_keys=True)
    except (TypeError, ValueError) as error:
        raise ValueError("curation values must be finite JSON values") from error
