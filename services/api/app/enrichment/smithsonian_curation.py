from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from hashlib import sha256
from pathlib import Path
from uuid import uuid4

from app.acquisition.contracts import (
    CandidateKind,
    ConflictState,
    FieldCandidate,
    canonical_json_bytes,
)
from app.acquisition.contracts.v1 import JsonValue
from app.acquisition.curation import (
    CurationPatchBundle,
    DecisionAction,
    DecisionLog,
    export_curation_patch,
    validate_decision_log,
)

from .smithsonian_cohort import SmithsonianCurrentPairCohort

SMITHSONIAN_CURATION_REVIEW_SCHEMA_VERSION = "panda-atlas-smithsonian-curation-review/v1"
_REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
SMITHSONIAN_REVIEW_PLAN_ROOT = _REPOSITORY_ROOT / ".acquisition" / "review-plans"


class SmithsonianReviewRecommendation(StrEnum):
    PROPOSE_ACCEPT = "propose-accept"
    REQUIRED_DEFER = "required-defer"
    SUPPORTING_EVIDENCE_ONLY = "supporting-evidence-only"


@dataclass(frozen=True, slots=True)
class SmithsonianCurationReviewItem:
    candidate_id: str
    subject_slug: str
    candidate_kind: CandidateKind
    source_field_path: str
    normalized_value: JsonValue
    conflict_state: ConflictState
    recommendation: SmithsonianReviewRecommendation
    reason: str
    fact_id: str | None = None
    fact_field_path: str | None = None

    def __post_init__(self) -> None:
        for label, value in (
            ("candidate_id", self.candidate_id),
            ("subject_slug", self.subject_slug),
            ("source_field_path", self.source_field_path),
            ("reason", self.reason),
        ):
            if not value or value != value.strip():
                raise ValueError(f"{label} must be non-empty and trimmed")
        if self.recommendation is SmithsonianReviewRecommendation.PROPOSE_ACCEPT:
            if self.fact_id is None or self.fact_field_path is None:
                raise ValueError("proposed accepts require their fact assertion basis")
        elif self.fact_id is not None or self.fact_field_path is not None:
            raise ValueError("non-fact review items cannot expose a fact assertion basis")

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "candidate_id": self.candidate_id,
            "subject_slug": self.subject_slug,
            "candidate_kind": self.candidate_kind.value,
            "source_field_path": self.source_field_path,
            "normalized_value": self.normalized_value,
            "conflict_state": self.conflict_state.value,
            "recommendation": self.recommendation.value,
            "reason": self.reason,
            "fact_id": self.fact_id,
            "fact_field_path": self.fact_field_path,
        }


@dataclass(frozen=True, slots=True)
class SmithsonianCurationReviewPlan:
    acquisition_bundle_id: str
    fact_enrichment_batch_id: str
    selected_slugs: tuple[str, ...]
    proposed_accept_candidate_ids: tuple[str, ...]
    required_defer_candidate_ids: tuple[str, ...]
    supporting_evidence_candidate_ids: tuple[str, ...]
    out_of_scope_candidate_ids: tuple[str, ...]
    items: tuple[SmithsonianCurationReviewItem, ...]
    created_at: datetime
    schema_version: str = SMITHSONIAN_CURATION_REVIEW_SCHEMA_VERSION
    canonical_curation_write_targets: tuple[str, ...] = field(default=(), repr=False)
    trusted_write_targets: tuple[str, ...] = field(default=(), repr=False)
    publication_write_targets: tuple[str, ...] = field(default=(), repr=False)

    def __post_init__(self) -> None:
        if self.schema_version != SMITHSONIAN_CURATION_REVIEW_SCHEMA_VERSION:
            raise ValueError(
                "Smithsonian review plan schema version does not match the supported version"
            )
        if self.created_at.tzinfo is None or self.created_at.utcoffset() is None:
            raise ValueError("Smithsonian review plan created_at must include a timezone")
        if (
            self.canonical_curation_write_targets
            or self.trusted_write_targets
            or self.publication_write_targets
        ):
            raise ValueError(
                "Smithsonian review plans cannot write curation, trusted, or public data"
            )
        if self.selected_slugs != ("bao-li", "qing-bao"):
            raise ValueError("Smithsonian review plan scope drifted")

        partitions = (
            self.proposed_accept_candidate_ids,
            self.required_defer_candidate_ids,
            self.supporting_evidence_candidate_ids,
            self.out_of_scope_candidate_ids,
        )
        for values in partitions:
            if values != tuple(sorted(set(values))):
                raise ValueError("Smithsonian review plan candidate partitions must be sorted")
        if any(
            set(left) & set(right)
            for index, left in enumerate(partitions)
            for right in partitions[index + 1 :]
        ):
            raise ValueError("Smithsonian review plan candidate partitions overlap")

        item_ids = tuple(item.candidate_id for item in self.items)
        if item_ids != tuple(sorted(set(item_ids))):
            raise ValueError("Smithsonian review plan items must be unique and sorted")
        expected_item_ids = tuple(
            sorted(
                (
                    *self.proposed_accept_candidate_ids,
                    *self.required_defer_candidate_ids,
                    *self.supporting_evidence_candidate_ids,
                )
            )
        )
        if item_ids != expected_item_ids:
            raise ValueError("Smithsonian review plan items do not cover the in-scope candidates")

        recommendation_ids = {
            recommendation: tuple(
                item.candidate_id for item in self.items if item.recommendation is recommendation
            )
            for recommendation in SmithsonianReviewRecommendation
        }
        if recommendation_ids[SmithsonianReviewRecommendation.PROPOSE_ACCEPT] != (
            self.proposed_accept_candidate_ids
        ):
            raise ValueError("Smithsonian proposed-accept item partition drifted")
        if recommendation_ids[SmithsonianReviewRecommendation.REQUIRED_DEFER] != (
            self.required_defer_candidate_ids
        ):
            raise ValueError("Smithsonian required-defer item partition drifted")
        if (
            recommendation_ids[SmithsonianReviewRecommendation.SUPPORTING_EVIDENCE_ONLY]
            != self.supporting_evidence_candidate_ids
        ):
            raise ValueError("Smithsonian supporting-evidence item partition drifted")

    @property
    def plan_id(self) -> str:
        payload = {
            "schema_version": self.schema_version,
            "acquisition_bundle_id": self.acquisition_bundle_id,
            "fact_enrichment_batch_id": self.fact_enrichment_batch_id,
            "selected_slugs": list(self.selected_slugs),
            "proposed_accept_candidate_ids": list(self.proposed_accept_candidate_ids),
            "required_defer_candidate_ids": list(self.required_defer_candidate_ids),
            "supporting_evidence_candidate_ids": list(self.supporting_evidence_candidate_ids),
            "out_of_scope_candidate_ids": list(self.out_of_scope_candidate_ids),
            "items": [item.to_dict() for item in self.items],
        }
        digest = sha256(canonical_json_bytes(payload)).hexdigest()
        return f"smithsonian-curation-review-{digest}"

    def recommendation_counts(self) -> dict[str, int]:
        return {
            recommendation.value: sum(item.recommendation is recommendation for item in self.items)
            for recommendation in SmithsonianReviewRecommendation
        }

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "schema_version": self.schema_version,
            "plan_id": self.plan_id,
            "acquisition_bundle_id": self.acquisition_bundle_id,
            "fact_enrichment_batch_id": self.fact_enrichment_batch_id,
            "created_at": self.created_at.isoformat(),
            "selected_slugs": list(self.selected_slugs),
            "summary": {
                "proposed_accept_count": len(self.proposed_accept_candidate_ids),
                "required_defer_count": len(self.required_defer_candidate_ids),
                "supporting_evidence_only_count": len(self.supporting_evidence_candidate_ids),
                "out_of_scope_count": len(self.out_of_scope_candidate_ids),
            },
            "candidate_partitions": {
                "proposed_accept": list(self.proposed_accept_candidate_ids),
                "required_defer": list(self.required_defer_candidate_ids),
                "supporting_evidence_only": list(self.supporting_evidence_candidate_ids),
                "out_of_scope": list(self.out_of_scope_candidate_ids),
            },
            "items": [item.to_dict() for item in self.items],
            "write_boundary": {
                "canonical_curation_write_targets": [],
                "trusted_write_targets": [],
                "publication_write_targets": [],
            },
        }


def build_smithsonian_current_pair_curation_review_plan(
    cohort: SmithsonianCurrentPairCohort,
    *,
    created_at: datetime,
) -> SmithsonianCurationReviewPlan:
    """Build a zero-write curator review plan from the verified cohort."""

    candidate_by_id = {
        candidate.candidate_id: candidate for candidate in cohort.acquisition_bundle.candidates
    }
    fact_by_candidate_id = {fact.intake_candidate_id: fact for fact in cohort.fact_enrichment.facts}
    if len(fact_by_candidate_id) != len(cohort.fact_enrichment.facts):
        raise ValueError("Smithsonian facts must map one-to-one to acquisition candidates")

    proposed_accept_ids = tuple(sorted(fact_by_candidate_id))
    selected_ids = set(cohort.selected_candidate_ids)
    if not set(proposed_accept_ids).issubset(selected_ids):
        raise ValueError("Smithsonian fact candidates escaped the selected cohort")
    supporting_ids = tuple(sorted(selected_ids - set(proposed_accept_ids)))
    required_defer_ids = cohort.deferred_candidate_ids

    all_candidate_ids = set(candidate_by_id)
    partition_ids = (
        set(proposed_accept_ids)
        | set(supporting_ids)
        | set(required_defer_ids)
        | set(cohort.out_of_scope_candidate_ids)
    )
    if partition_ids != all_candidate_ids:
        raise ValueError("Smithsonian curation review plan does not cover the acquisition bundle")

    items: list[SmithsonianCurationReviewItem] = []
    for candidate_id in proposed_accept_ids:
        candidate = candidate_by_id[candidate_id]
        fact = fact_by_candidate_id[candidate_id]
        items.append(
            SmithsonianCurationReviewItem(
                candidate_id=candidate_id,
                subject_slug=_required_subject_slug(candidate),
                candidate_kind=candidate.candidate_kind,
                source_field_path=candidate.field_path,
                normalized_value=candidate.normalized_value,
                conflict_state=candidate.conflict_state,
                recommendation=SmithsonianReviewRecommendation.PROPOSE_ACCEPT,
                reason=(
                    "verified fact passed source, identity, contradiction, evidence, "
                    "and enrichment gates"
                ),
                fact_id=fact.fact_id,
                fact_field_path=fact.field_path,
            )
        )
    for candidate_id in required_defer_ids:
        candidate = candidate_by_id[candidate_id]
        items.append(
            SmithsonianCurationReviewItem(
                candidate_id=candidate_id,
                subject_slug=_required_subject_slug(candidate),
                candidate_kind=candidate.candidate_kind,
                source_field_path=candidate.field_path,
                normalized_value=candidate.normalized_value,
                conflict_state=candidate.conflict_state,
                recommendation=SmithsonianReviewRecommendation.REQUIRED_DEFER,
                reason=_defer_reason(candidate.candidate_kind, candidate.normalized_value),
            )
        )
    for candidate_id in supporting_ids:
        candidate = candidate_by_id[candidate_id]
        items.append(
            SmithsonianCurationReviewItem(
                candidate_id=candidate_id,
                subject_slug=_required_subject_slug(candidate),
                candidate_kind=candidate.candidate_kind,
                source_field_path=candidate.field_path,
                normalized_value=candidate.normalized_value,
                conflict_state=candidate.conflict_state,
                recommendation=(SmithsonianReviewRecommendation.SUPPORTING_EVIDENCE_ONLY),
                reason=(
                    "used as identity-resolution evidence and intentionally omitted as a "
                    "standalone curation mutation"
                ),
            )
        )

    return SmithsonianCurationReviewPlan(
        acquisition_bundle_id=cohort.acquisition_bundle.bundle_id,
        fact_enrichment_batch_id=cohort.fact_enrichment.batch_id,
        selected_slugs=cohort.selected_slugs,
        proposed_accept_candidate_ids=proposed_accept_ids,
        required_defer_candidate_ids=required_defer_ids,
        supporting_evidence_candidate_ids=supporting_ids,
        out_of_scope_candidate_ids=cohort.out_of_scope_candidate_ids,
        items=tuple(sorted(items, key=lambda item: item.candidate_id)),
        created_at=created_at,
    )


def export_smithsonian_current_pair_curation_patch(
    cohort: SmithsonianCurrentPairCohort,
    decision_log: DecisionLog,
    *,
    created_at: datetime,
) -> CurationPatchBundle:
    """Export only explicitly reviewed Smithsonian fact candidates as a patch."""

    plan = build_smithsonian_current_pair_curation_review_plan(
        cohort,
        created_at=created_at,
    )
    validate_decision_log(cohort.acquisition_bundle, decision_log)
    effective = decision_log.effective_decisions()

    required_review_ids = set(plan.proposed_accept_candidate_ids) | set(
        plan.required_defer_candidate_ids
    )
    missing_ids = required_review_ids - set(effective)
    if missing_ids:
        raise ValueError(
            "Smithsonian curation patch requires explicit decisions for all proposed facts "
            "and required-defer candidates"
        )

    accepted_ids = {
        candidate_id
        for candidate_id, decision in effective.items()
        if decision.action is DecisionAction.ACCEPTED
    }
    invalid_accepts = accepted_ids - set(plan.proposed_accept_candidate_ids)
    if invalid_accepts:
        raise ValueError(
            "Smithsonian curation patch cannot accept deferred, supporting, or out-of-scope "
            "candidates"
        )

    incorrect_deferred = tuple(
        candidate_id
        for candidate_id in plan.required_defer_candidate_ids
        if effective[candidate_id].action is not DecisionAction.DEFERRED
    )
    if incorrect_deferred:
        raise ValueError(
            "Smithsonian source omissions and name-only parent relationships must remain deferred"
        )

    patch = export_curation_patch(
        cohort.acquisition_bundle,
        decision_log,
        created_at=created_at,
    )
    proposal_candidate_ids = {proposal.provenance.candidate_id for proposal in patch.proposals}
    if proposal_candidate_ids != accepted_ids:
        raise ValueError("Smithsonian curation patch proposal set drifted from curator decisions")
    if not proposal_candidate_ids.issubset(set(plan.proposed_accept_candidate_ids)):
        raise ValueError("Smithsonian curation patch escaped the verified fact set")
    return patch


def resolve_smithsonian_review_plan_path(value: str | Path) -> Path:
    root = SMITHSONIAN_REVIEW_PLAN_ROOT.resolve()
    requested = Path(value)
    candidate = requested.resolve() if requested.is_absolute() else (root / requested).resolve()
    try:
        candidate.relative_to(root)
    except ValueError as error:
        raise ValueError(f"Smithsonian review plan must stay below {root}") from error
    if candidate.suffix != ".json":
        raise ValueError("Smithsonian review plans must use the .json suffix")
    return candidate


def write_smithsonian_curation_review_plan(
    plan: SmithsonianCurationReviewPlan,
    output: str | Path,
    *,
    overwrite: bool,
) -> Path:
    path = resolve_smithsonian_review_plan_path(output)
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and not overwrite:
        raise FileExistsError(f"Smithsonian review plan already exists: {path}")
    body = json.dumps(plan.to_dict(), ensure_ascii=False, indent=2, allow_nan=False) + "\n"
    temporary = path.with_name(f".{path.name}.{uuid4().hex}.tmp")
    try:
        temporary.write_text(body, encoding="utf-8")
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)
    return path


def _required_subject_slug(candidate: FieldCandidate) -> str:
    slug = candidate.identity_match.matched_canonical_slug
    if slug not in {"bao-li", "qing-bao"}:
        raise ValueError("Smithsonian review item does not resolve to the current-pair cohort")
    return slug


def _defer_reason(candidate_kind: CandidateKind, normalized_value: JsonValue) -> str:
    if candidate_kind is CandidateKind.RELATIONSHIP:
        return "parent name lacks an explicit canonical target panda ID in the source"
    if normalized_value is None:
        return "source omission or unknown value is not a patchable fact"
    return "candidate is outside the reviewed fact-mapping boundary"
