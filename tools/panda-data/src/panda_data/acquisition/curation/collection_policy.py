from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from datetime import datetime

from ..contracts import AcquisitionBundle, CandidateKind, FieldCandidate
from .batch_review import ReviewLane, review_lane_for_candidate
from .models import CuratorDecision, DecisionAction, DecisionLog

POLICY_ID = "pandaatlas-collection-batch-policy/v2"
_PROMOTABLE_KINDS = frozenset(
    {
        CandidateKind.IDENTITY,
        CandidateKind.RELATIONSHIP,
        CandidateKind.RESIDENCY,
        CandidateKind.EVENT,
    }
)


@dataclass(frozen=True, slots=True)
class CollectionDecisionPolicySummary:
    candidate_count: int
    action_counts: dict[str, int]
    accepted_kind_counts: dict[str, int]
    deferred_lane_counts: dict[str, int]

    def to_dict(self) -> dict[str, object]:
        return {
            "policy_id": POLICY_ID,
            "candidate_count": self.candidate_count,
            "action_counts": dict(sorted(self.action_counts.items())),
            "accepted_kind_counts": dict(sorted(self.accepted_kind_counts.items())),
            "deferred_lane_counts": dict(sorted(self.deferred_lane_counts.items())),
        }


def build_collection_decision_log(
    bundle: AcquisitionBundle,
    *,
    decided_at: datetime,
    reviewer: str = POLICY_ID,
) -> tuple[DecisionLog, CollectionDecisionPolicySummary]:
    if decided_at.tzinfo is None or decided_at.utcoffset() is None:
        raise ValueError("decided_at must include a timezone")
    if decided_at < bundle.created_at:
        raise ValueError("collection decisions cannot precede the acquisition bundle")
    if not reviewer.strip() or reviewer != reviewer.strip():
        raise ValueError("reviewer must be a non-empty trimmed identity")

    decisions: list[CuratorDecision] = []
    accepted_kinds: Counter[str] = Counter()
    deferred_lanes: Counter[str] = Counter()
    action_counts: Counter[str] = Counter()
    for candidate in sorted(bundle.candidates, key=lambda item: item.candidate_id):
        action, note = collection_policy_decision(candidate)
        lane = review_lane_for_candidate(candidate)
        if action is DecisionAction.ACCEPTED:
            accepted_kinds[candidate.candidate_kind.value] += 1
        else:
            deferred_lanes[lane.value] += 1
        action_counts[action.value] += 1
        decisions.append(
            CuratorDecision(
                candidate_id=candidate.candidate_id,
                evidence_snapshot_id=candidate.evidence_snapshot_id,
                reviewer=reviewer,
                decided_at=decided_at,
                action=action,
                note=note,
            )
        )

    log = DecisionLog(
        acquisition_bundle_id=bundle.bundle_id,
        created_at=decided_at,
        updated_at=decided_at,
        decisions=tuple(decisions),
    )
    summary = CollectionDecisionPolicySummary(
        candidate_count=len(bundle.candidates),
        action_counts=dict(action_counts),
        accepted_kind_counts=dict(accepted_kinds),
        deferred_lane_counts=dict(deferred_lanes),
    )
    return log, summary


def collection_policy_decision(
    candidate: FieldCandidate,
) -> tuple[DecisionAction, str]:
    lane = review_lane_for_candidate(candidate)
    if lane is ReviewLane.MANUAL_CREATE_IDENTITY:
        if _is_v2_promotable_candidate(candidate):
            return (
                DecisionAction.ACCEPTED,
                "Accepted as a reviewed V2 identity-intake proposal for a new source identity; "
                "promotion must preserve the source identity and must not auto-create or merge an "
                "authoritative panda without the Curation identity checks.",
            )
        return (
            DecisionAction.DEFERRED,
            "Deferred because the candidate is not representable by the reviewed V2 panda "
            "promotion contract.",
        )
    if lane is ReviewLane.BATCH_READY:
        if _is_v2_promotable_candidate(candidate):
            return (
                DecisionAction.ACCEPTED,
                "Accepted as a reviewed V2 promotion proposal; the legacy curation CSV shape does "
                "not determine whether this candidate is representable.",
            )
        return (
            DecisionAction.DEFERRED,
            "Deferred because this candidate kind is not yet supported by the reviewed V2 "
            "promotion contract.",
        )
    if lane is ReviewLane.SUPPORTING_UNCHANGED:
        return (
            DecisionAction.DEFERRED,
            "Deferred pending the V2 corroboration path that can attach additional provenance "
            "without duplicating the current canonical fact.",
        )
    if lane is ReviewLane.MANUAL_CONTRADICTION:
        return (
            DecisionAction.DEFERRED,
            "Deferred because the candidate contradicts the current trusted value and requires an "
            "explicit Curation decision that preserves the competing assertion and evidence.",
        )
    if lane is ReviewLane.MANUAL_RELATIONSHIP_RESOLUTION:
        return (
            DecisionAction.DEFERRED,
            "Deferred because the parent is represented only by source text; no canonical parent "
            "identity is inferred from a name alone.",
        )
    if lane is ReviewLane.BLOCKED_ON_CREATE:
        return (
            DecisionAction.DEFERRED,
            "Deferred until the source-local panda identity has been reviewed and created; the "
            "bundle must then be replayed against the updated identity snapshot.",
        )
    if lane is ReviewLane.MANUAL_NOT_COMPARED:
        return (
            DecisionAction.DEFERRED,
            "Deferred because the reconciliation contract did not compare this field.",
        )
    if lane is ReviewLane.SOURCE_ABSENCE:
        return (
            DecisionAction.DEFERRED,
            "Deferred because source absence is not a patchable factual assertion.",
        )
    return (
        DecisionAction.DEFERRED,
        "Deferred because the candidate remains outside the reviewed V2 promotion policy.",
    )


def _is_v2_promotable_candidate(candidate: FieldCandidate) -> bool:
    if candidate.candidate_kind not in _PROMOTABLE_KINDS:
        return False
    if candidate.candidate_kind is CandidateKind.IDENTITY:
        return candidate.field_path.startswith("identity.")
    if candidate.candidate_kind is CandidateKind.RELATIONSHIP:
        return candidate.field_path.startswith("relationship.")
    if candidate.candidate_kind is CandidateKind.RESIDENCY:
        return candidate.field_path.startswith("residency.")
    if candidate.candidate_kind is CandidateKind.EVENT:
        value = candidate.normalized_value
        return isinstance(value, dict) and bool(value.get("event_type"))
    return False


__all__ = [
    "POLICY_ID",
    "CollectionDecisionPolicySummary",
    "build_collection_decision_log",
    "collection_policy_decision",
]
