from __future__ import annotations

import csv
import importlib.util
import os
import shutil
import tempfile
from collections import defaultdict
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import datetime
from hashlib import sha256
from pathlib import Path
from types import ModuleType
from typing import cast
from uuid import uuid4

from app.acquisition.contracts import canonical_json_bytes
from app.acquisition.contracts.v1 import JsonValue
from app.acquisition.curation import (
    CurationPatchBundle,
    CurationPatchProposal,
    IntakeKind,
    PatchSourceEvidence,
)

_REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
_VALIDATOR_PATH = _REPOSITORY_ROOT / "scripts" / "curation" / "validate_panda_curation.py"
_ALLOWED_SOURCE_URLS = {
    "https://nationalzoo.si.edu/animals/giant-panda",
    "https://nationalzoo.si.edu/animals/giant-panda-faqs",
    "https://nationalzoo.si.edu/animals/history-giant-pandas-zoo",
}
_EXPECTED_PROPOSAL_COUNTS = {"event": 4, "panda": 10, "residency": 2}
_TARGET_SLUGS = ("bao-li", "qing-bao")
_REQUIRED_CSV_FILES = ("events.csv", "media.csv", "pandas.csv", "sources.csv")

Validator = Callable[[Path], tuple[list[str], dict[str, int]]]


@dataclass(frozen=True, slots=True)
class SmithsonianCurationCsvApplicationResult:
    patch_id: str
    applied: bool
    applied_at: datetime
    proposal_count: int
    panda_row_updates: int
    event_insertions: int
    source_row_updates: int
    changed_files: tuple[str, ...]
    before_sha256: dict[str, str]
    after_sha256: dict[str, str]
    validation_counts: dict[str, int]
    publication_blockers: dict[str, tuple[str, ...]]

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "patch_id": self.patch_id,
            "applied": self.applied,
            "applied_at": self.applied_at.isoformat(),
            "proposal_count": self.proposal_count,
            "panda_row_updates": self.panda_row_updates,
            "event_insertions": self.event_insertions,
            "source_row_updates": self.source_row_updates,
            "changed_files": list(self.changed_files),
            "before_sha256": self.before_sha256,
            "after_sha256": self.after_sha256,
            "validation_counts": self.validation_counts,
            "publication_blockers": {
                slug: list(reasons) for slug, reasons in self.publication_blockers.items()
            },
        }


def apply_smithsonian_current_pair_curation_patch_to_csv(
    patch: CurationPatchBundle,
    *,
    curation_dir: Path,
    applied_at: datetime,
    apply: bool = False,
    validator: Validator | None = None,
) -> SmithsonianCurationCsvApplicationResult:
    """Validate and optionally apply the reviewed current-pair patch to curation CSVs."""

    _validate_application_request(patch, curation_dir=curation_dir, applied_at=applied_at)
    before_sha256 = _csv_hashes(curation_dir)
    selected_validator = validator or _load_repository_validator()

    with tempfile.TemporaryDirectory(
        prefix=".smithsonian-curation-stage-",
        dir=curation_dir.parent,
    ) as temporary_root:
        stage_dir = Path(temporary_root) / curation_dir.name
        shutil.copytree(curation_dir, stage_dir)
        application_counts = _apply_patch_to_stage(patch, stage_dir)
        errors, validation_counts = selected_validator(stage_dir)
        if errors:
            raise ValueError("staged Smithsonian curation failed validation: " + "; ".join(errors))
        after_sha256 = _csv_hashes(stage_dir)
        changed_files = tuple(
            sorted(
                name for name, digest in after_sha256.items() if before_sha256.get(name) != digest
            )
        )
        blockers = _publication_blockers(stage_dir)
        if apply:
            _commit_directory_swap(
                curation_dir=curation_dir,
                stage_dir=stage_dir,
                expected_sha256=before_sha256,
            )

    return SmithsonianCurationCsvApplicationResult(
        patch_id=patch.patch_id,
        applied=apply,
        applied_at=applied_at,
        proposal_count=len(patch.proposals),
        panda_row_updates=application_counts["pandas"],
        event_insertions=application_counts["events"],
        source_row_updates=application_counts["sources"],
        changed_files=changed_files,
        before_sha256=before_sha256,
        after_sha256=after_sha256,
        validation_counts=validation_counts,
        publication_blockers=blockers,
    )


def _validate_application_request(
    patch: CurationPatchBundle,
    *,
    curation_dir: Path,
    applied_at: datetime,
) -> None:
    if applied_at.tzinfo is None or applied_at.utcoffset() is None:
        raise ValueError("applied_at must include a timezone")
    if patch.source_reviewed_at > applied_at.date():
        raise ValueError("Smithsonian patch application cannot precede source review")
    if patch.source_review_expires_at < applied_at.date():
        raise ValueError(
            f"Smithsonian source review expired on {patch.source_review_expires_at.isoformat()}"
        )
    if patch.proposal_counts() != _EXPECTED_PROPOSAL_COUNTS:
        raise ValueError("Smithsonian curation patch proposal counts drifted")
    if {proposal.subject.identity_key for proposal in patch.proposals} != set(_TARGET_SLUGS):
        raise ValueError("Smithsonian curation patch subject scope drifted")
    if {source.final_url for source in patch.sources} != _ALLOWED_SOURCE_URLS:
        raise ValueError("Smithsonian curation patch source URL scope drifted")
    if curation_dir.is_symlink() or not curation_dir.is_dir():
        raise ValueError("curation_dir must be an existing non-symlink directory")
    missing = [name for name in _REQUIRED_CSV_FILES if not (curation_dir / name).is_file()]
    if missing:
        raise ValueError("curation_dir is missing required CSV files: " + ", ".join(missing))


def _apply_patch_to_stage(
    patch: CurationPatchBundle,
    stage_dir: Path,
) -> dict[str, int]:
    panda_fields, pandas_rows = _read_csv(stage_dir / "pandas.csv")
    event_fields, event_rows = _read_csv(stage_dir / "events.csv")
    source_fields, source_rows = _read_csv(stage_dir / "sources.csv")
    panda_by_slug = {row["slug"]: row for row in pandas_rows}
    source_by_url = {row["url"]: row for row in source_rows}
    source_by_snapshot = {source.evidence_snapshot_id: source for source in patch.sources}
    original_events_by_slug = _events_by_slug(event_rows)

    proposal_sources: dict[str, set[str]] = defaultdict(set)
    for proposal in patch.proposals:
        source = source_by_snapshot[proposal.provenance.evidence_snapshot_id]
        source_row = source_by_url.get(source.final_url)
        if source_row is None:
            raise ValueError(f"curation sources.csv lacks reviewed URL {source.final_url}")
        proposal_sources[proposal.subject.identity_key].add(source_row["source_id"])

    source_updates = _refresh_source_access_dates(
        patch,
        source_by_snapshot=source_by_snapshot,
        source_by_url=source_by_url,
    )
    panda_updates = _apply_panda_and_residency_proposals(
        patch.proposals,
        panda_by_slug=panda_by_slug,
        proposal_sources=proposal_sources,
    )
    event_insertions = _apply_event_proposals(
        patch,
        event_rows=event_rows,
        original_events_by_slug=original_events_by_slug,
        source_by_snapshot=source_by_snapshot,
        source_by_url=source_by_url,
    )

    _write_csv(stage_dir / "pandas.csv", panda_fields, pandas_rows)
    _write_csv(stage_dir / "events.csv", event_fields, event_rows)
    _write_csv(stage_dir / "sources.csv", source_fields, source_rows)
    return {
        "pandas": panda_updates,
        "events": event_insertions,
        "sources": source_updates,
    }


def _apply_panda_and_residency_proposals(
    proposals: tuple[CurationPatchProposal, ...],
    *,
    panda_by_slug: dict[str, dict[str, str]],
    proposal_sources: Mapping[str, set[str]],
) -> int:
    before_by_slug: dict[str, dict[str, str]] = {}
    for proposal in proposals:
        if proposal.intake_kind not in {IntakeKind.PANDA, IntakeKind.RESIDENCY}:
            continue
        slug = proposal.subject.identity_key
        row = panda_by_slug.get(slug)
        if row is None:
            raise ValueError(f"curation pandas.csv lacks reviewed panda {slug}")
        if row["review_status"] == "rejected":
            raise ValueError(f"curation panda {slug} is rejected and cannot be patched")
        before_by_slug.setdefault(slug, dict(row))
        operation = _required_text(proposal.payload, "operation")
        if operation == "propose-field":
            _apply_field_proposal(row, proposal)
        elif operation == "propose-residency":
            _apply_residency_proposal(row, proposal)
        else:
            raise ValueError(f"unsupported Smithsonian panda operation {operation}")
        row["primary_source_ids"] = _join_ids(
            {*_split_ids(row["primary_source_ids"]), *proposal_sources[slug]}
        )
        row["evidence_status"] = "verified"
        if row["review_status"] == "draft":
            row["review_status"] = "reviewed"
    return sum(panda_by_slug[slug] != before for slug, before in before_by_slug.items())


def _apply_field_proposal(row: dict[str, str], proposal: CurationPatchProposal) -> None:
    field_path = _required_text(proposal.payload, "field_path")
    value = proposal.payload.get("value")
    prior = proposal.provenance.prior_trusted_value
    if field_path == "identity.sex":
        proposed = _required_scalar(value, field_path)
        _guard_prior(row["gender"], prior.value, proposed, field_path)
        row["gender"] = proposed
        return
    if field_path == "identity.birth_date":
        proposed_value, proposed_precision = _date_value(value, field_path)
        current = {"value": row["birth_date"], "precision": row["birth_date_precision"]}
        proposed = {"value": proposed_value, "precision": proposed_precision}
        _guard_prior(current, prior.value, proposed, field_path)
        row["birth_date"] = proposed_value
        row["birth_date_precision"] = proposed_precision
        return
    if field_path == "identity.birthplace":
        proposed = _location_name(value, field_path)
        _guard_prior(row["birthplace"], prior.value, proposed, field_path)
        row["birthplace"] = proposed
        return
    raise ValueError(f"unsupported Smithsonian panda field {field_path}")


def _apply_residency_proposal(
    row: dict[str, str],
    proposal: CurationPatchProposal,
) -> None:
    if _required_text(proposal.payload, "residency_kind") != "current_location":
        raise ValueError("Smithsonian patch supports only current_location residency")
    proposed = _residency_text(proposal.payload.get("location"))
    prior = proposal.provenance.prior_trusted_value
    _guard_prior(row["current_location"], prior.value, proposed, "residency.current_location")
    row["current_location"] = proposed


def _apply_event_proposals(
    patch: CurationPatchBundle,
    *,
    event_rows: list[dict[str, str]],
    original_events_by_slug: Mapping[str, tuple[dict[str, JsonValue], ...]],
    source_by_snapshot: Mapping[str, PatchSourceEvidence],
    source_by_url: Mapping[str, dict[str, str]],
) -> int:
    event_proposals = tuple(
        proposal for proposal in patch.proposals if proposal.intake_kind is IntakeKind.EVENT
    )
    proposals_by_slug: dict[str, list[CurationPatchProposal]] = defaultdict(list)
    for proposal in event_proposals:
        proposals_by_slug[proposal.subject.identity_key].append(proposal)

    for slug, proposals in proposals_by_slug.items():
        prior_keys = _event_collection_keys(proposals[0].provenance.prior_trusted_value.value)
        for proposal in proposals[1:]:
            if _event_collection_keys(proposal.provenance.prior_trusted_value.value) != prior_keys:
                raise ValueError(f"event prior-value basis drifted for {slug}")
        current_keys = _event_collection_keys(list(original_events_by_slug.get(slug, ())))
        proposed_keys = {
            canonical_json_bytes(_required_event_payload(proposal)) for proposal in proposals
        }
        expected_after_keys = prior_keys | proposed_keys
        if current_keys not in {frozenset(prior_keys), frozenset(expected_after_keys)}:
            raise ValueError(f"concurrent curation change detected for events.{slug}")

    insertions = 0
    for proposal in event_proposals:
        slug = proposal.subject.identity_key
        event = _required_event_payload(proposal)
        source = source_by_snapshot[proposal.provenance.evidence_snapshot_id]
        source_id = source_by_url[source.final_url]["source_id"]
        inserted = _upsert_event_row(
            event_rows,
            slug=slug,
            event=event,
            source_id=source_id,
            patch_id=patch.patch_id,
            candidate_id=proposal.provenance.candidate_id,
        )
        insertions += int(inserted)
    return insertions


def _required_event_payload(proposal: CurationPatchProposal) -> dict[str, JsonValue]:
    event = proposal.payload.get("event")
    if not isinstance(event, dict):
        raise ValueError("Smithsonian event proposal requires an event object")
    return event


def _event_collection_keys(value: object) -> frozenset[bytes]:
    if not isinstance(value, (list, tuple)):
        raise ValueError("event prior trusted value must be a list")
    keys: set[bytes] = set()
    for item in value:
        if not isinstance(item, dict):
            raise ValueError("event prior trusted value entries must be objects")
        keys.add(canonical_json_bytes(item))
    return frozenset(keys)


def _upsert_event_row(
    rows: list[dict[str, str]],
    *,
    slug: str,
    event: dict[str, JsonValue],
    source_id: str,
    patch_id: str,
    candidate_id: str,
) -> bool:
    event_type = _required_text(event, "event_type")
    event_date, precision = _date_value(event.get("event_date"), "event.event_date")
    location = _required_text(event, "location")
    related = event.get("related_slugs", [])
    if not isinstance(related, list) or not all(isinstance(item, str) for item in related):
        raise ValueError("event.related_slugs must be a list of strings")
    identity = (slug, event_type, event_date, precision, location, tuple(related))
    for row in rows:
        if _event_row_identity(row) != identity:
            continue
        row["source_ids"] = _join_ids({*_split_ids(row["source_ids"]), source_id})
        row["evidence_status"] = "verified"
        if row["review_status"] == "draft":
            row["review_status"] = "reviewed"
        return False
    rows.append(
        {
            "event_id": _event_id(slug, event_type, event_date),
            "panda_slug": slug,
            "event_type": event_type,
            "event_date": event_date,
            "event_date_precision": precision,
            "location": location,
            "related_slugs": _join_ids(set(related)),
            "source_ids": source_id,
            "evidence_status": "verified",
            "review_status": "reviewed",
            "notes": f"Accepted patch {patch_id}; candidate {candidate_id}.",
        }
    )
    return True


def _refresh_source_access_dates(
    patch: CurationPatchBundle,
    *,
    source_by_snapshot: Mapping[str, PatchSourceEvidence],
    source_by_url: Mapping[str, dict[str, str]],
) -> int:
    del source_by_snapshot
    touched = 0
    for source in patch.sources:
        row = source_by_url[source.final_url]
        captured = source.captured_at.date().isoformat()
        if not row["accessed_at"] or row["accessed_at"] < captured:
            row["accessed_at"] = captured
            touched += 1
    return touched


def _publication_blockers(curation_dir: Path) -> dict[str, tuple[str, ...]]:
    _, events = _read_csv(curation_dir / "events.csv")
    _, media = _read_csv(curation_dir / "media.csv")
    result: dict[str, tuple[str, ...]] = {}
    for slug in _TARGET_SLUGS:
        approved_events = sum(
            row["panda_slug"] == slug
            and row["review_status"] == "approved"
            and row["evidence_status"] == "verified"
            for row in events
        )
        approved_media = sum(
            row.get("panda_slug") == slug and row.get("review_status") == "approved"
            for row in media
        )
        result[slug] = (
            f"approved-photo-count={approved_media}",
            f"approved-verified-event-count={approved_events}",
        )
    return result


def _events_by_slug(
    rows: list[dict[str, str]],
) -> dict[str, tuple[dict[str, JsonValue], ...]]:
    grouped: dict[str, list[dict[str, JsonValue]]] = defaultdict(list)
    for row in rows:
        grouped[row["panda_slug"]].append(_event_semantics(row))
    return {
        slug: tuple(sorted(items, key=lambda item: str(item))) for slug, items in grouped.items()
    }


def _event_semantics(row: Mapping[str, str]) -> dict[str, JsonValue]:
    related = _split_ids(row["related_slugs"])
    return {
        "event_type": row["event_type"],
        "event_date": {
            "value": row["event_date"],
            "precision": row["event_date_precision"],
        },
        "location": row["location"],
        "related_slugs": related,
        "related_reference_kind": "canonical-slug" if related else None,
    }


def _event_row_identity(row: Mapping[str, str]) -> tuple[object, ...]:
    return (
        row["panda_slug"],
        row["event_type"],
        row["event_date"],
        row["event_date_precision"],
        row["location"],
        tuple(_split_ids(row["related_slugs"])),
    )


def _guard_prior(current: object, prior: object, proposed: object, label: str) -> None:
    if current == proposed:
        return
    if current != prior:
        raise ValueError(f"concurrent curation change detected for {label}")


def _residency_text(value: object) -> str:
    if not isinstance(value, dict):
        raise ValueError("residency location must be an object")
    facility = value.get("facility")
    institution = value.get("institution")
    if not isinstance(facility, str) or not facility.strip():
        raise ValueError("residency location requires facility")
    if not isinstance(institution, str) or not institution.strip():
        raise ValueError("residency location requires institution")
    return f"{facility.strip()}, {institution.strip()}"


def _location_name(value: object, label: str) -> str:
    if isinstance(value, str) and value.strip():
        return value.strip()
    if isinstance(value, dict):
        name = value.get("name")
        if isinstance(name, str) and name.strip():
            return name.strip()
    raise ValueError(f"{label} requires a location name")


def _date_value(value: object, label: str) -> tuple[str, str]:
    if not isinstance(value, dict):
        raise ValueError(f"{label} requires a date object")
    date_value = value.get("value")
    precision = value.get("precision")
    if not isinstance(date_value, str) or not date_value.strip():
        raise ValueError(f"{label} requires a date value")
    if not isinstance(precision, str) or not precision.strip():
        raise ValueError(f"{label} requires date precision")
    return date_value.strip(), precision.strip()


def _required_scalar(value: object, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{label} requires a string value")
    return value.strip()


def _required_text(value: Mapping[str, object], key: str) -> str:
    item = value.get(key)
    if not isinstance(item, str) or not item.strip():
        raise ValueError(f"{key} must be a non-empty string")
    return item.strip()


def _read_csv(path: Path) -> tuple[tuple[str, ...], list[dict[str, str]]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        fields = tuple(reader.fieldnames or ())
        return fields, [dict(row) for row in reader]


def _write_csv(
    path: Path,
    fields: tuple[str, ...],
    rows: list[dict[str, str]],
) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def _split_ids(value: str) -> list[str]:
    return [item.strip() for item in value.split(";") if item.strip()]


def _join_ids(values: set[str]) -> str:
    return ";".join(sorted(value for value in values if value))


def _event_id(slug: str, event_type: str, event_date: str) -> str:
    safe_slug = slug.replace("-", "_")
    safe_type = event_type.replace("-", "_")
    return f"evt_{safe_slug}_{safe_type}_{event_date.replace('-', '')}"


def _csv_hashes(curation_dir: Path) -> dict[str, str]:
    return {
        path.name: sha256(path.read_bytes()).hexdigest()
        for path in sorted(curation_dir.glob("*.csv"))
    }


def _commit_directory_swap(
    *,
    curation_dir: Path,
    stage_dir: Path,
    expected_sha256: dict[str, str],
) -> None:
    if _csv_hashes(curation_dir) != expected_sha256:
        raise ValueError("curation CSVs changed after staging; refusing directory swap")
    backup_dir = curation_dir.with_name(f".{curation_dir.name}.backup-{uuid4().hex}")
    os.replace(curation_dir, backup_dir)
    try:
        os.replace(stage_dir, curation_dir)
    except BaseException:
        os.replace(backup_dir, curation_dir)
        raise
    shutil.rmtree(backup_dir)


def _load_repository_validator() -> Validator:
    spec = importlib.util.spec_from_file_location(
        "panda_atlas_curation_validator",
        _VALIDATOR_PATH,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("could not load repository curation validator")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    typed_module = cast(ModuleType, module)
    validator = getattr(typed_module, "validate_curation", None)
    if not callable(validator):
        raise RuntimeError("repository curation validator lacks validate_curation")
    return cast(Validator, validator)
