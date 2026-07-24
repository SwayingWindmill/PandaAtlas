from __future__ import annotations

import argparse
import csv
import hashlib
import json
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

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".tif", ".tiff"}


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


def resolve_commons_subjects(
    source: dict[str, Any],
    *,
    alias_index: dict[str, set[str]],
) -> list[str]:
    text_parts = [
        str(source.get("file_title") or ""),
        str(source.get("description") or ""),
        " ".join(str(value) for value in source.get("categories") or []),
    ]
    text = " ".join(text_parts).casefold()
    matches: set[str] = set()
    for alias, slugs in alias_index.items():
        if alias in text:
            matches.update(slugs)

    target_slug = str(source.get("panda_slug") or "").strip()
    if not matches and target_slug:
        matches.add(target_slug)
    return sorted(matches)


def candidate_from_commons_discovery(
    source: dict[str, Any],
    *,
    labels: dict[str, str],
    alias_index: dict[str, set[str]],
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

    subjects = resolve_commons_subjects(source, alias_index=alias_index)
    source_confidence = source.get("identity_confidence")
    if not isinstance(source_confidence, (int, float)):
        source_confidence = 0.25

    if len(subjects) == 1:
        subject_id = subjects[0]
        subject_label = labels.get(subject_id, subject_id)
        identity_confidence = max(float(source_confidence), 0.5)
        collection_priority = 2
    elif subjects:
        group_digest = hashlib.sha256("|".join(subjects).encode("utf-8")).hexdigest()[:12]
        subject_id = f"group-{group_digest}"
        subject_label = " / ".join(labels.get(slug, slug) for slug in subjects)
        identity_confidence = min(float(source_confidence), 0.75)
        collection_priority = 2
    else:
        subject_id = "unresolved-commons"
        subject_label = "Unresolved Wikimedia Commons panda candidate"
        identity_confidence = min(float(source_confidence), 0.25)
        collection_priority = 3

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
        "related_subject_ids": subjects,
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
        "existing_candidates": len(existing),
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
            f"commons_added={commons_summary['added_candidates']}, "
            f"commons_duplicates={commons_summary['skipped_duplicates']}, "
            f"commons_non_images={commons_summary['skipped_non_images']}, "
            f"total={commons_summary['total_candidates']}"
        )
    print(message + ".")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
