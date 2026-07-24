from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime

from ..contracts import AcquisitionBundle, CandidateKind, FieldCandidate
from .batch_review import ReviewLane, review_lane_for_candidate
from .models import CuratorDecision, DecisionAction, DecisionLog

POLICY_ID = "pandaatlas-collection-batch-policy/v1"
_SUPPORTED_CREATE_FIELDS = {
    "identity.names.official.zh",
    "identity.names.official.en",
    "identity.birth_date",
    "identity.sex",
}
_SUPPORTED_MATCHED_FIELDS = {
    "identity.names.official.zh",
}


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
        if candidate.field_path in _SUPPORTED_CREATE_FIELDS:
            return (
                DecisionAction.ACCEPTED,
                "Accepted by the collection batch policy as a field for a new source identity; "
                "the identity intake application must aggregate bilingual duplicates before "
                "creating one reviewed curation row.",
            )
        return (
            DecisionAction.DEFERRED,
            "Deferred because the new-identity field is not representable by the current curation "
            "CSV contract.",
        )
    if lane is ReviewLane.BATCH_READY:
        if candidate.candidate_kind is CandidateKind.EVENT:
            if not _event_has_exact_date(candidate):
                return (
                    DecisionAction.DEFERRED,
                    "Deferred because the current events.csv contract requires a complete ISO "
                    "date; the source supplies only year- or month-level precision.",
                )
            return (
                DecisionAction.ACCEPTED,
                "Accepted by the collection batch policy as a structured event with an exact date "
                "for an explicitly matched panda identity; bilingual duplicates must be "
                "idempotently upserted.",
            )
        if candidate.field_path in _SUPPORTED_MATCHED_FIELDS:
            return (
                DecisionAction.ACCEPTED,
                "Accepted by the collection batch policy as a missing canonical display field for "
                "an explicitly matched panda identity.",
            )
        return (
            DecisionAction.DEFERRED,
            "Deferred because this low-conflict candidate is not representable by the current "
            "curation CSV contract without a schema extension.",
        )
    if lane is ReviewLane.SUPPORTING_UNCHANGED:
        return (
            DecisionAction.DEFERRED,
            "Deferred as corroborating evidence only; no duplicate curation write is required.",
        )
    if lane is ReviewLane.MANUAL_CONTRADICTION:
        return (
            DecisionAction.DEFERRED,
            "Deferred because the candidate contradicts the current curation value and requires an "
            "explicit correction decision.",
        )
    if lane is ReviewLane.MANUAL_RELATIONSHIP_RESOLUTION:
        return (
            DecisionAction.DEFERRED,
            "Deferred because the parent is represented only by source text; no parent slug is "
            "inferred from a name alone.",
        )
    if lane is ReviewLane.BLOCKED_ON_CREATE:
        return (
            DecisionAction.DEFERRED,
            "Deferred until the source-local panda identity has been created and the acquisition "
            "bundle has been replayed against the updated identity snapshot.",
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
        "Deferred because the candidate is outside the unattended collection application policy.",
    )


def _event_has_exact_date(candidate: FieldCandidate) -> bool:
    value = candidate.normalized_value
    if not isinstance(value, dict):
        return False
    event_date = value.get("event_date")
    if not isinstance(event_date, dict):
        return False
    if event_date.get("precision") != "day":
        return False
    raw_date = event_date.get("value")
    if not isinstance(raw_date, str):
        return False
    try:
        date.fromisoformat(raw_date)
    except ValueError:
        return False
    return True


__all__ = [
    "POLICY_ID",
    "CollectionDecisionPolicySummary",
    "build_collection_decision_log",
    "collection_policy_decision",
]
