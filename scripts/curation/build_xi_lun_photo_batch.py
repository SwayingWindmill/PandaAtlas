from __future__ import annotations

import argparse
import csv
import hashlib
import json
from copy import deepcopy
from pathlib import Path
from typing import Any
from uuid import NAMESPACE_URL, uuid5

REPO_ROOT = Path(__file__).resolve().parents[2]
CURATION_DIR = REPO_ROOT / "data" / "curation" / "pandas"
BASE_VERSION = "2026.07.20.2"
BATCH_VERSION = "2026.07.21.1"
BASE_PATH = REPO_ROOT / "data" / "reviewed-batches" / BASE_VERSION / "source.json"
BATCH_DIR = REPO_ROOT / "data" / "reviewed-batches" / BATCH_VERSION
MEDIA_MANIFEST_PATH = BATCH_DIR / "media-manifest.json"
PROCESSOR_MANIFEST_PATH = BATCH_DIR / "processor-manifest.json"
SOURCE_INTEGRITY_PATH = BATCH_DIR / "source-integrity.json"
OUTPUT_PATH = BATCH_DIR / "source.json"
MEDIA_BASE_URL = f"https://api.zhipanda.com/media/releases/{BATCH_VERSION}"

PANDA_SLUG = "xi-lun"
PANDA_ID = str(uuid5(NAMESPACE_URL, f"https://zhipanda.com/pandas/{PANDA_SLUG}"))
PHOTO_SOURCE_ID = "src_commons_xi_lun_photo"
FACT_SOURCE_IDS = {
    "src_zooatlanta_cubs_birth",
    "src_zooatlanta_twins_names",
    "src_zooatlanta_arrival_china_2024",
    "src_zooatlanta_2016_public_debut",
}
EXPECTED_MEDIA_ID = "media-xi-lun-de9774371d2f2427"
EXPECTED_ORIGINAL_SHA1 = "e96415ba1e422405fe36278029dc211005971170"
EXPECTED_INPUT_SHA256 = "20ccab1f901b6821fda2b8b3f699a903fcd371a4adb119c5272c771fb0a06d92"


def stable_uuid(kind: str, slug: str) -> str:
    return str(uuid5(NAMESPACE_URL, f"https://zhipanda.com/{kind}/{slug}"))


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def read_csv(filename: str) -> list[dict[str, str]]:
    with (CURATION_DIR / filename).open("r", encoding="utf-8-sig", newline="") as handle:
        return [dict(row) for row in csv.DictReader(handle)]


def canonical_json_sha256(value: Any) -> str:
    payload = json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def record(record_id: str, public: dict[str, Any], note: str) -> dict[str, Any]:
    return {
        "id": record_id,
        "publication_status": "published",
        "public": public,
        "restricted": {"curator_notes": note},
    }


def _one_by_slug(records: list[dict[str, Any]], slug: str) -> dict[str, Any]:
    matches = [record for record in records if record["public"].get("canonical_slug") == slug]
    if len(matches) != 1:
        raise ValueError(f"Expected exactly one published record for slug {slug!r}")
    return matches[0]


def _one_csv(filename: str, key: str, value: str) -> dict[str, str]:
    matches = [row for row in read_csv(filename) if row.get(key) == value]
    if len(matches) != 1:
        raise ValueError(f"Expected exactly one {filename} row where {key}={value!r}")
    return matches[0]


def validate_reviewed_inputs() -> tuple[dict[str, Any], dict[str, Any]]:
    integrity = read_json(SOURCE_INTEGRITY_PATH)
    processor = read_json(PROCESSOR_MANIFEST_PATH)
    media_manifest = read_json(MEDIA_MANIFEST_PATH)
    candidate_path = REPO_ROOT / integrity["candidate_fixture"]
    candidate = read_json(candidate_path)

    if integrity.get("schema_version") != 1:
        raise ValueError("Xi Lun source-integrity schema drifted")
    if integrity.get("source_id") != PHOTO_SOURCE_ID:
        raise ValueError("Xi Lun source-integrity source ID drifted")
    if canonical_json_sha256(candidate) != integrity["candidate_fixture_canonical_sha256"]:
        raise ValueError("Xi Lun Commons candidate fixture drifted")
    if canonical_json_sha256(processor) != integrity["processing_input"][
        "processor_manifest_canonical_sha256"
    ]:
        raise ValueError("Xi Lun processor manifest drifted")

    pages = ((candidate.get("query") or {}).get("pages") or [])
    if len(pages) != 1 or pages[0].get("title") != "File:Xi Lun at Zoo Atlanta.jpg":
        raise ValueError("Xi Lun Commons candidate title drifted")
    infos = pages[0].get("imageinfo") or []
    if len(infos) != 1:
        raise ValueError("Xi Lun Commons candidate imageinfo cardinality drifted")
    info = infos[0]
    metadata = info.get("extmetadata") or {}
    reviewed_file = integrity["commons_file"]
    exact_values = {
        "user": reviewed_file["uploader"],
        "size": reviewed_file["original_bytes"],
        "width": reviewed_file["original_width"],
        "height": reviewed_file["original_height"],
        "url": reviewed_file["original_url"],
        "mime": reviewed_file["original_mime"],
        "sha1": reviewed_file["original_sha1"],
    }
    for key, expected in exact_values.items():
        if info.get(key) != expected:
            raise ValueError(f"Xi Lun Commons candidate {key} drifted")
    if info["sha1"] != EXPECTED_ORIGINAL_SHA1:
        raise ValueError("Xi Lun original source SHA-1 drifted")
    if "Xi Lun" not in str((metadata.get("ImageDescription") or {}).get("value") or ""):
        raise ValueError("Xi Lun Commons description lost individual identity")
    if reviewed_file["uploader"] not in str((metadata.get("Artist") or {}).get("value") or ""):
        raise ValueError("Xi Lun Commons artist/uploader drifted")
    if (metadata.get("Credit") or {}).get("value", "").find("Own work") < 0:
        raise ValueError("Xi Lun Commons own-work credit drifted")
    if (metadata.get("LicenseShortName") or {}).get("value") != reviewed_file["license"]:
        raise ValueError("Xi Lun Commons license drifted")
    if (metadata.get("LicenseUrl") or {}).get("value") != reviewed_file["license_url"]:
        raise ValueError("Xi Lun Commons license URL drifted")
    if (metadata.get("AttributionRequired") or {}).get("value") != "true":
        raise ValueError("Xi Lun Commons attribution requirement drifted")
    if integrity["review"] != {
        "reviewed_at": "2026-07-21",
        "review_state": "approved-for-batch",
        "original_image_downloaded": False,
        "publication_requires_release_gates": True,
    }:
        raise ValueError("Xi Lun source review state drifted")

    if processor.get("schema_version") != 1 or processor.get("record_count") != 1:
        raise ValueError("Xi Lun processor manifest cardinality drifted")
    processor_records = processor.get("records") or []
    media_records = media_manifest.get("records") or []
    if len(processor_records) != 1 or len(media_records) != 1:
        raise ValueError("Xi Lun media manifests must each contain one record")
    processed = processor_records[0]
    reviewed = media_records[0]
    processing_input = integrity["processing_input"]
    if processed.get("panda_slug") != PANDA_SLUG or processed.get("media_id") != EXPECTED_MEDIA_ID:
        raise ValueError("Xi Lun processed media identity drifted")
    if processed.get("asset") != processing_input["requested_url"]:
        raise ValueError("Xi Lun processing input URL drifted")
    original = processed.get("original") or {}
    original_expectations = {
        "width": processing_input["actual_width"],
        "height": processing_input["actual_height"],
        "bytes": processing_input["actual_bytes"],
        "mime_type": processing_input["actual_mime"],
        "sha256": processing_input["actual_sha256"],
    }
    for key, expected in original_expectations.items():
        if original.get(key) != expected:
            raise ValueError(f"Xi Lun processing input {key} drifted")
    if original.get("sha256") != EXPECTED_INPUT_SHA256:
        raise ValueError("Xi Lun processing input SHA-256 drifted")
    if not processing_input["policy_reason"].startswith("Wikimedia returned HTTP 429"):
        raise ValueError("Xi Lun thumbnail policy reason drifted")

    if media_manifest.get("batch_version") != BATCH_VERSION:
        raise ValueError("Xi Lun media batch version drifted")
    if reviewed.get("panda_slug") != PANDA_SLUG or reviewed.get("media_id") != EXPECTED_MEDIA_ID:
        raise ValueError("Xi Lun reviewed media identity drifted")
    for field in ("source_url", "rights", "credit", "alt_zh", "alt_en"):
        if reviewed.get(field) != processed.get(field):
            raise ValueError(f"Xi Lun reviewed media {field} drifted from processor output")
    processed_derivatives = {
        derivative["kind"]: {
            **derivative,
            "filename": Path(derivative["path"]).name,
        }
        for derivative in processed.get("derivatives") or []
    }
    reviewed_derivatives = {
        derivative["kind"]: derivative for derivative in reviewed.get("derivatives") or []
    }
    if set(processed_derivatives) != {"width-480", "width-1200"}:
        raise ValueError("Xi Lun processor derivative set drifted")
    if set(reviewed_derivatives) != set(processed_derivatives):
        raise ValueError("Xi Lun reviewed derivative set drifted")
    for kind, derivative in reviewed_derivatives.items():
        processed_derivative = processed_derivatives[kind]
        for field in ("filename", "sha256", "mime_type", "width", "height", "bytes"):
            if derivative[field] != processed_derivative[field]:
                raise ValueError(f"Xi Lun derivative {kind} field {field} drifted")
        if derivative["mime_type"] != "image/webp" or derivative["bytes"] <= 0:
            raise ValueError(f"Xi Lun derivative {kind} is invalid")

    source_row = _one_csv("sources.csv", "source_id", PHOTO_SOURCE_ID)
    if source_row["url"] != reviewed["source_url"]:
        raise ValueError("Xi Lun curation source URL drifted")
    if source_row["allowed_use"] != "licensed_media_only":
        raise ValueError("Xi Lun curation source allowed_use drifted")
    media_row = _one_csv("media.csv", "panda_slug", PANDA_SLUG)
    if media_row["review_status"] != "approved":
        raise ValueError("Xi Lun curation media is not approved")
    for field in ("source_url", "rights", "credit", "alt_zh", "alt_en"):
        if media_row[field] != reviewed[field]:
            raise ValueError(f"Xi Lun curation media {field} drifted")
    panda_row = _one_csv("pandas.csv", "slug", PANDA_SLUG)
    if panda_row["evidence_status"] != "verified" or panda_row["review_status"] != "approved":
        raise ValueError("Xi Lun curation panda is not verified and approved")
    if panda_row["is_featured"] != "true":
        raise ValueError("Xi Lun curation panda lost its approved photo flag")
    event_rows = [
        row
        for row in read_csv("events.csv")
        if row["panda_slug"] == PANDA_SLUG and row["review_status"] == "approved"
    ]
    if {row["event_type"] for row in event_rows} != {"birth", "public_debut", "transfer"}:
        raise ValueError("Xi Lun must have exactly the reviewed birth, public debut, and transfer events")

    return integrity, reviewed


def source_record() -> dict[str, Any]:
    row = _one_csv("sources.csv", "source_id", PHOTO_SOURCE_ID)
    return record(
        PHOTO_SOURCE_ID,
        {
            "publisher": row["publisher"],
            "title": row["title"],
            "url": row["url"],
            "published_at": row["published_date"] or None,
            "last_verified_at": row["accessed_at"],
            "language": "en",
            "access_state": "accessible",
            "evidence_tier": row["reliability"],
        },
        f"Allowed use: {row['allowed_use']}. {row['notes']}",
    )


def panda_record() -> dict[str, Any]:
    identity_sources = [
        "src_zooatlanta_cubs_birth",
        "src_zooatlanta_twins_names",
        "src_zooatlanta_arrival_china_2024",
    ]
    return {
        "id": PANDA_ID,
        "publication_status": "published",
        "public": {
            "canonical_slug": PANDA_SLUG,
            "legacy_slugs": [
                {"value": "xilun", "source_ids": ["src_zooatlanta_cubs_birth"]}
            ],
            "record_tier": "complete_first_pass",
            "names": [
                {
                    "language": "zh-Hans",
                    "value": "喜伦",
                    "kind": "official",
                    "primary": True,
                    "source_ids": identity_sources,
                },
                {
                    "language": "en",
                    "value": "Xi Lun",
                    "kind": "official_romanization",
                    "primary": True,
                    "source_ids": identity_sources,
                },
            ],
            "aliases": [],
            "external_identifiers": [
                {
                    "system": "zoo_atlanta_profile_key",
                    "value": PANDA_SLUG,
                    "source_ids": ["src_zooatlanta_cubs_birth"],
                }
            ],
            "sex": "female",
            "life_status": "alive",
            "content": [
                {
                    "locale": "zh-CN",
                    "translation_status": "approved",
                    "summary": "伦伦与洋洋之女，2016 年出生于亚特兰大动物园，与雅伦为双胞胎，2024 年返回成都基地。",
                },
                {
                    "locale": "en",
                    "translation_status": "approved",
                    "summary": "Daughter of Lun Lun and Yang Yang, born at Zoo Atlanta in 2016, twin of Ya Lun, and returned to Chengdu in 2024.",
                },
            ],
            "revision_summaries": [
                {
                    "locale": "zh-CN",
                    "summary": "完成身份、出生、居住、事件、亲缘与授权照片的公开审核。",
                },
                {
                    "locale": "en",
                    "summary": "Reviewed identity, birth, residency, events, lineage, and licensed media.",
                },
            ],
        },
        "restricted": {
            "curator_notes": "Promoted from the reviewed Xi Lun licensed-media batch.",
            "review_owner": None,
        },
    }


def fact_record(
    fact_id: str,
    field: str,
    value: str,
    source_ids: list[str],
    last_verified_at: str,
    *,
    precision: str | None = None,
    freshness_policy: str = "stable_identity_fact",
    max_age_days: int | None = None,
) -> dict[str, Any]:
    public: dict[str, Any] = {
        "subject_id": PANDA_ID,
        "field": field,
        "value": value,
        "conclusion_status": "confirmed",
        "source_ids": source_ids,
        "last_verified_at": last_verified_at,
        "freshness": {
            "policy": freshness_policy,
            "max_age_days": max_age_days,
            "state": "current",
        },
    }
    if precision is not None:
        public["precision"] = precision
    return record(fact_id, public, "Reviewed in the Xi Lun licensed-media batch.")


def residency_record(
    residency_id: str,
    facility_id: str,
    start_date: str,
    end_date: str | None,
    source_ids: list[str],
    note: str,
    *,
    last_verified_at: str | None = None,
) -> dict[str, Any]:
    public: dict[str, Any] = {
        "panda_id": PANDA_ID,
        "facility_id": facility_id,
        "residency_type": "primary",
        "start_date": start_date,
        "end_date": end_date,
        "status": "confirmed",
        "source_ids": source_ids,
    }
    if last_verified_at:
        public["last_verified_at"] = last_verified_at
    return record(residency_id, public, note)


def event_record(
    event_id: str,
    event_type: str,
    event_date: str,
    source_ids: list[str],
    **extra: Any,
) -> dict[str, Any]:
    return record(
        event_id,
        {
            "event_type": event_type,
            "event_status": "completed",
            "event_date": event_date,
            "participants": [PANDA_ID],
            "source_ids": source_ids,
            "changes_current_residency": False,
            **extra,
        },
        "Normalized reviewed Xi Lun event.",
    )


def parentage_record(assertion_id: str, role: str, parent_id: str) -> dict[str, Any]:
    return record(
        assertion_id,
        {
            "child_id": PANDA_ID,
            "parent_id": parent_id,
            "role": role,
            "status": "confirmed",
            "source_ids": ["src_zooatlanta_cubs_birth", "src_zooatlanta_twins_names"],
        },
        "Official Zoo Atlanta parentage.",
    )


def media_record(reviewed: dict[str, Any]) -> dict[str, Any]:
    derivatives = [
        {
            "kind": derivative["kind"],
            "url": f"{MEDIA_BASE_URL}/{derivative['filename']}",
            "sha256": derivative["sha256"],
            "mime_type": derivative["mime_type"],
            "width": derivative["width"],
            "height": derivative["height"],
            "bytes": derivative["bytes"],
        }
        for derivative in reviewed["derivatives"]
    ]
    derivatives.sort(key=lambda item: item["width"])
    primary = derivatives[-1]
    return record(
        reviewed["media_id"],
        {
            "panda_id": PANDA_ID,
            "url": primary["url"],
            "source_url": reviewed["source_url"],
            "rights": reviewed["rights"],
            "credit": reviewed["credit"],
            "alt_zh": reviewed["alt_zh"],
            "alt_en": reviewed["alt_en"],
            "status": "available",
            "sha256": primary["sha256"],
            "mime_type": primary["mime_type"],
            "width": primary["width"],
            "height": primary["height"],
            "bytes": primary["bytes"],
            "derivatives": derivatives,
            "source_ids": [PHOTO_SOURCE_ID],
        },
        "Original source metadata and official thumbnail input are audit-only; public output uses reviewed WebP derivatives.",
    )


def _append_unique(collection: list[dict[str, Any]], item: dict[str, Any]) -> None:
    if any(existing["id"] == item["id"] for existing in collection):
        raise ValueError(f"Duplicate record ID {item['id']}")
    collection.append(item)


def build_source() -> dict[str, Any]:
    _, reviewed_media = validate_reviewed_inputs()
    source = deepcopy(read_json(BASE_PATH))
    base = read_json(BASE_PATH)

    if any(item["public"].get("canonical_slug") == PANDA_SLUG for item in source["pandas"]):
        raise ValueError("Xi Lun already exists in the base release")
    if any(item["id"] == PANDA_ID for item in source["pandas"]):
        raise ValueError("Xi Lun stable UUID collides with the base release")
    existing_source_ids = {item["id"] for item in source["sources"]}
    if PHOTO_SOURCE_ID in existing_source_ids:
        raise ValueError("Xi Lun media source already exists in the base release")

    source["dataset"] = {
        **source["dataset"],
        "version": BATCH_VERSION,
        "title": "PandaAtlas Xi Lun licensed-media expansion release",
        "core_panda_count": 15,
        "base_dataset_version": BASE_VERSION,
        "expansion_panda_ids": sorted(
            set(source["dataset"]["expansion_panda_ids"]) | {PANDA_ID}
        ),
    }
    _append_unique(source["sources"], source_record())
    _append_unique(source["pandas"], panda_record())
    source["facts"].extend(
        [
            fact_record(
                "fact-xi-lun-sex",
                "sex",
                "female",
                ["src_zooatlanta_twins_names"],
                "2026-07-21",
            ),
            fact_record(
                "fact-xi-lun-birth-date",
                "birth_date",
                "2016-09-03",
                ["src_zooatlanta_cubs_birth", "src_zooatlanta_twins_names"],
                "2026-07-21",
            ),
            fact_record(
                "fact-xi-lun-current-place",
                "current_facility",
                "Chengdu Research Base of Giant Panda Breeding",
                ["src_zooatlanta_arrival_china_2024"],
                "2026-07-20",
                precision="facility_level",
                freshness_policy="current_location",
                max_age_days=180,
            ),
        ]
    )

    zoo_atlanta = _one_by_slug(source["facilities"], "zoo-atlanta")["id"]
    chengdu = _one_by_slug(source["facilities"], "chengdu-research-base")["id"]
    source["residencies"].extend(
        [
            residency_record(
                "res-xi-lun-zoo-atlanta",
                zoo_atlanta,
                "2016-09-03",
                "2024-10-12",
                ["src_zooatlanta_cubs_birth", "src_zooatlanta_twins_names"],
                "Birth-to-return Zoo Atlanta residency.",
            ),
            residency_record(
                "res-xi-lun-chengdu",
                chengdu,
                "2024-10-13",
                None,
                ["src_zooatlanta_arrival_china_2024"],
                "Current holder reviewed from the official return report.",
                last_verified_at="2026-07-20",
            ),
        ]
    )
    source["events"].extend(
        [
            event_record(
                "event-xi-lun-birth",
                "birth",
                "2016-09-03",
                ["src_zooatlanta_cubs_birth", "src_zooatlanta_twins_names"],
                to_facility_id=zoo_atlanta,
            ),
            event_record(
                "event-xi-lun-public-debut",
                "public_debut",
                "2016-12-27",
                ["src_zooatlanta_2016_public_debut"],
                to_facility_id=zoo_atlanta,
            ),
        ]
    )
    shared_return = next(
        (item for item in source["events"] if item["id"] == "event-zoo-atlanta-return-2024"),
        None,
    )
    if shared_return is None:
        raise ValueError("Shared Zoo Atlanta return event is missing")
    expected_base_participants = {
        _one_by_slug(base["pandas"], slug)["id"] for slug in ("lun-lun", "yang-yang", "ya-lun")
    }
    if set(shared_return["public"]["participants"]) != expected_base_participants:
        raise ValueError("Shared Zoo Atlanta return event participants drifted before Xi Lun")
    shared_return["public"]["participants"] = sorted(expected_base_participants | {PANDA_ID})

    father_id = _one_by_slug(source["pandas"], "yang-yang")["id"]
    mother_id = _one_by_slug(source["pandas"], "lun-lun")["id"]
    source["parentage_assertions"].extend(
        [
            parentage_record("parent-xi-lun-father", "father", father_id),
            parentage_record("parent-xi-lun-mother", "mother", mother_id),
        ]
    )
    _append_unique(source["media"], media_record(reviewed_media))

    validate_built_source(source, base)
    return source


def validate_built_source(source: dict[str, Any], base: dict[str, Any]) -> None:
    if source["dataset"]["version"] != BATCH_VERSION:
        raise ValueError("Xi Lun batch version drifted")
    if source["dataset"]["base_dataset_version"] != BASE_VERSION:
        raise ValueError("Xi Lun base dataset version drifted")
    if source["dataset"]["core_panda_count"] != 15:
        raise ValueError("Xi Lun core panda count drifted")
    for collection in (
        "sources",
        "facilities",
        "institutions",
        "places",
        "pandas",
        "facts",
        "residencies",
        "events",
        "parentage_assertions",
        "media",
    ):
        ids = [item["id"] for item in source[collection]]
        if len(ids) != len(set(ids)):
            raise ValueError(f"Duplicate IDs found in {collection}")

    xi_lun = _one_by_slug(source["pandas"], PANDA_SLUG)
    if xi_lun["id"] != PANDA_ID:
        raise ValueError("Xi Lun stable UUID drifted")
    if len(source["pandas"]) != len(base["pandas"]) + 1:
        raise ValueError("Xi Lun batch must add exactly one panda")
    if len(source["media"]) != len(base["media"]) + 1:
        raise ValueError("Xi Lun batch must add exactly one media record")
    if len(source["sources"]) != len(base["sources"]) + 1:
        raise ValueError("Xi Lun batch must add exactly one source")
    if len(source["facts"]) != len(base["facts"]) + 3:
        raise ValueError("Xi Lun batch must add exactly three facts")
    if len(source["residencies"]) != len(base["residencies"]) + 2:
        raise ValueError("Xi Lun batch must add exactly two residencies")
    if len(source["events"]) != len(base["events"]) + 2:
        raise ValueError("Xi Lun batch must add two direct events and extend one shared event")
    if len(source["parentage_assertions"]) != len(base["parentage_assertions"]) + 2:
        raise ValueError("Xi Lun batch must add exactly two parentage assertions")

    current_residencies = [
        item
        for item in source["residencies"]
        if item["public"].get("panda_id") == PANDA_ID and item["public"].get("end_date") is None
    ]
    if len(current_residencies) != 1 or not current_residencies[0]["public"].get(
        "last_verified_at"
    ):
        raise ValueError("Xi Lun requires one current reviewed residency")
    xi_events = [
        item for item in source["events"] if PANDA_ID in item["public"].get("participants", [])
    ]
    if len(xi_events) != 3:
        raise ValueError("Xi Lun must appear in exactly three reviewed events")
    xi_parentage = [
        item
        for item in source["parentage_assertions"]
        if item["public"].get("child_id") == PANDA_ID
    ]
    if {item["public"]["role"] for item in xi_parentage} != {"father", "mother"}:
        raise ValueError("Xi Lun parentage is incomplete")
    xi_media = [item for item in source["media"] if item["public"].get("panda_id") == PANDA_ID]
    if len(xi_media) != 1 or xi_media[0]["id"] != EXPECTED_MEDIA_ID:
        raise ValueError("Xi Lun media identity is incomplete")

    immutable_collections = (
        "sources",
        "facilities",
        "institutions",
        "places",
        "pandas",
        "facts",
        "residencies",
        "parentage_assertions",
        "media",
    )
    for collection in immutable_collections:
        current_by_id = {item["id"]: item for item in source[collection]}
        for item in base[collection]:
            if current_by_id.get(item["id"]) != item:
                raise ValueError(f"Base {collection} record {item['id']} was mutated")
    current_events = {item["id"]: item for item in source["events"]}
    for item in base["events"]:
        current = current_events.get(item["id"])
        if item["id"] == "event-zoo-atlanta-return-2024":
            expected = deepcopy(item)
            expected["public"]["participants"] = sorted(
                set(expected["public"]["participants"]) | {PANDA_ID}
            )
            if current != expected:
                raise ValueError("Shared Zoo Atlanta return event changed beyond Xi Lun addition")
        elif current != item:
            raise ValueError(f"Base events record {item['id']} was mutated")


def render_source(source: dict[str, Any]) -> str:
    return json.dumps(source, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the reviewed Xi Lun licensed-media batch.")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Verify tracked batch source is reproducible without writing it.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    source = build_source()
    rendered = render_source(source)
    if args.check:
        if not OUTPUT_PATH.is_file():
            raise SystemExit(f"Tracked Xi Lun batch is missing: {OUTPUT_PATH}")
        if OUTPUT_PATH.read_text(encoding="utf-8") != rendered:
            raise SystemExit("Tracked Xi Lun batch source.json is not reproducible")
        print(f"OK: {OUTPUT_PATH} is reproducible")
        return 0
    BATCH_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(rendered, encoding="utf-8", newline="")
    print(OUTPUT_PATH)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
