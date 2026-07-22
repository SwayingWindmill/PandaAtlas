from __future__ import annotations

import json
from collections.abc import Mapping
from datetime import date, datetime
from pathlib import Path
from uuid import uuid4

from ..contracts import (
    SCHEMA_VERSION as ACQUISITION_SCHEMA_VERSION,
)
from ..contracts import (
    AcquisitionBundle,
    AcquisitionCapability,
    AcquisitionMode,
    AcquisitionRun,
    AcquisitionRunState,
    CandidateKind,
    CandidateReviewState,
    ConflictState,
    CurrentTrustedValue,
    EvidenceBlockState,
    EvidenceSnapshot,
    FieldCandidate,
    IdentityMatchState,
    PandaIdentityMatch,
    SourceLocator,
    SourceLocatorKind,
)
from ..contracts.v1 import JsonValue
from .models import (
    DECISION_SCHEMA_VERSION,
    CurationPatchBundle,
    CuratorDecision,
    DecisionAction,
    DecisionLog,
)

_REPOSITORY_ROOT = Path(__file__).resolve().parents[5]
ACQUISITION_BUNDLE_ROOT = _REPOSITORY_ROOT / ".acquisition" / "bundles"
DECISION_ROOT = _REPOSITORY_ROOT / ".acquisition" / "decisions"
PATCH_ROOT = _REPOSITORY_ROOT / ".acquisition" / "curation-patches"


def resolve_acquisition_bundle_path(value: str | Path) -> Path:
    return _resolve_json_path(ACQUISITION_BUNDLE_ROOT, value)


def resolve_decision_path(value: str | Path) -> Path:
    return _resolve_json_path(DECISION_ROOT, value)


def resolve_patch_path(value: str | Path) -> Path:
    return _resolve_json_path(PATCH_ROOT, value)


def load_acquisition_bundle(value: str | Path) -> AcquisitionBundle:
    path = resolve_acquisition_bundle_path(value)
    raw = _load_json_object(path)
    if _required_text(raw, "schema_version") != ACQUISITION_SCHEMA_VERSION:
        raise ValueError(f"acquisition bundle must use {ACQUISITION_SCHEMA_VERSION}")
    _require_empty_write_boundary(raw)

    run_raw = _required_object(raw, "run")
    run = AcquisitionRun(
        run_id=_required_text(run_raw, "run_id"),
        source_id=_required_text(run_raw, "source_id"),
        adapter_id=_required_text(run_raw, "adapter_id"),
        adapter_version=_required_text(run_raw, "adapter_version"),
        parser_name=_required_text(run_raw, "parser_name"),
        parser_version=_required_text(run_raw, "parser_version"),
        mode=AcquisitionMode(_required_text(run_raw, "mode")),
        state=AcquisitionRunState(_required_text(run_raw, "state")),
        started_at=_required_datetime(run_raw, "started_at"),
        completed_at=_optional_datetime(run_raw, "completed_at"),
        cohort=_optional_text(run_raw, "cohort"),
        source_reviewed_at=_optional_date(run_raw, "source_reviewed_at"),
        source_review_expires_at=_optional_date(run_raw, "source_review_expires_at"),
        notes=_text_tuple(run_raw, "notes"),
    )

    snapshots: list[EvidenceSnapshot] = []
    for index, item in enumerate(_required_array(raw, "evidence_snapshots")):
        snapshot_raw = _as_object(item, f"evidence_snapshots[{index}]")
        snapshot = EvidenceSnapshot(
            source_id=_required_text(snapshot_raw, "source_id"),
            requested_url=_required_text(snapshot_raw, "requested_url"),
            final_url=_required_text(snapshot_raw, "final_url"),
            captured_at=_required_datetime(snapshot_raw, "captured_at"),
            status=_required_int(snapshot_raw, "status"),
            headers=_string_mapping(snapshot_raw, "headers"),
            body_bytes=_required_int(snapshot_raw, "body_bytes"),
            body_sha256=_required_text(snapshot_raw, "body_sha256"),
            block_state=EvidenceBlockState(_required_text(snapshot_raw, "block_state")),
            capability=AcquisitionCapability(_required_text(snapshot_raw, "capability")),
            content_type=_optional_text(snapshot_raw, "content_type"),
            notes=_text_tuple(snapshot_raw, "notes"),
        )
        if _required_text(snapshot_raw, "evidence_snapshot_id") != snapshot.snapshot_id:
            raise ValueError(f"evidence snapshot identity mismatch at index {index}")
        snapshots.append(snapshot)

    candidates: list[FieldCandidate] = []
    for index, item in enumerate(_required_array(raw, "candidates")):
        candidate_raw = _as_object(item, f"candidates[{index}]")
        locator_raw = _required_object(candidate_raw, "source_locator")
        identity_raw = _required_object(candidate_raw, "identity_match")
        current_raw = _required_object(candidate_raw, "current_trusted_value")
        candidate = FieldCandidate(
            source_id=_required_text(candidate_raw, "source_id"),
            evidence_snapshot_id=_required_text(candidate_raw, "evidence_snapshot_id"),
            evidence_body_sha256=_required_text(candidate_raw, "evidence_body_sha256"),
            candidate_kind=CandidateKind(_required_text(candidate_raw, "candidate_kind")),
            subject_key=_required_text(candidate_raw, "subject_key"),
            field_path=_required_text(candidate_raw, "field_path"),
            source_locator=SourceLocator(
                kind=SourceLocatorKind(_required_text(locator_raw, "kind")),
                value=_required_text(locator_raw, "value"),
                attribute=_optional_text(locator_raw, "attribute"),
                occurrence=_optional_int(locator_raw, "occurrence"),
            ),
            raw_value=_json_value(candidate_raw, "raw_value"),
            normalized_value=_json_value(candidate_raw, "normalized_value"),
            identity_match=PandaIdentityMatch(
                state=IdentityMatchState(_required_text(identity_raw, "state")),
                source_identity=_required_text(identity_raw, "source_identity"),
                matched_panda_id=_optional_text(identity_raw, "matched_panda_id"),
                matched_canonical_slug=_optional_text(identity_raw, "matched_canonical_slug"),
                candidate_panda_ids=_text_tuple(identity_raw, "candidate_panda_ids"),
                notes=_text_tuple(identity_raw, "notes"),
            ),
            current_trusted_value=CurrentTrustedValue(
                present=_required_bool(current_raw, "present"),
                value=_json_value(current_raw, "value"),
                assertion_ids=_text_tuple(current_raw, "assertion_ids"),
            ),
            parser_name=_required_text(candidate_raw, "parser_name"),
            parser_version=_required_text(candidate_raw, "parser_version"),
            conflict_state=ConflictState(_required_text(candidate_raw, "conflict_state")),
            review_state=CandidateReviewState(_required_text(candidate_raw, "review_state")),
            notes=_text_tuple(candidate_raw, "notes"),
        )
        if _required_text(candidate_raw, "candidate_id") != candidate.candidate_id:
            raise ValueError(f"candidate identity mismatch at index {index}")
        if _required_text(candidate_raw, "deduplication_key") != candidate.deduplication_key:
            raise ValueError(f"candidate deduplication identity mismatch at index {index}")
        candidates.append(candidate)

    bundle = AcquisitionBundle(
        run=run,
        evidence_snapshots=tuple(snapshots),
        candidates=tuple(candidates),
        created_at=_required_datetime(raw, "created_at"),
    )
    if _required_text(raw, "bundle_id") != bundle.bundle_id:
        raise ValueError("acquisition bundle identity does not match its contents")
    return bundle


def load_decision_log(value: str | Path) -> DecisionLog:
    path = resolve_decision_path(value)
    raw = _load_json_object(path)
    if _required_text(raw, "schema_version") != DECISION_SCHEMA_VERSION:
        raise ValueError(f"decision log must use {DECISION_SCHEMA_VERSION}")
    _require_empty_write_boundary(raw, require_canonical=True)

    decisions: list[CuratorDecision] = []
    for index, item in enumerate(_required_array(raw, "decisions")):
        decision_raw = _as_object(item, f"decisions[{index}]")
        decision = CuratorDecision(
            candidate_id=_required_text(decision_raw, "candidate_id"),
            evidence_snapshot_id=_required_text(decision_raw, "evidence_snapshot_id"),
            reviewer=_required_text(decision_raw, "reviewer"),
            decided_at=_required_datetime(decision_raw, "decided_at"),
            action=DecisionAction(_required_text(decision_raw, "action")),
            note=_optional_text(decision_raw, "note"),
        )
        if _required_text(decision_raw, "decision_id") != decision.decision_id:
            raise ValueError(f"decision identity mismatch at index {index}")
        decisions.append(decision)

    log = DecisionLog(
        acquisition_bundle_id=_required_text(raw, "acquisition_bundle_id"),
        created_at=_required_datetime(raw, "created_at"),
        updated_at=_required_datetime(raw, "updated_at"),
        decisions=tuple(decisions),
    )
    if _required_text(raw, "decision_log_id") != log.decision_log_id:
        raise ValueError("decision log identity does not match its contents")
    return log


def write_decision_log(
    log: DecisionLog,
    output: str | Path,
    *,
    overwrite: bool,
) -> Path:
    path = resolve_decision_path(output)
    if path.exists() and overwrite:
        existing = load_decision_log(path)
        if existing.acquisition_bundle_id != log.acquisition_bundle_id:
            raise ValueError("decision log cannot switch acquisition bundles")
        if existing.created_at != log.created_at:
            raise ValueError("decision log created_at cannot change")
        if log.updated_at < existing.updated_at:
            raise ValueError("decision log updated_at cannot move backwards")
        if len(log.decisions) < len(existing.decisions) or (
            log.decisions[: len(existing.decisions)] != existing.decisions
        ):
            raise ValueError("decision log history must remain an append-only prefix")
    return _write_json(path, log.to_dict(), overwrite=overwrite)


def write_curation_patch(
    patch: CurationPatchBundle,
    output: str | Path,
    *,
    overwrite: bool,
) -> Path:
    path = resolve_patch_path(output)
    return _write_json(path, patch.to_dict(), overwrite=overwrite)


def _resolve_json_path(root_path: Path, value: str | Path) -> Path:
    root = root_path.resolve()
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
        raise ValueError(f"JSON file must stay below the local root {root}") from error
    if candidate.suffix != ".json":
        raise ValueError("curation workflow files must use the .json suffix")
    return candidate


def _write_json(path: Path, payload: dict[str, JsonValue], *, overwrite: bool) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and not overwrite:
        raise FileExistsError(f"curation workflow file already exists: {path}")
    body = json.dumps(payload, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
    temporary = path.with_name(f".{path.name}.{uuid4().hex}.tmp")
    try:
        temporary.write_text(body, encoding="utf-8")
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)
    return path


def _load_json_object(path: Path) -> dict[str, object]:
    if not path.exists():
        raise FileNotFoundError(path)
    raw = json.loads(path.read_text(encoding="utf-8"))
    return _as_object(raw, str(path))


def _require_empty_write_boundary(
    raw: Mapping[str, object],
    *,
    require_canonical: bool = False,
) -> None:
    boundary = _required_object(raw, "write_boundary")
    keys = ["trusted_write_targets", "publication_write_targets"]
    if require_canonical:
        keys.insert(0, "canonical_curation_write_targets")
    for key in keys:
        if key not in boundary:
            raise ValueError(f"write_boundary.{key} is required")
        if _required_array(boundary, key):
            raise ValueError(f"write_boundary.{key} must be empty")


def _as_object(value: object, label: str) -> dict[str, object]:
    if not isinstance(value, dict) or not all(isinstance(key, str) for key in value):
        raise ValueError(f"{label} must be a JSON object")
    return value


def _required_object(raw: Mapping[str, object], key: str) -> dict[str, object]:
    if key not in raw:
        raise ValueError(f"missing required object {key}")
    return _as_object(raw[key], key)


def _required_array(raw: Mapping[str, object], key: str) -> list[object]:
    value = raw.get(key)
    if not isinstance(value, list):
        raise ValueError(f"{key} must be a JSON array")
    return value


def _required_text(raw: Mapping[str, object], key: str) -> str:
    value = raw.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{key} must be a non-empty string")
    return value


def _optional_text(raw: Mapping[str, object], key: str) -> str | None:
    value = raw.get(key)
    if value is None:
        return None
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{key} must be null or a non-empty string")
    return value


def _required_int(raw: Mapping[str, object], key: str) -> int:
    value = raw.get(key)
    if not isinstance(value, int) or isinstance(value, bool):
        raise ValueError(f"{key} must be an integer")
    return value


def _optional_int(raw: Mapping[str, object], key: str) -> int | None:
    value = raw.get(key)
    if value is None:
        return None
    if not isinstance(value, int) or isinstance(value, bool):
        raise ValueError(f"{key} must be null or an integer")
    return value


def _required_bool(raw: Mapping[str, object], key: str) -> bool:
    value = raw.get(key)
    if not isinstance(value, bool):
        raise ValueError(f"{key} must be a boolean")
    return value


def _required_datetime(raw: Mapping[str, object], key: str) -> datetime:
    value = _required_text(raw, key)
    return _parse_datetime(value, key)


def _optional_datetime(raw: Mapping[str, object], key: str) -> datetime | None:
    value = _optional_text(raw, key)
    return _parse_datetime(value, key) if value is not None else None


def _parse_datetime(value: str, label: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError(f"{label} must be an ISO 8601 datetime") from error
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ValueError(f"{label} must include a timezone")
    return parsed


def _optional_date(raw: Mapping[str, object], key: str) -> date | None:
    value = _optional_text(raw, key)
    if value is None:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError as error:
        raise ValueError(f"{key} must be an ISO 8601 date") from error


def _text_tuple(raw: Mapping[str, object], key: str) -> tuple[str, ...]:
    values = _required_array(raw, key)
    if not all(isinstance(value, str) for value in values):
        raise ValueError(f"{key} must contain only strings")
    return tuple(values)


def _string_mapping(raw: Mapping[str, object], key: str) -> dict[str, str]:
    value = _required_object(raw, key)
    if not all(isinstance(item, str) for item in value.values()):
        raise ValueError(f"{key} must map strings to strings")
    return {name: item for name, item in value.items() if isinstance(item, str)}


def _json_value(raw: Mapping[str, object], key: str) -> JsonValue:
    if key not in raw:
        raise ValueError(f"missing required JSON value {key}")
    value = raw[key]
    try:
        json.dumps(value, ensure_ascii=False, allow_nan=False, sort_keys=True)
    except (TypeError, ValueError) as error:
        raise ValueError(f"{key} must be a finite JSON value") from error
    return value  # type: ignore[return-value]
