from __future__ import annotations

from collections import Counter, defaultdict
from datetime import UTC, datetime
from typing import Final

from ..contracts import (
    AcquisitionBundle,
    AcquisitionRunState,
    CandidateKind,
    ConflictState,
    EvidenceBlockState,
    FieldCandidate,
    IdentityMatchState,
)
from ..contracts.v1 import JsonValue
from .models import (
    CurationPatchBundle,
    CurationPatchProposal,
    CuratorDecision,
    DecisionAction,
    DecisionLog,
    IntakeKind,
    PandaReference,
    PatchProvenance,
    PatchSourceEvidence,
    ReviewSummary,
    ReviewSummaryGroup,
)

_UNREVIEWED: Final = "unreviewed"


def validate_decision_log(bundle: AcquisitionBundle, log: DecisionLog) -> None:
    if log.acquisition_bundle_id != bundle.bundle_id:
        raise ValueError("decision log references a different acquisition bundle")
    if log.created_at < bundle.created_at:
        raise ValueError("decision log cannot precede its acquisition bundle")

    candidates = {candidate.candidate_id: candidate for candidate in bundle.candidates}
    for decision in log.decisions:
        candidate = candidates.get(decision.candidate_id)
        if candidate is None:
            raise ValueError(f"decision references unknown candidate {decision.candidate_id}")
        if decision.evidence_snapshot_id != candidate.evidence_snapshot_id:
            raise ValueError(f"decision evidence does not match candidate {decision.candidate_id}")
        if decision.decided_at < bundle.created_at:
            raise ValueError(
                f"decision for {decision.candidate_id} predates the acquisition bundle"
            )
        if decision.decided_at > log.updated_at:
            raise ValueError(
                f"decision for {decision.candidate_id} occurs after decision log updated_at"
            )


def record_decision(
    bundle: AcquisitionBundle,
    *,
    existing_log: DecisionLog | None,
    candidate_id: str,
    action: DecisionAction,
    reviewer: str,
    decided_at: datetime,
    recorded_at: datetime,
    note: str | None = None,
) -> tuple[DecisionLog, CuratorDecision]:
    if decided_at.tzinfo is None or decided_at.utcoffset() is None:
        raise ValueError("decided_at must include a timezone")
    if recorded_at.tzinfo is None or recorded_at.utcoffset() is None:
        raise ValueError("recorded_at must include a timezone")
    if recorded_at < decided_at:
        raise ValueError("recorded_at cannot precede decided_at")

    candidate = next(
        (item for item in bundle.candidates if item.candidate_id == candidate_id),
        None,
    )
    if candidate is None:
        raise ValueError(f"unknown candidate {candidate_id}")
    if decided_at < bundle.created_at:
        raise ValueError("curator decision cannot precede acquisition bundle creation")

    decision = CuratorDecision(
        candidate_id=candidate.candidate_id,
        evidence_snapshot_id=candidate.evidence_snapshot_id,
        reviewer=reviewer,
        decided_at=decided_at,
        action=action,
        note=note,
    )
    if existing_log is None:
        log = DecisionLog(
            acquisition_bundle_id=bundle.bundle_id,
            created_at=recorded_at,
            updated_at=recorded_at,
            decisions=(decision,),
        )
    else:
        validate_decision_log(bundle, existing_log)
        log = existing_log.append(decision, updated_at=recorded_at)
    validate_decision_log(bundle, log)
    return log, decision


def summarize_candidates(
    bundle: AcquisitionBundle,
    decision_log: DecisionLog | None = None,
) -> ReviewSummary:
    effective: dict[str, CuratorDecision] = {}
    if decision_log is not None:
        validate_decision_log(bundle, decision_log)
        effective = decision_log.effective_decisions()

    identity_counts = Counter(
        candidate.identity_match.state.value for candidate in bundle.candidates
    )
    conflict_counts = Counter(candidate.conflict_state.value for candidate in bundle.candidates)
    fact_kind_counts = Counter(candidate.candidate_kind.value for candidate in bundle.candidates)
    decision_counts: Counter[str] = Counter()
    grouped: dict[
        tuple[str, IdentityMatchState, str, str, ConflictState],
        list[FieldCandidate],
    ] = defaultdict(list)

    for candidate in bundle.candidates:
        decision = effective.get(candidate.candidate_id)
        decision_counts[decision.action.value if decision is not None else _UNREVIEWED] += 1
        match = candidate.identity_match
        panda_key = match.matched_canonical_slug or match.matched_panda_id or match.source_identity
        grouped[
            (
                panda_key,
                match.state,
                candidate.source_id,
                candidate.candidate_kind.value,
                candidate.conflict_state,
            )
        ].append(candidate)

    groups: list[ReviewSummaryGroup] = []
    for key, candidates in grouped.items():
        panda_key, identity_state, source_id, fact_kind, conflict_state = key
        group_decisions = Counter(
            effective[candidate.candidate_id].action.value
            if candidate.candidate_id in effective
            else _UNREVIEWED
            for candidate in candidates
        )
        groups.append(
            ReviewSummaryGroup(
                panda_key=panda_key,
                identity_state=identity_state,
                source_id=source_id,
                fact_kind=fact_kind,
                conflict_state=conflict_state,
                candidate_ids=tuple(sorted(candidate.candidate_id for candidate in candidates)),
                decision_counts=dict(group_decisions),
            )
        )

    groups.sort(
        key=lambda group: (
            group.panda_key,
            group.source_id,
            group.fact_kind,
            group.conflict_state.value,
        )
    )
    return ReviewSummary(
        acquisition_bundle_id=bundle.bundle_id,
        candidate_count=len(bundle.candidates),
        groups=tuple(groups),
        identity_state_counts=dict(identity_counts),
        conflict_state_counts=dict(conflict_counts),
        fact_kind_counts=dict(fact_kind_counts),
        decision_counts=dict(decision_counts),
    )


def export_curation_patch(
    bundle: AcquisitionBundle,
    decision_log: DecisionLog,
    *,
    created_at: datetime | None = None,
) -> CurationPatchBundle:
    patch_created_at = created_at or datetime.now(UTC)
    _require_aware("patch created_at", patch_created_at)
    if patch_created_at < bundle.created_at:
        raise ValueError("curation patch cannot precede its acquisition bundle")
    if bundle.run.state is not AcquisitionRunState.COMPLETED:
        raise ValueError("curation patches require a completed acquisition run")
    if bundle.run.source_reviewed_at is None or bundle.run.source_review_expires_at is None:
        raise ValueError("curation patches require source review dates")
    if bundle.run.source_reviewed_at > patch_created_at.date():
        raise ValueError("curation patch cannot precede the source review")
    if bundle.run.source_review_expires_at < patch_created_at.date():
        raise ValueError(
            f"source review expired on {bundle.run.source_review_expires_at.isoformat()}"
        )

    validate_decision_log(bundle, decision_log)
    if decision_log.updated_at > patch_created_at:
        raise ValueError("curation patch cannot precede decision log updated_at")
    effective = decision_log.effective_decisions()

    accepted_candidates = [
        candidate
        for candidate in bundle.candidates
        if (
            (decision := effective.get(candidate.candidate_id)) is not None
            and decision.action is DecisionAction.ACCEPTED
        )
    ]
    if not accepted_candidates:
        raise ValueError("curation patch export requires at least one accepted candidate")

    evidence_by_id = {snapshot.snapshot_id: snapshot for snapshot in bundle.evidence_snapshots}
    candidates_by_snapshot: dict[str, list[str]] = defaultdict(list)
    proposals: list[CurationPatchProposal] = []

    for candidate in accepted_candidates:
        decision = effective[candidate.candidate_id]
        _validate_accepted_candidate(candidate)
        snapshot = evidence_by_id.get(candidate.evidence_snapshot_id)
        if snapshot is None:
            raise ValueError(f"accepted candidate {candidate.candidate_id} has missing evidence")
        if snapshot.body_sha256 != candidate.evidence_body_sha256:
            raise ValueError(
                f"accepted candidate {candidate.candidate_id} evidence hash does not match"
            )
        if snapshot.block_state is not EvidenceBlockState.CLEAR or snapshot.status != 200:
            raise ValueError(
                f"accepted candidate {candidate.candidate_id} evidence is not clear HTTP 200"
            )

        subject = PandaReference(
            state=candidate.identity_match.state,
            source_identity=candidate.identity_match.source_identity,
            matched_panda_id=candidate.identity_match.matched_panda_id,
            matched_canonical_slug=candidate.identity_match.matched_canonical_slug,
        )
        intake_kind, payload = _proposal_payload(candidate)
        provenance = PatchProvenance(
            acquisition_bundle_id=bundle.bundle_id,
            acquisition_run_id=bundle.run.run_id,
            candidate_id=candidate.candidate_id,
            decision=decision,
            source_id=candidate.source_id,
            evidence_snapshot_id=candidate.evidence_snapshot_id,
            evidence_body_sha256=candidate.evidence_body_sha256,
            parser_name=candidate.parser_name,
            parser_version=candidate.parser_version,
            source_locator=candidate.source_locator,
            raw_value=candidate.raw_value,
            normalized_value=candidate.normalized_value,
            prior_trusted_value=candidate.current_trusted_value,
            conflict_state=candidate.conflict_state,
            candidate_notes=candidate.notes,
        )
        proposals.append(
            CurationPatchProposal(
                intake_kind=intake_kind,
                subject=subject,
                payload=payload,
                provenance=provenance,
            )
        )
        candidates_by_snapshot[candidate.evidence_snapshot_id].append(candidate.candidate_id)

    sources = tuple(
        PatchSourceEvidence(
            source_id=snapshot.source_id,
            evidence_snapshot_id=snapshot.snapshot_id,
            requested_url=snapshot.requested_url,
            final_url=snapshot.final_url,
            captured_at=snapshot.captured_at,
            body_sha256=snapshot.body_sha256,
            body_bytes=snapshot.body_bytes,
            content_type=snapshot.content_type,
            candidate_ids=tuple(sorted(candidates_by_snapshot[snapshot.snapshot_id])),
        )
        for snapshot in bundle.evidence_snapshots
        if snapshot.snapshot_id in candidates_by_snapshot
    )
    return CurationPatchBundle(
        acquisition_bundle_id=bundle.bundle_id,
        decision_log_id=decision_log.decision_log_id,
        created_at=patch_created_at,
        source_reviewed_at=bundle.run.source_reviewed_at,
        source_review_expires_at=bundle.run.source_review_expires_at,
        sources=sources,
        proposals=tuple(proposals),
    )


def render_summary_text(summary: ReviewSummary) -> str:
    lines = [
        f"Acquisition bundle: {summary.acquisition_bundle_id}",
        f"Candidates: {summary.candidate_count}",
        "Decisions: "
        + ", ".join(f"{name}={count}" for name, count in sorted(summary.decision_counts.items())),
        "",
        "panda | source | fact kind | conflict | count | decisions",
    ]
    for group in summary.groups:
        decisions = ",".join(
            f"{name}={count}" for name, count in sorted(group.decision_counts.items())
        )
        lines.append(
            " | ".join(
                (
                    group.panda_key,
                    group.source_id,
                    group.fact_kind,
                    group.conflict_state.value,
                    str(len(group.candidate_ids)),
                    decisions,
                )
            )
        )
    return "\n".join(lines)


def _validate_accepted_candidate(candidate: FieldCandidate) -> None:
    if candidate.identity_match.state is IdentityMatchState.AMBIGUOUS:
        raise ValueError(
            f"accepted candidate {candidate.candidate_id} has an ambiguous identity match"
        )
    if candidate.identity_match.state is IdentityMatchState.NOT_ATTEMPTED:
        raise ValueError(
            f"accepted candidate {candidate.candidate_id} has not completed identity matching"
        )
    if (
        candidate.identity_match.state is IdentityMatchState.UNMATCHED
        and candidate.candidate_kind is not CandidateKind.IDENTITY
    ):
        raise ValueError(
            f"accepted candidate {candidate.candidate_id} has no panda identity for "
            f"{candidate.candidate_kind.value} intake"
        )
    if candidate.conflict_state is ConflictState.CONTRADICTION:
        raise ValueError(
            f"accepted candidate {candidate.candidate_id} has an unresolved contradiction"
        )
    if candidate.normalized_value is None:
        raise ValueError(
            f"accepted candidate {candidate.candidate_id} is source absence, not a patchable fact"
        )
    if candidate.candidate_kind is CandidateKind.MEDIA_METADATA:
        raise ValueError(
            f"accepted candidate {candidate.candidate_id} is media metadata; this patch schema "
            "supports panda, event, relationship, and residency intake only"
        )


def _proposal_payload(candidate: FieldCandidate) -> tuple[IntakeKind, dict[str, JsonValue]]:
    source_ids = [candidate.source_id]
    if candidate.candidate_kind is CandidateKind.IDENTITY:
        if not candidate.field_path.startswith("identity."):
            raise ValueError(f"unsupported identity field path {candidate.field_path}")
        return (
            IntakeKind.PANDA,
            {
                "operation": "propose-field",
                "field_path": candidate.field_path,
                "value": candidate.normalized_value,
                "source_ids": source_ids,
            },
        )
    if candidate.candidate_kind is CandidateKind.EVENT:
        if not isinstance(candidate.normalized_value, dict):
            raise ValueError("event candidates require a structured normalized value")
        if not candidate.normalized_value.get("event_type"):
            raise ValueError("event candidates require event_type")
        return (
            IntakeKind.EVENT,
            {
                "operation": "propose-event",
                "event": candidate.normalized_value,
                "source_ids": source_ids,
            },
        )
    if candidate.candidate_kind is CandidateKind.RELATIONSHIP:
        if not candidate.field_path.startswith("relationship."):
            raise ValueError(f"unsupported relationship field path {candidate.field_path}")
        role = candidate.field_path.removeprefix("relationship.")
        if role not in {"father", "mother", "parent"}:
            raise ValueError(f"unsupported parentage role {role}")
        return (
            IntakeKind.RELATIONSHIP,
            {
                "operation": "propose-parentage-assertion",
                "role": role,
                "parent_reference": candidate.normalized_value,
                "source_ids": source_ids,
            },
        )
    if candidate.candidate_kind is CandidateKind.RESIDENCY:
        if not candidate.field_path.startswith("residency."):
            raise ValueError(f"unsupported residency field path {candidate.field_path}")
        return (
            IntakeKind.RESIDENCY,
            {
                "operation": "propose-residency",
                "residency_kind": candidate.field_path.removeprefix("residency."),
                "location": candidate.normalized_value,
                "source_ids": source_ids,
            },
        )
    raise ValueError(f"unsupported candidate kind {candidate.candidate_kind.value}")


def _require_aware(label: str, value: datetime) -> None:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{label} must include a timezone")
