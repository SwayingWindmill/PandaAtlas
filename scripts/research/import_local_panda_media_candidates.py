from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

REPO_ROOT = Path(__file__).resolve().parents[2]
LOCAL_MEDIA_ROOT = REPO_ROOT / "data" / "local-panda-research" / "media"
DEFAULT_OUTPUT = LOCAL_MEDIA_ROOT / "candidates.jsonl"
MEDIA_RELEASES_ROOT = REPO_ROOT / "data" / "media-library" / "releases"
DEFAULT_COMMONS_DISCOVERY = (
    REPO_ROOT
    / "data"
    / "media-library"
    / "discovery"
    / "commons-first-public-five-results.json"
)
PANDAS_CSV = REPO_ROOT / "data" / "curation" / "pandas" / "pandas.csv"

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".tif", ".tiff", ".svg"}


class CandidateImportError(RuntimeError):
    pass


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def latest_release_dir(root: Path = MEDIA_RELEASES_ROOT) -> Path:
    releases = sorted(path for path in root.iterdir() if path.is_dir())
    if not releases:
        raise CandidateImportError(f"no media-library releases found under {root}")
    return releases[-1]


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8-sig") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise CandidateImportError(f"{path} must contain a JSON object")
    return value


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8-sig") as handle:
        for line_number, raw_line in enumerate(handle, start=1):
            line = raw_line.strip()
            if not line:
                continue
            value = json.loads(line)
            if not isinstance(value, dict):
                raise CandidateImportError(f"{path}:{line_number} must be a JSON object")
            rows.append(value)
    return rows


def load_panda_labels(path: Path = PANDAS_CSV) -> dict[str, str]:
    labels: dict[str, str] = {}
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            slug = (row.get("slug") or "").strip()
            if not slug:
                continue
            label = (row.get("name_en") or row.get("name_zh") or slug).strip()
            labels[slug] = label
    return labels


def load_panda_alias_index(path: Path = PANDAS_CSV) -> dict[str, set[str]]:
    aliases: dict[str, set[str]] = {}
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            slug = (row.get("slug") or "").strip()
            if not slug:
                continue
            variants = {
                slug.replace("-", " "),
                (row.get("name_en") or "").strip(),
                (row.get("name_zh") or "").strip(),
            }
            for raw_variant in list(variants):
                for separator in ("/", ";", "|"):
                    if separator in raw_variant:
                        variants.update(part.strip() for part in raw_variant.split(separator))
            for variant in variants:
                normalized = variant.casefold().strip()
                if len(normalized) < 2:
                    continue
                aliases.setdefault(normalized, set()).add(slug)
    return aliases


_IDENTITY_HINT_STOPWORDS = {
    "base",
    "breeding",
    "center",
    "centre",
    "china",
    "current",
    "giant",
    "panda",
    "park",
    "province",
    "research",
    "unknown",
    "wildlife",
    "zoo",
}


def _identity_hint_terms(value: str) -> set[str]:
    terms = set(re.findall(r"[0-9a-z]+|[\u3400-\u9fff]{2,}", value.casefold()))
    return {
        term
        for term in terms
        if term not in _IDENTITY_HINT_STOPWORDS
        and (len(term) >= 4 or _contains_cjk(term))
    }


def load_panda_identity_hints(path: Path = PANDAS_CSV) -> dict[str, set[str]]:
    hints: dict[str, set[str]] = {}
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            slug = (row.get("slug") or "").strip()
            if not slug:
                continue
            values = [
                row.get("birthplace") or "",
                row.get("current_location") or "",
                row.get("tags") or "",
            ]
            terms: set[str] = set()
            for value in values:
                terms.update(_identity_hint_terms(value))
            hints[slug] = terms
    return hints


def load_panda_relationships(path: Path = PANDAS_CSV) -> dict[str, set[str]]:
    relationships: dict[str, set[str]] = {}
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            slug = (row.get("slug") or "").strip()
            if not slug:
                continue
            relationships.setdefault(slug, set())
            for field in ("father_slug", "mother_slug"):
                relative = (row.get(field) or "").strip()
                if not relative:
                    continue
                relationships[slug].add(relative)
                relationships.setdefault(relative, set()).add(slug)
    return relationships


def _first_year(*values: str) -> int | None:
    for value in values:
        match = re.search(r"(?<!\d)(18\d{2}|19\d{2}|20\d{2})(?!\d)", value)
        if match:
            return int(match.group(1))
    return None


def load_panda_life_ranges(path: Path = PANDAS_CSV) -> dict[str, tuple[int | None, int | None]]:
    ranges: dict[str, tuple[int | None, int | None]] = {}
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            slug = (row.get("slug") or "").strip()
            if not slug:
                continue
            birth_year = _first_year(
                row.get("birth_date") or "",
                row.get("birth_date_text") or "",
            )
            death_year = _first_year(row.get("death_date") or "")
            ranges[slug] = (birth_year, death_year)
    return ranges


def _suffix_from_url(asset_url: str) -> str:
    suffix = Path(urlparse(asset_url).path).suffix.lower()
    if suffix in IMAGE_SUFFIXES:
        return ".jpg" if suffix == ".jpeg" else suffix
    return ".jpg"


def _local_filename(subject_id: str, candidate_id: str, asset_url: str) -> str:
    digest = hashlib.sha256(asset_url.encode("utf-8")).hexdigest()[:12]
    suffix = _suffix_from_url(asset_url)
    safe_subject = "".join(
        character if character.isalnum() or character in {"-", "_"} else "-"
        for character in subject_id.lower()
    ).strip("-") or "unresolved-panda"
    safe_candidate = candidate_id.removeprefix("media-candidate-")[:12]
    return f"{safe_subject}-{safe_candidate}-{digest}{suffix}"


def _write_candidates(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "".join(canonical_json(row) + "\n" for row in rows),
        encoding="utf-8",
        newline="",
    )


def candidate_from_release(
    source: dict[str, Any],
    *,
    labels: dict[str, str],
    release_version: str,
    discovered_at: str,
) -> dict[str, Any]:
    asset_url = str(source.get("asset_url") or "").strip()
    source_url = str(source.get("source_url") or "").strip()
    panda_slug = str(source.get("panda_slug") or "").strip()
    candidate_id = str(source.get("candidate_id") or "").strip()
    if not asset_url.startswith("https://"):
        raise CandidateImportError(f"candidate {candidate_id!r} has no HTTPS asset_url")
    if not source_url.startswith("https://"):
        raise CandidateImportError(f"candidate {candidate_id!r} has no HTTPS source_url")
    if not panda_slug:
        raise CandidateImportError(f"candidate {candidate_id!r} has no panda_slug")

    media_digest = hashlib.sha256(asset_url.encode("utf-8")).hexdigest()[:20]
    captured_at = source.get("captured_at") or "unknown"
    review_state = str(source.get("review_state") or "unknown")
    rights_state = str(source.get("rights_state") or "unknown")
    rights_label = str(source.get("rights_label") or "unknown")
    identity_confidence = source.get("identity_confidence")
    if not isinstance(identity_confidence, (int, float)):
        identity_confidence = 0.5

    return {
        "media_id": f"local-media-library-{media_digest}",
        "subject_id": panda_slug,
        "subject_label": labels.get(panda_slug, panda_slug),
        "source_page_url": source_url,
        "asset_url": asset_url,
        "credit": str(source.get("credit") or "Unknown credit"),
        "description": str(
            source.get("alt_en")
            or source.get("alt_zh")
            or f"Image candidate for {panda_slug}."
        ),
        "captured_at": str(captured_at),
        "identity_confidence": float(identity_confidence),
        "rights_label": rights_label,
        "rights_state": rights_state,
        "collection_priority": 1 if review_state == "approved" else 2,
        "local_filename": _local_filename(panda_slug, candidate_id, asset_url),
        "discovered_at": discovered_at,
        "notes": (
            f"Imported from media-library release {release_version}; original candidate "
            f"{candidate_id}; review_state={review_state}. Rights metadata is retained but never gates local ingestion."
        ),
    }


def import_release_candidates(
    *,
    release_dir: Path,
    output_path: Path = DEFAULT_OUTPUT,
    discovered_at: str,
) -> dict[str, int]:
    payload = load_json(release_dir / "candidates.json")
    release_version = str(payload.get("dataset_release_version") or release_dir.name)
    source_candidates = payload.get("candidates")
    if not isinstance(source_candidates, list):
        raise CandidateImportError(f"{release_dir / 'candidates.json'} has no candidates array")

    existing = load_jsonl(output_path)
    existing_urls = {
        str(row.get("asset_url"))
        for row in existing
        if isinstance(row.get("asset_url"), str)
    }
    existing_ids = {
        str(row.get("media_id"))
        for row in existing
        if isinstance(row.get("media_id"), str)
    }
    labels = load_panda_labels()

    additions: list[dict[str, Any]] = []
    skipped_duplicates = 0
    for source in source_candidates:
        if not isinstance(source, dict):
            continue
        asset_url = str(source.get("asset_url") or "")
        if asset_url in existing_urls:
            skipped_duplicates += 1
            continue
        candidate = candidate_from_release(
            source,
            labels=labels,
            release_version=release_version,
            discovered_at=discovered_at,
        )
        if candidate["media_id"] in existing_ids:
            skipped_duplicates += 1
            continue
        additions.append(candidate)
        existing_urls.add(candidate["asset_url"])
        existing_ids.add(candidate["media_id"])

    combined = existing + sorted(
        additions,
        key=lambda row: (row["collection_priority"], row["subject_id"], row["media_id"]),
    )
    _write_candidates(output_path, combined)
    return {
        "source_candidates": len(source_candidates),
        "existing_candidates": len(existing),
        "added_candidates": len(additions),
        "skipped_duplicates": skipped_duplicates,
        "total_candidates": len(combined),
    }


def _contains_cjk(value: str) -> bool:
    return any("\u3400" <= character <= "\u9fff" for character in value)


_AMBIGUOUS_COMMON_ALIASES = {"happy", "long long", "na na", "pan"}


def _alias_matches_text(alias: str, text: str) -> bool:
    if _contains_cjk(alias):
        return alias in text
    if alias in _AMBIGUOUS_COMMON_ALIASES:
        explicit_patterns = (
            rf"panda named {re.escape(alias)}(?![0-9a-z])",
            rf"(?<![0-9a-z]){re.escape(alias)} the panda(?![0-9a-z])",
            rf"named ['\"]?{re.escape(alias)}['\"]?(?![0-9a-z])",
            rf"(?<![0-9a-z]){re.escape(alias)}\s*\(giant panda\)",
            rf"(?<![0-9a-z]){re.escape(alias)} giant panda(?![0-9a-z])",
            rf"giant panda ['\"]?{re.escape(alias)}['\"]?(?![0-9a-z])",
        )
        return any(re.search(pattern, text) is not None for pattern in explicit_patterns)
    pattern = rf"(?<![0-9a-z]){re.escape(alias)}(?![0-9a-z])"
    return re.search(pattern, text) is not None


def _has_giant_panda_signal(source: dict[str, Any]) -> bool:
    text = " ".join(
        [
            str(source.get("file_title") or ""),
            str(source.get("description") or ""),
            " ".join(str(value) for value in source.get("categories") or []),
        ]
    ).casefold()
    signals = ("giant panda", "ailuropoda melanoleuca", "大熊猫")
    return any(signal in text for signal in signals)


def _has_fictional_or_merchandise_signal(source: dict[str, Any]) -> bool:
    text = " ".join(
        [
            str(source.get("file_title") or ""),
            str(source.get("description") or ""),
            " ".join(str(value) for value in source.get("categories") or []),
        ]
    ).casefold()
    signals = (
        "red panda",
        "ailurus fulgens",
        "小熊猫",
        "fiat panda",
        "rallying automobiles",
        " automobile",
        "kung fu panda",
        "功夫熊猫",
        "universal studios",
        "universal beijing",
        "环球影城",
        "souvenir",
        "纪念品",
        " entry",
        " entrance",
        " logo",
        " signage",
        "入口",
        "标识",
        "招牌",
        "taxidermied",
        "taxidermy",
        " specimen",
        "bone of the",
        "skeleton of",
        "stuffed panda",
        "natural history museum",
        "naturkunde museum",
        "ausgestopfter",
        "剥制",
        "标本",
        " sticker",
        " stickers",
        " poster",
        " illustration",
        " podcast",
        "bloggercon",
        " botanic garden",
        "classification: plantae",
        " poaceae",
        "pogonatherum",
        "bamboo grass",
        "贴纸",
        "海报",
        "插画",
    )
    return any(signal in text for signal in signals)


def _related_media_topic(source: dict[str, Any]) -> tuple[str, str, str] | None:
    text = _commons_identity_text(source)
    if "crate" in text and "panda" in text and (
        "transport" in text or "given by china" in text
    ):
        return (
            "topic-1972-panda-transport-crates",
            "1972 panda transport crates",
            "historical_artifact",
        )
    signage_signals = (
        "panda waiting time",
        "time schedules",
        "signs in",
        "on signs",
        "main gate",
        " entry",
        " entrance",
    )
    has_panda_context = "panda" in text or "ailuropoda melanoleuca" in text
    costume_signals = (
        "panda cosplay",
        "giant panda cosplay",
        "panda costume",
        "panda mascot costume",
    )
    if any(signal in text for signal in costume_signals):
        return (
            "topic-panda-costumes",
            "Panda costumes and cosplay",
            "panda_costume",
        )
    research_diagram_signals = (
        "phylogenetic tree",
        "orthomam",
        "comparative genomics",
        "evolutionary genomics",
    )
    if has_panda_context and any(signal in text for signal in research_diagram_signals):
        return (
            "topic-panda-research-diagrams",
            "Panda-related research diagrams",
            "research_diagram",
        )
    if has_panda_context and any(signal in text for signal in signage_signals):
        return (
            "topic-panda-facility-signage",
            "Panda facility signage",
            "facility_signage",
        )
    memorial_signals = ("statue", "sculpture", "memorial", "塑像", "雕像", "雕塑")
    primary_text = " ".join(
        [str(source.get("file_title") or ""), str(source.get("description") or "")]
    ).casefold()
    has_memorial_panda_context = "panda" in primary_text or "熊猫" in primary_text
    if has_memorial_panda_context and any(signal in text for signal in memorial_signals):
        return (
            "topic-panda-memorials",
            "Panda statues and memorials",
            "panda_memorial",
        )
    cultural_object_signals = (
        "teddybear",
        "teddy bear",
        "handsewn",
        "handmade",
        "mohair",
        "alpaca",
        "stuffed toy",
        "plush toy",
    )
    if has_panda_context and any(signal in text for signal in cultural_object_signals):
        return (
            "topic-panda-cultural-objects",
            "Panda-themed cultural objects",
            "cultural_object",
        )
    return None


def _memorial_explicitly_represents_named_panda(source: dict[str, Any]) -> bool:
    primary_text = " ".join(
        [str(source.get("file_title") or ""), str(source.get("description") or "")]
    ).casefold()
    return any(
        signal in primary_text
        for signal in (
            "statue of panda",
            "statue of giant panda",
            "memorial to panda",
            "panda memorial",
            "熊猫" if "塑像" in primary_text or "雕像" in primary_text else "\0",
        )
    )


def _commons_identity_text(source: dict[str, Any]) -> str:
    return " ".join(
        [
            str(source.get("file_title") or ""),
            str(source.get("description") or ""),
            " ".join(str(value) for value in source.get("categories") or []),
        ]
    ).casefold()


def _explicit_media_subjects(source: dict[str, Any]) -> tuple[list[str], str | None]:
    primary_text = " ".join(
        [str(source.get("file_title") or ""), str(source.get("description") or "")]
    ).casefold()
    if re.search(r"(?<![0-9a-z])lun\s+and\s+lani(?![0-9a-z])", primary_text):
        return ["lun-lun", "mei-lan"], "community-nickname-crosswalk"
    if (
        "xing xing and qin qin" in primary_text
        and "columbus zoo" in primary_text
        and "1992" in primary_text
    ):
        return ["qin-qin-xian-1989", "xing-xing-chengdu-1989"], "historic-loan-description-crosswalk"
    return [], None


def resolve_commons_subjects(
    source: dict[str, Any],
    *,
    alias_index: dict[str, set[str]],
) -> list[str]:
    primary_text = " ".join(
        [
            str(source.get("file_title") or ""),
            str(source.get("description") or ""),
        ]
    ).casefold()
    category_text = " ".join(
        str(value) for value in source.get("categories") or []
    ).casefold()

    primary_matches: set[str] = set()
    category_matches: set[str] = set()
    for alias, slugs in alias_index.items():
        if _alias_matches_text(alias, primary_text):
            primary_matches.update(slugs)
        elif _alias_matches_text(alias, category_text):
            category_matches.update(slugs)

    return sorted(primary_matches or category_matches)


def disambiguate_commons_subjects(
    source: dict[str, Any],
    subjects: list[str],
    *,
    identity_hints: dict[str, set[str]],
    relationships: dict[str, set[str]] | None = None,
    life_ranges: dict[str, tuple[int | None, int | None]] | None = None,
) -> list[str]:
    if len(subjects) < 2:
        return subjects

    captured_year = _first_year(
        str(source.get("file_title") or ""),
        str(source.get("description") or ""),
        str(source.get("captured_at_text") or ""),
    )
    if captured_year is not None:
        possible = []
        for slug in subjects:
            birth_year, death_year = (life_ranges or {}).get(slug, (None, None))
            if birth_year is not None and captured_year < birth_year:
                continue
            if death_year is not None and captured_year > death_year:
                continue
            possible.append(slug)
        if possible:
            subjects = possible
        if len(subjects) < 2:
            return subjects

    text = _commons_identity_text(source)
    scores = {
        slug: sum(1 for hint in identity_hints.get(slug, set()) if _alias_matches_text(hint, text))
        for slug in subjects
    }
    best_score = max(scores.values(), default=0)
    if best_score >= 1:
        return [slug for slug in subjects if scores[slug] == best_score]

    relationship_map = relationships or {}
    subject_set = set(subjects)
    relation_scores = {
        slug: len(relationship_map.get(slug, set()) & subject_set)
        for slug in subjects
    }
    best_relation_score = max(relation_scores.values(), default=0)
    if best_relation_score >= 1:
        return [slug for slug in subjects if relation_scores[slug] == best_relation_score]
    return subjects


def candidate_from_commons_discovery(
    source: dict[str, Any],
    *,
    labels: dict[str, str],
    alias_index: dict[str, set[str]],
    identity_hints: dict[str, set[str]] | None = None,
    relationships: dict[str, set[str]] | None = None,
    life_ranges: dict[str, tuple[int | None, int | None]] | None = None,
    discovered_at: str,
) -> dict[str, Any] | None:
    mime = str(source.get("mime") or "")
    if not mime.startswith("image/"):
        return None
    asset_url = str(source.get("original_url") or "").strip()
    source_page_url = str(source.get("description_url") or "").strip()
    candidate_id = str(source.get("candidate_id") or "").strip()
    if not asset_url.startswith("https://") or not source_page_url.startswith("https://"):
        return None
    related_topic = _related_media_topic(source)
    if _has_fictional_or_merchandise_signal(source) and related_topic is None:
        return None

    subjects, explicit_identity_basis = _explicit_media_subjects(source)
    if not subjects:
        subjects = resolve_commons_subjects(source, alias_index=alias_index)
        subjects = disambiguate_commons_subjects(
            source,
            subjects,
            identity_hints=identity_hints or {},
            relationships=relationships,
            life_ranges=None if related_topic and related_topic[2] == "panda_memorial" else life_ranges,
        )
    source_confidence = source.get("identity_confidence")
    if not isinstance(source_confidence, (int, float)):
        source_confidence = 0.25
    if explicit_identity_basis == "historic-loan-description-crosswalk":
        source_confidence = max(float(source_confidence), 0.9)
    elif explicit_identity_basis:
        source_confidence = max(float(source_confidence), 0.65)
    if not subjects and not _has_giant_panda_signal(source) and related_topic is None:
        return None

    same_label_ambiguity = len(subjects) > 1 and len(
        {labels.get(slug, slug).casefold() for slug in subjects}
    ) == 1

    if related_topic is not None:
        subject_id, subject_label, media_kind = related_topic
        identity_confidence = 0.95
        collection_priority = 3
    elif len(subjects) == 1:
        subject_id = subjects[0]
        subject_label = labels.get(subject_id, subject_id)
        identity_confidence = max(float(source_confidence), 0.5)
        collection_priority = 2
        media_kind = "individual_panda"
    elif subjects and not same_label_ambiguity:
        group_digest = hashlib.sha256("|".join(subjects).encode("utf-8")).hexdigest()[:12]
        subject_id = f"group-{group_digest}"
        subject_label = " / ".join(labels.get(slug, slug) for slug in subjects)
        identity_confidence = (
            float(source_confidence)
            if explicit_identity_basis == "historic-loan-description-crosswalk"
            else min(float(source_confidence), 0.75)
        )
        collection_priority = 2
        media_kind = "panda_group"
    else:
        subject_id = "unresolved-commons"
        subject_label = "Unresolved Wikimedia Commons panda candidate"
        identity_confidence = min(float(source_confidence), 0.25)
        collection_priority = 3
        media_kind = "unresolved_panda"

    asset_digest = hashlib.sha256(asset_url.encode("utf-8")).hexdigest()[:20]
    artist = str(source.get("artist") or "").strip()
    uploader = str(source.get("uploader") or "").strip()
    credit = artist or uploader or str(source.get("credit") or "Unknown credit")
    rights_label = str(
        source.get("license_short_name")
        or source.get("usage_terms")
        or "unknown"
    )
    rights_state = str(source.get("rights_state") or "unknown")
    captured_at = str(source.get("captured_at_text") or "unknown")

    row = {
        "media_id": f"local-media-commons-{asset_digest}",
        "subject_id": subject_id,
        "subject_label": subject_label,
        "media_kind": media_kind,
        "source_page_url": source_page_url,
        "asset_url": asset_url,
        "credit": credit,
        "description": str(source.get("description") or source.get("file_title") or "Panda image candidate."),
        "captured_at": captured_at,
        "identity_confidence": identity_confidence,
        "rights_label": rights_label,
        "rights_state": rights_state,
        "collection_priority": collection_priority,
        "local_filename": _local_filename(subject_id, candidate_id, asset_url),
        "discovered_at": discovered_at,
        "notes": (
            "Imported from the existing Wikimedia Commons discovery results. "
            "Search-target identity was not trusted automatically; names were resolved from file title, description and categories. "
            "Rights metadata is retained but never gates local ingestion."
        ),
        "related_subject_ids": subjects if media_kind in {"individual_panda", "panda_group"} else [],
        "represented_subject_ids": (
            subjects
            if media_kind == "panda_memorial" and _memorial_explicitly_represents_named_panda(source)
            else []
        ),
        "identity_basis": explicit_identity_basis or str(source.get("identity_basis") or "metadata-alias-resolution"),
        "discovery_query": str(source.get("query") or ""),
        "original_discovery_candidate_id": candidate_id,
    }
    return row


def import_commons_discovery_candidates(
    *,
    discovery_path: Path = DEFAULT_COMMONS_DISCOVERY,
    output_path: Path = DEFAULT_OUTPUT,
    discovered_at: str,
) -> dict[str, int]:
    payload = load_json(discovery_path)
    source_candidates = payload.get("candidates")
    if not isinstance(source_candidates, list):
        raise CandidateImportError(f"{discovery_path} has no candidates array")

    existing = load_jsonl(output_path)
    source_candidate_ids = {
        str(source.get("candidate_id"))
        for source in source_candidates
        if isinstance(source, dict) and isinstance(source.get("candidate_id"), str)
    }
    original_existing_count = len(existing)
    existing = [
        row
        for row in existing
        if not (
            str(row.get("media_id") or "").startswith("local-media-commons-")
            and row.get("original_discovery_candidate_id") in source_candidate_ids
        )
    ]
    reconciled_candidates = original_existing_count - len(existing)
    existing_urls = {
        str(row.get("asset_url"))
        for row in existing
        if isinstance(row.get("asset_url"), str)
    }
    existing_ids = {
        str(row.get("media_id"))
        for row in existing
        if isinstance(row.get("media_id"), str)
    }
    labels = load_panda_labels()
    alias_index = load_panda_alias_index()
    identity_hints = load_panda_identity_hints()
    relationships = load_panda_relationships()
    life_ranges = load_panda_life_ranges()

    additions: list[dict[str, Any]] = []
    skipped_duplicates = 0
    skipped_non_images = 0
    for source in source_candidates:
        if not isinstance(source, dict):
            continue
        candidate = candidate_from_commons_discovery(
            source,
            labels=labels,
            alias_index=alias_index,
            identity_hints=identity_hints,
            relationships=relationships,
            life_ranges=life_ranges,
            discovered_at=discovered_at,
        )
        if candidate is None:
            skipped_non_images += 1
            continue
        if candidate["asset_url"] in existing_urls or candidate["media_id"] in existing_ids:
            skipped_duplicates += 1
            continue
        additions.append(candidate)
        existing_urls.add(candidate["asset_url"])
        existing_ids.add(candidate["media_id"])

    combined = existing + sorted(
        additions,
        key=lambda row: (row["collection_priority"], row["subject_id"], row["media_id"]),
    )
    _write_candidates(output_path, combined)
    return {
        "source_candidates": len(source_candidates),
        "existing_candidates": original_existing_count,
        "reconciled_candidates": reconciled_candidates,
        "added_candidates": len(additions),
        "skipped_duplicates": skipped_duplicates,
        "skipped_non_images": skipped_non_images,
        "total_candidates": len(combined),
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Import existing media candidates into the local-only media vault."
    )
    parser.add_argument("--release-dir", type=Path, default=None)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--discovered-at", default="2026-07-25")
    parser.add_argument(
        "--include-commons-discovery",
        action="store_true",
        help="Also import every image from the existing Wikimedia Commons discovery result set.",
    )
    parser.add_argument("--commons-discovery", type=Path, default=DEFAULT_COMMONS_DISCOVERY)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    release_dir = args.release_dir or latest_release_dir()
    try:
        release_summary = import_release_candidates(
            release_dir=release_dir,
            output_path=args.output,
            discovered_at=args.discovered_at,
        )
        commons_summary = None
        if args.include_commons_discovery:
            commons_summary = import_commons_discovery_candidates(
                discovery_path=args.commons_discovery,
                output_path=args.output,
                discovered_at=args.discovered_at,
            )
    except (OSError, json.JSONDecodeError, CandidateImportError) as error:
        print(f"Local media candidate import failed:\n{error}")
        return 1

    message = (
        "Local media candidate import passed: "
        f"release_source={release_summary['source_candidates']}, "
        f"release_added={release_summary['added_candidates']}, "
        f"release_duplicates={release_summary['skipped_duplicates']}, "
        f"total={release_summary['total_candidates']}"
    )
    if commons_summary is not None:
        message += (
            f"; commons_source={commons_summary['source_candidates']}, "
            f"commons_reconciled={commons_summary['reconciled_candidates']}, "
            f"commons_added={commons_summary['added_candidates']}, "
            f"commons_duplicates={commons_summary['skipped_duplicates']}, "
            f"commons_non_images={commons_summary['skipped_non_images']}, "
            f"total={commons_summary['total_candidates']}"
        )
    print(message + ".")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
