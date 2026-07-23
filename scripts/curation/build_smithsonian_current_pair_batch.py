from __future__ import annotations

import argparse
import csv
import json
import shutil
from copy import deepcopy
from pathlib import Path
from typing import Any
from uuid import NAMESPACE_URL, uuid5

REPO_ROOT = Path(__file__).resolve().parents[2]
CURATION_DIR = REPO_ROOT / "data" / "curation" / "pandas"
BASE_VERSION = "2026.07.21.1"
BATCH_VERSION = "2026.07.23.1"
BASE_PATH = REPO_ROOT / "data" / "reviewed-batches" / BASE_VERSION / "source.json"
BATCH_DIR = REPO_ROOT / "data" / "reviewed-batches" / BATCH_VERSION
OUTPUT_PATH = BATCH_DIR / "source.json"
MEDIA_MANIFEST_PATH = BATCH_DIR / "media-manifest.json"
MEDIA_WORK_DIR = REPO_ROOT / ".media-work" / BATCH_VERSION
MEDIA_BASE_URL = f"https://api.zhipanda.com/media/releases/{BATCH_VERSION}"
SMITHSONIAN_FACILITY_SLUG = "smithsonian-national-zoo"
REVIEWED_AT = "2026-07-23"

PANDAS = {
    "bao-li": {
        "id": "434e10e3-7ba0-5de7-a59e-d3984524c58c",
        "name_zh": "宝力",
        "name_en": "Bao Li",
        "pinyin": "Bǎolì",
        "sex": "male",
        "birth_date": "2021-08-04",
        "summary_zh": "2021 年出生于四川，2024 年抵达史密森国家动物园，并于 2025 年 1 月公开亮相。",
        "summary_en": (
            "Born in Sichuan in 2021, arrived at the Smithsonian's National Zoo in 2024, "
            "and made his public debut in January 2025."
        ),
        "media_manifest": REPO_ROOT / ".media-work" / "issue-131-bao-li" / "manifest.json",
        "media_source_id": "src_commons_bao_li_photo",
        "media_title": "Bao Li",
        "media_note": (
            "Commons metadata identifies Bao Li at the Smithsonian National Zoo; "
            "CC BY-SA 4.0; photographer Melina Kolburn."
        ),
        "media_published_at": None,
    },
    "qing-bao": {
        "id": str(uuid5(NAMESPACE_URL, "https://zhipanda.com/pandas/qing-bao")),
        "name_zh": "青宝",
        "name_en": "Qing Bao",
        "pinyin": "Qīngbǎo",
        "sex": "female",
        "birth_date": "2021-09-12",
        "summary_zh": "2021 年出生于四川，2024 年抵达史密森国家动物园，并于 2025 年 1 月公开亮相。",
        "summary_en": (
            "Born in Sichuan in 2021, arrived at the Smithsonian's National Zoo in 2024, "
            "and made her public debut in January 2025."
        ),
        "media_manifest": REPO_ROOT / ".media-work" / "issue-131-qing-bao" / "manifest.json",
        "media_source_id": "src_commons_qing_bao_photo",
        "media_title": "Probable Qing Bao eating bamboo in snow",
        "media_note": (
            "Commons image is retained with probable-identity wording because the photographer "
            "expressed uncertainty about the individual identification; CC BY 2.0; "
            "photographer Mike Maguire."
        ),
        "media_published_at": None,
    },
}


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def read_csv(filename: str) -> list[dict[str, str]]:
    with (CURATION_DIR / filename).open("r", encoding="utf-8-sig", newline="") as handle:
        return [dict(row) for row in csv.DictReader(handle)]


def record(record_id: str, public: dict[str, Any], note: str) -> dict[str, Any]:
    return {
        "id": record_id,
        "publication_status": "published",
        "public": public,
        "restricted": {"curator_notes": note},
    }


def by_id(records: list[dict[str, Any]], record_id: str) -> dict[str, Any]:
    matches = [item for item in records if item["id"] == record_id]
    if len(matches) != 1:
        raise ValueError(f"Expected one record with id={record_id!r}, found {len(matches)}")
    return matches[0]


def by_slug(records: list[dict[str, Any]], slug: str) -> dict[str, Any]:
    matches = [item for item in records if item["public"].get("canonical_slug") == slug]
    if len(matches) != 1:
        raise ValueError(f"Expected one record with slug={slug!r}, found {len(matches)}")
    return matches[0]


def curation_row(filename: str, key: str, value: str) -> dict[str, str]:
    matches = [row for row in read_csv(filename) if row.get(key) == value]
    if len(matches) != 1:
        raise ValueError(f"Expected one {filename} row where {key}={value!r}")
    return matches[0]


def append_unique(collection: list[dict[str, Any]], item: dict[str, Any]) -> None:
    if any(existing["id"] == item["id"] for existing in collection):
        raise ValueError(f"Duplicate record ID: {item['id']}")
    collection.append(item)


def replace_by_id(collection: list[dict[str, Any]], item: dict[str, Any]) -> None:
    indexes = [index for index, existing in enumerate(collection) if existing["id"] == item["id"]]
    if len(indexes) != 1:
        raise ValueError(f"Expected one record to replace: {item['id']}")
    collection[indexes[0]] = item


def source_from_curation(source_id: str) -> dict[str, Any]:
    row = curation_row("sources.csv", "source_id", source_id)
    return record(
        source_id,
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


def media_source(slug: str, media: dict[str, Any]) -> dict[str, Any]:
    config = PANDAS[slug]
    return record(
        config["media_source_id"],
        {
            "publisher": "Wikimedia Commons",
            "title": config["media_title"],
            "url": media["source_url"],
            "published_at": config["media_published_at"],
            "last_verified_at": REVIEWED_AT,
            "language": "en",
            "access_state": "accessible",
            "evidence_tier": "media_rights_record",
        },
        config["media_note"],
    )


def media_manifest_record(slug: str) -> dict[str, Any]:
    manifest = read_json(PANDAS[slug]["media_manifest"])
    records = manifest.get("records") or []
    if len(records) != 1 or records[0].get("panda_slug") != slug:
        raise ValueError(f"Unexpected processor manifest for {slug}")
    processed = records[0]
    derivatives = []
    source_root = PANDAS[slug]["media_manifest"].parent
    for derivative in processed["derivatives"]:
        source_path = source_root / derivative["path"]
        if not source_path.is_file():
            raise FileNotFoundError(source_path)
        if source_path.stat().st_size != derivative["bytes"]:
            raise ValueError(f"Derivative byte-size drift: {source_path}")
        derivatives.append(
            {
                "kind": derivative["kind"],
                "filename": source_path.name,
                "sha256": derivative["sha256"],
                "mime_type": derivative["mime_type"],
                "width": derivative["width"],
                "height": derivative["height"],
                "bytes": derivative["bytes"],
                "source_path": source_path,
            }
        )
    derivatives.sort(key=lambda item: item["width"])
    return {
        "panda_slug": slug,
        "media_id": processed["media_id"],
        "source_url": processed["source_url"],
        "rights": processed["rights"],
        "credit": processed["credit"],
        "alt_zh": processed["alt_zh"],
        "alt_en": processed["alt_en"],
        "review_status": processed["review_status"],
        "derivatives": derivatives,
    }


def public_media_record(slug: str, reviewed: dict[str, Any]) -> dict[str, Any]:
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
    primary = derivatives[-1]
    return record(
        reviewed["media_id"],
        {
            "panda_id": PANDAS[slug]["id"],
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
            "source_ids": [PANDAS[slug]["media_source_id"]],
        },
        "Collection media processed into immutable WebP derivatives for the personal site.",
    )


def panda_record(slug: str) -> dict[str, Any]:
    config = PANDAS[slug]
    source_ids = [
        "src_smithsonian_giant_panda_faq",
        "src_smithsonian_giant_panda_page",
        "src_smithsonian_history",
    ]
    return {
        "id": config["id"],
        "publication_status": "published",
        "public": {
            "canonical_slug": slug,
            "legacy_slugs": [{"value": slug.replace("-", ""), "source_ids": source_ids[:1]}],
            "record_tier": "complete_first_pass",
            "names": [
                {
                    "language": "zh-Hans",
                    "value": config["name_zh"],
                    "kind": "official",
                    "primary": True,
                    "source_ids": source_ids,
                },
                {
                    "language": "en",
                    "value": config["name_en"],
                    "kind": "official_romanization",
                    "primary": True,
                    "source_ids": source_ids,
                },
                {
                    "language": "pinyin",
                    "value": config["pinyin"],
                    "kind": "pinyin",
                    "primary": True,
                    "source_ids": source_ids[:1],
                },
            ],
            "aliases": [],
            "external_identifiers": [
                {
                    "system": "smithsonian_profile_key",
                    "value": slug,
                    "source_ids": ["src_smithsonian_giant_panda_page"],
                }
            ],
            "sex": config["sex"],
            "life_status": "alive",
            "content": [
                {
                    "locale": "zh-CN",
                    "translation_status": "approved",
                    "summary": config["summary_zh"],
                },
                {
                    "locale": "en",
                    "translation_status": "approved",
                    "summary": config["summary_en"],
                },
            ],
            "revision_summaries": [
                {"locale": "zh-CN", "summary": "补充出生地、抵达、公开亮相、现居场馆与收藏图片。"},
                {
                    "locale": "en",
                    "summary": (
                        "Added birthplace, arrival, public debut, current habitat, "
                        "and collection media."
                    ),
                },
            ],
        },
        "restricted": {
            "curator_notes": "Promoted from the reviewed Smithsonian current-pair curation batch.",
            "review_owner": None,
        },
    }


def fact_record(
    slug: str,
    fact_id: str,
    field: str,
    value: str,
    source_ids: list[str],
    *,
    precision: str | None = None,
    freshness_policy: str = "stable_identity_fact",
    max_age_days: int | None = None,
) -> dict[str, Any]:
    public: dict[str, Any] = {
        "subject_id": PANDAS[slug]["id"],
        "field": field,
        "value": value,
        "conclusion_status": "confirmed",
        "source_ids": source_ids,
        "last_verified_at": REVIEWED_AT,
        "freshness": {"policy": freshness_policy, "max_age_days": max_age_days, "state": "current"},
    }
    if precision:
        public["precision"] = precision
    return record(fact_id, public, "Reviewed in the Smithsonian current-pair collection batch.")


def residency_record(slug: str, facility_id: str) -> dict[str, Any]:
    return record(
        f"res-{slug}-smithsonian",
        {
            "panda_id": PANDAS[slug]["id"],
            "facility_id": facility_id,
            "residency_type": "primary",
            "start_date": "2024-10-15",
            "end_date": None,
            "status": "confirmed",
            "source_ids": ["src_smithsonian_giant_panda_faq", "src_smithsonian_history"],
            "last_verified_at": REVIEWED_AT,
        },
        "Current Smithsonian residency reviewed from official current-pair sources.",
    )


def event_record(
    slug: str,
    suffix: str,
    event_type: str,
    event_date: str,
    source_ids: list[str],
    facility_id: str,
    *,
    changes_current_residency: bool = False,
) -> dict[str, Any]:
    return record(
        f"event-{slug}-{suffix}",
        {
            "event_type": event_type,
            "event_status": "completed",
            "event_date": event_date,
            "participants": [PANDAS[slug]["id"]],
            "source_ids": source_ids,
            "changes_current_residency": changes_current_residency,
            "to_facility_id": facility_id,
        },
        "Normalized reviewed Smithsonian current-pair event.",
    )


def build_source() -> tuple[dict[str, Any], list[dict[str, Any]]]:
    source = deepcopy(read_json(BASE_PATH))
    base = read_json(BASE_PATH)
    smithsonian_id = by_slug(source["facilities"], SMITHSONIAN_FACILITY_SLUG)["id"]

    source["dataset"] = {
        **source["dataset"],
        "version": BATCH_VERSION,
        "title": "PandaAtlas Smithsonian current-pair collection release",
        "base_dataset_version": BASE_VERSION,
        "core_panda_count": 16,
        "expansion_panda_ids": sorted(
            set(source["dataset"].get("expansion_panda_ids", [])) | {PANDAS["qing-bao"]["id"]}
        ),
    }

    for source_id in ("src_smithsonian_giant_panda_faq", "src_smithsonian_history"):
        existing = by_id(source["sources"], source_id)
        existing["public"]["last_verified_at"] = REVIEWED_AT
    append_unique(source["sources"], source_from_curation("src_smithsonian_giant_panda_page"))

    reviewed_media = {slug: media_manifest_record(slug) for slug in PANDAS}
    for slug, media in reviewed_media.items():
        append_unique(source["sources"], media_source(slug, media))

    replace_by_id(source["pandas"], panda_record("bao-li"))
    append_unique(source["pandas"], panda_record("qing-bao"))

    fact_ids_to_replace = {
        "fact-bao-li-sex",
        "fact-bao-li-birth-date",
        "fact-bao-li-current-place",
    }
    source["facts"] = [item for item in source["facts"] if item["id"] not in fact_ids_to_replace]
    for slug in PANDAS:
        source["facts"].extend(
            [
                fact_record(
                    slug,
                    f"fact-{slug}-sex",
                    "sex",
                    PANDAS[slug]["sex"],
                    ["src_smithsonian_giant_panda_faq", "src_smithsonian_giant_panda_page"],
                ),
                fact_record(
                    slug,
                    f"fact-{slug}-birth-date",
                    "birth_date",
                    PANDAS[slug]["birth_date"],
                    ["src_smithsonian_giant_panda_faq", "src_smithsonian_giant_panda_page"],
                ),
                fact_record(
                    slug,
                    f"fact-{slug}-birthplace",
                    "birthplace",
                    "China Conservation and Research Center for the Giant Panda, Sichuan",
                    ["src_smithsonian_giant_panda_faq", "src_smithsonian_giant_panda_page"],
                ),
                fact_record(
                    slug,
                    f"fact-{slug}-current-place",
                    "current_facility",
                    "David M. Rubenstein and Family Giant Panda Habitat, Smithsonian National Zoo",
                    ["src_smithsonian_giant_panda_faq", "src_smithsonian_giant_panda_page"],
                    precision="facility_level",
                    freshness_policy="current_location",
                    max_age_days=180,
                ),
            ]
        )

    source["residencies"] = [
        item for item in source["residencies"] if item["id"] != "res-bao-li-smithsonian"
    ]
    source["residencies"].extend(
        [residency_record("bao-li", smithsonian_id), residency_record("qing-bao", smithsonian_id)]
    )

    for slug in PANDAS:
        source["events"].extend(
            [
                event_record(
                    slug,
                    "birth",
                    "birth",
                    PANDAS[slug]["birth_date"],
                    ["src_smithsonian_giant_panda_faq"],
                    smithsonian_id,
                ),
                event_record(
                    slug,
                    "arrival-2024",
                    "arrival",
                    "2024-10-15",
                    ["src_smithsonian_history"],
                    smithsonian_id,
                    changes_current_residency=True,
                ),
                event_record(
                    slug,
                    "public-debut-2025",
                    "public_debut",
                    "2025-01-24",
                    ["src_smithsonian_history"],
                    smithsonian_id,
                ),
            ]
        )

    source["media"] = [
        item for item in source["media"] if item["public"].get("panda_id") != PANDAS["bao-li"]["id"]
    ]
    for slug, media in reviewed_media.items():
        append_unique(source["media"], public_media_record(slug, media))

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
        "related_pandas",
        "media",
    ):
        source[collection].sort(key=lambda item: item["id"])
        ids = [item["id"] for item in source[collection]]
        if len(ids) != len(set(ids)):
            raise ValueError(f"Duplicate IDs found in {collection}")

    if len(source["pandas"]) != len(base["pandas"]) + 1:
        raise ValueError("Smithsonian batch must add exactly Qing Bao")
    if not any(item["public"].get("canonical_slug") == "qing-bao" for item in source["pandas"]):
        raise ValueError("Qing Bao is missing from the built source")
    return source, list(reviewed_media.values())


def render_media_manifest(records: list[dict[str, Any]]) -> str:
    public_records = []
    for item in records:
        public_records.append(
            {key: value for key, value in item.items() if key != "derivatives"}
            | {
                "derivatives": [
                    {key: value for key, value in derivative.items() if key != "source_path"}
                    for derivative in item["derivatives"]
                ]
            }
        )
    payload = {
        "batch_version": BATCH_VERSION,
        "generated_at": "2026-07-23T12:30:00Z",
        "records": sorted(public_records, key=lambda item: item["panda_slug"]),
    }
    return json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def install_media_files(records: list[dict[str, Any]]) -> None:
    derivative_dir = MEDIA_WORK_DIR / "derivatives"
    derivative_dir.mkdir(parents=True, exist_ok=True)
    for item in records:
        for derivative in item["derivatives"]:
            destination = derivative_dir / derivative["filename"]
            shutil.copyfile(derivative["source_path"], destination)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build the reviewed Smithsonian current-pair batch"
    )
    parser.add_argument("--check", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    source, media_records = build_source()
    rendered_source = json.dumps(source, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    rendered_media = render_media_manifest(media_records)
    if args.check:
        if OUTPUT_PATH.read_text(encoding="utf-8") != rendered_source:
            raise SystemExit("Tracked Smithsonian batch source.json is not reproducible")
        if MEDIA_MANIFEST_PATH.read_text(encoding="utf-8") != rendered_media:
            raise SystemExit("Tracked Smithsonian batch media-manifest.json is not reproducible")
        print(f"OK: {BATCH_VERSION} reviewed batch is reproducible")
        return 0
    BATCH_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(rendered_source, encoding="utf-8", newline="")
    MEDIA_MANIFEST_PATH.write_text(rendered_media, encoding="utf-8", newline="")
    install_media_files(media_records)
    print(OUTPUT_PATH)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
