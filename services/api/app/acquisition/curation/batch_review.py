from __future__ import annotations

import json
from collections import Counter, defaultdict
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from hashlib import sha256
from pathlib import Path
from uuid import uuid4

from ..contracts import (
    AcquisitionBundle,
    AcquisitionRunState,
    CandidateKind,
    ConflictState,
    FieldCandidate,
    IdentityMatchState,
)
from ..contracts.v1 import JsonValue, canonical_json_bytes

SCHEMA_VERSION = "panda-atlas-batch-review-plan/v1"
_REPOSITORY_ROOT = Path(__file__).resolve().parents[5]
LOCAL_REVIEW_PLAN_ROOT = _REPOSITORY_ROOT / ".acquisition" / "review-plans"


class ReviewLane(StrEnum):
    BATCH_READY = "batch-ready"
    MANUAL_CONTRADICTION = "manual-contradiction"
    MANUAL_CREATE_IDENTITY = "manual-create-identity"
    BLOCKED_ON_CREATE = "blocked-on-create"
    SUPPORTING_UNCHANGED = "supporting-unchanged"
    MANUAL_NOT_COMPARED = "manual-not-compared"
    MANUAL_RELATIONSHIP_RESOLUTION = "manual-relationship-resolution"
    SOURCE_ABSENCE = "source-absence"
    MANUAL_OTHER = "manual-other"


@dataclass(frozen=True, slots=True)
class BatchReviewGroup:
    lane: ReviewLane
    subject_key: str
    identity_state: IdentityMatchState
    source_id: str
    candidate_kind: CandidateKind
    field_path: str
    conflict_state: ConflictState
    normalized_value: JsonValue
    candidate_ids: tuple[str, ...]
    bundle_ids: tuple[str, ...]
    evidence_snapshot_ids: tuple[str, ...]
    parser_versions: tuple[str, ...]

    def __post_init__(self) -> None:
        for label, value in (
            ("subject_key", self.subject_key),
            ("source_id", self.source_id),
            ("field_path", self.field_path),
        ):
            if not value.strip():
                raise ValueError(f"{label} cannot be empty")
        for label, values in (
            ("candidate_ids", self.candidate_ids),
            ("bundle_ids", self.bundle_ids),
            ("evidence_snapshot_ids", self.evidence_snapshot_ids),
            ("parser_versions", self.parser_versions),
        ):
            if not values:
                raise ValueError(f"{label} cannot be empty")
            if len(set(values)) != len(values):
                raise ValueError(f"{label} contains duplicates")

    @property
    def group_id(self) -> str:
        payload: JsonValue = {
            "lane": self.lane.value,
            "subject_key": self.subject_key,
            "identity_state": self.identity_state.value,
            "source_id": self.source_id,
            "candidate_kind": self.candidate_kind.value,
            "field_path": self.field_path,
            "conflict_state": self.conflict_state.value,
            "normalized_value": self.normalized_value,
            "candidate_ids": list(self.candidate_ids),
            "bundle_ids": list(self.bundle_ids),
        }
        return f"review-group-{sha256(canonical_json_bytes(payload)).hexdigest()}"

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "group_id": self.group_id,
            "lane": self.lane.value,
            "subject_key": self.subject_key,
            "identity_state": self.identity_state.value,
            "source_id": self.source_id,
            "candidate_kind": self.candidate_kind.value,
            "field_path": self.field_path,
            "conflict_state": self.conflict_state.value,
            "normalized_value": self.normalized_value,
            "candidate_count": len(self.candidate_ids),
            "candidate_ids": list(self.candidate_ids),
            "bundle_ids": list(self.bundle_ids),
            "evidence_snapshot_ids": list(self.evidence_snapshot_ids),
            "parser_versions": list(self.parser_versions),
        }


@dataclass(frozen=True, slots=True)
class BatchReviewPlan:
    generated_at: datetime
    bundle_ids: tuple[str, ...]
    groups: tuple[BatchReviewGroup, ...]
    schema_version: str = SCHEMA_VERSION
    canonical_curation_write_targets: tuple[str, ...] = field(default=(), repr=False)
    trusted_write_targets: tuple[str, ...] = field(default=(), repr=False)
    publication_write_targets: tuple[str, ...] = field(default=(), repr=False)

    def __post_init__(self) -> None:
        if self.schema_version != SCHEMA_VERSION:
            raise ValueError(f"schema_version must equal {SCHEMA_VERSION}")
        if self.generated_at.tzinfo is None or self.generated_at.utcoffset() is None:
            raise ValueError("generated_at must include a timezone")
        if not self.bundle_ids:
            raise ValueError("batch review plan requires at least one bundle")
        if len(set(self.bundle_ids)) != len(self.bundle_ids):
            raise ValueError("batch review plan contains duplicate bundle IDs")
        if not self.groups:
            raise ValueError("batch review plan requires at least one group")
        if (
            self.canonical_curation_write_targets
            or self.trusted_write_targets
            or self.publication_write_targets
        ):
            raise ValueError("batch review plans cannot expose write targets")
        candidate_ids = [
            candidate_id for group in self.groups for candidate_id in group.candidate_ids
        ]
        if len(set(candidate_ids)) != len(candidate_ids):
            raise ValueError("one candidate may belong to only one review group")
        group_ids = [group.group_id for group in self.groups]
        if len(set(group_ids)) != len(group_ids):
            raise ValueError("batch review plan contains duplicate review groups")

    @property
    def plan_id(self) -> str:
        payload: JsonValue = {
            "schema_version": self.schema_version,
            "bundle_ids": list(self.bundle_ids),
            "groups": [group.to_dict() for group in self.groups],
        }
        return f"batch-review-plan-{sha256(canonical_json_bytes(payload)).hexdigest()}"

    def to_dict(self) -> dict[str, JsonValue]:
        lane_counts = Counter(group.lane.value for group in self.groups)
        lane_candidate_counts = Counter({lane.value: 0 for lane in ReviewLane})
        for group in self.groups:
            lane_candidate_counts[group.lane.value] += len(group.candidate_ids)
        identity_counts = Counter(group.identity_state.value for group in self.groups)
        fact_kind_counts = Counter(group.candidate_kind.value for group in self.groups)
        conflict_counts = Counter(group.conflict_state.value for group in self.groups)
        return {
            "schema_version": self.schema_version,
            "plan_id": self.plan_id,
            "generated_at": self.generated_at.isoformat(),
            "bundle_ids": list(self.bundle_ids),
            "summary": {
                "bundle_count": len(self.bundle_ids),
                "group_count": len(self.groups),
                "candidate_count": sum(len(group.candidate_ids) for group in self.groups),
                "lane_group_counts": dict(sorted(lane_counts.items())),
                "lane_candidate_counts": {
                    key: value for key, value in sorted(lane_candidate_counts.items()) if value
                },
                "identity_state_group_counts": dict(sorted(identity_counts.items())),
                "fact_kind_group_counts": dict(sorted(fact_kind_counts.items())),
                "conflict_state_group_counts": dict(sorted(conflict_counts.items())),
            },
            "groups": [group.to_dict() for group in self.groups],
            "write_boundary": {
                "canonical_curation_write_targets": [],
                "trusted_write_targets": [],
                "publication_write_targets": [],
            },
        }


def build_batch_review_plan(
    bundles: Sequence[AcquisitionBundle],
    *,
    generated_at: datetime,
) -> BatchReviewPlan:
    if generated_at.tzinfo is None or generated_at.utcoffset() is None:
        raise ValueError("generated_at must include a timezone")
    if not bundles:
        raise ValueError("at least one acquisition bundle is required")

    bundle_ids: set[str] = set()
    candidates_by_group: dict[bytes, list[tuple[str, FieldCandidate]]] = defaultdict(list)
    for bundle in bundles:
        if bundle.bundle_id in bundle_ids:
            raise ValueError(f"duplicate acquisition bundle {bundle.bundle_id}")
        if bundle.run.state is not AcquisitionRunState.COMPLETED:
            raise ValueError(f"bundle {bundle.bundle_id} is not completed")
        if generated_at < bundle.created_at:
            raise ValueError("batch review plan cannot precede an acquisition bundle")
        bundle_ids.add(bundle.bundle_id)
        for candidate in bundle.candidates:
            candidates_by_group[_semantic_group_key(candidate)].append(
                (bundle.bundle_id, candidate)
            )

    groups = tuple(
        sorted(
            (_build_group(entries) for entries in candidates_by_group.values()),
            key=lambda group: (
                _lane_rank(group.lane),
                group.subject_key,
                group.candidate_kind.value,
                group.field_path,
                canonical_json_bytes(group.normalized_value),
                group.conflict_state.value,
            ),
        )
    )
    return BatchReviewPlan(
        generated_at=generated_at,
        bundle_ids=tuple(sorted(bundle_ids)),
        groups=groups,
    )


def write_batch_review_plan(
    plan: BatchReviewPlan,
    output: str | Path,
    *,
    overwrite: bool = False,
) -> Path:
    path = resolve_batch_review_plan_path(output)
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and not overwrite:
        raise FileExistsError(path)
    rendered = json.dumps(plan.to_dict(), ensure_ascii=False, indent=2, allow_nan=False) + "\n"
    temporary = path.with_name(f".{path.name}.{uuid4().hex}.tmp")
    try:
        temporary.write_text(rendered, encoding="utf-8", newline="")
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)
    return path


def resolve_batch_review_plan_path(value: str | Path) -> Path:
    root = LOCAL_REVIEW_PLAN_ROOT.resolve()
    requested = Path(value)
    if requested.is_absolute():
        candidate = requested.resolve()
    else:
        repository_candidate = (_REPOSITORY_ROOT / requested).resolve()
        try:
            repository_candidate.relative_to(root)
        except ValueError:
            candidate = (root / requested).resolve()
        else:
            candidate = repository_candidate
    try:
        candidate.relative_to(root)
    except ValueError as error:
        raise ValueError(f"review plan must stay below {root}") from error
    if candidate.suffix != ".json":
        raise ValueError("review plans must use the .json suffix")
    return candidate


def _semantic_group_key(candidate: FieldCandidate) -> bytes:
    match = candidate.identity_match
    subject_key = match.matched_canonical_slug or match.matched_panda_id or match.source_identity
    payload: JsonValue = {
        "lane": review_lane_for_candidate(candidate).value,
        "subject_key": subject_key,
        "identity_state": match.state.value,
        "source_id": candidate.source_id,
        "candidate_kind": candidate.candidate_kind.value,
        "field_path": candidate.field_path,
        "conflict_state": candidate.conflict_state.value,
        "normalized_value": candidate.normalized_value,
    }
    return canonical_json_bytes(payload)


def _build_group(entries: Sequence[tuple[str, FieldCandidate]]) -> BatchReviewGroup:
    if not entries:
        raise ValueError("review group cannot be empty")
    first = entries[0][1]
    match = first.identity_match
    subject_key = match.matched_canonical_slug or match.matched_panda_id or match.source_identity
    return BatchReviewGroup(
        lane=review_lane_for_candidate(first),
        subject_key=subject_key,
        identity_state=match.state,
        source_id=first.source_id,
        candidate_kind=first.candidate_kind,
        field_path=first.field_path,
        conflict_state=first.conflict_state,
        normalized_value=first.normalized_value,
        candidate_ids=tuple(sorted(candidate.candidate_id for _, candidate in entries)),
        bundle_ids=tuple(sorted({bundle_id for bundle_id, _ in entries})),
        evidence_snapshot_ids=tuple(
            sorted({candidate.evidence_snapshot_id for _, candidate in entries})
        ),
        parser_versions=tuple(
            sorted(
                {f"{candidate.parser_name}@{candidate.parser_version}" for _, candidate in entries}
            )
        ),
    )


def review_lane_for_candidate(candidate: FieldCandidate) -> ReviewLane:
    if candidate.normalized_value is None:
        return ReviewLane.SOURCE_ABSENCE
    if candidate.conflict_state is ConflictState.CONTRADICTION:
        return ReviewLane.MANUAL_CONTRADICTION
    if candidate.identity_match.state is IdentityMatchState.UNMATCHED:
        if candidate.candidate_kind is CandidateKind.IDENTITY:
            return ReviewLane.MANUAL_CREATE_IDENTITY
        return ReviewLane.BLOCKED_ON_CREATE
    if candidate.identity_match.state is not IdentityMatchState.MATCHED:
        return ReviewLane.MANUAL_OTHER
    if candidate.candidate_kind is CandidateKind.RELATIONSHIP:
        parent_reference = candidate.normalized_value
        if not isinstance(parent_reference, dict) or not parent_reference.get("canonical_slug"):
            return ReviewLane.MANUAL_RELATIONSHIP_RESOLUTION
    if candidate.conflict_state is ConflictState.UNCHANGED:
        return ReviewLane.SUPPORTING_UNCHANGED
    if candidate.conflict_state in {
        ConflictState.NEW,
        ConflictState.MISSING_CURRENT_VALUE,
    }:
        return ReviewLane.BATCH_READY
    if candidate.conflict_state is ConflictState.NOT_COMPARED:
        return ReviewLane.MANUAL_NOT_COMPARED
    return ReviewLane.MANUAL_OTHER


def _lane_rank(lane: ReviewLane) -> int:
    order = {
        ReviewLane.BATCH_READY: 0,
        ReviewLane.MANUAL_CREATE_IDENTITY: 1,
        ReviewLane.BLOCKED_ON_CREATE: 2,
        ReviewLane.MANUAL_CONTRADICTION: 3,
        ReviewLane.MANUAL_NOT_COMPARED: 4,
        ReviewLane.MANUAL_RELATIONSHIP_RESOLUTION: 5,
        ReviewLane.SOURCE_ABSENCE: 6,
        ReviewLane.SUPPORTING_UNCHANGED: 7,
        ReviewLane.MANUAL_OTHER: 8,
    }
    return order[lane]


__all__ = [
    "LOCAL_REVIEW_PLAN_ROOT",
    "SCHEMA_VERSION",
    "BatchReviewGroup",
    "BatchReviewPlan",
    "ReviewLane",
    "build_batch_review_plan",
    "resolve_batch_review_plan_path",
    "review_lane_for_candidate",
    "write_batch_review_plan",
]
