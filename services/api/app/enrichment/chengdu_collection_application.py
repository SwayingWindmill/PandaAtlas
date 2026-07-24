from __future__ import annotations

import csv
import importlib.util
import json
import os
import shutil
import tempfile
from collections import defaultdict
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from hashlib import sha256
from pathlib import Path
from types import ModuleType
from typing import cast
from uuid import uuid4

from app.acquisition.contracts import IdentityMatchState, canonical_json_bytes
from app.acquisition.contracts.v1 import JsonValue
from app.acquisition.curation import (
    CurationPatchBundle,
    CurationPatchProposal,
    IntakeKind,
    PatchSourceEvidence,
)
from app.acquisition.reconciliation import load_reconciliation_snapshot

_REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
_VALIDATOR_PATH = _REPOSITORY_ROOT / "scripts" / "curation" / "validate_panda_curation.py"
_DEFAULT_IDENTITY_LINKS_PATH = (
    _REPOSITORY_ROOT / "data" / "acquisition-sources" / "identity-links.json"
)
_REQUIRED_CSV_FILES = ("events.csv", "media.csv", "pandas.csv", "sources.csv")

_SOURCE_METADATA: dict[str, dict[str, str]] = {
    "https://www.panda.org.cn/cn/cooperate/international/": {
        "source_id": "src_chengdu_international_zh",
        "source_type": "official_profile",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "国际合作",
        "published_date": "",
        "notes": (
            "Official Chinese international-cooperation page used for named panda identity "
            "and transfer-event facts."
        ),
    },
    "https://www.panda.org.cn/en/cooperate/international/": {
        "source_id": "src_chengdu_international_en",
        "source_type": "official_profile",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "International Cooperation",
        "published_date": "",
        "notes": (
            "Official English international-cooperation page used for named panda identity "
            "and transfer-event facts."
        ),
    },
    "https://www.panda.org.cn/cn/culture/activities/2023-07-07/6594.html": {
        "source_id": "src_chengdu_newborns_2021_zh",
        "source_type": "official_news",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "2021年新生大熊猫幼仔档案",
        "published_date": "",
        "notes": (
            "Official Chinese 2021 newborn profile page used for names, sex, birth dates, "
            "mothers, and birth events."
        ),
    },
    "https://www.panda.org.cn/en/culture/activities/2023-09-19/8165.html": {
        "source_id": "src_chengdu_newborns_2021_en",
        "source_type": "official_news",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "2021 Newborn Giant Panda Profiles",
        "published_date": "",
        "notes": (
            "Official English 2021 newborn profile page used for names, sex, birth dates, "
            "mothers, and birth events."
        ),
    },
    "https://www.panda.org.cn/cn/culture/activities/2023-07-07/6593.html": {
        "source_id": "src_chengdu_denmark_2019_zh",
        "source_type": "official_news",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "成都大熊猫星二毛二赴丹欢送仪式",
        "published_date": "",
        "notes": (
            "Official Chinese Denmark handover profile page used for Xing Er and Mao Er "
            "identity and transfer facts."
        ),
    },
    "https://www.panda.org.cn/en/culture/activities/2023-08-24/8081.html": {
        "source_id": "src_chengdu_denmark_2019_en",
        "source_type": "official_news",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "Chengdu Giant Pandas Xing Er and Mao Er Handover to Denmark",
        "published_date": "",
        "notes": (
            "Official English Denmark handover profile page used for Xing Er and Mao Er "
            "identity and transfer facts."
        ),
    },
    "https://www.panda.org.cn/cn/culture/activities/2023-08-23/8079.html": {
        "source_id": "src_chengdu_newborns_2017_zh",
        "source_type": "official_news",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "2017新生大熊猫宝宝齐亮相",
        "published_date": "",
        "notes": (
            "Official Chinese 2017 newborn page used for names, sex, birth dates, mothers, "
            "and birth events."
        ),
    },
    "https://www.panda.org.cn/en/culture/activities/2023-08-24/8080.html": {
        "source_id": "src_chengdu_newborns_2017_en",
        "source_type": "official_news",
        "publisher": "Chengdu Research Base of Giant Panda Breeding",
        "title": "Debut of 2017 Newborn Pandas",
        "published_date": "",
        "notes": (
            "Official English 2017 newborn page used for names, sex, birth dates, mothers, "
            "and birth events."
        ),
    },
}
_NEW_IDENTITY_SLUGS = {
    "chengdu:bao-xin": "bao-xin",
    "chengdu:zhen-xi": "zhen-xi",
    "chengdu:qing-qing-2017-07-26": "qing-qing-chengdu-2017-07-26",
    "chengdu:xiao-xin-2017": "xiao-xin-chengdu-2017",
}

Validator = Callable[[Path], tuple[list[str], dict[str, int]]]


@dataclass(frozen=True, slots=True)
class ChengduCollectionApplicationResult:
    patch_ids: tuple[str, ...]
    applied: bool
    applied_at: datetime
    proposal_count: int
    new_panda_insertions: int
    panda_row_updates: int
    event_insertions: int
    source_insertions: int
    source_updates: int
    identity_link_insertions: int
    changed_files: tuple[str, ...]
    before_sha256: dict[str, str]
    after_sha256: dict[str, str]
    validation_counts: dict[str, int]

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "patch_ids": list(self.patch_ids),
            "applied": self.applied,
            "applied_at": self.applied_at.isoformat(),
            "proposal_count": self.proposal_count,
            "new_panda_insertions": self.new_panda_insertions,
            "panda_row_updates": self.panda_row_updates,
            "event_insertions": self.event_insertions,
            "source_insertions": self.source_insertions,
            "source_updates": self.source_updates,
            "identity_link_insertions": self.identity_link_insertions,
            "changed_files": list(self.changed_files),
            "before_sha256": self.before_sha256,
            "after_sha256": self.after_sha256,
            "validation_counts": self.validation_counts,
        }


def apply_chengdu_collection_patches(
    patches: Sequence[CurationPatchBundle],
    *,
    curation_dir: Path,
    identity_links_path: Path = _DEFAULT_IDENTITY_LINKS_PATH,
    applied_at: datetime,
    apply: bool = False,
    validator: Validator | None = None,
) -> ChengduCollectionApplicationResult:
    ordered_patches = tuple(sorted(patches, key=lambda item: item.patch_id))
    _validate_application_request(
        ordered_patches,
        curation_dir=curation_dir,
        identity_links_path=identity_links_path,
        applied_at=applied_at,
    )
    before_sha256 = _target_hashes(curation_dir, identity_links_path)
    selected_validator = validator or _load_repository_validator()

    with tempfile.TemporaryDirectory(
        prefix=".chengdu-collection-stage-",
        dir=curation_dir.parent,
    ) as temporary_root:
        stage_root = Path(temporary_root)
        stage_dir = stage_root / curation_dir.name
        stage_links = stage_root / identity_links_path.name
        shutil.copytree(curation_dir, stage_dir)
        shutil.copyfile(identity_links_path, stage_links)

        counts = _apply_patches_to_stage(
            ordered_patches,
            stage_dir=stage_dir,
            stage_links=stage_links,
            applied_at=applied_at,
        )
        errors, validation_counts = selected_validator(stage_dir)
        if errors:
            raise ValueError("staged Chengdu curation failed validation: " + "; ".join(errors))
        load_reconciliation_snapshot(
            stage_dir,
            identity_links_path=stage_links,
        )
        after_sha256 = _target_hashes(stage_dir, stage_links)
        changed_files = tuple(
            sorted(
                name for name, digest in after_sha256.items() if before_sha256.get(name) != digest
            )
        )
        if apply:
            _commit_staged_targets(
                curation_dir=curation_dir,
                stage_dir=stage_dir,
                identity_links_path=identity_links_path,
                stage_links=stage_links,
                expected_sha256=before_sha256,
            )

    return ChengduCollectionApplicationResult(
        patch_ids=tuple(patch.patch_id for patch in ordered_patches),
        applied=apply,
        applied_at=applied_at,
        proposal_count=sum(len(patch.proposals) for patch in ordered_patches),
        new_panda_insertions=counts["new_pandas"],
        panda_row_updates=counts["pandas"],
        event_insertions=counts["events"],
        source_insertions=counts["source_insertions"],
        source_updates=counts["source_updates"],
        identity_link_insertions=counts["identity_links"],
        changed_files=changed_files,
        before_sha256=before_sha256,
        after_sha256=after_sha256,
        validation_counts=validation_counts,
    )


def _validate_application_request(
    patches: tuple[CurationPatchBundle, ...],
    *,
    curation_dir: Path,
    identity_links_path: Path,
    applied_at: datetime,
) -> None:
    if applied_at.tzinfo is None or applied_at.utcoffset() is None:
        raise ValueError("applied_at must include a timezone")
    if not patches:
        raise ValueError("at least one Chengdu curation patch is required")
    patch_ids = [patch.patch_id for patch in patches]
    if len(set(patch_ids)) != len(patch_ids):
        raise ValueError("duplicate Chengdu curation patch IDs")
    candidate_ids: set[str] = set()
    source_urls: set[str] = set()
    for patch in patches:
        if patch.source_reviewed_at > applied_at.date():
            raise ValueError("Chengdu patch application cannot precede source review")
        if patch.source_review_expires_at < applied_at.date():
            raise ValueError(
                f"Chengdu source review expired on {patch.source_review_expires_at.isoformat()}"
            )
        for source in patch.sources:
            source_urls.add(source.final_url)
        for proposal in patch.proposals:
            candidate_id = proposal.provenance.candidate_id
            if candidate_id in candidate_ids:
                raise ValueError("one accepted candidate appears in multiple Chengdu patches")
            candidate_ids.add(candidate_id)
            if proposal.intake_kind not in {IntakeKind.PANDA, IntakeKind.EVENT}:
                raise ValueError(
                    "Chengdu collection application supports only accepted panda and event "
                    "proposals"
                )
    if not source_urls or not source_urls <= set(_SOURCE_METADATA):
        raise ValueError("Chengdu patch source URL scope drifted")
    if curation_dir.is_symlink() or not curation_dir.is_dir():
        raise ValueError("curation_dir must be an existing non-symlink directory")
    missing = [name for name in _REQUIRED_CSV_FILES if not (curation_dir / name).is_file()]
    if missing:
        raise ValueError("curation_dir is missing required CSV files: " + ", ".join(missing))
    if identity_links_path.is_symlink() or not identity_links_path.is_file():
        raise ValueError("identity_links_path must be an existing non-symlink file")


def _apply_patches_to_stage(
    patches: tuple[CurationPatchBundle, ...],
    *,
    stage_dir: Path,
    stage_links: Path,
    applied_at: datetime,
) -> dict[str, int]:
    panda_fields, panda_rows = _read_csv(stage_dir / "pandas.csv")
    event_fields, event_rows = _read_csv(stage_dir / "events.csv")
    source_fields, source_rows = _read_csv(stage_dir / "sources.csv")
    panda_by_slug = {row["slug"]: row for row in panda_rows}
    original_events_by_slug = _events_by_slug(event_rows)

    source_by_snapshot, proposal_source_ids = _ensure_sources(
        patches,
        source_rows=source_rows,
    )
    new_pandas, subject_to_slug = _apply_new_identity_proposals(
        patches,
        panda_rows=panda_rows,
        panda_by_slug=panda_by_slug,
        proposal_source_ids=proposal_source_ids,
    )
    panda_updates = _apply_matched_identity_proposals(
        patches,
        panda_by_slug=panda_by_slug,
        proposal_source_ids=proposal_source_ids,
    )
    event_insertions = _apply_event_proposals(
        patches,
        event_rows=event_rows,
        original_events_by_slug=original_events_by_slug,
        proposal_source_ids=proposal_source_ids,
    )
    identity_link_insertions = _update_identity_links(
        stage_links,
        subject_to_slug=subject_to_slug,
        reviewed_at=applied_at.date().isoformat(),
    )

    _write_csv(stage_dir / "pandas.csv", panda_fields, panda_rows)
    _write_csv(stage_dir / "events.csv", event_fields, event_rows)
    _write_csv(stage_dir / "sources.csv", source_fields, source_rows)
    return {
        "new_pandas": new_pandas,
        "pandas": panda_updates,
        "events": event_insertions,
        "source_insertions": source_by_snapshot["insertions"],
        "source_updates": source_by_snapshot["updates"],
        "identity_links": identity_link_insertions,
    }


def _ensure_sources(
    patches: tuple[CurationPatchBundle, ...],
    *,
    source_rows: list[dict[str, str]],
) -> tuple[dict[str, object], dict[str, str]]:
    row_by_url = {row["url"]: row for row in source_rows}
    snapshot_by_id: dict[str, PatchSourceEvidence] = {}
    insertions = 0
    updates = 0
    for patch in patches:
        for source in patch.sources:
            existing_snapshot = snapshot_by_id.get(source.evidence_snapshot_id)
            if existing_snapshot is not None and existing_snapshot != source:
                raise ValueError("evidence snapshot identity drifted across Chengdu patches")
            snapshot_by_id[source.evidence_snapshot_id] = source
            metadata = _SOURCE_METADATA[source.final_url]
            row = row_by_url.get(source.final_url)
            captured = source.captured_at.date().isoformat()
            if row is None:
                row = {
                    "source_id": metadata["source_id"],
                    "source_type": metadata["source_type"],
                    "publisher": metadata["publisher"],
                    "title": metadata["title"],
                    "url": source.final_url,
                    "published_date": metadata["published_date"],
                    "accessed_at": captured,
                    "reliability": "primary_fact",
                    "allowed_use": "profile_facts_only",
                    "notes": metadata["notes"],
                }
                source_rows.append(row)
                row_by_url[source.final_url] = row
                insertions += 1
            else:
                if row["source_id"] != metadata["source_id"]:
                    raise ValueError(f"source ID drifted for {source.final_url}")
                before = dict(row)
                if not row["accessed_at"] or row["accessed_at"] < captured:
                    row["accessed_at"] = captured
                if row != before:
                    updates += 1

    proposal_source_ids: dict[str, str] = {}
    for patch in patches:
        for proposal in patch.proposals:
            source = snapshot_by_id[proposal.provenance.evidence_snapshot_id]
            proposal_source_ids[proposal.provenance.candidate_id] = _SOURCE_METADATA[
                source.final_url
            ]["source_id"]
    return {
        "snapshots": snapshot_by_id,
        "insertions": insertions,
        "updates": updates,
    }, proposal_source_ids


def _apply_new_identity_proposals(
    patches: tuple[CurationPatchBundle, ...],
    *,
    panda_rows: list[dict[str, str]],
    panda_by_slug: dict[str, dict[str, str]],
    proposal_source_ids: Mapping[str, str],
) -> tuple[int, dict[str, str]]:
    proposals_by_subject: dict[str, list[CurationPatchProposal]] = defaultdict(list)
    for patch in patches:
        for proposal in patch.proposals:
            if (
                proposal.intake_kind is IntakeKind.PANDA
                and proposal.subject.state is IdentityMatchState.UNMATCHED
            ):
                proposals_by_subject[proposal.subject.source_identity].append(proposal)

    subject_to_slug: dict[str, str] = {}
    insertions = 0
    for subject, proposals in sorted(proposals_by_subject.items()):
        slug = _NEW_IDENTITY_SLUGS.get(subject)
        if slug is None:
            raise ValueError(f"unreviewed Chengdu create identity {subject}")
        subject_to_slug[subject] = slug
        values_by_field: dict[str, set[bytes]] = defaultdict(set)
        decoded_by_key: dict[tuple[str, bytes], JsonValue] = {}
        source_ids: set[str] = set()
        candidate_ids: list[str] = []
        for proposal in proposals:
            field_path = _required_text(proposal.payload, "field_path")
            value = proposal.payload.get("value")
            key = canonical_json_bytes(value)
            values_by_field[field_path].add(key)
            decoded_by_key[(field_path, key)] = cast(JsonValue, value)
            candidate_id = proposal.provenance.candidate_id
            candidate_ids.append(candidate_id)
            source_ids.add(proposal_source_ids[candidate_id])
        expected_fields = {
            "identity.names.official.zh",
            "identity.names.official.en",
            "identity.birth_date",
            "identity.sex",
        }
        if set(values_by_field) != expected_fields:
            raise ValueError(f"new identity {subject} field coverage drifted")
        if any(len(values) != 1 for values in values_by_field.values()):
            raise ValueError(f"new identity {subject} has conflicting bilingual values")

        name_zh = _required_scalar(
            _single_group_value(values_by_field, decoded_by_key, "identity.names.official.zh"),
            "name_zh",
        )
        name_en = _required_scalar(
            _single_group_value(values_by_field, decoded_by_key, "identity.names.official.en"),
            "name_en",
        )
        gender = _required_scalar(
            _single_group_value(values_by_field, decoded_by_key, "identity.sex"),
            "gender",
        )
        birth_date, birth_precision = _date_value(
            _single_group_value(values_by_field, decoded_by_key, "identity.birth_date"),
            "identity.birth_date",
        )
        expected_row = {
            "slug": slug,
            "name_zh": name_zh,
            "name_en": name_en,
            "gender": gender,
            "birth_date": birth_date,
            "birth_date_precision": birth_precision,
            "birth_date_text": "",
            "death_date": "",
            "status": "unknown",
            "birthplace": "",
            "current_location": "",
            "father_slug": "",
            "mother_slug": "",
            "intro": (
                f"Giant panda documented in an official Chengdu newborn cohort ({birth_date})."
            ),
            "tags": "chengdu;newborn-cohort",
            "is_featured": "false",
            "primary_source_ids": _join_ids(source_ids),
            "evidence_status": "verified",
            "review_status": "reviewed",
            "notes": (
                "Created from accepted Chengdu acquisition candidates; parentage remains "
                "unresolved. "
                f"Candidates: {','.join(sorted(candidate_ids))}."
            ),
        }
        current = panda_by_slug.get(slug)
        if current is None:
            panda_rows.append(expected_row)
            panda_by_slug[slug] = expected_row
            insertions += 1
        else:
            for field in (
                "name_zh",
                "name_en",
                "gender",
                "birth_date",
                "birth_date_precision",
            ):
                if current[field] != expected_row[field]:
                    raise ValueError(f"existing panda {slug} conflicts on {field}")
            current["primary_source_ids"] = _join_ids(
                {*_split_ids(current["primary_source_ids"]), *source_ids}
            )
            if current["evidence_status"] == "draft":
                current["evidence_status"] = "verified"
            if current["review_status"] == "draft":
                current["review_status"] = "reviewed"
    return insertions, subject_to_slug


def _apply_matched_identity_proposals(
    patches: tuple[CurationPatchBundle, ...],
    *,
    panda_by_slug: dict[str, dict[str, str]],
    proposal_source_ids: Mapping[str, str],
) -> int:
    before_by_slug: dict[str, dict[str, str]] = {}
    for patch in patches:
        for proposal in patch.proposals:
            if proposal.intake_kind is not IntakeKind.PANDA:
                continue
            if proposal.subject.state is not IdentityMatchState.MATCHED:
                continue
            slug = proposal.subject.identity_key
            row = panda_by_slug.get(slug)
            if row is None:
                raise ValueError(f"curation pandas.csv lacks matched panda {slug}")
            if row["review_status"] == "rejected":
                raise ValueError(f"curation panda {slug} is rejected and cannot be patched")
            before_by_slug.setdefault(slug, dict(row))
            field_path = _required_text(proposal.payload, "field_path")
            if field_path != "identity.names.official.zh":
                raise ValueError(f"unsupported matched Chengdu panda field {field_path}")
            proposed = _required_scalar(proposal.payload.get("value"), field_path)
            prior = proposal.provenance.prior_trusted_value.value
            _guard_prior(row["name_zh"] or None, prior, proposed, f"{slug}.{field_path}")
            row["name_zh"] = proposed
            source_id = proposal_source_ids[proposal.provenance.candidate_id]
            row["primary_source_ids"] = _join_ids(
                {*_split_ids(row["primary_source_ids"]), source_id}
            )
            row["evidence_status"] = "verified"
            if row["review_status"] == "draft":
                row["review_status"] = "reviewed"
    return sum(panda_by_slug[slug] != before for slug, before in before_by_slug.items())


def _apply_event_proposals(
    patches: tuple[CurationPatchBundle, ...],
    *,
    event_rows: list[dict[str, str]],
    original_events_by_slug: Mapping[str, tuple[dict[str, JsonValue], ...]],
    proposal_source_ids: Mapping[str, str],
) -> int:
    proposals = tuple(
        proposal
        for patch in patches
        for proposal in patch.proposals
        if proposal.intake_kind is IntakeKind.EVENT
    )
    proposals_by_slug: dict[str, list[CurationPatchProposal]] = defaultdict(list)
    for proposal in proposals:
        if proposal.subject.state is not IdentityMatchState.MATCHED:
            raise ValueError("unmatched event proposal cannot be applied before identity replay")
        proposals_by_slug[proposal.subject.identity_key].append(proposal)

    for slug, slug_proposals in proposals_by_slug.items():
        prior_keys = _event_collection_keys(slug_proposals[0].provenance.prior_trusted_value.value)
        for proposal in slug_proposals[1:]:
            if _event_collection_keys(proposal.provenance.prior_trusted_value.value) != prior_keys:
                raise ValueError(f"event prior-value basis drifted for {slug}")
        current_keys = _event_collection_keys(list(original_events_by_slug.get(slug, ())))
        proposed_keys = {
            canonical_json_bytes(_curation_event_semantics(_required_event_payload(proposal)))
            for proposal in slug_proposals
        }
        expected_after = prior_keys | proposed_keys
        if current_keys not in {prior_keys, frozenset(expected_after)}:
            raise ValueError(f"concurrent curation change detected for events.{slug}")

    insertions = 0
    for proposal in proposals:
        event = _required_event_payload(proposal)
        inserted = _upsert_event_row(
            event_rows,
            slug=proposal.subject.identity_key,
            event=event,
            source_id=proposal_source_ids[proposal.provenance.candidate_id],
            patch_id=proposal.provenance.acquisition_bundle_id,
            candidate_id=proposal.provenance.candidate_id,
        )
        insertions += int(inserted)
    return insertions


def _update_identity_links(
    path: Path,
    *,
    subject_to_slug: Mapping[str, str],
    reviewed_at: str,
) -> int:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError("identity-links.json must be an object")
    source_keys = raw.get("source_keys")
    if not isinstance(source_keys, list):
        raise ValueError("identity-links.json source_keys must be an array")
    existing: dict[tuple[str, str], dict[str, object]] = {}
    for item in source_keys:
        if not isinstance(item, dict):
            raise ValueError("identity-links.json source key entries must be objects")
        source_id = item.get("source_id")
        source_key = item.get("source_key")
        if isinstance(source_id, str) and isinstance(source_key, str):
            existing[(source_id, source_key)] = item
    insertions = 0
    for subject, slug in sorted(subject_to_slug.items()):
        key = ("chengdu-panda-base-international-cooperation", subject)
        current = existing.get(key)
        if current is not None:
            if current.get("canonical_slug") != slug:
                raise ValueError(f"identity link drifted for {subject}")
            continue
        source_keys.append(
            {
                "source_id": key[0],
                "source_key": subject,
                "canonical_slug": slug,
                "basis": (
                    "Created from accepted bilingual Chengdu newborn identity candidates with "
                    "consistent official names, exact birth date, and sex."
                ),
            }
        )
        insertions += 1
    source_keys.sort(
        key=lambda item: (
            str(item.get("source_id") or ""),
            str(item.get("source_key") or ""),
        )
    )
    raw["reviewed_at"] = reviewed_at
    path.write_text(
        json.dumps(raw, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
        encoding="utf-8",
        newline="",
    )
    return insertions


def _required_event_payload(proposal: CurationPatchProposal) -> dict[str, JsonValue]:
    event = proposal.payload.get("event")
    if not isinstance(event, dict):
        raise ValueError("Chengdu event proposal requires an event object")
    return event


def _curation_event_semantics(event: Mapping[str, JsonValue]) -> dict[str, JsonValue]:
    event_type = _required_text(event, "event_type")
    event_date, precision = _date_value(event.get("event_date"), "event.event_date")
    location = _required_scalar(event.get("location"), "event.location")
    related = event.get("related_slugs", [])
    if not isinstance(related, list) or not all(isinstance(item, str) for item in related):
        raise ValueError("event.related_slugs must be a list of strings")
    return {
        "event_type": event_type,
        "event_date": {"value": event_date, "precision": precision},
        "location": location,
        "related_slugs": sorted(related),
        "related_reference_kind": "canonical-slug",
    }


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
    location = _required_scalar(event.get("location"), "event.location")
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
    event_id = _unique_event_id(rows, slug=slug, event=event)
    rows.append(
        {
            "event_id": event_id,
            "panda_slug": slug,
            "event_type": event_type,
            "event_date": event_date,
            "event_date_precision": precision,
            "location": location,
            "related_slugs": _join_ids(set(related)),
            "source_ids": source_id,
            "evidence_status": "verified",
            "review_status": "reviewed",
            "notes": f"Accepted collection patch {patch_id}; candidate {candidate_id}.",
        }
    )
    return True


def _unique_event_id(
    rows: Sequence[Mapping[str, str]],
    *,
    slug: str,
    event: Mapping[str, JsonValue],
) -> str:
    event_type = _required_text(event, "event_type")
    event_date, _ = _date_value(event.get("event_date"), "event.event_date")
    base = (
        f"evt_{slug.replace('-', '_')}_{event_type.replace('-', '_')}_{event_date.replace('-', '')}"
    )
    used = {row["event_id"] for row in rows}
    if base not in used:
        return base
    suffix = sha256(canonical_json_bytes(dict(event))).hexdigest()[:8]
    candidate = f"{base}_{suffix}"
    if candidate in used:
        raise ValueError(f"event ID collision for {slug} {event_type} {event_date}")
    return candidate


def _events_by_slug(
    rows: Sequence[Mapping[str, str]],
) -> dict[str, tuple[dict[str, JsonValue], ...]]:
    grouped: dict[str, list[dict[str, JsonValue]]] = defaultdict(list)
    for row in rows:
        grouped[row["panda_slug"]].append(_event_semantics(row))
    return {
        slug: tuple(sorted(items, key=lambda item: canonical_json_bytes(item)))
        for slug, items in grouped.items()
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
        "related_reference_kind": "canonical-slug",
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


def _event_collection_keys(value: object) -> frozenset[bytes]:
    if value is None:
        return frozenset()
    if not isinstance(value, (list, tuple)):
        raise ValueError("event prior trusted value must be a list or null")
    keys: set[bytes] = set()
    for item in value:
        if not isinstance(item, dict):
            raise ValueError("event prior trusted value entries must be objects")
        keys.add(canonical_json_bytes(item))
    return frozenset(keys)


def _guard_prior(current: object, prior: object, proposed: object, label: str) -> None:
    if current == proposed:
        return
    if current != prior:
        raise ValueError(f"concurrent curation change detected for {label}")


def _single_group_value(
    values_by_field: Mapping[str, set[bytes]],
    decoded_by_key: Mapping[tuple[str, bytes], JsonValue],
    field: str,
) -> JsonValue:
    key = next(iter(values_by_field[field]))
    return decoded_by_key[(field, key)]


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
    rows: Sequence[Mapping[str, str]],
) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def _split_ids(value: str) -> list[str]:
    return [item.strip() for item in value.split(";") if item.strip()]


def _join_ids(values: set[str]) -> str:
    return ";".join(sorted(value for value in values if value))


def _target_hashes(curation_dir: Path, identity_links_path: Path) -> dict[str, str]:
    hashes = {
        path.name: sha256(path.read_bytes()).hexdigest()
        for path in sorted(curation_dir.glob("*.csv"))
    }
    hashes[f"identity-links/{identity_links_path.name}"] = sha256(
        identity_links_path.read_bytes()
    ).hexdigest()
    return hashes


def _commit_staged_targets(
    *,
    curation_dir: Path,
    stage_dir: Path,
    identity_links_path: Path,
    stage_links: Path,
    expected_sha256: dict[str, str],
) -> None:
    if _target_hashes(curation_dir, identity_links_path) != expected_sha256:
        raise ValueError("curation targets changed after staging; refusing atomic replacement")
    backup_dir = curation_dir.with_name(f".{curation_dir.name}.backup-{uuid4().hex}")
    backup_links = identity_links_path.with_name(
        f".{identity_links_path.name}.backup-{uuid4().hex}"
    )
    os.replace(curation_dir, backup_dir)
    try:
        os.replace(identity_links_path, backup_links)
    except BaseException:
        os.replace(backup_dir, curation_dir)
        raise
    try:
        os.replace(stage_dir, curation_dir)
        os.replace(stage_links, identity_links_path)
    except BaseException:
        if curation_dir.exists():
            shutil.rmtree(curation_dir)
        if identity_links_path.exists():
            identity_links_path.unlink()
        os.replace(backup_dir, curation_dir)
        os.replace(backup_links, identity_links_path)
        raise
    shutil.rmtree(backup_dir)
    backup_links.unlink()


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


__all__ = [
    "ChengduCollectionApplicationResult",
    "apply_chengdu_collection_patches",
]
