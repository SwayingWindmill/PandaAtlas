from __future__ import annotations

import argparse
import csv
import json
from copy import deepcopy
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
GOLDEN_PATH = REPO_ROOT / "contracts" / "golden-dataset" / "mei-xiang-family.v1.json"
CURATION_DIR = REPO_ROOT / "data" / "curation" / "pandas"
BATCH_VERSION = "2026.07.20.1"
BATCH_DIR = REPO_ROOT / "data" / "reviewed-batches" / BATCH_VERSION
MEDIA_MANIFEST_PATH = BATCH_DIR / "media-manifest.json"
OUTPUT_PATH = BATCH_DIR / "source.json"
MEDIA_BASE_URL = f"https://api.zhipanda.com/media/releases/{BATCH_VERSION}"

PANDA_IDS = {
    "lun-lun": "4dcff88b-9fa1-5fba-aa79-1aacb82ae28f",
    "yang-yang": "db108e44-8893-54e1-8cb5-8c5238b75089",
    "ya-lun": "fa8a0c14-b937-5de5-ae65-482cfd744482",
}
FACILITY_IDS = {
    "zoo-atlanta": "8a89d2e0-9f81-5cdb-a69b-8c998d370fb2",
    "chengdu-research-base": "7b09ec20-5a9c-5041-a2f3-eca29a2bc8b0",
}
SOURCE_IDS = {
    "src_zooatlanta_lun_lun",
    "src_zooatlanta_yang_yang",
    "src_zooatlanta_cubs_birth",
    "src_zooatlanta_twins_names",
    "src_zooatlanta_arrival_china_2024",
    "src_zooatlanta_2016_public_debut",
    "src_commons_lun_lun_photo",
    "src_commons_yang_yang_photo",
    "src_commons_ya_lun_photo",
}
PHOTO_SOURCE_BY_SLUG = {
    "lun-lun": "src_commons_lun_lun_photo",
    "yang-yang": "src_commons_yang_yang_photo",
    "ya-lun": "src_commons_ya_lun_photo",
}


def read_csv(filename: str) -> list[dict[str, str]]:
    with (CURATION_DIR / filename).open("r", encoding="utf-8-sig", newline="") as handle:
        return [dict(row) for row in csv.DictReader(handle)]


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def source_records() -> list[dict[str, Any]]:
    selected = {
        row["source_id"]: row for row in read_csv("sources.csv") if row["source_id"] in SOURCE_IDS
    }
    missing = sorted(SOURCE_IDS - selected.keys())
    if missing:
        raise ValueError(f"Missing reviewed source rows: {', '.join(missing)}")
    records = []
    for source_id in sorted(selected):
        row = selected[source_id]
        records.append(
            {
                "id": source_id,
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
                    "curator_notes": row["notes"],
                    "allowed_use": row["allowed_use"],
                },
            }
        )
    return records


def panda_record(
    slug: str,
    name_zh: str,
    name_en: str,
    sex: str,
    content_zh: str,
    content_en: str,
    source_ids: list[str],
) -> dict[str, Any]:
    return {
        "id": PANDA_IDS[slug],
        "publication_status": "published",
        "public": {
            "canonical_slug": slug,
            "legacy_slugs": [
                {"value": slug.replace("-", ""), "source_ids": source_ids[:1]},
            ],
            "record_tier": "complete_first_pass",
            "names": [
                {
                    "language": "zh-Hans",
                    "value": name_zh,
                    "kind": "official",
                    "primary": True,
                    "source_ids": source_ids,
                },
                {
                    "language": "en",
                    "value": name_en,
                    "kind": "official_romanization",
                    "primary": True,
                    "source_ids": source_ids,
                },
            ],
            "aliases": [],
            "external_identifiers": [
                {
                    "system": "zoo_atlanta_profile_key",
                    "value": slug,
                    "source_ids": source_ids[:1],
                }
            ],
            "sex": sex,
            "life_status": "alive",
            "content": [
                {"locale": "zh-CN", "translation_status": "approved", "summary": content_zh},
                {"locale": "en", "translation_status": "approved", "summary": content_en},
            ],
            "revision_summaries": [
                {
                    "locale": "zh-CN",
                    "summary": "完成身份、出生、居住、事件、亲缘与授权照片的首轮公开整理。",
                },
                {
                    "locale": "en",
                    "summary": "Reviewed identity, birth, residency, events, lineage, and media.",
                },
            ],
        },
        "restricted": {
            "curator_notes": "Promoted from the reviewed Atlanta photo expansion batch.",
            "review_owner": None,
        },
    }


def fact_record(
    fact_id: str,
    panda_slug: str,
    field: str,
    value: str,
    source_ids: list[str],
    *,
    precision: str | None = None,
    freshness_policy: str = "stable_identity_fact",
    max_age_days: int | None = None,
) -> dict[str, Any]:
    public: dict[str, Any] = {
        "subject_id": PANDA_IDS[panda_slug],
        "field": field,
        "value": value,
        "conclusion_status": "confirmed",
        "source_ids": source_ids,
        "last_verified_at": "2026-07-20",
        "freshness": {
            "policy": freshness_policy,
            "max_age_days": max_age_days,
            "state": "current",
        },
    }
    if precision:
        public["precision"] = precision
    return {
        "id": fact_id,
        "publication_status": "published",
        "public": public,
        "restricted": {"curator_notes": "Reviewed in the Atlanta photo expansion batch."},
    }


def event_record(
    event_id: str,
    event_type: str,
    event_date: str,
    participants: list[str],
    source_ids: list[str],
    **extra: Any,
) -> dict[str, Any]:
    return {
        "id": event_id,
        "publication_status": "published",
        "public": {
            "event_type": event_type,
            "event_status": "completed",
            "event_date": event_date,
            "participants": [PANDA_IDS[slug] for slug in participants],
            "source_ids": source_ids,
            "changes_current_residency": bool(extra.pop("changes_current_residency", False)),
            **extra,
        },
        "restricted": {
            "curator_notes": "Normalized reviewed event; shared events are not duplicated."
        },
    }


def media_records() -> list[dict[str, Any]]:
    manifest = read_json(MEDIA_MANIFEST_PATH)
    records = []
    found_slugs = set()
    for item in manifest["records"]:
        slug = item["panda_slug"]
        if slug not in PANDA_IDS:
            continue
        found_slugs.add(slug)
        derivatives = []
        for derivative in item["derivatives"]:
            filename = derivative["filename"]
            derivatives.append(
                {
                    "kind": derivative["kind"],
                    "url": f"{MEDIA_BASE_URL}/{filename}",
                    "sha256": derivative["sha256"],
                    "mime_type": derivative["mime_type"],
                    "width": derivative["width"],
                    "height": derivative["height"],
                    "bytes": derivative["bytes"],
                }
            )
        derivatives.sort(key=lambda derivative: derivative["width"])
        primary = derivatives[-1]
        records.append(
            {
                "id": item["media_id"],
                "publication_status": "published",
                "public": {
                    "panda_id": PANDA_IDS[slug],
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
                    "derivatives": derivatives,
                    "source_ids": [PHOTO_SOURCE_BY_SLUG[slug]],
                },
                "restricted": {
                    "curator_notes": "Original is internal; public output uses WebP derivatives."
                },
            }
        )
    if found_slugs != set(PANDA_IDS):
        raise ValueError(f"Media manifest panda set drifted: {sorted(found_slugs)}")
    return sorted(records, key=lambda record: record["id"])


def build_source() -> dict[str, Any]:
    source = deepcopy(read_json(GOLDEN_PATH))
    source["dataset"] = {
        **source["dataset"],
        "id": "panda-atlas-public",
        "version": BATCH_VERSION,
        "public_schema_version": "1.2.0",
        "title": "PandaAtlas first licensed-photo expansion release",
        "core_panda_count": 10,
        "base_dataset_version": "2026.07.18.1",
        "expansion_panda_ids": sorted(PANDA_IDS.values()),
    }
    source["sources"].extend(source_records())
    source["facilities"].extend(
        [
            {
                "id": FACILITY_IDS["zoo-atlanta"],
                "publication_status": "published",
                "public": {
                    "canonical_slug": "zoo-atlanta",
                    "names": [
                        {"language": "en", "value": "Zoo Atlanta", "kind": "official"},
                        {"language": "zh-Hans", "value": "亚特兰大动物园", "kind": "translated"},
                    ],
                    "country_code": "US",
                    "locality": "Atlanta, Georgia",
                    "facility_type": "zoo",
                },
                "restricted": {"curator_notes": "Reviewed historic holding facility."},
            },
            {
                "id": FACILITY_IDS["chengdu-research-base"],
                "publication_status": "published",
                "public": {
                    "canonical_slug": "chengdu-research-base",
                    "names": [
                        {
                            "language": "en",
                            "value": "Chengdu Research Base of Giant Panda Breeding",
                            "kind": "official_translation",
                        },
                        {
                            "language": "zh-Hans",
                            "value": "成都大熊猫繁育研究基地",
                            "kind": "official",
                        },
                    ],
                    "country_code": "CN",
                    "locality": "Chengdu, Sichuan",
                    "facility_type": "conservation_center",
                },
                "restricted": {"curator_notes": "Reviewed current holding facility."},
            },
        ]
    )
    source["institutions"].extend(
        [
            {
                "id": "institution-zoo-atlanta",
                "publication_status": "published",
                "public": {
                    "canonical_slug": "zoo-atlanta",
                    "legacy_slugs": [],
                    "names": [
                        {"language": "en", "value": "Zoo Atlanta", "kind": "official"},
                        {"language": "zh-Hans", "value": "亚特兰大动物园", "kind": "translated"},
                    ],
                    "institution_type": "zoo",
                    "facility_ids": [FACILITY_IDS["zoo-atlanta"]],
                    "place_ids": ["place-zoo-atlanta"],
                    "source_ids": ["src_zooatlanta_lun_lun", "src_zooatlanta_yang_yang"],
                    "last_verified_at": "2026-07-20",
                    "revision_summaries": [
                        {"locale": "zh-CN", "summary": "建立亚特兰大动物园的机构与园区关系。"},
                        {
                            "locale": "en",
                            "summary": "Established the Zoo Atlanta institution and campus.",
                        },
                    ],
                },
                "restricted": {
                    "curator_notes": "Institution kept distinct from its physical campus."
                },
            },
            {
                "id": "institution-chengdu-research-base",
                "publication_status": "published",
                "public": {
                    "canonical_slug": "chengdu-research-base",
                    "legacy_slugs": [],
                    "names": [
                        {
                            "language": "en",
                            "value": "Chengdu Research Base of Giant Panda Breeding",
                            "kind": "official_translation",
                        },
                        {
                            "language": "zh-Hans",
                            "value": "成都大熊猫繁育研究基地",
                            "kind": "official",
                        },
                    ],
                    "institution_type": "conservation_center",
                    "facility_ids": [FACILITY_IDS["chengdu-research-base"]],
                    "place_ids": ["place-chengdu-research-base"],
                    "source_ids": ["src_zooatlanta_arrival_china_2024"],
                    "last_verified_at": "2026-07-20",
                    "revision_summaries": [
                        {"locale": "zh-CN", "summary": "建立成都基地的机构与场所关系。"},
                        {
                            "locale": "en",
                            "summary": "Established the Chengdu institution and place.",
                        },
                    ],
                },
                "restricted": {
                    "curator_notes": "Current holder derived from reviewed official sources."
                },
            },
        ]
    )
    source["places"].extend(
        [
            {
                "id": "place-zoo-atlanta",
                "publication_status": "published",
                "public": {
                    "canonical_slug": "zoo-atlanta-atlanta-georgia",
                    "legacy_slugs": [],
                    "names": [
                        {
                            "language": "en",
                            "value": "Zoo Atlanta, Atlanta, Georgia",
                            "kind": "display",
                        },
                        {
                            "language": "zh-Hans",
                            "value": "亚特兰大动物园（美国佐治亚州）",
                            "kind": "translated",
                        },
                    ],
                    "country_code": "US",
                    "locality": "Atlanta, Georgia",
                    "precision": "locality",
                    "place_type": "zoo_campus",
                    "facility_ids": [FACILITY_IDS["zoo-atlanta"]],
                    "institution_ids": ["institution-zoo-atlanta"],
                    "source_ids": ["src_zooatlanta_lun_lun", "src_zooatlanta_yang_yang"],
                    "last_verified_at": "2026-07-20",
                    "revision_summaries": [
                        {"locale": "zh-CN", "summary": "以城市级精度发布亚特兰大园区。"},
                        {
                            "locale": "en",
                            "summary": "Published the Atlanta campus at locality precision.",
                        },
                    ],
                },
                "restricted": {"curator_notes": "No exact coordinate is inferred."},
            },
            {
                "id": "place-chengdu-research-base",
                "publication_status": "published",
                "public": {
                    "canonical_slug": "chengdu-research-base-chengdu-sichuan",
                    "legacy_slugs": [],
                    "names": [
                        {
                            "language": "en",
                            "value": (
                                "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan"
                            ),
                            "kind": "display",
                        },
                        {
                            "language": "zh-Hans",
                            "value": "成都大熊猫繁育研究基地（四川成都）",
                            "kind": "display",
                        },
                    ],
                    "country_code": "CN",
                    "locality": "Chengdu, Sichuan",
                    "precision": "locality",
                    "place_type": "conservation_base",
                    "facility_ids": [FACILITY_IDS["chengdu-research-base"]],
                    "institution_ids": ["institution-chengdu-research-base"],
                    "source_ids": ["src_zooatlanta_arrival_china_2024"],
                    "last_verified_at": "2026-07-20",
                    "revision_summaries": [
                        {"locale": "zh-CN", "summary": "以城市级精度发布成都基地。"},
                        {
                            "locale": "en",
                            "summary": "Published the Chengdu base at locality precision.",
                        },
                    ],
                },
                "restricted": {"curator_notes": "No exact coordinate is inferred."},
            },
        ]
    )
    source["pandas"].extend(
        [
            panda_record(
                "lun-lun",
                "伦伦",
                "Lun Lun",
                "female",
                "曾生活于亚特兰大动物园的雌性大熊猫，是七只幼崽的母亲，2024 年返回成都基地。",
                "Former Zoo Atlanta female, mother of seven cubs; returned to Chengdu in 2024.",
                ["src_zooatlanta_lun_lun", "src_zooatlanta_arrival_china_2024"],
            ),
            panda_record(
                "yang-yang",
                "洋洋",
                "Yang Yang",
                "male",
                "曾生活于亚特兰大动物园的雄性大熊猫，是七只幼崽的父亲，2024 年返回成都基地。",
                "Former Zoo Atlanta male, father of seven cubs; returned to Chengdu in 2024.",
                ["src_zooatlanta_yang_yang", "src_zooatlanta_arrival_china_2024"],
            ),
            panda_record(
                "ya-lun",
                "雅伦",
                "Ya Lun",
                "female",
                "伦伦与洋洋之女，2016 年出生于亚特兰大动物园，2024 年返回成都基地。",
                "Daughter of Lun Lun and Yang Yang; born in Atlanta in 2016 and returned in 2024.",
                [
                    "src_zooatlanta_cubs_birth",
                    "src_zooatlanta_twins_names",
                    "src_zooatlanta_arrival_china_2024",
                ],
            ),
        ]
    )
    source["facts"].extend(
        [
            fact_record("fact-lun-lun-sex", "lun-lun", "sex", "female", ["src_zooatlanta_lun_lun"]),
            fact_record(
                "fact-lun-lun-birth-date",
                "lun-lun",
                "birth_date",
                "1997-08-25",
                ["src_zooatlanta_lun_lun"],
            ),
            fact_record(
                "fact-lun-lun-current-place",
                "lun-lun",
                "current_facility",
                "Chengdu Research Base of Giant Panda Breeding",
                ["src_zooatlanta_lun_lun", "src_zooatlanta_arrival_china_2024"],
                precision="facility_level",
                freshness_policy="current_location",
                max_age_days=180,
            ),
            fact_record(
                "fact-yang-yang-sex", "yang-yang", "sex", "male", ["src_zooatlanta_yang_yang"]
            ),
            fact_record(
                "fact-yang-yang-birth-date",
                "yang-yang",
                "birth_date",
                "1997-09-09",
                ["src_zooatlanta_yang_yang"],
            ),
            fact_record(
                "fact-yang-yang-current-place",
                "yang-yang",
                "current_facility",
                "Chengdu Research Base of Giant Panda Breeding",
                ["src_zooatlanta_yang_yang", "src_zooatlanta_arrival_china_2024"],
                precision="facility_level",
                freshness_policy="current_location",
                max_age_days=180,
            ),
            fact_record(
                "fact-ya-lun-sex",
                "ya-lun",
                "sex",
                "female",
                ["src_zooatlanta_twins_names"],
            ),
            fact_record(
                "fact-ya-lun-birth-date",
                "ya-lun",
                "birth_date",
                "2016-09-03",
                ["src_zooatlanta_cubs_birth", "src_zooatlanta_twins_names"],
            ),
            fact_record(
                "fact-ya-lun-current-place",
                "ya-lun",
                "current_facility",
                "Chengdu Research Base of Giant Panda Breeding",
                ["src_zooatlanta_arrival_china_2024"],
                precision="facility_level",
                freshness_policy="current_location",
                max_age_days=180,
            ),
        ]
    )
    source["parentage_assertions"].extend(
        [
            {
                "id": "parent-ya-lun-father",
                "publication_status": "published",
                "public": {
                    "child_id": PANDA_IDS["ya-lun"],
                    "parent_id": PANDA_IDS["yang-yang"],
                    "role": "father",
                    "status": "confirmed",
                    "source_ids": ["src_zooatlanta_cubs_birth", "src_zooatlanta_twins_names"],
                },
                "restricted": {"curator_notes": "Official Zoo Atlanta parentage."},
            },
            {
                "id": "parent-ya-lun-mother",
                "publication_status": "published",
                "public": {
                    "child_id": PANDA_IDS["ya-lun"],
                    "parent_id": PANDA_IDS["lun-lun"],
                    "role": "mother",
                    "status": "confirmed",
                    "source_ids": ["src_zooatlanta_cubs_birth", "src_zooatlanta_twins_names"],
                },
                "restricted": {"curator_notes": "Official Zoo Atlanta parentage."},
            },
        ]
    )
    source["residencies"].extend(
        [
            {
                "id": "res-lun-lun-zoo-atlanta",
                "publication_status": "published",
                "public": {
                    "panda_id": PANDA_IDS["lun-lun"],
                    "facility_id": FACILITY_IDS["zoo-atlanta"],
                    "residency_type": "primary",
                    "start_date": "1999-11-05",
                    "end_date": "2024-10-12",
                    "status": "confirmed",
                    "source_ids": ["src_zooatlanta_lun_lun"],
                },
                "restricted": {"curator_notes": "Historic Zoo Atlanta residency."},
            },
            {
                "id": "res-lun-lun-chengdu",
                "publication_status": "published",
                "public": {
                    "panda_id": PANDA_IDS["lun-lun"],
                    "facility_id": FACILITY_IDS["chengdu-research-base"],
                    "residency_type": "primary",
                    "start_date": "2024-10-13",
                    "end_date": None,
                    "status": "confirmed",
                    "last_verified_at": "2026-07-20",
                    "source_ids": ["src_zooatlanta_lun_lun", "src_zooatlanta_arrival_china_2024"],
                },
                "restricted": {
                    "curator_notes": "Current holder reviewed from official profiles and return."
                },
            },
            {
                "id": "res-yang-yang-zoo-atlanta",
                "publication_status": "published",
                "public": {
                    "panda_id": PANDA_IDS["yang-yang"],
                    "facility_id": FACILITY_IDS["zoo-atlanta"],
                    "residency_type": "primary",
                    "start_date": "1999-11-05",
                    "end_date": "2024-10-12",
                    "status": "confirmed",
                    "source_ids": ["src_zooatlanta_yang_yang"],
                },
                "restricted": {"curator_notes": "Historic Zoo Atlanta residency."},
            },
            {
                "id": "res-yang-yang-chengdu",
                "publication_status": "published",
                "public": {
                    "panda_id": PANDA_IDS["yang-yang"],
                    "facility_id": FACILITY_IDS["chengdu-research-base"],
                    "residency_type": "primary",
                    "start_date": "2024-10-13",
                    "end_date": None,
                    "status": "confirmed",
                    "last_verified_at": "2026-07-20",
                    "source_ids": ["src_zooatlanta_yang_yang", "src_zooatlanta_arrival_china_2024"],
                },
                "restricted": {
                    "curator_notes": "Current holder reviewed from official profiles and return."
                },
            },
            {
                "id": "res-ya-lun-zoo-atlanta",
                "publication_status": "published",
                "public": {
                    "panda_id": PANDA_IDS["ya-lun"],
                    "facility_id": FACILITY_IDS["zoo-atlanta"],
                    "residency_type": "primary",
                    "start_date": "2016-09-03",
                    "end_date": "2024-10-12",
                    "status": "confirmed",
                    "source_ids": ["src_zooatlanta_cubs_birth", "src_zooatlanta_twins_names"],
                },
                "restricted": {"curator_notes": "Birth-to-return Zoo Atlanta residency."},
            },
            {
                "id": "res-ya-lun-chengdu",
                "publication_status": "published",
                "public": {
                    "panda_id": PANDA_IDS["ya-lun"],
                    "facility_id": FACILITY_IDS["chengdu-research-base"],
                    "residency_type": "primary",
                    "start_date": "2024-10-13",
                    "end_date": None,
                    "status": "confirmed",
                    "last_verified_at": "2026-07-20",
                    "source_ids": ["src_zooatlanta_arrival_china_2024"],
                },
                "restricted": {
                    "curator_notes": "Current holder reviewed from the official return report."
                },
            },
        ]
    )
    source["events"].extend(
        [
            event_record(
                "event-lun-lun-birth",
                "birth",
                "1997-08-25",
                ["lun-lun"],
                ["src_zooatlanta_lun_lun"],
                to_facility_id=FACILITY_IDS["chengdu-research-base"],
            ),
            event_record(
                "event-yang-yang-birth",
                "birth",
                "1997-09-09",
                ["yang-yang"],
                ["src_zooatlanta_yang_yang"],
                to_facility_id=FACILITY_IDS["chengdu-research-base"],
            ),
            event_record(
                "event-zoo-atlanta-pair-arrival-1999",
                "arrival",
                "1999-11-05",
                ["lun-lun", "yang-yang"],
                ["src_zooatlanta_lun_lun", "src_zooatlanta_yang_yang"],
                to_facility_id=FACILITY_IDS["zoo-atlanta"],
            ),
            event_record(
                "event-ya-lun-birth",
                "birth",
                "2016-09-03",
                ["ya-lun"],
                ["src_zooatlanta_cubs_birth", "src_zooatlanta_twins_names"],
                to_facility_id=FACILITY_IDS["zoo-atlanta"],
            ),
            event_record(
                "event-ya-lun-public-debut",
                "public_debut",
                "2016-12-27",
                ["ya-lun"],
                ["src_zooatlanta_2016_public_debut"],
                to_facility_id=FACILITY_IDS["zoo-atlanta"],
            ),
            event_record(
                "event-zoo-atlanta-return-2024",
                "transfer",
                "2024-10-12",
                ["lun-lun", "yang-yang", "ya-lun"],
                ["src_zooatlanta_arrival_china_2024"],
                from_facility_id=FACILITY_IDS["zoo-atlanta"],
                to_facility_id=FACILITY_IDS["chengdu-research-base"],
                changes_current_residency=True,
            ),
        ]
    )
    source["media"].extend(media_records())
    return source


def serialized_source() -> str:
    return json.dumps(build_source(), ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build the reviewed Atlanta panda photo expansion source."
    )
    parser.add_argument(
        "--check", action="store_true", help="Fail when the tracked source is stale."
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    content = serialized_source()
    if args.check:
        if not OUTPUT_PATH.exists() or OUTPUT_PATH.read_text(encoding="utf-8") != content:
            print(f"ERROR: {OUTPUT_PATH} is stale; regenerate the reviewed batch source")
            return 1
        print(f"OK: {OUTPUT_PATH} is reproducible")
        return 0
    OUTPUT_PATH.write_text(content, encoding="utf-8", newline="")
    print(OUTPUT_PATH)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
