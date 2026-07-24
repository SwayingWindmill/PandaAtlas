from __future__ import annotations

import csv
import json
from collections import Counter, defaultdict
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from hashlib import sha256
from pathlib import Path
from typing import Any

from .contracts import (
    AcquisitionBundle,
    AcquisitionRunState,
    CandidateKind,
    IdentityMatchState,
)
from .contracts.v1 import JsonValue, canonical_json_bytes

SCHEMA_VERSION = "panda-atlas-breadth-first-backfill/v1"
WORK_QUEUE_SCHEMA_VERSION = "panda-atlas-acquisition-work-queue/v1"
_REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
DEFAULT_QUEUE_PATH = (
    _REPOSITORY_ROOT / ".acquisition" / "work-queue" / "panda-acquisition-work-queue.v1.json"
)
DEFAULT_TARGET_ASSESSMENT_PATH = (
    _REPOSITORY_ROOT / "docs" / "data-acquisition" / "source-expansion-targets-2026-07-22.csv"
)
LOCAL_BACKFILL_ROOT = _REPOSITORY_ROOT / ".acquisition" / "backfill-runs"

_EXECUTION_DISPOSITION_MAP = {
    "maintenance-only": "maintenance-only",
    "retire-empty-backlog-row": "retired-empty-target",
    "document-cohort-research": "document-research-required",
    "split-into-official-holder-cohorts": "official-holder-split-required",
    "replace-secondary-with-official": "official-replacement-surface-required",
    "manual-surface-discovery": "manual-source-discovery-required",
    "review-then-adapt": "source-review-and-adapter-required",
    "seek-permission": "permission-required",
    "defer-lower-impact-review": "deferred-lower-impact",
}
_DISPOSITION_RANK = {
    "acquired-candidate-batch": 0,
    "reviewed-source-partial-coverage": 1,
    "source-review-and-adapter-required": 2,
    "existing-official-source-refresh": 3,
    "official-replacement-surface-required": 4,
    "document-research-required": 5,
    "manual-source-discovery-required": 6,
    "permission-required": 7,
    "official-holder-split-required": 8,
    "deferred-lower-impact": 9,
    "maintenance-only": 10,
    "secondary-discovery-only": 11,
    "retired-empty-target": 12,
    "no-active-source-opportunity": 13,
}


@dataclass(frozen=True, slots=True)
class InputSnapshot:
    path: str
    bytes: int
    sha256: str

    def to_dict(self) -> dict[str, JsonValue]:
        return {"path": self.path, "bytes": self.bytes, "sha256": self.sha256}


@dataclass(frozen=True, slots=True)
class TargetAssessment:
    target_id: str
    institution_or_source: str
    backlog_status: str
    execution_disposition: str
    access_class: str
    adapter_family: str
    next_wave: str
    blocker: str
    recommendation: str

    @classmethod
    def from_row(cls, row: Mapping[str, str]) -> TargetAssessment:
        required = (
            "target_id",
            "institution_or_source",
            "backlog_status",
            "execution_disposition",
            "access_class",
            "adapter_family",
            "next_wave",
            "blocker",
            "recommendation",
        )
        missing = [field for field in required if not str(row.get(field) or "").strip()]
        if missing:
            raise ValueError(
                f"target assessment {row.get('target_id')!r} is missing: {', '.join(missing)}"
            )
        disposition = str(row["execution_disposition"]).strip()
        if disposition not in _EXECUTION_DISPOSITION_MAP:
            raise ValueError(f"unsupported target execution disposition: {disposition}")
        return cls(**{field: str(row[field]).strip() for field in required})

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "target_id": self.target_id,
            "institution_or_source": self.institution_or_source,
            "backlog_status": self.backlog_status,
            "execution_disposition": self.execution_disposition,
            "access_class": self.access_class,
            "adapter_family": self.adapter_family,
            "next_wave": self.next_wave,
            "blocker": self.blocker,
            "recommendation": self.recommendation,
        }


@dataclass(frozen=True, slots=True)
class ExistingPandaDisposition:
    panda_slug: str
    panda_name_zh: str | None
    panda_name_en: str
    priority_band: str
    review_status: str
    approved_media_count: int
    disposition: str
    reason: str
    selected_cohort_id: str | None
    selected_target_id: str | None
    related_cohort_ids: tuple[str, ...]
    missing_fields: tuple[str, ...]
    bundle_ids: tuple[str, ...]

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "panda_slug": self.panda_slug,
            "panda_name_zh": self.panda_name_zh,
            "panda_name_en": self.panda_name_en,
            "priority_band": self.priority_band,
            "review_status": self.review_status,
            "approved_media_count": self.approved_media_count,
            "disposition": self.disposition,
            "reason": self.reason,
            "selected_cohort_id": self.selected_cohort_id,
            "selected_target_id": self.selected_target_id,
            "related_cohort_ids": list(self.related_cohort_ids),
            "missing_fields": list(self.missing_fields),
            "bundle_ids": list(self.bundle_ids),
        }


@dataclass(frozen=True, slots=True)
class IdentityDisposition:
    source_id: str
    subject_key: str
    disposition: str
    matched_canonical_slug: str | None
    candidate_count: int
    candidate_kinds: tuple[str, ...]
    conflict_states: tuple[str, ...]
    official_name_zh: str | None
    official_name_en: str | None
    bundle_ids: tuple[str, ...]

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "source_id": self.source_id,
            "subject_key": self.subject_key,
            "disposition": self.disposition,
            "matched_canonical_slug": self.matched_canonical_slug,
            "candidate_count": self.candidate_count,
            "candidate_kinds": list(self.candidate_kinds),
            "conflict_states": list(self.conflict_states),
            "official_name_zh": self.official_name_zh,
            "official_name_en": self.official_name_en,
            "bundle_ids": list(self.bundle_ids),
        }


@dataclass(frozen=True, slots=True)
class BreadthFirstBackfillReport:
    queue_id: str
    generated_at: datetime
    inputs: tuple[InputSnapshot, ...]
    existing_pandas: tuple[ExistingPandaDisposition, ...]
    identities: tuple[IdentityDisposition, ...]
    bundle_summaries: tuple[dict[str, JsonValue], ...]
    schema_version: str = SCHEMA_VERSION

    @property
    def report_id(self) -> str:
        payload: JsonValue = {
            "schema_version": self.schema_version,
            "queue_id": self.queue_id,
            "generated_at": self.generated_at.isoformat(),
            "inputs": [item.to_dict() for item in self.inputs],
            "existing_pandas": [item.to_dict() for item in self.existing_pandas],
            "identities": [item.to_dict() for item in self.identities],
            "bundle_summaries": list(self.bundle_summaries),
        }
        return f"backfill-{sha256(canonical_json_bytes(payload)).hexdigest()}"

    def to_dict(self) -> dict[str, JsonValue]:
        existing_counts = Counter(item.disposition for item in self.existing_pandas)
        identity_counts = Counter(item.disposition for item in self.identities)
        missing_field_counts = Counter(
            field for item in self.existing_pandas for field in item.missing_fields
        )
        return {
            "schema_version": self.schema_version,
            "report_id": self.report_id,
            "queue_id": self.queue_id,
            "generated_at": self.generated_at.isoformat(),
            "inputs": [item.to_dict() for item in self.inputs],
            "summary": {
                "existing_panda_count": len(self.existing_pandas),
                "existing_disposition_counts": dict(sorted(existing_counts.items())),
                "identity_subject_count": len(self.identities),
                "identity_disposition_counts": dict(sorted(identity_counts.items())),
                "missing_field_counts": dict(sorted(missing_field_counts.items())),
                "bundle_count": len(self.bundle_summaries),
                "acquisition_candidate_coverage_count": sum(
                    item.disposition == "acquired-candidate-batch" for item in self.existing_pandas
                ),
                "page_publication_coverage_count": sum(
                    item.review_status == "approved" for item in self.existing_pandas
                ),
                "cleared_photo_coverage_count": sum(
                    item.approved_media_count > 0 for item in self.existing_pandas
                ),
                "cleared_photo_coverage_note": (
                    "Counts existing approved media rows; this acquisition run did not perform "
                    "new media discovery or rights review."
                ),
            },
            "existing_pandas": [item.to_dict() for item in self.existing_pandas],
            "identities": [item.to_dict() for item in self.identities],
            "bundle_summaries": list(self.bundle_summaries),
            "write_boundary": {
                "trusted_write_targets": [],
                "publication_write_targets": [],
            },
        }


def snapshot_input(path: Path) -> InputSnapshot:
    return _snapshot(path, path.read_bytes())


def load_work_queue(path: Path = DEFAULT_QUEUE_PATH) -> tuple[dict[str, Any], InputSnapshot]:
    raw_bytes = path.read_bytes()
    raw = json.loads(raw_bytes)
    if not isinstance(raw, dict) or raw.get("schema_version") != WORK_QUEUE_SCHEMA_VERSION:
        raise ValueError(f"work queue must use {WORK_QUEUE_SCHEMA_VERSION}")
    boundary = raw.get("write_boundary")
    if boundary != {"trusted_write_targets": [], "publication_write_targets": []}:
        raise ValueError("work queue write boundary is not empty")
    records = raw.get("records")
    cohorts = raw.get("cohorts")
    if not isinstance(records, list) or not isinstance(cohorts, list):
        raise ValueError("work queue records and cohorts must be arrays")
    return raw, _snapshot(path, raw_bytes)


def load_target_assessments(
    path: Path = DEFAULT_TARGET_ASSESSMENT_PATH,
) -> tuple[dict[str, TargetAssessment], InputSnapshot]:
    raw_bytes = path.read_bytes()
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        assessments = [TargetAssessment.from_row(row) for row in csv.DictReader(handle)]
    by_id = {item.target_id: item for item in assessments}
    if len(by_id) != len(assessments):
        raise ValueError("target assessment contains duplicate target IDs")
    return by_id, _snapshot(path, raw_bytes)


def build_breadth_first_report(
    *,
    queue: Mapping[str, Any],
    assessments: Mapping[str, TargetAssessment],
    bundles: Sequence[AcquisitionBundle],
    generated_at: datetime,
    inputs: Sequence[InputSnapshot] = (),
) -> BreadthFirstBackfillReport:
    if generated_at.tzinfo is None or generated_at.utcoffset() is None:
        raise ValueError("generated_at must include a timezone")
    queue_id = str(queue.get("queue_id") or "").strip()
    if not queue_id.startswith("queue-"):
        raise ValueError("work queue has no valid queue ID")
    summary = queue.get("summary")
    if not isinstance(summary, dict) or not isinstance(summary.get("panda_count"), int):
        raise ValueError("work queue summary is invalid")

    completed_bundles = tuple(_validated_completed_bundles(bundles))
    bundle_coverage = _bundle_coverage(completed_bundles)
    cohorts = _cohort_index(queue)
    records_by_panda = _records_by_panda(queue)
    existing = tuple(
        _existing_disposition(
            slug,
            records,
            cohorts=cohorts,
            assessments=assessments,
            bundle_coverage=bundle_coverage,
        )
        for slug, records in sorted(records_by_panda.items())
    )
    if len(existing) != summary["panda_count"]:
        raise ValueError(
            "breadth-first dispositions do not cover every work-queue panda: "
            f"expected {summary['panda_count']}, found {len(existing)}"
        )
    identities = _identity_dispositions(completed_bundles)
    bundle_summaries = tuple(_bundle_summary(bundle) for bundle in completed_bundles)
    return BreadthFirstBackfillReport(
        queue_id=queue_id,
        generated_at=generated_at,
        inputs=tuple(inputs),
        existing_pandas=existing,
        identities=identities,
        bundle_summaries=bundle_summaries,
    )


def write_backfill_report(
    report: BreadthFirstBackfillReport,
    output: str | Path | None = None,
    *,
    overwrite: bool = False,
) -> Path:
    target = _resolve_output_path(output or f"{report.report_id}.json")
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and not overwrite:
        raise FileExistsError(target)
    rendered = json.dumps(report.to_dict(), ensure_ascii=False, indent=2, allow_nan=False) + "\n"
    target.write_text(rendered, encoding="utf-8", newline="")
    return target


def _existing_disposition(
    slug: str,
    records: Sequence[Mapping[str, Any]],
    *,
    cohorts: Mapping[str, Mapping[str, Any]],
    assessments: Mapping[str, TargetAssessment],
    bundle_coverage: Mapping[str, tuple[str, ...]],
) -> ExistingPandaDisposition:
    first = records[0]
    priority_bands = {str(item.get("priority_band") or "") for item in records}
    if len(priority_bands) != 1:
        raise ValueError(f"panda {slug} has inconsistent priority bands")
    review_statuses = {str(item.get("review_status") or "") for item in records}
    if len(review_statuses) != 1:
        raise ValueError(f"panda {slug} has inconsistent review statuses")
    approved_media_counts = {item.get("approved_media_count") for item in records}
    if len(approved_media_counts) != 1 or not all(
        isinstance(item, int) and item >= 0 for item in approved_media_counts
    ):
        raise ValueError(f"panda {slug} has inconsistent approved media counts")
    review_status = next(iter(review_statuses))
    approved_media_count = next(iter(approved_media_counts))
    assert isinstance(approved_media_count, int)
    missing_fields = tuple(
        sorted(
            {
                str(field)
                for record in records
                for field in _required_string_array(record, "missing_fields")
            }
        )
    )
    cohort_ids = tuple(sorted({str(item.get("cohort_id") or "") for item in records}))
    bundle_ids = bundle_coverage.get(slug, ())
    if bundle_ids:
        return ExistingPandaDisposition(
            panda_slug=slug,
            panda_name_zh=_optional_text(first.get("panda_name_zh")),
            panda_name_en=_required_text(first, "panda_name_en"),
            priority_band=next(iter(priority_bands)),
            review_status=review_status,
            approved_media_count=approved_media_count,
            disposition="acquired-candidate-batch",
            reason=(
                "At least one completed acquisition bundle produced candidates matched "
                "to this panda."
            ),
            selected_cohort_id=None,
            selected_target_id=None,
            related_cohort_ids=cohort_ids,
            missing_fields=missing_fields,
            bundle_ids=bundle_ids,
        )

    choices = [
        _cohort_disposition(cohorts[cohort_id], assessments)
        for cohort_id in cohort_ids
        if cohort_id in cohorts
    ]
    if not choices:
        choices = [
            (
                "no-active-source-opportunity",
                "The work queue contains no usable source cohort for this panda.",
                None,
                None,
            )
        ]
    choices.sort(key=lambda item: (_DISPOSITION_RANK[item[0]], item[2] or "", item[3] or ""))
    disposition, reason, cohort_id, target_id = choices[0]
    if next(iter(priority_bands)) == "approved-maintenance" and disposition not in {
        "source-review-and-adapter-required",
        "reviewed-source-partial-coverage",
    }:
        disposition = "maintenance-only"
        reason = (
            "The panda is already approved; future acquisition is maintenance rather than backfill."
        )
    return ExistingPandaDisposition(
        panda_slug=slug,
        panda_name_zh=_optional_text(first.get("panda_name_zh")),
        panda_name_en=_required_text(first, "panda_name_en"),
        priority_band=next(iter(priority_bands)),
        review_status=review_status,
        approved_media_count=approved_media_count,
        disposition=disposition,
        reason=reason,
        selected_cohort_id=cohort_id,
        selected_target_id=target_id,
        related_cohort_ids=cohort_ids,
        missing_fields=missing_fields,
        bundle_ids=(),
    )


def _cohort_disposition(
    cohort: Mapping[str, Any],
    assessments: Mapping[str, TargetAssessment],
) -> tuple[str, str, str | None, str | None]:
    cohort_id = _required_text(cohort, "cohort_id")
    kind = _required_text(cohort, "cohort_kind")
    if kind == "backlog-target":
        target_id = _optional_text(cohort.get("backlog_target_id"))
        if target_id is None:
            raise ValueError(f"backlog cohort {cohort_id} has no target ID")
        assessment = assessments.get(target_id)
        if assessment is None:
            raise ValueError(f"backlog target {target_id} has no execution assessment")
        if target_id == "target_chengdu_base":
            return (
                "reviewed-source-partial-coverage",
                "The first reviewed Chengdu page family is live, but this panda was not "
                "named on the current exact-page batch; additional exact official pages "
                "are required.",
                cohort_id,
                target_id,
            )
        disposition = _EXECUTION_DISPOSITION_MAP[assessment.execution_disposition]
        return (
            disposition,
            assessment.blocker or assessment.recommendation,
            cohort_id,
            target_id,
        )
    if kind == "official-source-domain":
        return (
            "existing-official-source-refresh",
            "The queue associates this panda with an existing official source domain "
            "that requires a bounded refresh adapter or maintenance run.",
            cohort_id,
            None,
        )
    if kind == "discovery-source-domain":
        return (
            "secondary-discovery-only",
            "This cohort is a discovery index and must be split into official holder "
            "evidence before fact publication.",
            cohort_id,
            None,
        )
    raise ValueError(f"unsupported cohort kind: {kind}")


def _identity_dispositions(
    bundles: Sequence[AcquisitionBundle],
) -> tuple[IdentityDisposition, ...]:
    grouped: dict[tuple[str, str], list[tuple[str, Any]]] = defaultdict(list)
    for bundle in bundles:
        for candidate in bundle.candidates:
            grouped[(candidate.source_id, candidate.subject_key)].append(
                (bundle.bundle_id, candidate)
            )
    results: list[IdentityDisposition] = []
    for (source_id, subject_key), entries in sorted(grouped.items()):
        candidates = [candidate for _, candidate in entries]
        states = {candidate.identity_match.state for candidate in candidates}
        matched_slugs = {
            candidate.identity_match.matched_canonical_slug
            for candidate in candidates
            if candidate.identity_match.matched_canonical_slug
        }
        if states == {IdentityMatchState.MATCHED} and len(matched_slugs) == 1:
            disposition = "merge"
            matched_slug = next(iter(matched_slugs))
        elif IdentityMatchState.AMBIGUOUS in states or len(matched_slugs) > 1:
            disposition = "unresolved"
            matched_slug = None
        elif states == {IdentityMatchState.UNMATCHED}:
            matched_slug = None
            zh = _name_value(candidates, "identity.names.official.zh")
            en = _name_value(candidates, "identity.names.official.en")
            disposition = "create" if zh and en else "unresolved"
        else:
            disposition = "unresolved"
            matched_slug = None
        results.append(
            IdentityDisposition(
                source_id=source_id,
                subject_key=subject_key,
                disposition=disposition,
                matched_canonical_slug=matched_slug,
                candidate_count=len(candidates),
                candidate_kinds=tuple(
                    sorted({candidate.candidate_kind.value for candidate in candidates})
                ),
                conflict_states=tuple(
                    sorted({candidate.conflict_state.value for candidate in candidates})
                ),
                official_name_zh=_name_value(candidates, "identity.names.official.zh"),
                official_name_en=_name_value(candidates, "identity.names.official.en"),
                bundle_ids=tuple(sorted({bundle_id for bundle_id, _ in entries})),
            )
        )
    return tuple(results)


def _bundle_coverage(
    bundles: Sequence[AcquisitionBundle],
) -> dict[str, tuple[str, ...]]:
    coverage: dict[str, set[str]] = defaultdict(set)
    for bundle in bundles:
        for candidate in bundle.candidates:
            slug = candidate.identity_match.matched_canonical_slug
            if slug:
                coverage[slug].add(bundle.bundle_id)
    return {slug: tuple(sorted(bundle_ids)) for slug, bundle_ids in coverage.items()}


def _bundle_summary(bundle: AcquisitionBundle) -> dict[str, JsonValue]:
    return {
        "bundle_id": bundle.bundle_id,
        "run_id": bundle.run.run_id,
        "source_id": bundle.run.source_id,
        "adapter_id": bundle.run.adapter_id,
        "mode": bundle.run.mode.value,
        "state": bundle.run.state.value,
        "evidence_snapshot_count": len(bundle.evidence_snapshots),
        "candidate_count": len(bundle.candidates),
        "candidate_kind_counts": dict(
            sorted(Counter(item.candidate_kind.value for item in bundle.candidates).items())
        ),
        "conflict_state_counts": dict(
            sorted(Counter(item.conflict_state.value for item in bundle.candidates).items())
        ),
        "matched_panda_count": len(
            {
                item.identity_match.matched_canonical_slug
                for item in bundle.candidates
                if item.identity_match.matched_canonical_slug
            }
        ),
        "unmatched_subject_count": len(
            {
                item.subject_key
                for item in bundle.candidates
                if item.identity_match.state is IdentityMatchState.UNMATCHED
            }
        ),
    }


def _validated_completed_bundles(
    bundles: Iterable[AcquisitionBundle],
) -> Iterable[AcquisitionBundle]:
    seen: set[str] = set()
    for bundle in bundles:
        if bundle.bundle_id in seen:
            raise ValueError(f"duplicate acquisition bundle: {bundle.bundle_id}")
        seen.add(bundle.bundle_id)
        if bundle.run.state is not AcquisitionRunState.COMPLETED:
            raise ValueError(
                f"backfill report cannot include non-completed bundle {bundle.bundle_id}"
            )
        yield bundle


def _cohort_index(queue: Mapping[str, Any]) -> dict[str, Mapping[str, Any]]:
    cohorts = queue.get("cohorts")
    if not isinstance(cohorts, list):
        raise ValueError("work queue cohorts must be an array")
    by_id: dict[str, Mapping[str, Any]] = {}
    for raw in cohorts:
        if not isinstance(raw, dict):
            raise ValueError("work queue cohort must be an object")
        cohort_id = _required_text(raw, "cohort_id")
        if cohort_id in by_id:
            raise ValueError(f"duplicate work queue cohort: {cohort_id}")
        by_id[cohort_id] = raw
    return by_id


def _records_by_panda(
    queue: Mapping[str, Any],
) -> dict[str, tuple[Mapping[str, Any], ...]]:
    records = queue.get("records")
    if not isinstance(records, list):
        raise ValueError("work queue records must be an array")
    grouped: dict[str, list[Mapping[str, Any]]] = defaultdict(list)
    for raw in records:
        if not isinstance(raw, dict):
            raise ValueError("work queue record must be an object")
        grouped[_required_text(raw, "panda_slug")].append(raw)
    return {
        slug: tuple(sorted(items, key=lambda item: _required_text(item, "record_id")))
        for slug, items in grouped.items()
    }


def _name_value(candidates: Sequence[Any], field_path: str) -> str | None:
    values = {
        str(candidate.normalized_value).strip()
        for candidate in candidates
        if candidate.candidate_kind is CandidateKind.IDENTITY
        and candidate.field_path == field_path
        and isinstance(candidate.normalized_value, str)
        and candidate.normalized_value.strip()
    }
    return next(iter(values)) if len(values) == 1 else None


def _required_text(value: Mapping[str, Any], field: str) -> str:
    item = value.get(field)
    if not isinstance(item, str) or not item.strip():
        raise ValueError(f"required text field is missing: {field}")
    return item.strip()


def _optional_text(value: Any) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _required_string_array(value: Mapping[str, Any], field: str) -> tuple[str, ...]:
    items = value.get(field)
    if not isinstance(items, list) or any(
        not isinstance(item, str) or not item.strip() for item in items
    ):
        raise ValueError(f"required string array is invalid: {field}")
    return tuple(item.strip() for item in items)


def _snapshot(path: Path, raw_bytes: bytes) -> InputSnapshot:
    try:
        relative = path.resolve().relative_to(_REPOSITORY_ROOT.resolve())
        label = relative.as_posix()
    except ValueError:
        label = str(path.resolve())
    return InputSnapshot(path=label, bytes=len(raw_bytes), sha256=sha256(raw_bytes).hexdigest())


def _resolve_output_path(value: str | Path) -> Path:
    candidate = Path(value)
    if not candidate.is_absolute():
        candidate = LOCAL_BACKFILL_ROOT / candidate
    resolved = candidate.resolve()
    try:
        resolved.relative_to(LOCAL_BACKFILL_ROOT.resolve())
    except ValueError as error:
        raise ValueError(
            "backfill report output must stay below .acquisition/backfill-runs"
        ) from error
    if resolved.suffix.lower() != ".json":
        raise ValueError("backfill report output must use .json")
    return resolved


__all__ = [
    "DEFAULT_QUEUE_PATH",
    "DEFAULT_TARGET_ASSESSMENT_PATH",
    "LOCAL_BACKFILL_ROOT",
    "SCHEMA_VERSION",
    "BreadthFirstBackfillReport",
    "ExistingPandaDisposition",
    "IdentityDisposition",
    "InputSnapshot",
    "TargetAssessment",
    "build_breadth_first_report",
    "load_target_assessments",
    "load_work_queue",
    "snapshot_input",
    "write_backfill_report",
]
