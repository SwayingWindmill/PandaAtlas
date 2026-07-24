from __future__ import annotations

import argparse
import csv
import hashlib
import json
import shutil
from copy import deepcopy
from itertools import combinations
from pathlib import Path
from typing import Any

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[2]
CURATION_DIR = REPO_ROOT / "data" / "curation" / "pandas"
BASE_VERSION = "2026.07.24.2"
BATCH_VERSION = "2026.07.24.3"
REVIEWED_AT = "2026-07-24"
BASE_SOURCE_PATH = REPO_ROOT / "data" / "reviewed-batches" / BASE_VERSION / "source.json"
BATCH_DIR = REPO_ROOT / "data" / "reviewed-batches" / BATCH_VERSION
OUTPUT_PATH = BATCH_DIR / "source.json"
PROCESSOR_MANIFEST_PATH = BATCH_DIR / "processor-manifest.json"
MEDIA_MANIFEST_PATH = BATCH_DIR / "media-manifest.json"
DUPLICATE_REVIEW_PATH = BATCH_DIR / "duplicate-review.json"
SOURCE_INTEGRITY_PATH = BATCH_DIR / "source-integrity.json"
DISCOVERY_RESULT_PATH = (
    REPO_ROOT / "data" / "media-library" / "discovery" / "commons-first-public-five-results.json"
)
DISCOVERY_MANIFEST_PATH = (
    REPO_ROOT
    / "data"
    / "media-library"
    / "discovery"
    / "commons-first-public-five-results-manifest.json"
)
DEFAULT_MEDIA_WORK_DIR = REPO_ROOT / ".media-work" / BATCH_VERSION
MEDIA_BASE_URL = f"https://api.zhipanda.com/media/releases/{BATCH_VERSION}"
PERCEPTUAL_ALGORITHM = "dhash-64-grayscale-lanczos"
NEAR_DUPLICATE_DISTANCE = 6

CANDIDATES: dict[str, dict[str, Any]] = {
    "commons-candidate-73ee162326e52f8d7f6bb4aa": {
        "panda_slug": "mei-xiang",
        "file_title": "File:Mei Xiang at Smithsonian's National Zoo.jpg",
        "original_url": "https://upload.wikimedia.org/wikipedia/commons/1/14/Mei_Xiang_at_Smithsonian%27s_National_Zoo.jpg",
        "description_url": "https://commons.wikimedia.org/wiki/File:Mei_Xiang_at_Smithsonian%27s_National_Zoo.jpg",
        "sha1": "93891d91768cf1c161a0ebced5922a7252058114",
        "bytes": 16946734,
        "width": 5472,
        "height": 3648,
        "mime": "image/jpeg",
        "license_short_name": "CC BY-SA 4.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/4.0",
        "attribution_required": True,
        "identity_confidence": 0.95,
        "identity_basis": "canonical-name-in-title-and-description",
        "rights_confidence": 0.95,
        "rights_state": "open_license",
        "uploader": "O01326",
        "artist": "O01326",
        "source_id": "src_commons_mei_xiang_73ee1623",
        "curator_role": "primary",
    },
    "commons-candidate-7c99cc1fb00e3519f119e770": {
        "panda_slug": "xiao-qi-ji",
        "file_title": "File:Giant Panda Xiao Qi Ji at Smithsonian's National Zoo.jpg",
        "original_url": "https://upload.wikimedia.org/wikipedia/commons/7/72/Giant_Panda_Xiao_Qi_Ji_at_Smithsonian%27s_National_Zoo.jpg",
        "description_url": "https://commons.wikimedia.org/wiki/File:Giant_Panda_Xiao_Qi_Ji_at_Smithsonian%27s_National_Zoo.jpg",
        "sha1": "e26b745e4b63c27b22322c1fd1fcec20adb0fc56",
        "bytes": 16518783,
        "width": 5472,
        "height": 3648,
        "mime": "image/jpeg",
        "license_short_name": "CC BY-SA 4.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/4.0",
        "attribution_required": True,
        "identity_confidence": 0.95,
        "identity_basis": "canonical-name-in-title-and-description",
        "rights_confidence": 0.95,
        "rights_state": "open_license",
        "uploader": "O01326",
        "artist": "O01326",
        "source_id": "src_commons_xiao_qi_ji_7c99cc1f",
        "curator_role": "primary",
    },
    "commons-candidate-ba6b6fecf09aa90d296dd228": {
        "panda_slug": "xiao-qi-ji",
        "file_title": "File:Panda Cub Xiao Qi Ji Wrestling with Mama Panda 1.jpg",
        "original_url": "https://upload.wikimedia.org/wikipedia/commons/9/9c/Panda_Cub_Xiao_Qi_Ji_Wrestling_with_Mama_Panda_1.jpg",
        "description_url": "https://commons.wikimedia.org/wiki/File:Panda_Cub_Xiao_Qi_Ji_Wrestling_with_Mama_Panda_1.jpg",
        "sha1": "f7b7e4e636961c1094d99da03ff55be96e87ac54",
        "bytes": 8618294,
        "width": 6000,
        "height": 4000,
        "mime": "image/jpeg",
        "license_short_name": "CC BY 2.0",
        "license_url": "https://creativecommons.org/licenses/by/2.0",
        "attribution_required": True,
        "identity_confidence": 0.85,
        "identity_basis": "canonical-name-in-title",
        "rights_confidence": 0.95,
        "rights_state": "open_license",
        "uploader": "Ser Amantio di Nicolao",
        "artist": "Amaury Laporte",
        "source_id": "src_commons_xiao_qi_ji_ba6b6fec",
        "curator_role": "gallery",
    },
    "commons-candidate-cdfdd7cc694698fb52fd70e0": {
        "panda_slug": "xiao-qi-ji",
        "file_title": "File:Panda Cub Xiao Qi Ji Wrestling with Mama Panda 3.jpg",
        "original_url": "https://upload.wikimedia.org/wikipedia/commons/1/11/Panda_Cub_Xiao_Qi_Ji_Wrestling_with_Mama_Panda_3.jpg",
        "description_url": "https://commons.wikimedia.org/wiki/File:Panda_Cub_Xiao_Qi_Ji_Wrestling_with_Mama_Panda_3.jpg",
        "sha1": "81c8b11aaa2b240a2b6ac165832f2652c242999b",
        "bytes": 8313238,
        "width": 6000,
        "height": 4000,
        "mime": "image/jpeg",
        "license_short_name": "CC BY 2.0",
        "license_url": "https://creativecommons.org/licenses/by/2.0",
        "attribution_required": True,
        "identity_confidence": 0.85,
        "identity_basis": "canonical-name-in-title",
        "rights_confidence": 0.95,
        "rights_state": "open_license",
        "uploader": "Ser Amantio di Nicolao",
        "artist": "Amaury Laporte",
        "source_id": "src_commons_xiao_qi_ji_cdfdd7cc",
        "curator_role": "gallery",
    },
    "commons-candidate-5bf1a592b3376ff690ec0f73": {
        "panda_slug": "xiao-qi-ji",
        "file_title": "File:Panda Cub Xiao Qi Ji Wrestling with Mama Panda 2.jpg",
        "original_url": "https://upload.wikimedia.org/wikipedia/commons/4/4c/Panda_Cub_Xiao_Qi_Ji_Wrestling_with_Mama_Panda_2.jpg",
        "description_url": "https://commons.wikimedia.org/wiki/File:Panda_Cub_Xiao_Qi_Ji_Wrestling_with_Mama_Panda_2.jpg",
        "sha1": "c5b0c06924c2f1869963f49856189ff4e1a7bba5",
        "bytes": 9036827,
        "width": 6000,
        "height": 4000,
        "mime": "image/jpeg",
        "license_short_name": "CC BY 2.0",
        "license_url": "https://creativecommons.org/licenses/by/2.0",
        "attribution_required": True,
        "identity_confidence": 0.85,
        "identity_basis": "canonical-name-in-title",
        "rights_confidence": 0.95,
        "rights_state": "open_license",
        "uploader": "Ser Amantio di Nicolao",
        "artist": "Amaury Laporte",
        "source_id": "src_commons_xiao_qi_ji_5bf1a592",
        "curator_role": "gallery",
    },
    "commons-candidate-d905ec669d6111bb4e9016fe": {
        "panda_slug": "xiao-qi-ji",
        "file_title": "File:Panda Cub Xiao Qi Ji Wrestling Mama Panda for Ice Treat 15.jpg",
        "original_url": "https://upload.wikimedia.org/wikipedia/commons/d/dc/Panda_Cub_Xiao_Qi_Ji_Wrestling_Mama_Panda_for_Ice_Treat_15.jpg",
        "description_url": "https://commons.wikimedia.org/wiki/File:Panda_Cub_Xiao_Qi_Ji_Wrestling_Mama_Panda_for_Ice_Treat_15.jpg",
        "sha1": "444f17175cafc07ac1c2c5e6a5c85d29724c810d",
        "bytes": 7702127,
        "width": 6000,
        "height": 4000,
        "mime": "image/jpeg",
        "license_short_name": "CC BY 2.0",
        "license_url": "https://creativecommons.org/licenses/by/2.0",
        "attribution_required": True,
        "identity_confidence": 0.85,
        "identity_basis": "canonical-name-in-title",
        "rights_confidence": 0.95,
        "rights_state": "open_license",
        "uploader": "Ser Amantio di Nicolao",
        "artist": "Amaury Laporte",
        "source_id": "src_commons_xiao_qi_ji_d905ec66",
        "curator_role": "gallery",
    },
}


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return [dict(row) for row in csv.DictReader(handle)]


def pretty_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def canonical_json_sha256(value: Any) -> str:
    return sha256_bytes(canonical_json(value).encode("utf-8"))


def sha1_file(path: Path) -> str:
    digest = hashlib.sha1()  # noqa: S324 - required to verify the Commons revision identifier.
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def dhash(path: Path) -> str:
    with Image.open(path) as image:
        grayscale = image.convert("L").resize((9, 8), Image.Resampling.LANCZOS)
        pixels = list(grayscale.get_flattened_data())
    value = 0
    for row in range(8):
        offset = row * 9
        for column in range(8):
            value = (value << 1) | int(pixels[offset + column] > pixels[offset + column + 1])
    return f"{value:016x}"


def hamming(left: str, right: str) -> int:
    return (int(left, 16) ^ int(right, 16)).bit_count()


def discovery_candidates() -> dict[str, dict[str, Any]]:
    result = read_json(DISCOVERY_RESULT_PATH)
    candidates = {item["candidate_id"]: item for item in result.get("candidates", [])}
    missing = sorted(set(CANDIDATES) - set(candidates))
    if missing:
        raise ValueError(f"Missing reviewed Commons candidates: {missing}")
    review_ready = {
        candidate_id
        for candidate_id, item in candidates.items()
        if item.get("profile_image_eligible")
        and item.get("identity_confidence", 0) >= 0.85
        and item.get("rights_confidence", 0) >= 0.90
        and item.get("rights_state") in {"open_license", "public_domain"}
    }
    if review_ready != set(CANDIDATES):
        raise ValueError(
            "The review-ready Commons allowlist drifted: "
            f"expected {sorted(CANDIDATES)}, found {sorted(review_ready)}"
        )
    for candidate_id, expected in CANDIDATES.items():
        actual = candidates[candidate_id]
        for key in (
            "panda_slug",
            "file_title",
            "original_url",
            "description_url",
            "sha1",
            "bytes",
            "width",
            "height",
            "mime",
            "license_short_name",
            "license_url",
            "attribution_required",
            "identity_confidence",
            "identity_basis",
            "rights_confidence",
            "rights_state",
            "uploader",
            "artist",
        ):
            if actual.get(key) != expected[key]:
                raise ValueError(f"Candidate {candidate_id} field {key} drifted")
        if actual.get("original_image_downloaded") is not False:
            raise ValueError(f"Discovery candidate {candidate_id} must remain discovery-only")
    return {candidate_id: candidates[candidate_id] for candidate_id in sorted(CANDIDATES)}


def curation_rows() -> tuple[dict[str, dict[str, str]], dict[str, dict[str, str]]]:
    media_rows = read_csv(CURATION_DIR / "media.csv")
    source_rows = read_csv(CURATION_DIR / "sources.csv")
    expected_source_urls = {item["description_url"] for item in CANDIDATES.values()}
    expected_source_ids = {item["source_id"] for item in CANDIDATES.values()}
    media_by_source = {
        row["source_url"]: row
        for row in media_rows
        if row.get("source_url") in expected_source_urls
        and "candidate_id=commons-candidate-" in row.get("notes", "")
    }
    sources_by_id = {
        row["source_id"]: row
        for row in source_rows
        if row.get("source_id") in expected_source_ids
    }
    if set(media_by_source) != expected_source_urls:
        raise ValueError("Reviewed Commons curation media rows are incomplete or drifted")
    if set(sources_by_id) != expected_source_ids:
        raise ValueError("Reviewed Commons curation source rows are incomplete or drifted")
    return media_by_source, sources_by_id


def processor_records(manifest: dict[str, Any]) -> dict[str, dict[str, Any]]:
    if manifest.get("schema_version") != 1:
        raise ValueError("Processor manifest schema drifted")
    records = {
        record["source_url"]: record
        for record in manifest.get("records", [])
        if record.get("source_url") in {item["description_url"] for item in CANDIDATES.values()}
    }
    if set(records) != {item["description_url"] for item in CANDIDATES.values()}:
        raise ValueError("Processor manifest must contain all and only the six reviewed source URLs")
    return records


def build_duplicate_review(
    media_work_dir: Path,
    records: dict[str, dict[str, Any]],
    candidates: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    reviewed: list[dict[str, Any]] = []
    for candidate_id, candidate in candidates.items():
        record = records[candidate["description_url"]]
        original = record["original"]
        original_path = media_work_dir / original["path"]
        if not original_path.is_file():
            raise ValueError(f"Missing processed original for {candidate_id}: {original_path}")
        actual = {
            "sha256": sha256_file(original_path),
            "sha1": sha1_file(original_path),
            "bytes": original_path.stat().st_size,
            "width": original["width"],
            "height": original["height"],
            "mime_type": original["mime_type"],
        }
        expected = CANDIDATES[candidate_id]
        if actual["sha1"] != expected["sha1"]:
            raise ValueError(f"Downloaded Commons SHA-1 drifted for {candidate_id}")
        if actual["bytes"] != expected["bytes"]:
            raise ValueError(f"Downloaded Commons byte count drifted for {candidate_id}")
        if actual["width"] != expected["width"] or actual["height"] != expected["height"]:
            raise ValueError(f"Downloaded Commons dimensions drifted for {candidate_id}")
        if actual["mime_type"] != expected["mime"]:
            raise ValueError(f"Downloaded Commons MIME drifted for {candidate_id}")
        if original.get("sha256") != actual["sha256"]:
            raise ValueError(f"Processor SHA-256 drifted for {candidate_id}")
        reviewed.append(
            {
                "candidate_id": candidate_id,
                "panda_slug": candidate["panda_slug"],
                "curator_role": CANDIDATES[candidate_id]["curator_role"],
                "original_url": candidate["original_url"],
                "sha1": actual["sha1"],
                "sha256": actual["sha256"],
                "bytes": actual["bytes"],
                "width": actual["width"],
                "height": actual["height"],
                "mime_type": actual["mime_type"],
                "perceptual_hash": dhash(original_path),
            }
        )
    pairs: list[dict[str, Any]] = []
    near_pairs: list[dict[str, Any]] = []
    for left, right in combinations(reviewed, 2):
        exact = left["sha256"] == right["sha256"]
        distance = hamming(left["perceptual_hash"], right["perceptual_hash"])
        pair = {
            "left_candidate_id": left["candidate_id"],
            "right_candidate_id": right["candidate_id"],
            "exact_duplicate": exact,
            "perceptual_distance": distance,
            "near_duplicate": not exact and distance <= NEAR_DUPLICATE_DISTANCE,
            "decision": "collapse-exact" if exact else "retain-distinct",
        }
        if pair["near_duplicate"]:
            pair["decision"] = "manual-review-required"
            near_pairs.append(pair)
        pairs.append(pair)
    exact_groups: dict[str, list[str]] = {}
    for item in reviewed:
        exact_groups.setdefault(item["sha256"], []).append(item["candidate_id"])
    duplicate_groups = [values for values in exact_groups.values() if len(values) > 1]
    if duplicate_groups or near_pairs:
        raise ValueError(
            "Duplicate review found an unresolved exact or near duplicate: "
            f"exact={duplicate_groups}, near={near_pairs}"
        )
    return {
        "schema_version": 1,
        "batch_version": BATCH_VERSION,
        "reviewed_at": REVIEWED_AT,
        "candidate_count": len(reviewed),
        "algorithm": PERCEPTUAL_ALGORITHM,
        "near_duplicate_distance_threshold": NEAR_DUPLICATE_DISTANCE,
        "comparison_scope": "all six approved Commons originals; existing released originals unavailable in git",
        "existing_library_exact_check": "public derivative SHA-256 values are checked by the dual media library; original-byte perceptual comparison is not possible without archived originals",
        "records": sorted(reviewed, key=lambda item: item["candidate_id"]),
        "pairs": sorted(
            pairs,
            key=lambda item: (item["left_candidate_id"], item["right_candidate_id"]),
        ),
        "exact_duplicate_groups": duplicate_groups,
        "near_duplicate_pairs": near_pairs,
        "outcome": "passed",
    }


def build_media_manifest(
    records: dict[str, dict[str, Any]], candidates: dict[str, dict[str, Any]]
) -> dict[str, Any]:
    output: list[dict[str, Any]] = []
    for candidate_id, candidate in candidates.items():
        record = records[candidate["description_url"]]
        derivatives = []
        for derivative in record.get("derivatives", []):
            derivatives.append(
                {
                    "kind": derivative["kind"],
                    "filename": Path(derivative["path"]).name,
                    "sha256": derivative["sha256"],
                    "mime_type": derivative["mime_type"],
                    "width": derivative["width"],
                    "height": derivative["height"],
                    "bytes": derivative["bytes"],
                }
            )
        output.append(
            {
                "candidate_id": candidate_id,
                "source_id": CANDIDATES[candidate_id]["source_id"],
                "curator_role": CANDIDATES[candidate_id]["curator_role"],
                "identity_confidence": candidate["identity_confidence"],
                "rights_confidence": candidate["rights_confidence"],
                "media_id": record["media_id"],
                "panda_slug": record["panda_slug"],
                "source_url": record["source_url"],
                "asset": record["asset"],
                "rights": record["rights"],
                "credit": record["credit"],
                "alt_zh": record["alt_zh"],
                "alt_en": record["alt_en"],
                "original": record["original"],
                "derivatives": sorted(derivatives, key=lambda item: item["width"]),
            }
        )
    return {
        "schema_version": 1,
        "batch_version": BATCH_VERSION,
        "reviewed_at": REVIEWED_AT,
        "record_count": len(output),
        "records": sorted(output, key=lambda item: (item["panda_slug"], item["candidate_id"])),
    }


def source_record(row: dict[str, str]) -> dict[str, Any]:
    return {
        "id": row["source_id"],
        "publication_status": "published",
        "public": {
            "publisher": row["publisher"],
            "title": row["title"],
            "url": row["url"],
            "published_at": row["published_date"] or None,
            "last_verified_at": row["accessed_at"],
            "language": "en",
            "access_state": "accessible",
            "evidence_tier": row["reliability"],
        },
        "restricted": {
            "curator_notes": f"Allowed use: {row['allowed_use']}. {row['notes']}"
        },
    }


def media_record(item: dict[str, Any], panda_id: str) -> dict[str, Any]:
    derivatives = [
        {
            **derivative,
            "url": f"{MEDIA_BASE_URL}/{derivative['filename']}",
        }
        for derivative in item["derivatives"]
    ]
    derivatives.sort(key=lambda value: value["width"])
    primary = derivatives[-1]
    return {
        "id": item["media_id"],
        "publication_status": "published",
        "public": {
            "panda_id": panda_id,
            "presentation_role": item["curator_role"],
            "url": primary["url"],
            "source_url": item["source_url"],
            "rights": item["rights"],
            "credit": item["credit"],
            "alt_zh": item["alt_zh"],
            "alt_en": item["alt_en"],
            "status": "available",
            "sha256": primary["sha256"],
            "mime_type": primary["mime_type"],
            "width": primary["width"],
            "height": primary["height"],
            "bytes": primary["bytes"],
            "derivatives": [
                {key: value for key, value in derivative.items() if key != "filename"}
                for derivative in derivatives
            ],
            "source_ids": [item["source_id"]],
        },
        "restricted": {
            "curator_notes": (
                "Original Commons bytes and identity/rights review are audit-only; "
                f"public output uses reviewed WebP derivatives. Curator role: {item['curator_role']}."
            )
        },
    }


def build_source(media_manifest: dict[str, Any]) -> dict[str, Any]:
    source = deepcopy(read_json(BASE_SOURCE_PATH))
    pandas_by_slug = {
        record["public"]["canonical_slug"]: record["id"] for record in source["pandas"]
    }
    target_slugs = {value["panda_slug"] for value in CANDIDATES.values()}
    missing = target_slugs - set(pandas_by_slug)
    if missing:
        raise ValueError(f"Base source is missing target pandas: {sorted(missing)}")
    source["dataset"] = {
        **source["dataset"],
        "version": BATCH_VERSION,
        "base_dataset_version": BASE_VERSION,
        "title": "PandaAtlas Smithsonian Commons media review release",
        "core_panda_count": len(source["pandas"]),
    }
    _, source_rows = curation_rows()
    source_ids = {value["source_id"] for value in CANDIDATES.values()}
    source["sources"] = [record for record in source["sources"] if record["id"] not in source_ids]
    source["sources"].extend(source_record(source_rows[source_id]) for source_id in source_ids)
    source["sources"].sort(key=lambda record: record["id"])

    target_panda_ids = {pandas_by_slug[slug] for slug in target_slugs}
    source["media"] = [
        record
        for record in source["media"]
        if record.get("public", {}).get("panda_id") not in target_panda_ids
    ]
    source["media"].extend(
        media_record(item, pandas_by_slug[item["panda_slug"]])
        for item in media_manifest["records"]
    )
    source["media"].sort(key=lambda record: record["id"])
    return source


def build_integrity(
    candidates: dict[str, dict[str, Any]],
    processor_manifest: dict[str, Any],
    media_manifest: dict[str, Any],
    duplicate_review: dict[str, Any],
    source: dict[str, Any],
) -> dict[str, Any]:
    return {
        "schema_version": 1,
        "batch_version": BATCH_VERSION,
        "reviewed_at": REVIEWED_AT,
        "base_version": BASE_VERSION,
        "discovery_result": {
            "path": DISCOVERY_RESULT_PATH.relative_to(REPO_ROOT).as_posix(),
            "sha256": sha256_file(DISCOVERY_RESULT_PATH),
            "canonical_sha256": canonical_json_sha256(read_json(DISCOVERY_RESULT_PATH)),
        },
        "discovery_manifest": {
            "path": DISCOVERY_MANIFEST_PATH.relative_to(REPO_ROOT).as_posix(),
            "sha256": sha256_file(DISCOVERY_MANIFEST_PATH),
            "canonical_sha256": canonical_json_sha256(read_json(DISCOVERY_MANIFEST_PATH)),
        },
        "candidate_ids": sorted(candidates),
        "primary_candidate_ids": sorted(
            candidate_id
            for candidate_id, expected in CANDIDATES.items()
            if expected["curator_role"] == "primary"
        ),
        "gallery_candidate_ids": sorted(
            candidate_id
            for candidate_id, expected in CANDIDATES.items()
            if expected["curator_role"] == "gallery"
        ),
        "processor_manifest_canonical_sha256": canonical_json_sha256(processor_manifest),
        "media_manifest_canonical_sha256": canonical_json_sha256(media_manifest),
        "duplicate_review_canonical_sha256": canonical_json_sha256(duplicate_review),
        "source_canonical_sha256": canonical_json_sha256(source),
        "publication_write_targets": [],
        "review_state": "approved-for-public-release-build",
    }


def write_outputs(media_work_dir: Path) -> None:
    candidates = discovery_candidates()
    processor_manifest = read_json(media_work_dir / "manifest.json")
    records = processor_records(processor_manifest)
    duplicate_review = build_duplicate_review(media_work_dir, records, candidates)
    media_manifest = build_media_manifest(records, candidates)
    source = build_source(media_manifest)
    integrity = build_integrity(
        candidates, processor_manifest, media_manifest, duplicate_review, source
    )
    BATCH_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(media_work_dir / "manifest.json", PROCESSOR_MANIFEST_PATH)
    MEDIA_MANIFEST_PATH.write_text(pretty_json(media_manifest), encoding="utf-8", newline="")
    DUPLICATE_REVIEW_PATH.write_text(
        pretty_json(duplicate_review), encoding="utf-8", newline=""
    )
    OUTPUT_PATH.write_text(pretty_json(source), encoding="utf-8", newline="")
    SOURCE_INTEGRITY_PATH.write_text(pretty_json(integrity), encoding="utf-8", newline="")


def check_outputs() -> None:
    candidates = discovery_candidates()
    processor_manifest = read_json(PROCESSOR_MANIFEST_PATH)
    records = processor_records(processor_manifest)
    media_manifest = build_media_manifest(records, candidates)
    source = build_source(media_manifest)
    duplicate_review = read_json(DUPLICATE_REVIEW_PATH)
    if duplicate_review.get("candidate_count") != 6 or duplicate_review.get("outcome") != "passed":
        raise ValueError("Duplicate review evidence is incomplete or failed")
    if duplicate_review.get("exact_duplicate_groups") or duplicate_review.get("near_duplicate_pairs"):
        raise ValueError("Duplicate review contains unresolved duplicate evidence")
    integrity = build_integrity(
        candidates, processor_manifest, media_manifest, duplicate_review, source
    )
    expected = {
        MEDIA_MANIFEST_PATH: pretty_json(media_manifest),
        OUTPUT_PATH: pretty_json(source),
        SOURCE_INTEGRITY_PATH: pretty_json(integrity),
    }
    drifted = [str(path) for path, content in expected.items() if path.read_text(encoding="utf-8") != content]
    if drifted:
        raise ValueError(f"Smithsonian Commons batch outputs drifted: {drifted}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build the reviewed Mei Xiang and Xiao Qi Ji Commons media batch."
    )
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--media-work-dir", type=Path, default=DEFAULT_MEDIA_WORK_DIR)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        if args.check:
            check_outputs()
            print(f"OK: {BATCH_VERSION} Smithsonian Commons media batch is reproducible")
        else:
            write_outputs(args.media_work_dir.resolve())
            print(f"OK: built {BATCH_VERSION} Smithsonian Commons media batch")
    except (OSError, ValueError, KeyError, json.JSONDecodeError) as error:
        print(f"ERROR: {error}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
