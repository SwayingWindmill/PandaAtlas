from __future__ import annotations

import argparse
import csv
import json
from copy import deepcopy
from pathlib import Path
from typing import Any
from uuid import NAMESPACE_URL, uuid5

REPO_ROOT = Path(__file__).resolve().parents[2]
CURATION_DIR = REPO_ROOT / "data" / "curation" / "pandas"
BASE_VERSION = "2026.07.20.1"
BATCH_VERSION = "2026.07.20.2"
BASE_PATH = REPO_ROOT / "data" / "reviewed-batches" / BASE_VERSION / "source.json"
BATCH_DIR = REPO_ROOT / "data" / "reviewed-batches" / BATCH_VERSION
MEDIA_MANIFEST_PATH = BATCH_DIR / "media-manifest.json"
OUTPUT_PATH = BATCH_DIR / "source.json"
MEDIA_BASE_URL = f"https://api.zhipanda.com/media/releases/{BATCH_VERSION}"


def stable_uuid(kind: str, slug: str) -> str:
    return str(uuid5(NAMESPACE_URL, f"https://zhipanda.com/{kind}/{slug}"))


PANDA_IDS = {
    slug: stable_uuid("pandas", slug)
    for slug in ("ri-ri", "shin-shin", "xiao-xiao", "lei-lei")
}
FACILITY_IDS = {
    slug: stable_uuid("facilities", slug)
    for slug in ("ueno-zoo", "ccrcgp-bifengxia-base", "ccrcgp-yaan-base")
}
SOURCE_IDS = {
    "src_ueno_return_riri_shinshin",
    "src_tokyo_zoo_ueno_panda_history",
    "src_gpg_yaan_base_profiles",
    "src_gpg_yaan_base_previous_page_1",
    "src_ueno_twins_names_2021",
    "src_ueno_xiaolei_return_2026",
    "src_commons_ri_ri_photo",
    "src_commons_shin_shin_photo",
    "src_commons_xiao_xiao_photo",
    "src_commons_lei_lei_xiao_xiao_photo",
}
PHOTO_SOURCE_BY_SLUG = {
    "ri-ri": "src_commons_ri_ri_photo",
    "shin-shin": "src_commons_shin_shin_photo",
    "xiao-xiao": "src_commons_xiao_xiao_photo",
    "lei-lei": "src_commons_lei_lei_xiao_xiao_photo",
}


def read_csv(filename: str) -> list[dict[str, str]]:
    with (CURATION_DIR / filename).open("r", encoding="utf-8-sig", newline="") as handle:
        return [dict(row) for row in csv.DictReader(handle)]


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def record(record_id: str, public: dict[str, Any], note: str) -> dict[str, Any]:
    return {
        "id": record_id,
        "publication_status": "published",
        "public": public,
        "restricted": {"curator_notes": note},
    }


def source_records(existing_ids: set[str]) -> list[dict[str, Any]]:
    selected = {
        row["source_id"]: row for row in read_csv("sources.csv") if row["source_id"] in SOURCE_IDS
    }
    missing = sorted(SOURCE_IDS - selected.keys())
    if missing:
        raise ValueError(f"Missing reviewed source rows: {', '.join(missing)}")
    records: list[dict[str, Any]] = []
    for source_id in sorted(selected):
        if source_id in existing_ids:
            continue
        row = selected[source_id]
        records.append(
            record(
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
        )
    return records


def panda_record(
    slug: str,
    name_zh: str,
    name_en: str,
    sex: str,
    summary_zh: str,
    summary_en: str,
    source_ids: list[str],
    aliases: list[tuple[str, str]],
) -> dict[str, Any]:
    return record(
        PANDA_IDS[slug],
        {
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
            "aliases": [
                {
                    "language": language,
                    "value": value,
                    "kind": "alternate_romanization",
                    "source_ids": source_ids,
                }
                for language, value in aliases
            ],
            "external_identifiers": [
                {
                    "system": "tokyo_zoo_profile_key",
                    "value": slug,
                    "source_ids": source_ids[:1],
                }
            ],
            "sex": sex,
            "life_status": "alive",
            "content": [
                {"locale": "zh-CN", "translation_status": "approved", "summary": summary_zh},
                {"locale": "en", "translation_status": "approved", "summary": summary_en},
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
        "Promoted from the reviewed Ueno family licensed-photo batch.",
    )


def fact_record(
    fact_id: str,
    slug: str,
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
        "subject_id": PANDA_IDS[slug],
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
    if precision:
        public["precision"] = precision
    return record(fact_id, public, "Reviewed in the Ueno family licensed-photo batch.")


def event_record(
    event_id: str,
    event_type: str,
    event_date: str,
    participants: list[str],
    source_ids: list[str],
    **extra: Any,
) -> dict[str, Any]:
    return record(
        event_id,
        {
            "event_type": event_type,
            "event_status": "completed",
            "event_date": event_date,
            "participants": [PANDA_IDS[slug] for slug in participants],
            "source_ids": source_ids,
            "changes_current_residency": bool(extra.pop("changes_current_residency", False)),
            **extra,
        },
        "Normalized reviewed event; shared family events are not duplicated.",
    )


def residency_record(
    residency_id: str,
    slug: str,
    facility_slug: str,
    start_date: str,
    source_ids: list[str],
    *,
    end_date: str | None = None,
    last_verified_at: str | None = None,
) -> dict[str, Any]:
    public: dict[str, Any] = {
        "panda_id": PANDA_IDS[slug],
        "facility_id": FACILITY_IDS[facility_slug],
        "residency_type": "primary",
        "start_date": start_date,
        "end_date": end_date,
        "status": "confirmed",
        "source_ids": source_ids,
    }
    if last_verified_at:
        public["last_verified_at"] = last_verified_at
    return record(residency_id, public, "Reviewed holder record; no exact coordinate is inferred.")


def parentage_record(
    assertion_id: str,
    child_slug: str,
    parent_slug: str,
    role: str,
) -> dict[str, Any]:
    return record(
        assertion_id,
        {
            "child_id": PANDA_IDS[child_slug],
            "parent_id": PANDA_IDS[parent_slug],
            "role": role,
            "status": "confirmed",
            "source_ids": ["src_tokyo_zoo_ueno_panda_history"],
        },
        "Parentage comes from the official Ueno history, not legacy father/mother columns.",
    )


def media_records() -> list[dict[str, Any]]:
    manifest = read_json(MEDIA_MANIFEST_PATH)
    records: list[dict[str, Any]] = []
    found_slugs: set[str] = set()
    for item in manifest["records"]:
        slug = item["panda_slug"]
        if slug not in PANDA_IDS:
            continue
        found_slugs.add(slug)
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
            for derivative in item["derivatives"]
        ]
        derivatives.sort(key=lambda derivative: derivative["width"])
        primary = derivatives[-1]
        records.append(
            record(
                item["media_id"],
                {
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
                "Original is retained internally; public output uses EXIF-free WebP derivatives.",
            )
        )
    if found_slugs != set(PANDA_IDS):
        raise ValueError(f"Media manifest panda set drifted: {sorted(found_slugs)}")
    return sorted(records, key=lambda item: item["id"])


def facility_records() -> list[dict[str, Any]]:
    return [
        record(
            FACILITY_IDS["ueno-zoo"],
            {
                "canonical_slug": "ueno-zoo",
                "names": [
                    {"language": "en", "value": "Ueno Zoo", "kind": "official"},
                    {"language": "zh-Hans", "value": "上野动物园", "kind": "translated"},
                ],
                "country_code": "JP",
                "locality": "Tokyo",
                "facility_type": "zoo",
            },
            "Reviewed historic holding facility.",
        ),
        record(
            FACILITY_IDS["ccrcgp-bifengxia-base"],
            {
                "canonical_slug": "ccrcgp-bifengxia-base",
                "names": [
                    {
                        "language": "en",
                        "value": "CCRCGP Bifengxia Base",
                        "kind": "official_translation",
                    },
                    {
                        "language": "zh-Hans",
                        "value": "中国大熊猫保护研究中心雅安碧峰峡基地",
                        "kind": "official",
                    },
                ],
                "country_code": "CN",
                "locality": "Ya'an, Sichuan",
                "facility_type": "conservation_center",
            },
            "Current Ri Ri and Shin Shin holder; locality precision only.",
        ),
        record(
            FACILITY_IDS["ccrcgp-yaan-base"],
            {
                "canonical_slug": "ccrcgp-yaan-base",
                "names": [
                    {
                        "language": "en",
                        "value": "CCRCGP Ya'an Base",
                        "kind": "official_translation",
                    },
                    {
                        "language": "zh-Hans",
                        "value": "中国大熊猫保护研究中心雅安基地",
                        "kind": "official",
                    },
                ],
                "country_code": "CN",
                "locality": "Ya'an, Sichuan",
                "facility_type": "conservation_center",
            },
            "Official Xiao Xiao and Lei Lei arrival record names Ya'an Base; no narrower base is inferred.",
        ),
    ]


def place_records() -> list[dict[str, Any]]:
    return [
        record(
            "place-ueno-zoo",
            {
                "canonical_slug": "ueno-zoo-tokyo",
                "legacy_slugs": [],
                "names": [
                    {"language": "en", "value": "Ueno Zoo, Tokyo", "kind": "display"},
                    {"language": "zh-Hans", "value": "上野动物园（日本东京）", "kind": "display"},
                ],
                "country_code": "JP",
                "locality": "Tokyo",
                "precision": "locality",
                "place_type": "zoo_campus",
                "facility_ids": [FACILITY_IDS["ueno-zoo"]],
                "institution_ids": ["institution-ueno-zoo"],
                "source_ids": ["src_tokyo_zoo_ueno_panda_history"],
                "last_verified_at": "2026-07-20",
                "revision_summaries": [
                    {"locale": "zh-CN", "summary": "以上野园区的城市级精度发布。"},
                    {"locale": "en", "summary": "Published the Ueno campus at locality precision."},
                ],
            },
            "No exact coordinate is inferred.",
        ),
        record(
            "place-ccrcgp-bifengxia-base",
            {
                "canonical_slug": "ccrcgp-bifengxia-base-yaan-sichuan",
                "legacy_slugs": [],
                "names": [
                    {
                        "language": "en",
                        "value": "CCRCGP Bifengxia Base, Ya'an, Sichuan",
                        "kind": "display",
                    },
                    {
                        "language": "zh-Hans",
                        "value": "中国大熊猫保护研究中心雅安碧峰峡基地（四川雅安）",
                        "kind": "display",
                    },
                ],
                "country_code": "CN",
                "locality": "Ya'an, Sichuan",
                "precision": "locality",
                "place_type": "conservation_base",
                "facility_ids": [FACILITY_IDS["ccrcgp-bifengxia-base"]],
                "institution_ids": ["institution-ccrcgp"],
                "source_ids": ["src_ueno_return_riri_shinshin", "src_gpg_yaan_base_profiles"],
                "last_verified_at": "2026-05-10",
                "revision_summaries": [
                    {"locale": "zh-CN", "summary": "以雅安市级精度发布碧峰峡基地。"},
                    {"locale": "en", "summary": "Published Bifengxia Base at Ya'an locality precision."},
                ],
            },
            "No exact coordinate is inferred.",
        ),
        record(
            "place-ccrcgp-yaan-base",
            {
                "canonical_slug": "ccrcgp-yaan-base-sichuan",
                "legacy_slugs": [],
                "names": [
                    {"language": "en", "value": "CCRCGP Ya'an Base", "kind": "display"},
                    {"language": "zh-Hans", "value": "中国大熊猫保护研究中心雅安基地", "kind": "display"},
                ],
                "country_code": "CN",
                "locality": "Ya'an, Sichuan",
                "precision": "locality",
                "place_type": "conservation_base",
                "facility_ids": [FACILITY_IDS["ccrcgp-yaan-base"]],
                "institution_ids": ["institution-ccrcgp"],
                "source_ids": ["src_ueno_xiaolei_return_2026"],
                "last_verified_at": "2026-05-10",
                "revision_summaries": [
                    {"locale": "zh-CN", "summary": "按官方表述以雅安基地发布，不推断更细分基地。"},
                    {"locale": "en", "summary": "Published as Ya'an Base without inferring a narrower campus."},
                ],
            },
            "No exact coordinate or narrower base is inferred.",
        ),
    ]


def institution_record() -> dict[str, Any]:
    return record(
        "institution-ueno-zoo",
        {
            "canonical_slug": "ueno-zoo",
            "legacy_slugs": [],
            "names": [
                {"language": "en", "value": "Ueno Zoo", "kind": "official"},
                {"language": "zh-Hans", "value": "上野动物园", "kind": "translated"},
            ],
            "institution_type": "zoo",
            "facility_ids": [FACILITY_IDS["ueno-zoo"]],
            "place_ids": ["place-ueno-zoo"],
            "source_ids": ["src_tokyo_zoo_ueno_panda_history"],
            "last_verified_at": "2026-07-20",
            "revision_summaries": [
                {"locale": "zh-CN", "summary": "建立上野动物园机构与园区关系。"},
                {"locale": "en", "summary": "Established the Ueno Zoo institution and campus."},
            ],
        },
        "Institution kept distinct from its physical campus.",
    )


def extend_ccrcgp_institution(source: dict[str, Any]) -> None:
    institution = next(
        item for item in source["institutions"] if item["id"] == "institution-ccrcgp"
    )
    public = institution["public"]
    public["facility_ids"] = sorted(
        set(public["facility_ids"])
        | {FACILITY_IDS["ccrcgp-bifengxia-base"], FACILITY_IDS["ccrcgp-yaan-base"]}
    )
    public["place_ids"] = sorted(
        set(public["place_ids"])
        | {"place-ccrcgp-bifengxia-base", "place-ccrcgp-yaan-base"}
    )
    public["source_ids"] = sorted(
        set(public["source_ids"])
        | {
            "src_ueno_return_riri_shinshin",
            "src_ueno_xiaolei_return_2026",
        }
    )


def build_source() -> dict[str, Any]:
    source = deepcopy(read_json(BASE_PATH))
    existing_source_ids = {item["id"] for item in source["sources"]}
    source["dataset"] = {
        **source["dataset"],
        "version": BATCH_VERSION,
        "title": "PandaAtlas Ueno family licensed-photo expansion release",
        "core_panda_count": 14,
        "base_dataset_version": BASE_VERSION,
        "expansion_panda_ids": sorted(
            set(source["dataset"]["expansion_panda_ids"]) | set(PANDA_IDS.values())
        ),
    }
    source["sources"].extend(source_records(existing_source_ids))
    source["facilities"].extend(facility_records())
    source["institutions"].append(institution_record())
    source["places"].extend(place_records())
    extend_ccrcgp_institution(source)

    source["pandas"].extend(
        [
            panda_record(
                "ri-ri",
                "力力",
                "Ri Ri",
                "male",
                "2005 年出生于卧龙、2011 年抵达上野动物园的雄性大熊猫，2024 年返回雅安碧峰峡基地。",
                "Male giant panda born in Wolong in 2005, resident at Ueno Zoo from 2011, and returned to Bifengxia Base in 2024.",
                ["src_tokyo_zoo_ueno_panda_history", "src_ueno_return_riri_shinshin"],
                [("en", "Bi Li"), ("en", "Li Li")],
            ),
            panda_record(
                "shin-shin",
                "真真",
                "Shin Shin",
                "female",
                "2005 年出生于卧龙、2011 年抵达上野动物园的雌性大熊猫，是香香、晓晓和蕾蕾的母亲，2024 年返回雅安碧峰峡基地。",
                "Female giant panda born in Wolong in 2005, mother of Xiang Xiang, Xiao Xiao, and Lei Lei, and returned from Ueno to Bifengxia Base in 2024.",
                ["src_tokyo_zoo_ueno_panda_history", "src_ueno_return_riri_shinshin"],
                [("en", "Xian Nu"), ("en", "Xin Xin")],
            ),
            panda_record(
                "xiao-xiao",
                "晓晓",
                "Xiao Xiao",
                "male",
                "力力与真真之子，2021 年出生于上野动物园，与蕾蕾为双胞胎，2026 年返回雅安基地。",
                "Son of Ri Ri and Shin Shin, born at Ueno Zoo in 2021, twin of Lei Lei, and returned to Ya'an Base in 2026.",
                [
                    "src_tokyo_zoo_ueno_panda_history",
                    "src_ueno_twins_names_2021",
                    "src_ueno_xiaolei_return_2026",
                ],
                [],
            ),
            panda_record(
                "lei-lei",
                "蕾蕾",
                "Lei Lei",
                "female",
                "力力与真真之女，2021 年出生于上野动物园，与晓晓为双胞胎，2026 年返回雅安基地。",
                "Daughter of Ri Ri and Shin Shin, born at Ueno Zoo in 2021, twin of Xiao Xiao, and returned to Ya'an Base in 2026.",
                [
                    "src_tokyo_zoo_ueno_panda_history",
                    "src_ueno_twins_names_2021",
                    "src_ueno_xiaolei_return_2026",
                ],
                [],
            ),
        ]
    )

    identity_sources = {
        "ri-ri": ["src_tokyo_zoo_ueno_panda_history", "src_ueno_return_riri_shinshin"],
        "shin-shin": ["src_tokyo_zoo_ueno_panda_history", "src_ueno_return_riri_shinshin"],
        "xiao-xiao": ["src_tokyo_zoo_ueno_panda_history", "src_ueno_twins_names_2021"],
        "lei-lei": ["src_tokyo_zoo_ueno_panda_history", "src_ueno_twins_names_2021"],
    }
    birth_dates = {
        "ri-ri": "2005-08-16",
        "shin-shin": "2005-07-03",
        "xiao-xiao": "2021-06-23",
        "lei-lei": "2021-06-23",
    }
    sexes = {"ri-ri": "male", "shin-shin": "female", "xiao-xiao": "male", "lei-lei": "female"}
    for slug in PANDA_IDS:
        source["facts"].extend(
            [
                fact_record(
                    f"fact-{slug}-sex",
                    slug,
                    "sex",
                    sexes[slug],
                    identity_sources[slug],
                    "2026-07-20",
                ),
                fact_record(
                    f"fact-{slug}-birth-date",
                    slug,
                    "birth_date",
                    birth_dates[slug],
                    identity_sources[slug],
                    "2026-07-20",
                ),
            ]
        )

    for slug in ("ri-ri", "shin-shin"):
        source["facts"].append(
            fact_record(
                f"fact-{slug}-current-place",
                slug,
                "current_facility",
                "CCRCGP Bifengxia Base",
                ["src_ueno_return_riri_shinshin", "src_gpg_yaan_base_profiles"],
                "2026-05-10",
                precision="facility_level",
                freshness_policy="current_location",
                max_age_days=180,
            )
        )
    for slug in ("xiao-xiao", "lei-lei"):
        source["facts"].append(
            fact_record(
                f"fact-{slug}-current-place",
                slug,
                "current_facility",
                "CCRCGP Ya'an Base",
                ["src_ueno_xiaolei_return_2026"],
                "2026-05-10",
                precision="facility_level",
                freshness_policy="current_location",
                max_age_days=180,
            )
        )

    source["parentage_assertions"].extend(
        [
            parentage_record("parent-xiao-xiao-father", "xiao-xiao", "ri-ri", "father"),
            parentage_record("parent-xiao-xiao-mother", "xiao-xiao", "shin-shin", "mother"),
            parentage_record("parent-lei-lei-father", "lei-lei", "ri-ri", "father"),
            parentage_record("parent-lei-lei-mother", "lei-lei", "shin-shin", "mother"),
        ]
    )

    for slug in ("ri-ri", "shin-shin"):
        source["residencies"].extend(
            [
                residency_record(
                    f"res-{slug}-ueno",
                    slug,
                    "ueno-zoo",
                    "2011-02-21",
                    ["src_tokyo_zoo_ueno_panda_history", "src_ueno_return_riri_shinshin"],
                    end_date="2024-09-29",
                ),
                residency_record(
                    f"res-{slug}-bifengxia",
                    slug,
                    "ccrcgp-bifengxia-base",
                    "2024-09-29",
                    ["src_ueno_return_riri_shinshin", "src_gpg_yaan_base_profiles"],
                    last_verified_at="2026-05-10",
                ),
            ]
        )
    for slug in ("xiao-xiao", "lei-lei"):
        source["residencies"].extend(
            [
                residency_record(
                    f"res-{slug}-ueno",
                    slug,
                    "ueno-zoo",
                    "2021-06-23",
                    ["src_tokyo_zoo_ueno_panda_history"],
                    end_date="2026-01-28",
                ),
                residency_record(
                    f"res-{slug}-yaan",
                    slug,
                    "ccrcgp-yaan-base",
                    "2026-01-28",
                    ["src_ueno_xiaolei_return_2026"],
                    last_verified_at="2026-05-10",
                ),
            ]
        )

    source["events"].extend(
        [
            event_record(
                "event-ri-ri-birth",
                "birth",
                "2005-08-16",
                ["ri-ri"],
                ["src_tokyo_zoo_ueno_panda_history", "src_ueno_return_riri_shinshin"],
            ),
            event_record(
                "event-shin-shin-birth",
                "birth",
                "2005-07-03",
                ["shin-shin"],
                ["src_tokyo_zoo_ueno_panda_history", "src_ueno_return_riri_shinshin"],
            ),
            event_record(
                "event-ueno-pair-arrival-2011",
                "arrival",
                "2011-02-21",
                ["ri-ri", "shin-shin"],
                ["src_tokyo_zoo_ueno_panda_history", "src_ueno_return_riri_shinshin"],
                to_facility_id=FACILITY_IDS["ueno-zoo"],
            ),
            event_record(
                "event-ueno-pair-return-2024",
                "transfer",
                "2024-09-29",
                ["ri-ri", "shin-shin"],
                ["src_ueno_return_riri_shinshin"],
                from_facility_id=FACILITY_IDS["ueno-zoo"],
                to_facility_id=FACILITY_IDS["ccrcgp-bifengxia-base"],
                changes_current_residency=True,
            ),
            event_record(
                "event-ueno-twins-birth-2021",
                "birth",
                "2021-06-23",
                ["xiao-xiao", "lei-lei"],
                ["src_tokyo_zoo_ueno_panda_history", "src_ueno_twins_names_2021"],
                to_facility_id=FACILITY_IDS["ueno-zoo"],
            ),
            event_record(
                "event-ueno-twins-named-2021",
                "naming",
                "2021-10-08",
                ["xiao-xiao", "lei-lei"],
                ["src_ueno_twins_names_2021"],
                to_facility_id=FACILITY_IDS["ueno-zoo"],
            ),
            event_record(
                "event-ueno-twins-return-2026",
                "transfer",
                "2026-01-28",
                ["xiao-xiao", "lei-lei"],
                ["src_ueno_xiaolei_return_2026"],
                from_facility_id=FACILITY_IDS["ueno-zoo"],
                to_facility_id=FACILITY_IDS["ccrcgp-yaan-base"],
                changes_current_residency=True,
            ),
        ]
    )
    source["media"].extend(media_records())
    return source


def serialized_source() -> str:
    return json.dumps(build_source(), ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the reviewed Ueno family photo batch.")
    parser.add_argument("--check", action="store_true", help="Fail when the tracked source is stale.")
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
    BATCH_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(content, encoding="utf-8", newline="")
    print(OUTPUT_PATH)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
