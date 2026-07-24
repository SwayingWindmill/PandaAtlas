from __future__ import annotations

import argparse
import csv
import hashlib
import json
import shutil
from copy import deepcopy
from pathlib import Path
from typing import Any
from uuid import NAMESPACE_URL, uuid5

REPO_ROOT = Path(__file__).resolve().parents[2]
CURATION_DIR = REPO_ROOT / "data" / "curation" / "pandas"
BASE_VERSION = "2026.07.24.1"
BATCH_VERSION = "2026.07.24.2"
RELEASED_AT = "2026-07-24T06:00:00Z"
REVIEWED_AT = "2026-07-24"
BASE_PATH = REPO_ROOT / "data" / "reviewed-batches" / BASE_VERSION / "source.json"
BATCH_DIR = REPO_ROOT / "data" / "reviewed-batches" / BATCH_VERSION
OUTPUT_PATH = BATCH_DIR / "source.json"
MEDIA_MANIFEST_PATH = BATCH_DIR / "media-manifest.json"
PROCESSOR_MANIFEST_PATH = REPO_ROOT / ".media-work" / BATCH_VERSION / "manifest.json"
MEDIA_BASE_URL = f"https://api.zhipanda.com/media/releases/{BATCH_VERSION}"

CHILDREN = {
    "bao-xin": {
        "mother_slug": "a-bao",
        "summary_zh": (
            "宝新是雄性大熊猫，2021年6月24日出生于成都大熊猫繁育研究基地，"
            "母亲为阿宝；2021年10月1日参加基地2021级新生幼仔线上亮相。"
        ),
        "summary_en": (
            "Bao Xin is a male giant panda born at the Chengdu Research Base on "
            "2021-06-24 to mother A Bao. He joined the Base's online presentation "
            "of the 2021 newborn cohort on 2021-10-01."
        ),
    },
    "zhen-xi": {
        "mother_slug": "qi-zhen",
        "summary_zh": (
            "珍喜是雌性大熊猫，2017年7月15日出生于成都大熊猫繁育研究基地，"
            "母亲为奇珍，初生体重168克；2017年9月参加新生幼仔集体亮相，"
            "2024年4月1日在星汉馆被基地官方记录到正在吃竹子。"
        ),
        "summary_en": (
            "Zhen Xi is a female giant panda born at the Chengdu Research Base on "
            "2017-07-15 to mother Qi Zhen, with a recorded birth weight of 168 g. "
            "She joined the 2017 newborn cohort presentation and was officially "
            "observed eating bamboo at Xinghan Hall on 2024-04-01."
        ),
    },
    "qing-qing-chengdu-2017-07-26": {
        "mother_slug": "er-qiao",
        "summary_zh": (
            "青青是雌性大熊猫，2017年7月26日出生于成都大熊猫繁育研究基地，"
            "母亲为二巧，初生体重144克；2017年9月参加基地新生幼仔集体亮相。"
        ),
        "summary_en": (
            "Qing Qing is a female giant panda born at the Chengdu Research Base on "
            "2017-07-26 to mother Er Qiao, with a recorded birth weight of 144 g. "
            "She joined the Base's 2017 newborn cohort presentation."
        ),
    },
    "xiao-xin-chengdu-2017": {
        "mother_slug": "xiao-yatou",
        "summary_zh": (
            "小馨是雌性大熊猫，2017年7月26日出生于成都大熊猫繁育研究基地，"
            "母亲为小丫头，初生体重115.4克；2017年9月参加基地新生幼仔集体亮相。"
        ),
        "summary_en": (
            "Xiao Xin is a female giant panda born at the Chengdu Research Base on "
            "2017-07-26 to mother Xiao Yatou, with a recorded birth weight of 115.4 g. "
            "She joined the Base's 2017 newborn cohort presentation."
        ),
    },
}

PARENTS = {
    "a-bao": {
        "name_zh": "阿宝",
        "name_en": "A Bao",
        "child_slug": "bao-xin",
    },
    "qi-zhen": {
        "name_zh": "奇珍",
        "name_en": "Qi Zhen",
        "child_slug": "zhen-xi",
    },
    "er-qiao": {
        "name_zh": "二巧",
        "name_en": "Er Qiao",
        "child_slug": "qing-qing-chengdu-2017-07-26",
    },
    "xiao-yatou": {
        "name_zh": "小丫头",
        "name_en": "Xiao Yatou",
        "child_slug": "xiao-xin-chengdu-2017",
    },
}

SELECTED_EVENTS = {
    "evt_bao_xin_birth_20210624",
    "evt_bao_xin_online_debut_20211001",
    "evt_qing_qing_chengdu_2017_07_26_birth_20170726",
    "evt_qing_qing_cohort_debut_20170927",
    "evt_xiao_xin_chengdu_2017_birth_20170726",
    "evt_xiao_xin_cohort_debut_20170927",
    "evt_zhen_xi_birth_20170715",
    "evt_zhen_xi_cohort_debut_20170927",
    "evt_zhen_xi_xinghan_observation_20240401",
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


def stable_id(slug: str) -> str:
    return str(uuid5(NAMESPACE_URL, f"https://zhipanda.com/pandas/{slug}"))


def split_ids(value: str) -> list[str]:
    return sorted({item.strip() for item in value.split(";") if item.strip()})


def by_slug(records: list[dict[str, Any]], slug: str) -> dict[str, Any]:
    matches = [item for item in records if item["public"].get("canonical_slug") == slug]
    if len(matches) != 1:
        raise ValueError(f"Expected one panda record for {slug}, found {len(matches)}")
    return matches[0]


def curation_by_slug() -> dict[str, dict[str, str]]:
    return {row["slug"]: row for row in read_csv("pandas.csv")}


def source_rows_by_id() -> dict[str, dict[str, str]]:
    return {row["source_id"]: row for row in read_csv("sources.csv")}


def source_record(row: dict[str, str]) -> dict[str, Any]:
    language = "zh-Hans" if any("\u3400" <= char <= "\u9fff" for char in row["title"]) else "en"
    return record(
        row["source_id"],
        {
            "publisher": row["publisher"],
            "title": row["title"],
            "url": row["url"],
            "published_at": row["published_date"] or None,
            "last_verified_at": row["accessed_at"],
            "language": language,
            "access_state": "accessible",
            "evidence_tier": row["reliability"],
        },
        f"Allowed use: {row['allowed_use']}. {row['notes']}".strip(),
    )


def replace_or_append(collection: list[dict[str, Any]], item: dict[str, Any]) -> None:
    indexes = [index for index, existing in enumerate(collection) if existing["id"] == item["id"]]
    if len(indexes) > 1:
        raise ValueError(f"Duplicate existing record ID: {item['id']}")
    if indexes:
        collection[indexes[0]] = item
    else:
        collection.append(item)


def source_ids_for(row: dict[str, str], published_source_ids: set[str]) -> list[str]:
    result = [
        source_id
        for source_id in split_ids(row["primary_source_ids"])
        if source_id in published_source_ids
    ]
    if not result:
        raise ValueError(f"No published sources for {row['slug']}")
    return result


def names(row: dict[str, str], source_ids: list[str]) -> list[dict[str, Any]]:
    return [
        {
            "language": "zh-Hans",
            "value": row["name_zh"],
            "kind": "official",
            "primary": True,
            "source_ids": source_ids,
        },
        {
            "language": "en",
            "value": row["name_en"],
            "kind": "official_romanization",
            "primary": True,
            "source_ids": source_ids,
        },
    ]


def update_child_record(
    existing: dict[str, Any],
    row: dict[str, str],
    config: dict[str, str],
    source_ids: list[str],
) -> dict[str, Any]:
    public = deepcopy(existing["public"])
    public.update(
        {
            "canonical_slug": row["slug"],
            "record_tier": "complete_first_pass"
            if row["slug"] == "zhen-xi"
            else "identity_first_pass",
            "names": names(row, source_ids),
            "sex": row["gender"],
            "life_status": row["status"] if row["status"] in {"alive", "deceased"} else "unknown",
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
                {
                    "locale": "zh-CN",
                    "summary": "补充官方母系关系、出生细节、事件时间线与收藏图片。",
                },
                {
                    "locale": "en",
                    "summary": (
                        "Added official maternal lineage, birth details, timeline events, "
                        "and collection media."
                    ),
                },
            ],
        }
    )
    return {
        **existing,
        "public": public,
        "restricted": {
            **existing.get("restricted", {}),
            "curator_notes": (
                "Deepened from exact official Chengdu newborn and observation sources; "
                "unresolved fathers remain unknown."
            ),
            "compiled_at": RELEASED_AT,
        },
    }


def parent_stub(
    slug: str,
    row: dict[str, str],
    config: dict[str, str],
    source_ids: list[str],
) -> dict[str, Any]:
    return record(
        stable_id(slug),
        {
            "canonical_slug": slug,
            "legacy_slugs": [],
            "record_tier": "identity_first_pass",
            "names": names(row, source_ids),
            "aliases": [],
            "external_identifiers": [],
            "life_status": "unknown",
            "sex": "female",
            "content": [
                {
                    "locale": "zh-CN",
                    "translation_status": "approved",
                    "summary": (
                        f"成都基地官方新生幼仔档案确认{config['name_zh']}为"
                        f"{CHILDREN[config['child_slug']]['summary_zh'].split('是')[0]}的母亲。"
                    ),
                },
                {
                    "locale": "en",
                    "translation_status": "approved",
                    "summary": (
                        f"An official Chengdu newborn record identifies {config['name_en']} as "
                        "the mother of "
                        f"{CHILDREN[config['child_slug']]['summary_en'].split(' is ')[0]}."
                    ),
                },
            ],
            "revision_summaries": [
                {
                    "locale": "zh-CN",
                    "summary": "建立仅含官方母系身份依据的首轮关系档案。",
                },
                {
                    "locale": "en",
                    "summary": "Created an identity-first maternal relationship profile.",
                },
            ],
        },
        (
            "Identity stub contains only the name and maternal role confirmed by the "
            "exact official newborn source; secondary birth and current-location fields "
            "were not promoted."
        ),
    )


def fact_records(row: dict[str, str], panda_id: str, source_ids: list[str]) -> list[dict[str, Any]]:
    definitions: list[tuple[str, str, str, str | None, str, int | None]] = [
        ("birth-date", "birth_date", row["birth_date"], None, "stable_identity_fact", None),
        ("sex", "sex", row["gender"], None, "stable_identity_fact", None),
        ("birthplace", "birthplace", row["birthplace"], None, "stable_identity_fact", None),
    ]
    if row["current_location"]:
        definitions.append(
            (
                "current-coarse-location",
                "current_coarse_location",
                row["current_location"],
                "facility_level",
                "current_location",
                180,
            )
        )
    result = []
    for suffix, field, value, precision, policy, max_age_days in definitions:
        public: dict[str, Any] = {
            "subject_id": panda_id,
            "field": field,
            "value": value,
            "conclusion_status": "confirmed",
            "source_ids": source_ids,
            "last_verified_at": REVIEWED_AT,
            "freshness": {
                "policy": policy,
                "max_age_days": max_age_days,
                "state": "current",
            },
        }
        if precision:
            public["precision"] = precision
        result.append(
            record(
                f"fact-{row['slug']}-{suffix}",
                public,
                "Compiled from exact official Chengdu sources in the profile-depth batch.",
            )
        )
    return result


def event_record(
    row: dict[str, str],
    panda_ids: dict[str, str],
    published_source_ids: set[str],
) -> dict[str, Any]:
    source_ids = [item for item in split_ids(row["source_ids"]) if item in published_source_ids]
    if not source_ids:
        raise ValueError(f"No published source for event {row['event_id']}")
    participants = [panda_ids[row["panda_slug"]]]
    participants.extend(
        panda_ids[slug] for slug in split_ids(row["related_slugs"]) if slug in panda_ids
    )
    public: dict[str, Any] = {
        "event_type": row["event_type"].replace("-", "_"),
        "event_status": "completed",
        "event_date": row["event_date"],
        "participants": sorted(set(participants)),
        "source_ids": source_ids,
        "changes_current_residency": False,
    }
    if row["location"]:
        public["to_coarse_location"] = row["location"]
    return record(
        row["event_id"],
        public,
        "Reviewed exact-date Chengdu profile-depth event.",
    )


def parentage_record(
    child_slug: str,
    mother_slug: str,
    panda_ids: dict[str, str],
    source_ids: list[str],
) -> dict[str, Any]:
    return record(
        f"parent-{child_slug}-mother",
        {
            "child_id": panda_ids[child_slug],
            "parent_id": panda_ids[mother_slug],
            "role": "mother",
            "status": "confirmed",
            "source_ids": source_ids,
        },
        "Confirmed from the exact official Chengdu newborn profile page.",
    )


def reviewed_media_manifest(processor: dict[str, Any]) -> dict[str, Any]:
    records = []
    for item in sorted(processor["records"], key=lambda record: record["panda_slug"]):
        derivatives = []
        for derivative in sorted(item["derivatives"], key=lambda value: value["width"]):
            path = PROCESSOR_MANIFEST_PATH.parent / derivative["path"]
            if not path.is_file():
                raise FileNotFoundError(path)
            if path.stat().st_size != derivative["bytes"]:
                raise ValueError(f"Derivative byte-size drift: {path}")
            actual_hash = hashlib.sha256(path.read_bytes()).hexdigest()
            if actual_hash != derivative["sha256"]:
                raise ValueError(f"Derivative SHA-256 drift: {path}")
            derivatives.append(
                {
                    "filename": path.name,
                    "kind": derivative["kind"],
                    "sha256": derivative["sha256"],
                    "mime_type": derivative["mime_type"],
                    "width": derivative["width"],
                    "height": derivative["height"],
                    "bytes": derivative["bytes"],
                }
            )
        records.append(
            {
                "panda_slug": item["panda_slug"],
                "media_id": item["media_id"],
                "source_url": item["source_url"],
                "rights": item["rights"],
                "credit": item["credit"],
                "alt_zh": item["alt_zh"],
                "alt_en": item["alt_en"],
                "review_status": item["review_status"],
                "derivatives": derivatives,
            }
        )
    return {
        "batch_version": BATCH_VERSION,
        "generated_at": RELEASED_AT,
        "records": records,
    }


def public_media_record(
    item: dict[str, Any],
    panda_id: str,
    source_id: str,
) -> dict[str, Any]:
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
    primary = max(derivatives, key=lambda derivative: derivative["width"])
    return record(
        item["media_id"],
        {
            "panda_id": panda_id,
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
            "source_ids": [source_id],
        },
        (
            "Official Chengdu image processed into immutable WebP derivatives for the owner's "
            "personal collection. Cohort images retain non-individual wording."
        ),
    )


def build() -> tuple[dict[str, Any], dict[str, Any]]:
    source = deepcopy(read_json(BASE_PATH))
    pandas_rows = curation_by_slug()
    source_rows = source_rows_by_id()
    event_rows = {row["event_id"]: row for row in read_csv("events.csv")}
    processor_manifest = read_json(PROCESSOR_MANIFEST_PATH)
    media_manifest = reviewed_media_manifest(processor_manifest)

    required_source_ids = {
        source_id
        for slug in CHILDREN
        for source_id in split_ids(pandas_rows[slug]["primary_source_ids"])
    }
    required_source_ids.update(
        source_id
        for event_id in SELECTED_EVENTS
        for source_id in split_ids(event_rows[event_id]["source_ids"])
    )
    existing_source_ids = {str(item["id"]) for item in source["sources"]}
    for source_id in sorted(required_source_ids - existing_source_ids):
        replace_or_append(source["sources"], source_record(source_rows[source_id]))

    published_source_ids = {str(item["id"]) for item in source["sources"]}
    existing_pandas = {item["public"]["canonical_slug"]: item for item in source["pandas"]}
    panda_ids = {slug: str(item["id"]) for slug, item in existing_pandas.items()}

    for parent_slug, config in PARENTS.items():
        panda_ids.setdefault(parent_slug, stable_id(parent_slug))
        child_sources = source_ids_for(pandas_rows[config["child_slug"]], published_source_ids)
        stub = parent_stub(
            parent_slug,
            pandas_rows[parent_slug],
            config,
            child_sources,
        )
        replace_or_append(source["pandas"], stub)
        replace_or_append(
            source["media"],
            record(
                f"media-{parent_slug}-none",
                {
                    "display_mode": "designed_empty_state",
                    "license_state": "no_licensed_media",
                    "panda_id": panda_ids[parent_slug],
                    "source_ids": [],
                },
                (
                    "No individually reviewed collection image is attached to this "
                    "maternal identity stub."
                ),
            ),
        )

    for child_slug, config in CHILDREN.items():
        row = pandas_rows[child_slug]
        source_ids = source_ids_for(row, published_source_ids)
        existing = by_slug(source["pandas"], child_slug)
        replace_or_append(source["pandas"], update_child_record(existing, row, config, source_ids))
        panda_ids[child_slug] = str(existing["id"])
        for fact in fact_records(row, panda_ids[child_slug], source_ids):
            replace_or_append(source["facts"], fact)
        replace_or_append(
            source["parentage_assertions"],
            parentage_record(
                child_slug,
                config["mother_slug"],
                panda_ids,
                source_ids,
            ),
        )

    for event_id in sorted(SELECTED_EVENTS):
        replace_or_append(
            source["events"],
            event_record(event_rows[event_id], panda_ids, published_source_ids),
        )

    source_id_by_url = {row["url"]: row["source_id"] for row in source_rows.values()}
    target_panda_ids = {panda_ids[slug] for slug in CHILDREN}
    source["media"] = [
        item
        for item in source["media"]
        if str(item.get("public", {}).get("panda_id")) not in target_panda_ids
    ]
    for item in media_manifest["records"]:
        source_url = item["source_url"]
        source_id = source_id_by_url.get(source_url)
        if source_id is None or source_id not in published_source_ids:
            raise ValueError(f"No published source row matches media source URL: {source_url}")
        replace_or_append(
            source["media"],
            public_media_record(item, panda_ids[item["panda_slug"]], source_id),
        )

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
        source.setdefault(collection, [])
        source[collection].sort(key=lambda item: str(item["id"]))
        ids = [str(item["id"]) for item in source[collection]]
        if len(ids) != len(set(ids)):
            raise ValueError(f"Duplicate IDs in {collection}")

    source["dataset"] = {
        **source["dataset"],
        "version": BATCH_VERSION,
        "base_dataset_version": BASE_VERSION,
        "title": f"PandaAtlas collection release {BATCH_VERSION}",
        "core_panda_count": len(source["pandas"]),
        "expansion_panda_ids": sorted(
            {
                *source["dataset"].get("expansion_panda_ids", []),
                *(panda_ids[slug] for slug in PARENTS),
            }
        ),
    }
    return source, media_manifest


def canonical_json(value: dict[str, Any]) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Build the Chengdu profile-depth reviewed batch.")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    source, media_manifest = build()
    source_text = canonical_json(source)
    media_text = canonical_json(media_manifest)

    if args.check:
        if OUTPUT_PATH.read_text(encoding="utf-8") != source_text:
            raise ValueError(f"Generated source drifted: {OUTPUT_PATH}")
        if MEDIA_MANIFEST_PATH.read_text(encoding="utf-8") != media_text:
            raise ValueError(f"Generated media manifest drifted: {MEDIA_MANIFEST_PATH}")
        print(f"OK: {BATCH_VERSION} Chengdu profile-depth batch is reproducible")
        return 0

    if BATCH_DIR.exists():
        raise FileExistsError(BATCH_DIR)
    temporary = BATCH_DIR.with_name(f".{BATCH_DIR.name}.tmp")
    shutil.rmtree(temporary, ignore_errors=True)
    temporary.mkdir(parents=True)
    try:
        (temporary / "source.json").write_text(source_text, encoding="utf-8", newline="")
        (temporary / "media-manifest.json").write_text(media_text, encoding="utf-8", newline="")
        temporary.replace(BATCH_DIR)
    except Exception:
        shutil.rmtree(temporary, ignore_errors=True)
        raise
    print(
        json.dumps(
            {
                "outcome": "applied",
                "batch_version": BATCH_VERSION,
                "base_version": BASE_VERSION,
                "pandas": len(source["pandas"]),
                "events": len(source["events"]),
                "parentage_assertions": len(source["parentage_assertions"]),
                "media": len(source["media"]),
                "source_sha256": hashlib.sha256(source_text.encode()).hexdigest(),
                "media_manifest_sha256": hashlib.sha256(media_text.encode()).hexdigest(),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
