from __future__ import annotations

import csv
import json
import unicodedata
from collections import Counter, defaultdict
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
from urllib.parse import urlparse
from uuid import uuid4

from .contracts.v1 import JsonValue, canonical_json_bytes

SCHEMA_VERSION = "panda-atlas-acquisition-work-queue/v1"
_REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
DEFAULT_CURATION_DIR = _REPOSITORY_ROOT / "data" / "curation" / "pandas"
LOCAL_WORK_QUEUE_ROOT = _REPOSITORY_ROOT / ".acquisition" / "work-queue"
DEFAULT_OUTPUT_NAME = "panda-acquisition-work-queue.v1.json"

_REQUIRED_FILES = (
    "pandas.csv",
    "sources.csv",
    "events.csv",
    "media.csv",
    "source-expansion-backlog.csv",
)
_GENERIC_COHORT_TOKENS = frozenset(
    {
        "and",
        "animal",
        "animals",
        "aquarium",
        "base",
        "breeding",
        "center",
        "centre",
        "china",
        "conservation",
        "for",
        "archive",
        "archives",
        "archival",
        "batch",
        "com",
        "daily",
        "death",
        "deaths",
        "deceased",
        "domestic",
        "duplicate",
        "early",
        "edu",
        "garden",
        "gardens",
        "giant",
        "global",
        "gov",
        "historic",
        "historical",
        "history",
        "index",
        "indexes",
        "institute",
        "institution",
        "legacy",
        "living",
        "media",
        "merge",
        "missing",
        "national",
        "news",
        "notices",
        "official",
        "of",
        "org",
        "page",
        "pages",
        "panda",
        "park",
        "previous",
        "profile",
        "profiles",
        "reconciliation",
        "record",
        "records",
        "research",
        "royal",
        "society",
        "source",
        "sources",
        "the",
        "wildlife",
        "world",
        "zoo",
        "zoological",
    }
)
_OFFICIAL_SOURCE_TYPES = frozenset(
    {
        "official_profile",
        "official_news",
        "official_video",
        "official_tourism",
        "official_repost",
        "official_site",
        "government_media",
        "government_official",
        "institution_article",
    }
)
_EVIDENCE_BASE_SCORE = {
    "needs_primary_source": 3000,
    "partial": 2000,
    "verified_unapproved": 1000,
    "approved": 0,
}
_GAP_WEIGHTS = {
    "name_zh": 90,
    "parentage": 100,
    "complete_parentage": 50,
    "structured_events": 90,
    "verified_event_coverage": 45,
    "current_location": 100,
    "current_location_primary_evidence": 60,
    "licensed_media": 40,
    "exact_birth_date": 35,
    "gender": 25,
    "life_status": 25,
}
_BACKLOG_PRIORITY_BONUS = {1: 60, 2: 30, 3: 10}


@dataclass(frozen=True, slots=True)
class InputSnapshot:
    path: str
    bytes: int
    sha256: str
    row_count: int

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "path": self.path,
            "bytes": self.bytes,
            "sha256": self.sha256,
            "row_count": self.row_count,
        }


@dataclass(frozen=True, slots=True)
class SourceCohort:
    cohort_id: str
    cohort_kind: str
    label: str
    institution_or_source: str
    region: str | None
    source_domains: tuple[str, ...]
    known_source_ids: tuple[str, ...]
    backlog_target_id: str | None = None
    backlog_priority: int | None = None
    backlog_status: str | None = None
    backlog_reason: str | None = None

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "cohort_id": self.cohort_id,
            "cohort_kind": self.cohort_kind,
            "label": self.label,
            "institution_or_source": self.institution_or_source,
            "region": self.region,
            "source_domains": list(self.source_domains),
            "known_source_ids": list(self.known_source_ids),
            "backlog_target_id": self.backlog_target_id,
            "backlog_priority": self.backlog_priority,
            "backlog_status": self.backlog_status,
            "backlog_reason": self.backlog_reason,
        }


@dataclass(frozen=True, slots=True)
class PandaWorkRecord:
    panda_slug: str
    panda_name_zh: str | None
    panda_name_en: str
    cohort_id: str
    current_source_ids: tuple[str, ...]
    current_source_ids_in_cohort: tuple[str, ...]
    evidence_status: str
    review_status: str
    missing_fields: tuple[str, ...]
    event_count: int
    verified_event_count: int
    approved_media_count: int
    priority_score: int
    priority_band: str
    priority_reasons: tuple[str, ...]
    opportunity_reasons: tuple[str, ...]

    @property
    def record_id(self) -> str:
        payload: JsonValue = {
            "panda_slug": self.panda_slug,
            "cohort_id": self.cohort_id,
            "current_source_ids": list(self.current_source_ids),
            "current_source_ids_in_cohort": list(self.current_source_ids_in_cohort),
            "evidence_status": self.evidence_status,
            "review_status": self.review_status,
            "missing_fields": list(self.missing_fields),
            "priority_score": self.priority_score,
        }
        return f"work-{sha256(canonical_json_bytes(payload)).hexdigest()}"

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "record_id": self.record_id,
            "panda_slug": self.panda_slug,
            "panda_name_zh": self.panda_name_zh,
            "panda_name_en": self.panda_name_en,
            "cohort_id": self.cohort_id,
            "current_source_ids": list(self.current_source_ids),
            "current_source_ids_in_cohort": list(self.current_source_ids_in_cohort),
            "evidence_status": self.evidence_status,
            "review_status": self.review_status,
            "missing_fields": list(self.missing_fields),
            "event_count": self.event_count,
            "verified_event_count": self.verified_event_count,
            "approved_media_count": self.approved_media_count,
            "priority_score": self.priority_score,
            "priority_band": self.priority_band,
            "priority_reasons": list(self.priority_reasons),
            "opportunity_reasons": list(self.opportunity_reasons),
        }


@dataclass(frozen=True, slots=True)
class CohortSummary:
    cohort: SourceCohort
    record_count: int
    panda_count: int
    priority_band_counts: Mapping[str, int]
    missing_field_counts: Mapping[str, int]
    top_record_ids: tuple[str, ...]

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            **self.cohort.to_dict(),
            "record_count": self.record_count,
            "panda_count": self.panda_count,
            "priority_band_counts": dict(sorted(self.priority_band_counts.items())),
            "missing_field_counts": dict(sorted(self.missing_field_counts.items())),
            "top_record_ids": list(self.top_record_ids),
        }


@dataclass(frozen=True, slots=True)
class AcquisitionWorkQueue:
    inputs: tuple[InputSnapshot, ...]
    cohorts: tuple[CohortSummary, ...]
    records: tuple[PandaWorkRecord, ...]
    panda_count: int
    schema_version: str = SCHEMA_VERSION

    @property
    def queue_id(self) -> str:
        payload: JsonValue = {
            "schema_version": self.schema_version,
            "inputs": [item.to_dict() for item in self.inputs],
            "cohorts": [item.to_dict() for item in self.cohorts],
            "records": [item.to_dict() for item in self.records],
            "panda_count": self.panda_count,
        }
        return f"queue-{sha256(canonical_json_bytes(payload)).hexdigest()}"

    def to_dict(self) -> dict[str, JsonValue]:
        representative_by_panda: dict[str, PandaWorkRecord] = {}
        for record in self.records:
            representative_by_panda.setdefault(record.panda_slug, record)
        panda_records = tuple(representative_by_panda.values())
        return {
            "schema_version": self.schema_version,
            "queue_id": self.queue_id,
            "inputs": [item.to_dict() for item in self.inputs],
            "summary": {
                "panda_count": self.panda_count,
                "record_count": len(self.records),
                "cohort_count": len(self.cohorts),
                "priority_band_panda_counts": dict(
                    sorted(Counter(item.priority_band for item in panda_records).items())
                ),
                "priority_band_record_counts": dict(
                    sorted(Counter(item.priority_band for item in self.records).items())
                ),
                "missing_field_panda_counts": dict(
                    sorted(
                        Counter(
                            field for record in panda_records for field in record.missing_fields
                        ).items()
                    )
                ),
                "missing_field_record_counts": dict(
                    sorted(
                        Counter(
                            field for record in self.records for field in record.missing_fields
                        ).items()
                    )
                ),
            },
            "cohorts": [item.to_dict() for item in self.cohorts],
            "records": [item.to_dict() for item in self.records],
            "write_boundary": {
                "trusted_write_targets": [],
                "publication_write_targets": [],
            },
        }


def build_acquisition_work_queue(
    curation_dir: Path = DEFAULT_CURATION_DIR,
) -> AcquisitionWorkQueue:
    input_rows, inputs = _load_inputs(curation_dir)
    pandas = input_rows["pandas.csv"]
    sources = input_rows["sources.csv"]
    events = input_rows["events.csv"]
    media = input_rows["media.csv"]
    backlog = input_rows["source-expansion-backlog.csv"]

    _validate_unique(pandas, "slug", "pandas.csv")
    _validate_unique(sources, "source_id", "sources.csv")
    _validate_unique(events, "event_id", "events.csv")
    _validate_unique(backlog, "target_id", "source-expansion-backlog.csv")

    source_by_id = {row["source_id"]: row for row in sources}
    panda_slugs = {row["slug"] for row in pandas}
    name_en_counts = Counter(_normalize_text(row["name_en"]) for row in pandas)
    name_zh_counts = Counter(row["name_zh"].strip() for row in pandas if row["name_zh"].strip())
    for row in events:
        if row["panda_slug"] not in panda_slugs:
            raise ValueError(f"event {row['event_id']} references unknown panda")
    for row in media:
        if row["panda_slug"] not in panda_slugs:
            raise ValueError(f"media row references unknown panda {row['panda_slug']!r}")

    target_sources = _map_sources_to_backlog(sources, backlog)
    cohort_catalog = _build_cohort_catalog(sources, backlog, target_sources)

    events_by_panda: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in events:
        events_by_panda[row["panda_slug"]].append(row)
    media_by_panda: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in media:
        media_by_panda[row["panda_slug"]].append(row)

    records: list[PandaWorkRecord] = []
    for panda in pandas:
        current_source_ids = tuple(sorted(_split_ids(panda["primary_source_ids"])))
        unknown_source_ids = [item for item in current_source_ids if item not in source_by_id]
        if unknown_source_ids:
            raise ValueError(
                f"panda {panda['slug']} references unknown sources {unknown_source_ids}"
            )
        current_sources = [source_by_id[item] for item in current_source_ids]
        opportunities = _select_cohort_opportunities(
            panda=panda,
            current_sources=current_sources,
            backlog=backlog,
            target_sources=target_sources,
            cohort_catalog=cohort_catalog,
            unique_name_en=name_en_counts[_normalize_text(panda["name_en"])] == 1,
            unique_name_zh=(
                bool(panda["name_zh"].strip()) and name_zh_counts[panda["name_zh"].strip()] == 1
            ),
        )
        panda_events = events_by_panda.get(panda["slug"], [])
        panda_media = media_by_panda.get(panda["slug"], [])
        missing_fields = _missing_fields(panda, panda_events, panda_media)
        priority_band = _priority_band(panda)

        for cohort_id, opportunity_reasons in opportunities.items():
            cohort = cohort_catalog[cohort_id]
            current_in_cohort = _current_sources_in_cohort(
                current_sources=current_sources,
                cohort=cohort,
                target_source_ids=target_sources.get(cohort.backlog_target_id or "", ()),
            )
            priority_score, priority_reasons = _priority_score(
                panda=panda,
                missing_fields=missing_fields,
                cohort=cohort,
            )
            records.append(
                PandaWorkRecord(
                    panda_slug=panda["slug"],
                    panda_name_zh=panda["name_zh"].strip() or None,
                    panda_name_en=panda["name_en"].strip(),
                    cohort_id=cohort_id,
                    current_source_ids=current_source_ids,
                    current_source_ids_in_cohort=current_in_cohort,
                    evidence_status=panda["evidence_status"],
                    review_status=panda["review_status"],
                    missing_fields=missing_fields,
                    event_count=len(panda_events),
                    verified_event_count=sum(
                        event["evidence_status"] == "verified" for event in panda_events
                    ),
                    approved_media_count=sum(
                        item["review_status"] == "approved" for item in panda_media
                    ),
                    priority_score=priority_score,
                    priority_band=priority_band,
                    priority_reasons=priority_reasons,
                    opportunity_reasons=tuple(sorted(opportunity_reasons)),
                )
            )

    records.sort(
        key=lambda item: (
            -item.priority_score,
            item.cohort_id,
            item.panda_slug,
            item.record_id,
        )
    )
    _require_one_record_per_panda(records, pandas)
    cohorts = _summarize_cohorts(records, cohort_catalog)
    return AcquisitionWorkQueue(
        inputs=inputs,
        cohorts=cohorts,
        records=tuple(records),
        panda_count=len(pandas),
    )


def resolve_local_work_queue_path(output: str | Path | None = None) -> Path:
    root = LOCAL_WORK_QUEUE_ROOT.resolve()
    if output is None:
        candidate = root / DEFAULT_OUTPUT_NAME
    else:
        requested = Path(output)
        candidate = requested if requested.is_absolute() else root / requested
        candidate = candidate.resolve()
    try:
        candidate.relative_to(root)
    except ValueError as error:
        raise ValueError(f"work queues must stay below the local output root {root}") from error
    if candidate.suffix != ".json":
        raise ValueError("work queue output must use the .json suffix")
    return candidate


def write_local_work_queue(
    queue: AcquisitionWorkQueue,
    output: str | Path | None = None,
    *,
    overwrite: bool = False,
) -> Path:
    output_path = resolve_local_work_queue_path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists() and not overwrite:
        raise FileExistsError(f"work queue already exists: {output_path}")
    payload = json.dumps(queue.to_dict(), ensure_ascii=False, indent=2) + "\n"
    temporary = output_path.with_name(f".{output_path.name}.{uuid4().hex}.tmp")
    try:
        temporary.write_text(payload, encoding="utf-8")
        temporary.replace(output_path)
    finally:
        temporary.unlink(missing_ok=True)
    return output_path


def _load_inputs(
    curation_dir: Path,
) -> tuple[dict[str, list[dict[str, str]]], tuple[InputSnapshot, ...]]:
    rows_by_name: dict[str, list[dict[str, str]]] = {}
    snapshots: list[InputSnapshot] = []
    for name in _REQUIRED_FILES:
        path = curation_dir / name
        if not path.is_file():
            raise FileNotFoundError(f"required curation input is missing: {path}")
        raw = path.read_bytes()
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.DictReader(handle))
        rows_by_name[name] = rows
        try:
            display_path = path.relative_to(_REPOSITORY_ROOT).as_posix()
        except ValueError:
            display_path = path.name
        snapshots.append(
            InputSnapshot(
                path=display_path,
                bytes=len(raw),
                sha256=sha256(raw).hexdigest(),
                row_count=len(rows),
            )
        )
    return rows_by_name, tuple(sorted(snapshots, key=lambda item: item.path))


def _build_cohort_catalog(
    sources: list[dict[str, str]],
    backlog: list[dict[str, str]],
    target_sources: Mapping[str, tuple[str, ...]],
) -> dict[str, SourceCohort]:
    source_by_id = {row["source_id"]: row for row in sources}
    catalog: dict[str, SourceCohort] = {}
    mapped_source_ids = {source_id for values in target_sources.values() for source_id in values}

    for target in backlog:
        target_id = target["target_id"]
        known_source_ids = tuple(sorted(target_sources.get(target_id, ())))
        domains = tuple(
            sorted(
                {
                    domain
                    for source_id in known_source_ids
                    if (domain := _source_domain(source_by_id[source_id]))
                }
            )
        )
        cohort_id = f"backlog:{target_id}"
        catalog[cohort_id] = SourceCohort(
            cohort_id=cohort_id,
            cohort_kind="backlog-target",
            label=target["institution_or_source"],
            institution_or_source=target["institution_or_source"],
            region=target["region"].strip() or None,
            source_domains=domains,
            known_source_ids=known_source_ids,
            backlog_target_id=target_id,
            backlog_priority=int(target["priority"]),
            backlog_status=target["status"],
            backlog_reason=target["reason"],
        )

    by_domain: dict[str, list[dict[str, str]]] = defaultdict(list)
    for source in sources:
        if source["source_id"] in mapped_source_ids:
            continue
        domain = _source_domain(source)
        if domain:
            by_domain[domain].append(source)
    for domain, domain_sources in sorted(by_domain.items()):
        official = any(_is_official_source(source) for source in domain_sources)
        cohort_id = f"domain:{domain}"
        publishers = sorted(
            {
                source["publisher"].strip()
                for source in domain_sources
                if source["publisher"].strip()
            }
        )
        label = publishers[0] if len(publishers) == 1 else domain
        catalog[cohort_id] = SourceCohort(
            cohort_id=cohort_id,
            cohort_kind="official-source-domain" if official else "discovery-source-domain",
            label=label,
            institution_or_source=label,
            region=None,
            source_domains=(domain,),
            known_source_ids=tuple(sorted(source["source_id"] for source in domain_sources)),
        )

    catalog["unassigned:official-source-review"] = SourceCohort(
        cohort_id="unassigned:official-source-review",
        cohort_kind="unassigned",
        label="Unassigned official-source review",
        institution_or_source="Unassigned official-source review",
        region=None,
        source_domains=(),
        known_source_ids=(),
    )
    return catalog


def _map_sources_to_backlog(
    sources: list[dict[str, str]],
    backlog: list[dict[str, str]],
) -> dict[str, tuple[str, ...]]:
    mapped: dict[str, list[str]] = defaultdict(list)
    for source in sources:
        matches: list[tuple[int, str]] = []
        for target in backlog:
            strength = _source_backlog_match_strength(source, target)
            if strength > 0:
                matches.append((strength, target["target_id"]))
        if matches:
            best_strength = max(strength for strength, _ in matches)
            for _, target_id in sorted(item for item in matches if item[0] == best_strength):
                mapped[target_id].append(source["source_id"])
    return {key: tuple(sorted(value)) for key, value in sorted(mapped.items())}


def _source_backlog_match_strength(
    source: dict[str, str],
    target: dict[str, str],
) -> int:
    publisher = _normalize_text(source["publisher"])
    source_identity = _normalize_text(
        " ".join((source["publisher"], source["title"], source["url"]))
    )
    target_label = _normalize_text(target["institution_or_source"])
    if target_label and _contains_phrase(source_identity, target_label):
        return 4
    if not publisher or not _contains_phrase(target_label, publisher):
        return 0

    publisher_tokens = _significant_tokens(source["publisher"])
    target_tokens = _significant_tokens(target["institution_or_source"])
    target_specific_tokens = target_tokens - publisher_tokens
    if not target_specific_tokens:
        return 3 if target_label == publisher else 0

    source_title_and_url = _normalize_text(" ".join((source["title"], source["url"])))
    if any(
        _contains_phrase(source_title_and_url, token) for token in sorted(target_specific_tokens)
    ):
        return 3
    return 0


def _select_cohort_opportunities(
    *,
    panda: dict[str, str],
    current_sources: list[dict[str, str]],
    backlog: list[dict[str, str]],
    target_sources: Mapping[str, tuple[str, ...]],
    cohort_catalog: Mapping[str, SourceCohort],
    unique_name_en: bool,
    unique_name_zh: bool,
) -> dict[str, set[str]]:
    opportunities: dict[str, set[str]] = defaultdict(set)
    current_source_ids = {source["source_id"] for source in current_sources}
    panda_context = _normalize_text(
        " ".join(
            (
                panda["name_zh"],
                panda["name_en"],
                panda["birthplace"],
                panda["current_location"],
                panda["tags"],
                panda["intro"],
                panda["notes"],
            )
        )
    )

    for target in backlog:
        target_id = target["target_id"]
        reasons: list[str] = []
        if _backlog_mentions_panda(
            target,
            panda,
            unique_name_en=unique_name_en,
            unique_name_zh=unique_name_zh,
        ):
            reasons.append("backlog target explicitly names this uniquely identified panda")
        if _cohort_match_strength(target, panda_context) > 0:
            reasons.append("panda location, notes, tags, or intro match the target institution")
        if current_source_ids.intersection(target_sources.get(target_id, ())):
            reasons.append("current source IDs already belong to this target cohort")
        if reasons:
            opportunities[f"backlog:{target_id}"].update(reasons)

    mapped_source_ids = {
        source_id for target in backlog for source_id in target_sources.get(target["target_id"], ())
    }
    for source in current_sources:
        if source["source_id"] in mapped_source_ids:
            continue
        domain = _source_domain(source)
        if not domain:
            continue
        cohort_id = f"domain:{domain}"
        if cohort_id not in cohort_catalog:
            continue
        if _is_official_source(source):
            reason = "current official or institutional source domain"
        else:
            reason = (
                "current discovery source domain needs official-source replacement or confirmation"
            )
        opportunities[cohort_id].add(reason)

    if not opportunities:
        opportunities["unassigned:official-source-review"].add(
            "no deterministic official institution or source-domain cohort was found"
        )
    return dict(sorted(opportunities.items()))


def _current_sources_in_cohort(
    *,
    current_sources: list[dict[str, str]],
    cohort: SourceCohort,
    target_source_ids: Iterable[str],
) -> tuple[str, ...]:
    target_ids = set(target_source_ids)
    result: list[str] = []
    for source in current_sources:
        source_id = source["source_id"]
        if cohort.backlog_target_id is not None and source_id in target_ids:
            result.append(source_id)
        elif cohort.backlog_target_id is None and _source_domain(source) in cohort.source_domains:
            result.append(source_id)
    return tuple(sorted(result))


def _missing_fields(
    panda: dict[str, str],
    events: list[dict[str, str]],
    media: list[dict[str, str]],
) -> tuple[str, ...]:
    missing: list[str] = []
    if not panda["name_zh"].strip():
        missing.append("name_zh")
    father = bool(panda["father_slug"].strip())
    mother = bool(panda["mother_slug"].strip())
    if not father and not mother:
        missing.append("parentage")
    elif not father or not mother:
        missing.append("complete_parentage")
    if not events:
        missing.append("structured_events")
    elif not any(event["evidence_status"] == "verified" for event in events):
        missing.append("verified_event_coverage")
    if not panda["current_location"].strip():
        missing.append("current_location")
    elif panda["evidence_status"] != "verified":
        missing.append("current_location_primary_evidence")
    if not any(item["review_status"] == "approved" for item in media):
        missing.append("licensed_media")
    if panda["birth_date_precision"] != "day" or not panda["birth_date"].strip():
        missing.append("exact_birth_date")
    if panda["gender"] in {"", "unknown"}:
        missing.append("gender")
    if panda["status"] in {"", "unknown"}:
        missing.append("life_status")
    return tuple(sorted(missing))


def _priority_band(panda: dict[str, str]) -> str:
    evidence = panda["evidence_status"]
    if evidence == "needs_primary_source":
        return "needs-primary-source"
    if evidence == "partial":
        return "partial-evidence"
    if panda["review_status"] != "approved":
        return "verified-unapproved"
    return "approved-maintenance"


def _priority_score(
    *,
    panda: dict[str, str],
    missing_fields: tuple[str, ...],
    cohort: SourceCohort,
) -> tuple[int, tuple[str, ...]]:
    band = _priority_band(panda)
    evidence_key = {
        "needs-primary-source": "needs_primary_source",
        "partial-evidence": "partial",
        "verified-unapproved": "verified_unapproved",
        "approved-maintenance": "approved",
    }[band]
    score = _EVIDENCE_BASE_SCORE[evidence_key]
    reasons = [f"{band} base priority +{score}"]
    for field in missing_fields:
        weight = _GAP_WEIGHTS[field]
        score += weight
        reasons.append(f"missing {field} +{weight}")
    if cohort.backlog_priority is not None:
        bonus = _BACKLOG_PRIORITY_BONUS.get(cohort.backlog_priority, 0)
        score += bonus
        reasons.append(f"source backlog priority {cohort.backlog_priority} +{bonus}")
    return score, tuple(reasons)


def _summarize_cohorts(
    records: list[PandaWorkRecord],
    cohort_catalog: Mapping[str, SourceCohort],
) -> tuple[CohortSummary, ...]:
    by_cohort: dict[str, list[PandaWorkRecord]] = defaultdict(list)
    for record in records:
        by_cohort[record.cohort_id].append(record)
    summaries: list[CohortSummary] = []
    for cohort_id, cohort_records in by_cohort.items():
        ordered = sorted(
            cohort_records,
            key=lambda item: (-item.priority_score, item.panda_slug, item.record_id),
        )
        summaries.append(
            CohortSummary(
                cohort=cohort_catalog[cohort_id],
                record_count=len(ordered),
                panda_count=len({item.panda_slug for item in ordered}),
                priority_band_counts=Counter(item.priority_band for item in ordered),
                missing_field_counts=Counter(
                    field for item in ordered for field in item.missing_fields
                ),
                top_record_ids=tuple(item.record_id for item in ordered[:10]),
            )
        )
    summaries.sort(
        key=lambda item: (
            -max(
                (record.priority_score for record in by_cohort[item.cohort.cohort_id]),
                default=0,
            ),
            item.cohort.cohort_id,
        )
    )
    return tuple(summaries)


def _backlog_mentions_panda(
    target: dict[str, str],
    panda: dict[str, str],
    *,
    unique_name_en: bool,
    unique_name_zh: bool,
) -> bool:
    target_text = _normalize_text(" ".join((target["reason"], target["notes"])))
    name_en = _normalize_text(panda["name_en"])
    name_zh = panda["name_zh"].strip()
    return bool(
        (
            unique_name_en
            and name_en
            and len(name_en) >= 4
            and _contains_phrase(target_text, name_en)
        )
        or (unique_name_zh and name_zh and name_zh in f"{target['reason']} {target['notes']}")
    )


def _cohort_match_strength(target: dict[str, str], normalized_context: str) -> int:
    institution = _normalize_text(target["institution_or_source"])
    if institution and _contains_phrase(normalized_context, institution):
        return 3
    target_id_tokens = _significant_tokens(target["target_id"].removeprefix("target_"))
    institution_tokens = _significant_tokens(target["institution_or_source"])
    tokens = sorted(target_id_tokens.union(institution_tokens))
    matches = sum(_contains_phrase(normalized_context, token) for token in tokens)
    if matches >= 2:
        return 2
    return 0


def _is_official_source(source: dict[str, str]) -> bool:
    return (
        source["reliability"] == "primary_fact" or source["source_type"] in _OFFICIAL_SOURCE_TYPES
    )


def _source_domain(source: dict[str, str]) -> str:
    parsed = urlparse(source["url"])
    domain = (parsed.hostname or "").lower().removeprefix("www.")
    return domain


def _normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).casefold()
    characters = [character if character.isalnum() else " " for character in normalized]
    return " ".join("".join(characters).split())


def _significant_tokens(value: str) -> set[str]:
    return {
        token
        for token in _normalize_text(value).split()
        if len(token) >= 3 and not token.isdigit() and token not in _GENERIC_COHORT_TOKENS
    }


def _contains_phrase(context: str, phrase: str) -> bool:
    return f" {phrase} " in f" {context} "


def _split_ids(value: str) -> list[str]:
    return [item.strip() for item in value.split(";") if item.strip()]


def _validate_unique(rows: list[dict[str, str]], key: str, label: str) -> None:
    values = [row[key] for row in rows]
    if len(values) != len(set(values)):
        raise ValueError(f"{label} contains duplicate {key} values")


def _require_one_record_per_panda(
    records: list[PandaWorkRecord],
    pandas: list[dict[str, str]],
) -> None:
    record_slugs = {item.panda_slug for item in records}
    panda_slugs = {item["slug"] for item in pandas}
    if record_slugs != panda_slugs:
        missing = sorted(panda_slugs - record_slugs)
        raise ValueError(f"work queue omitted panda records: {missing}")
    record_keys = [(item.panda_slug, item.cohort_id) for item in records]
    if len(record_keys) != len(set(record_keys)):
        raise ValueError("work queue contains duplicate panda and cohort opportunities")
