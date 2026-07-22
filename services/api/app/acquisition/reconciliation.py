from __future__ import annotations

import csv
import json
import re
import unicodedata
from collections import Counter, defaultdict
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, replace
from datetime import date, datetime
from hashlib import sha256
from pathlib import Path
from types import MappingProxyType
from typing import Any

from app.domain.trusted_identity import normalize_identity_term

from .contracts import (
    ConflictState,
    CurrentTrustedValue,
    FieldCandidate,
    IdentityMatchState,
    PandaIdentityMatch,
    canonical_json_bytes,
)
from .contracts.v1 import JsonValue
from .source_registry import ReviewedSource

SCHEMA_VERSION = "panda-atlas-acquisition-reconciliation/v1"
_REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
DEFAULT_CURATION_DIR = _REPOSITORY_ROOT / "data" / "curation" / "pandas"
DEFAULT_IDENTITY_LINKS_PATH = (
    _REPOSITORY_ROOT / "data" / "acquisition-sources" / "identity-links.json"
)
DEFAULT_GOLDEN_DATASET_PATH = (
    _REPOSITORY_ROOT / "contracts" / "golden-dataset" / "mei-xiang-family.v1.json"
)
_DATE_PATTERNS = (
    "%Y-%m-%d",
    "%Y/%m/%d",
    "%B %d, %Y",
    "%B %d %Y",
    "%b %d, %Y",
    "%b %d %Y",
    "%d %B %Y",
    "%d %b %Y",
)
_DATE_VALUE_KEYS = ("value", "date", "event_date", "birth_date", "death_date")
_NAME_PATH_MARKERS = (".name", ".names", ".alias", ".aliases")
_EXTERNAL_IDENTIFIER_MARKERS = ("external_identifier", "external-identifiers")
_RELATIONSHIP_PATHS = {
    "relationship.father": "father_slug",
    "parentage.father": "father_slug",
    "father": "father_slug",
    "relationship.mother": "mother_slug",
    "parentage.mother": "mother_slug",
    "mother": "mother_slug",
}
_FIELD_ALIASES = {
    "gender": "identity.sex",
    "sex": "identity.sex",
    "identity.gender": "identity.sex",
    "status": "identity.life_status",
    "life_status": "identity.life_status",
    "identity.status": "identity.life_status",
    "birth_date": "identity.birth_date",
    "identity.birthdate": "identity.birth_date",
    "death_date": "identity.death_date",
    "identity.deathdate": "identity.death_date",
    "birthplace": "identity.birthplace",
    "identity.birth_place": "identity.birthplace",
    "current_location": "residency.current_location",
    "identity.current_location": "residency.current_location",
    "residency.current": "residency.current_location",
    "name_en": "identity.names.official.en",
    "identity.name.en": "identity.names.official.en",
    "name_zh": "identity.names.official.zh",
    "identity.name.zh": "identity.names.official.zh",
    **_RELATIONSHIP_PATHS,
}
_SEX_VALUES = {
    "m": "male",
    "male": "male",
    "boy": "male",
    "雄": "male",
    "雄性": "male",
    "f": "female",
    "female": "female",
    "girl": "female",
    "雌": "female",
    "雌性": "female",
    "unknown": "unknown",
    "undetermined": "unknown",
    "未知": "unknown",
}
_LIFE_STATUS_VALUES = {
    "alive": "alive",
    "living": "alive",
    "current": "alive",
    "在世": "alive",
    "deceased": "deceased",
    "dead": "deceased",
    "died": "deceased",
    "euthanized": "deceased",
    "死亡": "deceased",
    "unknown": "unknown",
    "未知": "unknown",
}
_EVENT_TYPE_VALUES = {
    "born": "birth",
    "birth": "birth",
    "arrival": "arrival",
    "arrived": "arrival",
    "transfer": "transfer",
    "transferred": "transfer",
    "return": "return",
    "returned": "return",
    "naming": "naming",
    "named": "naming",
    "public_debut": "public_debut",
    "public debut": "public_debut",
    "death": "death",
    "died": "death",
}


@dataclass(frozen=True, slots=True)
class InputSnapshot:
    path: str
    bytes: int
    sha256: str
    row_count: int | None

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "path": self.path,
            "bytes": self.bytes,
            "sha256": self.sha256,
            "row_count": self.row_count,
        }


@dataclass(frozen=True, slots=True)
class SourceKeyLink:
    source_id: str
    source_key: str
    canonical_slug: str
    basis: str


@dataclass(frozen=True, slots=True)
class ExternalIdentifierLink:
    system: str
    value: str
    canonical_slug: str
    basis: str


@dataclass(frozen=True, slots=True)
class CurationPanda:
    canonical_slug: str
    stable_id: str | None
    name_zh: str | None
    name_en: str
    gender: str
    birth_date: str | None
    birth_date_precision: str
    birth_date_text: str | None
    death_date: str | None
    life_status: str
    birthplace: str | None
    current_location: str | None
    father_slug: str | None
    mother_slug: str | None
    primary_source_ids: tuple[str, ...]
    evidence_status: str
    aliases: tuple[str, ...]
    external_identifiers: tuple[tuple[str, str], ...]

    @property
    def reviewed_name_terms(self) -> tuple[str, ...]:
        curation_names: tuple[str | None, ...] = ()
        if self.evidence_status in {"verified", "partial"}:
            curation_names = (self.name_en, self.name_zh)
        return tuple(dict.fromkeys(value for value in (*curation_names, *self.aliases) if value))

    @property
    def match_reference(self) -> str:
        return self.stable_id or self.canonical_slug


@dataclass(frozen=True, slots=True)
class ReconciliationSnapshot:
    pandas_by_slug: Mapping[str, CurationPanda]
    events_by_panda: Mapping[str, tuple[Mapping[str, str], ...]]
    media_by_panda: Mapping[str, tuple[Mapping[str, str], ...]]
    source_urls_by_id: Mapping[str, str]
    source_key_links: Mapping[tuple[str, str], SourceKeyLink]
    external_identifier_index: Mapping[tuple[str, str], tuple[str, ...]]
    field_assertion_ids: Mapping[tuple[str, str], tuple[str, ...]]
    parent_assertion_ids: Mapping[tuple[str, str], tuple[str, ...]]
    inputs: tuple[InputSnapshot, ...]

    @property
    def snapshot_id(self) -> str:
        payload: JsonValue = {
            "schema_version": SCHEMA_VERSION,
            "inputs": [item.to_dict() for item in self.inputs],
            "source_keys": [
                {
                    "source_id": link.source_id,
                    "source_key": link.source_key,
                    "canonical_slug": link.canonical_slug,
                    "basis": link.basis,
                }
                for link in sorted(
                    self.source_key_links.values(),
                    key=lambda item: (item.source_id, item.source_key),
                )
            ],
        }
        return f"reconciliation-{sha256(canonical_json_bytes(payload)).hexdigest()}"

    def source_scope(self, source: ReviewedSource) -> tuple[str, ...]:
        source_ids = {
            source_id
            for source_id, url in self.source_urls_by_id.items()
            if _url_is_in_source_scope(url, source)
        }
        slugs = [
            panda.canonical_slug
            for panda in self.pandas_by_slug.values()
            if source_ids.intersection(panda.primary_source_ids)
        ]
        linked_slugs = [
            link.canonical_slug
            for link in self.source_key_links.values()
            if link.source_id == source.source_id
        ]
        return tuple(sorted(set(slugs).union(linked_slugs)))


@dataclass(frozen=True, slots=True)
class ReconciliationSummary:
    snapshot_id: str
    candidate_count: int
    identity_state_counts: Mapping[str, int]
    conflict_state_counts: Mapping[str, int]

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "schema_version": SCHEMA_VERSION,
            "snapshot_id": self.snapshot_id,
            "candidate_count": self.candidate_count,
            "identity_state_counts": dict(sorted(self.identity_state_counts.items())),
            "conflict_state_counts": dict(sorted(self.conflict_state_counts.items())),
        }

    def run_notes(self) -> tuple[str, ...]:
        return (
            f"reconciliation_schema={SCHEMA_VERSION}",
            f"reconciliation_snapshot_id={self.snapshot_id}",
            "reconciliation_summary="
            + json.dumps(self.to_dict(), ensure_ascii=False, sort_keys=True, separators=(",", ":")),
        )


@dataclass(frozen=True, slots=True)
class ReconciliationResult:
    candidates: tuple[FieldCandidate, ...]
    summary: ReconciliationSummary


def load_reconciliation_snapshot(
    curation_dir: Path = DEFAULT_CURATION_DIR,
    *,
    identity_links_path: Path = DEFAULT_IDENTITY_LINKS_PATH,
    golden_dataset_path: Path = DEFAULT_GOLDEN_DATASET_PATH,
) -> ReconciliationSnapshot:
    pandas_rows, pandas_input = _read_csv(curation_dir / "pandas.csv")
    source_rows, sources_input = _read_csv(curation_dir / "sources.csv")
    event_rows, events_input = _read_csv(curation_dir / "events.csv")
    media_rows, media_input = _read_csv(curation_dir / "media.csv")
    identity_links_raw, links_input = _read_json(identity_links_path)
    golden_raw, golden_input = _read_json(golden_dataset_path)

    _validate_unique(pandas_rows, "slug", "pandas.csv")
    _validate_unique(source_rows, "source_id", "sources.csv")
    _validate_unique(event_rows, "event_id", "events.csv")

    golden_by_slug, stable_id_to_slug, field_assertions, parent_assertions = (
        _load_golden_identity_supplement(golden_raw)
    )
    pandas_by_slug: dict[str, CurationPanda] = {}
    for row in pandas_rows:
        slug = _required_text(row, "slug", "pandas.csv")
        supplement = golden_by_slug.get(slug, {})
        panda = CurationPanda(
            canonical_slug=slug,
            stable_id=_optional_text(supplement.get("stable_id")),
            name_zh=_optional_text(row.get("name_zh")),
            name_en=_required_text(row, "name_en", f"panda {slug}"),
            gender=_normalize_sex(row.get("gender")) or "unknown",
            birth_date=_optional_text(row.get("birth_date")),
            birth_date_precision=_optional_text(row.get("birth_date_precision")) or "unknown",
            birth_date_text=_optional_text(row.get("birth_date_text")),
            death_date=_optional_text(row.get("death_date")),
            life_status=_normalize_life_status(row.get("status")) or "unknown",
            birthplace=_optional_text(row.get("birthplace")),
            current_location=_optional_text(row.get("current_location")),
            father_slug=_optional_text(row.get("father_slug")),
            mother_slug=_optional_text(row.get("mother_slug")),
            primary_source_ids=_split_values(row.get("primary_source_ids")),
            evidence_status=_required_text(row, "evidence_status", f"panda {slug}"),
            aliases=tuple(supplement.get("aliases", ())),
            external_identifiers=tuple(supplement.get("external_identifiers", ())),
        )
        pandas_by_slug[slug] = panda

    source_key_links, explicit_external_links = _load_identity_links(
        identity_links_raw,
        pandas_by_slug,
    )
    external_index: dict[tuple[str, str], set[str]] = defaultdict(set)
    for panda in pandas_by_slug.values():
        for system, value in panda.external_identifiers:
            external_index[_external_identifier_key(system, value)].add(panda.canonical_slug)
    for link in explicit_external_links:
        external_index[_external_identifier_key(link.system, link.value)].add(link.canonical_slug)

    events_by_panda: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in event_rows:
        slug = _required_text(row, "panda_slug", "events.csv")
        if slug not in pandas_by_slug:
            raise ValueError(f"event references unknown panda {slug!r}")
        events_by_panda[slug].append(dict(row))
    media_by_panda: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in media_rows:
        slug = _required_text(row, "panda_slug", "media.csv")
        if slug not in pandas_by_slug:
            raise ValueError(f"media references unknown panda {slug!r}")
        media_by_panda[slug].append(dict(row))

    source_urls = {
        _required_text(row, "source_id", "sources.csv"): _required_text(row, "url", "sources.csv")
        for row in source_rows
    }
    return ReconciliationSnapshot(
        pandas_by_slug=MappingProxyType(dict(pandas_by_slug)),
        events_by_panda=MappingProxyType(
            {
                slug: tuple(
                    MappingProxyType(dict(row))
                    for row in sorted(rows, key=lambda row: row["event_id"])
                )
                for slug, rows in events_by_panda.items()
            }
        ),
        media_by_panda=MappingProxyType(
            {
                slug: tuple(
                    MappingProxyType(dict(row))
                    for row in sorted(
                        rows,
                        key=lambda row: (row["source_url"], row["asset"]),
                    )
                )
                for slug, rows in media_by_panda.items()
            }
        ),
        source_urls_by_id=MappingProxyType(dict(source_urls)),
        source_key_links=MappingProxyType(dict(source_key_links)),
        external_identifier_index=MappingProxyType(
            {key: tuple(sorted(slugs)) for key, slugs in external_index.items()}
        ),
        field_assertion_ids=MappingProxyType(
            {
                (stable_id_to_slug.get(subject_id, subject_id), field): tuple(sorted(ids))
                for (subject_id, field), ids in field_assertions.items()
                if stable_id_to_slug.get(subject_id, subject_id) in pandas_by_slug
            }
        ),
        parent_assertion_ids=MappingProxyType(
            {
                (stable_id_to_slug.get(child_id, child_id), role): tuple(sorted(ids))
                for (child_id, role), ids in parent_assertions.items()
                if stable_id_to_slug.get(child_id, child_id) in pandas_by_slug
            }
        ),
        inputs=(
            pandas_input,
            sources_input,
            events_input,
            media_input,
            links_input,
            golden_input,
        ),
    )


def reconcile_candidates(
    candidates: Sequence[FieldCandidate],
    *,
    source: ReviewedSource,
    cohort: str | None,
    snapshot: ReconciliationSnapshot | None = None,
) -> ReconciliationResult:
    trusted = snapshot or load_reconciliation_snapshot()
    by_subject: dict[str, list[FieldCandidate]] = defaultdict(list)
    for candidate in candidates:
        if candidate.source_id != source.source_id:
            raise ValueError("candidate source does not match reconciliation source")
        by_subject[candidate.subject_key].append(candidate)

    identity_by_subject = {
        subject_key: _match_subject(
            subject_candidates,
            source=source,
            cohort=cohort,
            snapshot=trusted,
        )
        for subject_key, subject_candidates in by_subject.items()
    }

    reconciled: list[FieldCandidate] = []
    for candidate in candidates:
        identity_match, identity_notes = identity_by_subject[candidate.subject_key]
        normalized_value = _normalize_candidate_value(candidate)
        current, conflict, comparison_notes = _compare_candidate(
            candidate,
            normalized_value=normalized_value,
            identity_match=identity_match,
            snapshot=trusted,
        )
        reconciled.append(
            replace(
                candidate,
                normalized_value=normalized_value,
                identity_match=identity_match,
                current_trusted_value=current,
                conflict_state=conflict,
                notes=tuple(
                    dict.fromkeys(
                        (
                            *candidate.notes,
                            *identity_notes,
                            *comparison_notes,
                            f"reconciliation_snapshot_id={trusted.snapshot_id}",
                        )
                    )
                ),
            )
        )

    summary = ReconciliationSummary(
        snapshot_id=trusted.snapshot_id,
        candidate_count=len(reconciled),
        identity_state_counts=MappingProxyType(
            dict(Counter(candidate.identity_match.state.value for candidate in reconciled))
        ),
        conflict_state_counts=MappingProxyType(
            dict(Counter(candidate.conflict_state.value for candidate in reconciled))
        ),
    )
    return ReconciliationResult(candidates=tuple(reconciled), summary=summary)


def _match_subject(
    candidates: Sequence[FieldCandidate],
    *,
    source: ReviewedSource,
    cohort: str | None,
    snapshot: ReconciliationSnapshot,
) -> tuple[PandaIdentityMatch, tuple[str, ...]]:
    subject_key = candidates[0].subject_key
    strong_matches: set[str] = set()
    bases: list[str] = []

    link = snapshot.source_key_links.get((source.source_id, subject_key))
    if link is not None:
        strong_matches.add(link.canonical_slug)
        bases.append(f"reviewed source key: {link.basis}")

    external_matches = _external_identifier_matches(candidates, snapshot)
    if external_matches:
        strong_matches.update(external_matches)
        bases.append("explicit external identifier")

    if len(strong_matches) > 1:
        return _ambiguous_match(subject_key, strong_matches, snapshot), (
            "identity_match_basis=conflicting explicit identity references",
        )
    if len(strong_matches) == 1:
        slug = next(iter(strong_matches))
        panda = snapshot.pandas_by_slug[slug]
        return (
            PandaIdentityMatch(
                state=IdentityMatchState.MATCHED,
                source_identity=subject_key,
                matched_panda_id=panda.stable_id,
                matched_canonical_slug=slug,
                notes=tuple(sorted(set(bases))),
            ),
            (f"identity_match_basis={' | '.join(sorted(set(bases)))}",),
        )

    name_terms = _candidate_name_terms(candidates)
    if not name_terms or not cohort:
        return (
            PandaIdentityMatch(
                state=IdentityMatchState.UNMATCHED,
                source_identity=subject_key,
                notes=(
                    "No reviewed source key or external identifier matched; "
                    "exact-name matching requires a named cohort.",
                ),
            ),
            ("identity_match_basis=unmatched",),
        )

    scope = set(snapshot.source_scope(source))
    if not scope:
        return (
            PandaIdentityMatch(
                state=IdentityMatchState.UNMATCHED,
                source_identity=subject_key,
                notes=("The reviewed source has no curation-backed identity scope.",),
            ),
            ("identity_match_basis=unmatched source scope",),
        )

    matches: set[str] = set()
    ambiguous = False
    for term in name_terms:
        term_matches = {
            slug for slug in scope if _panda_matches_exact_term(snapshot.pandas_by_slug[slug], term)
        }
        matches.update(term_matches)
        ambiguous = ambiguous or len(term_matches) > 1

    if ambiguous or len(matches) > 1:
        return _ambiguous_match(subject_key, matches, snapshot), (
            f"identity_match_basis=ambiguous exact reviewed name within cohort {cohort}",
        )
    if len(matches) == 1:
        slug = next(iter(matches))
        panda = snapshot.pandas_by_slug[slug]
        return (
            PandaIdentityMatch(
                state=IdentityMatchState.MATCHED,
                source_identity=subject_key,
                matched_panda_id=panda.stable_id,
                matched_canonical_slug=slug,
                notes=(f"Exact reviewed name or alias is unique within source cohort {cohort}.",),
            ),
            (f"identity_match_basis=unique exact name in cohort {cohort}",),
        )

    return (
        PandaIdentityMatch(
            state=IdentityMatchState.UNMATCHED,
            source_identity=subject_key,
            notes=(f"No exact reviewed name or alias matched within source cohort {cohort}.",),
        ),
        ("identity_match_basis=unmatched exact cohort name",),
    )


def _ambiguous_match(
    source_identity: str,
    slugs: Iterable[str],
    snapshot: ReconciliationSnapshot,
) -> PandaIdentityMatch:
    references = tuple(sorted(snapshot.pandas_by_slug[slug].match_reference for slug in set(slugs)))
    if len(references) < 2:
        return PandaIdentityMatch(
            state=IdentityMatchState.UNMATCHED,
            source_identity=source_identity,
            notes=("No unique existing panda identity was accepted.",),
        )
    return PandaIdentityMatch(
        state=IdentityMatchState.AMBIGUOUS,
        source_identity=source_identity,
        candidate_panda_ids=references,
        notes=("Competing identities are retained for curator review.",),
    )


def _external_identifier_matches(
    candidates: Sequence[FieldCandidate],
    snapshot: ReconciliationSnapshot,
) -> set[str]:
    matches: set[str] = set()
    for candidate in candidates:
        if not any(
            marker in candidate.field_path.lower() for marker in _EXTERNAL_IDENTIFIER_MARKERS
        ):
            continue
        identifier = _external_identifier_from_candidate(candidate)
        if identifier is None:
            continue
        matches.update(snapshot.external_identifier_index.get(identifier, ()))
    return matches


def _external_identifier_from_candidate(
    candidate: FieldCandidate,
) -> tuple[str, str] | None:
    value = candidate.normalized_value
    if isinstance(value, dict):
        system = _optional_text(value.get("system"))
        identifier = _optional_text(value.get("value"))
        if system and identifier:
            return _external_identifier_key(system, identifier)
    suffix = candidate.field_path.rsplit(".", 1)[-1]
    identifier = _optional_text(value) if isinstance(value, str) else None
    if suffix and identifier and "identifier" not in suffix:
        return _external_identifier_key(suffix, identifier)
    return None


def _candidate_name_terms(candidates: Sequence[FieldCandidate]) -> tuple[str, ...]:
    terms: list[str] = []
    for candidate in candidates:
        path = candidate.field_path.lower()
        if not any(marker in path for marker in _NAME_PATH_MARKERS):
            continue
        value = _name_text(candidate.normalized_value)
        if value:
            terms.append(value)
    return tuple(dict.fromkeys(terms))


def _panda_matches_exact_term(panda: CurationPanda, term: str) -> bool:
    normalized = normalize_identity_term(term)
    return bool(normalized) and any(
        normalize_identity_term(candidate) == normalized for candidate in panda.reviewed_name_terms
    )


def _normalize_candidate_value(candidate: FieldCandidate) -> JsonValue:
    field = _canonical_field_path(candidate.field_path)
    value = candidate.normalized_value
    if field == "identity.sex":
        return _normalize_sex(value) or _normalize_scalar(value)
    if field == "identity.life_status":
        return _normalize_life_status(value) or _normalize_scalar(value)
    if field in {"identity.birth_date", "identity.death_date"}:
        return _normalize_date_value(value)
    if field.startswith("identity.names.") or ".alias" in field:
        return _normalize_name_value(value)
    if field in {"identity.birthplace", "residency.current_location"}:
        return _normalize_location_value(value)
    if field in _RELATIONSHIP_PATHS.values() or field.startswith("relationship."):
        return _normalize_parent_reference(value)
    if candidate.candidate_kind.value == "event" or field == "event" or field.startswith("events."):
        return _normalize_event_value(value)
    if any(marker in field for marker in _EXTERNAL_IDENTIFIER_MARKERS):
        return _normalize_external_identifier_value(value, field)
    return _normalize_json_value(value)


def _compare_candidate(
    candidate: FieldCandidate,
    *,
    normalized_value: JsonValue,
    identity_match: PandaIdentityMatch,
    snapshot: ReconciliationSnapshot,
) -> tuple[CurrentTrustedValue, ConflictState, tuple[str, ...]]:
    candidate_present = _value_is_present(normalized_value)
    if identity_match.state is IdentityMatchState.AMBIGUOUS:
        return (
            CurrentTrustedValue(present=False),
            ConflictState.NOT_COMPARED,
            ("comparison_basis=identity ambiguous; no current value selected",),
        )
    if identity_match.state is IdentityMatchState.UNMATCHED:
        conflict = ConflictState.NEW if candidate_present else ConflictState.NOT_COMPARED
        basis = (
            "new unmatched source subject"
            if candidate_present
            else "unmatched subject emitted an absent or unknown source value"
        )
        return (
            CurrentTrustedValue(present=False),
            conflict,
            (f"comparison_basis={basis}",),
        )
    if identity_match.state is not IdentityMatchState.MATCHED:
        return (
            CurrentTrustedValue(present=False),
            ConflictState.NOT_COMPARED,
            ("comparison_basis=identity matching not completed",),
        )

    slug = identity_match.matched_canonical_slug
    if slug is None or slug not in snapshot.pandas_by_slug:
        return (
            CurrentTrustedValue(present=False),
            ConflictState.NOT_COMPARED,
            ("comparison_basis=matched identity is absent from curation snapshot",),
        )
    panda = snapshot.pandas_by_slug[slug]
    known, current, basis = _current_value_for_candidate(
        candidate,
        panda=panda,
        snapshot=snapshot,
    )
    if not candidate_present:
        return (
            current,
            ConflictState.NOT_COMPARED,
            (
                "comparison_basis=source candidate is absent or unknown; "
                f"absence is not evidence against {basis}",
            ),
        )
    if not known:
        return current, ConflictState.NEW, (f"comparison_basis=new field; {basis}",)
    if not current.present:
        return (
            current,
            ConflictState.MISSING_CURRENT_VALUE,
            (f"comparison_basis=known field has no current curation value; {basis}",),
        )

    conflict = _compare_values(
        candidate,
        candidate_value=normalized_value,
        current_value=current.value,
    )
    return current, conflict, (f"comparison_basis={basis}",)


def _current_value_for_candidate(
    candidate: FieldCandidate,
    *,
    panda: CurationPanda,
    snapshot: ReconciliationSnapshot,
) -> tuple[bool, CurrentTrustedValue, str]:
    field = _canonical_field_path(candidate.field_path)
    assertion_ids: tuple[str, ...] = ()
    value: JsonValue = None
    known = True

    if field == "identity.names.official.en":
        value = panda.name_en
    elif field == "identity.names.official.zh":
        value = panda.name_zh
    elif ".alias" in field:
        value = list(panda.aliases)
    elif field == "identity.sex":
        value = panda.gender if panda.gender != "unknown" else None
        assertion_ids = snapshot.field_assertion_ids.get((panda.canonical_slug, "sex"), ())
    elif field == "identity.life_status":
        value = panda.life_status if panda.life_status != "unknown" else None
        assertion_ids = snapshot.field_assertion_ids.get((panda.canonical_slug, "life_status"), ())
    elif field == "identity.birth_date":
        value = _current_date_value(
            panda.birth_date,
            panda.birth_date_precision,
            panda.birth_date_text,
        )
        assertion_ids = snapshot.field_assertion_ids.get((panda.canonical_slug, "birth_date"), ())
    elif field == "identity.death_date":
        value = _current_date_value(panda.death_date, "day", None)
        assertion_ids = snapshot.field_assertion_ids.get((panda.canonical_slug, "death_date"), ())
    elif field == "identity.birthplace":
        value = panda.birthplace
    elif field == "residency.current_location":
        value = panda.current_location
        assertion_ids = snapshot.field_assertion_ids.get(
            (panda.canonical_slug, "current_coarse_location"), ()
        )
    elif field in {"relationship.father", "parentage.father", "father_slug"}:
        value = panda.father_slug
        assertion_ids = snapshot.parent_assertion_ids.get((panda.canonical_slug, "father"), ())
    elif field in {"relationship.mother", "parentage.mother", "mother_slug"}:
        value = panda.mother_slug
        assertion_ids = snapshot.parent_assertion_ids.get((panda.canonical_slug, "mother"), ())
    elif (
        candidate.candidate_kind.value == "event" or field == "event" or field.startswith("events.")
    ):
        rows = snapshot.events_by_panda.get(panda.canonical_slug, ())
        value = [_normalize_current_event(row) for row in rows]
        assertion_ids = tuple(row["event_id"] for row in rows)
    elif field in {"media.original_url", "media.asset"}:
        value = [row["asset"] for row in snapshot.media_by_panda.get(panda.canonical_slug, ())]
    elif field in {"media.description_url", "media.source_url"}:
        value = [row["source_url"] for row in snapshot.media_by_panda.get(panda.canonical_slug, ())]
    elif field in {"media.license_short_name", "media.license", "media.rights"}:
        value = [row["rights"] for row in snapshot.media_by_panda.get(panda.canonical_slug, ())]
    elif field == "media.credit":
        value = [row["credit"] for row in snapshot.media_by_panda.get(panda.canonical_slug, ())]
    elif field == "media.alt.zh":
        value = [row["alt_zh"] for row in snapshot.media_by_panda.get(panda.canonical_slug, ())]
    elif field == "media.alt.en":
        value = [row["alt_en"] for row in snapshot.media_by_panda.get(panda.canonical_slug, ())]
    elif any(marker in field for marker in _EXTERNAL_IDENTIFIER_MARKERS):
        system = field.rsplit(".", 1)[-1]
        value = [
            identifier_value
            for identifier_system, identifier_value in panda.external_identifiers
            if normalize_identity_term(identifier_system) == normalize_identity_term(system)
        ]
    else:
        known = False

    present = _value_is_present(value)
    return (
        known,
        CurrentTrustedValue(
            present=present,
            value=value if present else None,
            assertion_ids=assertion_ids if present else (),
        ),
        f"curation panda {panda.canonical_slug} field {field}",
    )


def _compare_values(
    candidate: FieldCandidate,
    *,
    candidate_value: JsonValue,
    current_value: JsonValue,
) -> ConflictState:
    field = _canonical_field_path(candidate.field_path)
    if candidate.candidate_kind.value == "event" or field == "event" or field.startswith("events."):
        return _compare_event(candidate_value, current_value)
    if field in {"identity.birth_date", "identity.death_date"}:
        return _compare_dates(candidate_value, current_value)
    if field.startswith("identity.names.") or ".alias" in field:
        return _compare_names(
            candidate_value,
            current_value,
            alias_field=".alias" in field,
        )
    if field in {"identity.birthplace", "residency.current_location"}:
        return _compare_locations(candidate_value, current_value)
    if (
        field.startswith("relationship.")
        or field.startswith("parentage.")
        or field
        in {
            "father_slug",
            "mother_slug",
        }
    ):
        return _compare_parent_reference(candidate_value, current_value)
    if isinstance(current_value, list):
        return (
            ConflictState.UNCHANGED
            if any(_json_equal(candidate_value, value) for value in current_value)
            else ConflictState.CONTRADICTION
        )
    return (
        ConflictState.UNCHANGED
        if _json_equal(candidate_value, current_value)
        else ConflictState.CONTRADICTION
    )


def _compare_dates(candidate: JsonValue, current: JsonValue) -> ConflictState:
    if not isinstance(candidate, dict) or not isinstance(current, dict):
        return (
            ConflictState.UNCHANGED
            if _json_equal(candidate, current)
            else ConflictState.CONTRADICTION
        )
    candidate_value = str(candidate.get("value") or "")
    current_value = str(current.get("value") or "")
    if candidate_value == current_value and candidate.get("precision") == current.get("precision"):
        return ConflictState.UNCHANGED
    if _date_prefix_compatible(candidate_value, current_value):
        candidate_rank = _precision_rank(str(candidate.get("precision") or "unknown"))
        current_rank = _precision_rank(str(current.get("precision") or "unknown"))
        return (
            ConflictState.ENRICHMENT if candidate_rank > current_rank else ConflictState.UNCHANGED
        )
    return ConflictState.CONTRADICTION


def _compare_names(
    candidate: JsonValue,
    current: JsonValue,
    *,
    alias_field: bool,
) -> ConflictState:
    candidate_text = _name_text(candidate)
    if isinstance(current, list):
        current_values = [str(value) for value in current]
    else:
        current_values = [str(current)]
    normalized = normalize_identity_term(candidate_text or "")
    if normalized and any(normalize_identity_term(value) == normalized for value in current_values):
        return ConflictState.UNCHANGED
    return ConflictState.ENRICHMENT if alias_field else ConflictState.CONTRADICTION


def _compare_locations(candidate: JsonValue, current: JsonValue) -> ConflictState:
    candidate_text = _location_text(candidate)
    current_text = _location_text(current)
    if not candidate_text or not current_text:
        return ConflictState.CONTRADICTION
    candidate_key = _location_key(candidate_text)
    current_key = _location_key(current_text)
    if candidate_key == current_key:
        return ConflictState.UNCHANGED
    candidate_tokens = _location_tokens(candidate_text)
    current_tokens = _location_tokens(current_text)
    candidate_institution = _location_component_tokens(candidate, "institution")
    candidate_context = frozenset().union(
        *(
            _location_component_tokens(candidate, key)
            for key in ("city", "region", "state", "province", "country")
        )
    )
    if candidate_institution and candidate_institution <= current_tokens:
        if candidate_context and not candidate_context <= current_tokens:
            return ConflictState.CONTRADICTION
        return (
            ConflictState.ENRICHMENT
            if candidate_tokens - current_tokens
            else ConflictState.UNCHANGED
        )
    if current_tokens and current_tokens < candidate_tokens:
        return ConflictState.ENRICHMENT
    if candidate_tokens and candidate_tokens < current_tokens:
        return ConflictState.UNCHANGED
    return ConflictState.CONTRADICTION


def _compare_parent_reference(candidate: JsonValue, current: JsonValue) -> ConflictState:
    if isinstance(candidate, dict):
        slug = _optional_text(candidate.get("canonical_slug"))
        if slug:
            return ConflictState.UNCHANGED if slug == current else ConflictState.CONTRADICTION
        return ConflictState.NOT_COMPARED
    return ConflictState.UNCHANGED if candidate == current else ConflictState.NOT_COMPARED


def _compare_event(candidate: JsonValue, current: JsonValue) -> ConflictState:
    if not isinstance(candidate, dict) or not isinstance(current, list):
        return ConflictState.NEW
    same_type = [
        event
        for event in current
        if isinstance(event, dict) and event.get("event_type") == candidate.get("event_type")
    ]
    if not same_type:
        return ConflictState.NEW
    same_date = [
        event
        for event in same_type
        if _date_values_compatible(event.get("event_date"), candidate.get("event_date"))
    ]
    if not same_date:
        return ConflictState.CONTRADICTION
    for event in same_date:
        if _json_equal(candidate, event):
            return ConflictState.UNCHANGED
        conflict = False
        enrichment = (
            _compare_dates(candidate.get("event_date"), event.get("event_date"))
            is ConflictState.ENRICHMENT
        )

        candidate_location = candidate.get("location")
        current_location = event.get("location")
        if _value_is_present(candidate_location):
            if not _value_is_present(current_location):
                enrichment = True
            else:
                location_state = _compare_locations(candidate_location, current_location)
                if location_state is ConflictState.CONTRADICTION:
                    conflict = True
                elif location_state is ConflictState.ENRICHMENT:
                    enrichment = True

        candidate_related = candidate.get("related_slugs")
        current_related = event.get("related_slugs")
        if _value_is_present(candidate_related):
            if candidate.get("related_reference_kind") == "source-text":
                enrichment = True
            elif not _value_is_present(current_related):
                enrichment = True
            elif not _json_equal(candidate_related, current_related):
                conflict = True

        if not conflict:
            return ConflictState.ENRICHMENT if enrichment else ConflictState.UNCHANGED
    return ConflictState.CONTRADICTION


def _normalize_date_value(value: JsonValue) -> JsonValue:
    precision: str | None = None
    text: str | None = None
    if isinstance(value, dict):
        precision = _optional_text(value.get("precision"))
        text = next(
            (
                _optional_text(value.get(key))
                for key in _DATE_VALUE_KEYS
                if _optional_text(value.get(key))
            ),
            None,
        )
        if text is None:
            text = _optional_text(value.get("text"))
    else:
        text = _optional_text(value)
    if text is None:
        return None
    normalized, inferred_precision = _parse_date_text(text)
    return {
        "value": normalized,
        "precision": _normalize_precision(precision or inferred_precision),
    }


def _current_date_value(
    value: str | None,
    precision: str,
    text: str | None,
) -> JsonValue:
    candidate = value or text
    if not candidate:
        return None
    normalized, inferred = _parse_date_text(candidate)
    return {
        "value": normalized,
        "precision": _normalize_precision(precision or inferred),
    }


def _parse_date_text(value: str) -> tuple[str, str]:
    text = _collapse_space(value).replace("Sept.", "Sep.").replace(".", "")
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
        return text, "day"
    if re.fullmatch(r"\d{4}-\d{2}", text):
        return text, "month"
    if re.fullmatch(r"\d{4}", text):
        return text, "year"
    for pattern in _DATE_PATTERNS:
        try:
            return datetime.strptime(text, pattern).date().isoformat(), "day"
        except ValueError:
            continue
    year_match = re.search(r"(?<!\d)(18|19|20)\d{2}(?!\d)", text)
    if year_match:
        return year_match.group(0), "year"
    return text, "unknown"


def _normalize_precision(value: str) -> str:
    normalized = _collapse_space(value).casefold().replace("-", "_")
    if normalized in {"day", "exact", "date"}:
        return "day"
    if normalized in {"month", "month_text"}:
        return "month"
    if normalized in {"year", "year_text", "age_text"}:
        return "year"
    return "unknown"


def _precision_rank(value: str) -> int:
    return {"unknown": 0, "year": 1, "month": 2, "day": 3}.get(_normalize_precision(value), 0)


def _date_prefix_compatible(left: str, right: str) -> bool:
    if not left or not right:
        return False
    shorter, longer = sorted((left, right), key=len)
    return longer.startswith(shorter)


def _date_values_compatible(left: Any, right: Any) -> bool:
    if not isinstance(left, dict) or not isinstance(right, dict):
        return False
    return _date_prefix_compatible(str(left.get("value") or ""), str(right.get("value") or ""))


def _normalize_name_value(value: JsonValue) -> JsonValue:
    if isinstance(value, dict):
        result = {str(key): _normalize_json_value(item) for key, item in value.items()}
        if "value" in result and isinstance(result["value"], str):
            result["value"] = _collapse_space(result["value"])
        return result
    return _collapse_space(str(value)) if value is not None else None


def _normalize_location_value(value: JsonValue) -> JsonValue:
    if isinstance(value, dict):
        return {str(key): _normalize_json_value(item) for key, item in value.items()}
    return _collapse_space(str(value)) if value is not None else None


def _normalize_parent_reference(value: JsonValue) -> JsonValue:
    if isinstance(value, dict):
        result = {str(key): _normalize_json_value(item) for key, item in value.items()}
        if "canonical_slug" in result and isinstance(result["canonical_slug"], str):
            result["canonical_slug"] = _slugify(result["canonical_slug"])
        return result
    if isinstance(value, str):
        return _collapse_space(value)
    return _normalize_json_value(value)


def _normalize_event_value(value: JsonValue) -> JsonValue:
    if not isinstance(value, dict):
        return _normalize_json_value(value)
    event_type = _normalize_event_type(value.get("event_type") or value.get("type"))
    date_value = value.get("event_date") or value.get("date")
    has_canonical_related = "related_slugs" in value
    related = value.get("related_slugs") or value.get("related") or []
    if isinstance(related, str):
        related_values = list(_split_values(related))
    elif isinstance(related, list):
        related_values = sorted(
            _collapse_space(str(item)) for item in related if _optional_text(item)
        )
    else:
        related_values = []
    return {
        "event_type": event_type,
        "event_date": _normalize_date_value(date_value),
        "location": _normalize_location_value(value.get("location")),
        "related_slugs": related_values,
        "related_reference_kind": (
            ("canonical-slug" if has_canonical_related else "source-text")
            if related_values
            else None
        ),
    }


def _normalize_current_event(row: Mapping[str, str]) -> dict[str, JsonValue]:
    return {
        "event_type": _normalize_event_type(row.get("event_type")),
        "event_date": _normalize_date_value(
            {
                "value": row.get("event_date"),
                "precision": row.get("event_date_precision"),
            }
        ),
        "location": _normalize_location_value(row.get("location")),
        "related_slugs": list(_split_values(row.get("related_slugs"))),
        "related_reference_kind": "canonical-slug",
    }


def _normalize_event_type(value: Any) -> str | None:
    text = _optional_text(value)
    if text is None:
        return None
    normalized = _collapse_space(text).casefold().replace("-", "_")
    return _EVENT_TYPE_VALUES.get(normalized, normalized.replace(" ", "_"))


def _normalize_external_identifier_value(value: JsonValue, field: str) -> JsonValue:
    if isinstance(value, dict):
        system = _optional_text(value.get("system"))
        identifier = _optional_text(value.get("value"))
        if not system or not identifier:
            return None
        normalized_system, normalized_identifier = _external_identifier_key(system, identifier)
        return {"system": normalized_system, "value": normalized_identifier}
    identifier = _optional_text(value)
    if identifier is None:
        return None
    suffix = field.rsplit(".", 1)[-1]
    normalized_system, normalized_identifier = _external_identifier_key(suffix, identifier)
    return {"system": normalized_system, "value": normalized_identifier}


def _normalize_json_value(value: JsonValue) -> JsonValue:
    if isinstance(value, str):
        return _collapse_space(value)
    if isinstance(value, list):
        return [_normalize_json_value(item) for item in value]
    if isinstance(value, dict):
        return {
            str(key): _normalize_json_value(item)
            for key, item in sorted(value.items(), key=lambda item: str(item[0]))
        }
    return value


def _normalize_sex(value: Any) -> str | None:
    text = _scalar_text(value)
    if text is None:
        return None
    return _SEX_VALUES.get(text.casefold(), text.casefold())


def _normalize_life_status(value: Any) -> str | None:
    text = _scalar_text(value)
    if text is None:
        return None
    return _LIFE_STATUS_VALUES.get(text.casefold(), text.casefold())


def _normalize_scalar(value: Any) -> JsonValue:
    text = _scalar_text(value)
    return text.casefold() if text else None


def _scalar_text(value: Any) -> str | None:
    if isinstance(value, dict):
        for key in ("value", "label", "text"):
            text = _optional_text(value.get(key))
            if text:
                return _collapse_space(text)
        return None
    text = _optional_text(value)
    return _collapse_space(text) if text else None


def _name_text(value: JsonValue) -> str | None:
    if isinstance(value, dict):
        return _optional_text(value.get("value") or value.get("name"))
    return _optional_text(value)


def _location_text(value: JsonValue) -> str | None:
    if isinstance(value, dict):
        for key in ("name", "value", "label", "location"):
            text = _optional_text(value.get(key))
            if text:
                return text
        parts = tuple(
            dict.fromkeys(
                text
                for key in (
                    "facility",
                    "institution",
                    "city",
                    "region",
                    "state",
                    "province",
                    "country",
                )
                if (text := _optional_text(value.get(key)))
            )
        )
        return ", ".join(parts) if parts else None
    return _optional_text(value)


def _location_key(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value.casefold())
    return "".join(
        character
        for character in decomposed
        if not unicodedata.combining(character) and character.isalnum()
    )


def _location_tokens(value: str) -> frozenset[str]:
    decomposed = unicodedata.normalize("NFKD", value.casefold())
    normalized = "".join(
        character for character in decomposed if not unicodedata.combining(character)
    )
    return frozenset(re.findall(r"[^\W_]+", normalized, flags=re.UNICODE))


def _location_component_tokens(value: JsonValue, key: str) -> frozenset[str]:
    if not isinstance(value, dict):
        return frozenset()
    text = _optional_text(value.get(key))
    return _location_tokens(text) if text else frozenset()


def _canonical_field_path(value: str) -> str:
    normalized = value.strip().casefold().replace("-", "_")
    return _FIELD_ALIASES.get(normalized, normalized)


def _external_identifier_key(system: str, value: str) -> tuple[str, str]:
    normalized_system = _collapse_space(unicodedata.normalize("NFKC", system)).casefold()
    normalized_value = _collapse_space(unicodedata.normalize("NFKC", value))
    return normalized_system, normalized_value


def _json_equal(left: JsonValue, right: JsonValue) -> bool:
    return canonical_json_bytes(left) == canonical_json_bytes(right)


def _value_is_present(value: JsonValue) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip()) and value.casefold() not in {"unknown", "null", "none"}
    if isinstance(value, list):
        return any(_value_is_present(item) for item in value)
    if isinstance(value, dict):
        return any(_value_is_present(item) for item in value.values())
    return True


def _load_identity_links(
    raw: Mapping[str, Any],
    pandas_by_slug: Mapping[str, CurationPanda],
) -> tuple[
    dict[tuple[str, str], SourceKeyLink],
    tuple[ExternalIdentifierLink, ...],
]:
    if raw.get("schema_version") != 1:
        raise ValueError("identity links schema_version must be 1")
    date.fromisoformat(str(raw["reviewed_at"]))
    source_links: dict[tuple[str, str], SourceKeyLink] = {}
    for item in raw.get("source_keys", []):
        link = SourceKeyLink(
            source_id=_required_text(item, "source_id", "identity source key"),
            source_key=_required_text(item, "source_key", "identity source key"),
            canonical_slug=_required_text(item, "canonical_slug", "identity source key"),
            basis=_required_text(item, "basis", "identity source key"),
        )
        if link.canonical_slug not in pandas_by_slug:
            raise ValueError(
                f"identity source key references unknown panda {link.canonical_slug!r}"
            )
        key = (link.source_id, link.source_key)
        if key in source_links:
            raise ValueError(f"duplicate reviewed source key {key!r}")
        source_links[key] = link

    external_links: list[ExternalIdentifierLink] = []
    seen_external: set[tuple[str, str, str]] = set()
    for item in raw.get("external_identifiers", []):
        link = ExternalIdentifierLink(
            system=_required_text(item, "system", "identity external identifier"),
            value=_required_text(item, "value", "identity external identifier"),
            canonical_slug=_required_text(item, "canonical_slug", "identity external identifier"),
            basis=_required_text(item, "basis", "identity external identifier"),
        )
        if link.canonical_slug not in pandas_by_slug:
            raise ValueError(
                f"external identifier references unknown panda {link.canonical_slug!r}"
            )
        key = (*_external_identifier_key(link.system, link.value), link.canonical_slug)
        if key in seen_external:
            raise ValueError(f"duplicate external identity link {key!r}")
        seen_external.add(key)
        external_links.append(link)
    return source_links, tuple(external_links)


def _load_golden_identity_supplement(
    raw: Mapping[str, Any],
) -> tuple[
    dict[str, dict[str, Any]],
    dict[str, str],
    dict[tuple[str, str], list[str]],
    dict[tuple[str, str], list[str]],
]:
    by_slug: dict[str, dict[str, Any]] = {}
    stable_id_to_slug: dict[str, str] = {}
    for record in raw.get("pandas", []):
        if record.get("publication_status") != "published":
            continue
        public = record.get("public") or {}
        slug = _optional_text(public.get("canonical_slug"))
        stable_id = _optional_text(record.get("id"))
        if not slug or not stable_id:
            continue
        aliases = [
            str(item["value"])
            for item in public.get("aliases", [])
            if isinstance(item, dict) and _optional_text(item.get("value"))
        ]
        names = [
            str(item["value"])
            for item in public.get("names", [])
            if isinstance(item, dict) and _optional_text(item.get("value"))
        ]
        external = [
            (str(item["system"]), str(item["value"]))
            for item in public.get("external_identifiers", [])
            if isinstance(item, dict)
            and _optional_text(item.get("system"))
            and _optional_text(item.get("value"))
        ]
        by_slug[slug] = {
            "stable_id": stable_id,
            "aliases": tuple(dict.fromkeys((*aliases, *names))),
            "external_identifiers": tuple(dict.fromkeys(external)),
        }
        stable_id_to_slug[stable_id] = slug

    field_assertions: dict[tuple[str, str], list[str]] = defaultdict(list)
    for fact in raw.get("facts", []):
        if fact.get("publication_status") != "published":
            continue
        public = fact.get("public") or {}
        subject_id = _optional_text(public.get("subject_id"))
        field = _optional_text(public.get("field"))
        fact_id = _optional_text(fact.get("id"))
        if subject_id and field and fact_id:
            field_assertions[(subject_id, field)].append(fact_id)

    parent_assertions: dict[tuple[str, str], list[str]] = defaultdict(list)
    for assertion in raw.get("parentage_assertions", []):
        if assertion.get("publication_status") != "published":
            continue
        public = assertion.get("public") or {}
        child_id = _optional_text(public.get("child_id"))
        role = _optional_text(public.get("role"))
        assertion_id = _optional_text(assertion.get("id"))
        if child_id and role and assertion_id:
            parent_assertions[(child_id, role)].append(assertion_id)
    return by_slug, stable_id_to_slug, field_assertions, parent_assertions


def _url_is_in_source_scope(url: str, source: ReviewedSource) -> bool:
    try:
        source.validate_request_target(url, live=False)
    except ValueError:
        return False
    return True


def _read_csv(path: Path) -> tuple[list[dict[str, str]], InputSnapshot]:
    body = path.read_bytes()
    rows = list(csv.DictReader(body.decode("utf-8-sig").splitlines()))
    return rows, _input_snapshot(path, body, len(rows))


def _read_json(path: Path) -> tuple[dict[str, Any], InputSnapshot]:
    body = path.read_bytes()
    raw = json.loads(body)
    if not isinstance(raw, dict):
        raise ValueError(f"JSON input must be an object: {path}")
    return raw, _input_snapshot(path, body, None)


def _input_snapshot(path: Path, body: bytes, row_count: int | None) -> InputSnapshot:
    try:
        relative = path.resolve().relative_to(_REPOSITORY_ROOT.resolve()).as_posix()
    except ValueError:
        relative = str(path.resolve())
    return InputSnapshot(
        path=relative,
        bytes=len(body),
        sha256=sha256(body).hexdigest(),
        row_count=row_count,
    )


def _validate_unique(rows: Sequence[Mapping[str, str]], key: str, label: str) -> None:
    values = [row.get(key, "").strip() for row in rows]
    if any(not value for value in values):
        raise ValueError(f"{label} contains an empty {key}")
    duplicates = sorted(value for value, count in Counter(values).items() if count > 1)
    if duplicates:
        raise ValueError(f"{label} contains duplicate {key} values: {duplicates}")


def _required_text(mapping: Mapping[str, Any], key: str, label: str) -> str:
    value = _optional_text(mapping.get(key))
    if value is None:
        raise ValueError(f"{label} requires {key}")
    return value


def _optional_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _split_values(value: Any) -> tuple[str, ...]:
    text = _optional_text(value)
    if text is None:
        return ()
    return tuple(dict.fromkeys(item.strip() for item in text.split(";") if item.strip()))


def _collapse_space(value: str) -> str:
    return " ".join(value.split())


def _slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.strip().casefold())
    parts = re.findall(r"[a-z0-9]+", "".join(c for c in normalized if not unicodedata.combining(c)))
    return "-".join(parts)


__all__ = [
    "SCHEMA_VERSION",
    "CurationPanda",
    "InputSnapshot",
    "ReconciliationResult",
    "ReconciliationSnapshot",
    "ReconciliationSummary",
    "load_reconciliation_snapshot",
    "reconcile_candidates",
]
