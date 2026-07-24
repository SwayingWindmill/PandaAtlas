from __future__ import annotations

import argparse
import csv
import json
import os
import shutil
import tempfile
from pathlib import Path
from typing import Any

from validate_panda_curation import validate_curation

REPO_ROOT = Path(__file__).resolve().parents[2]
CURATION_DIR = REPO_ROOT / "data" / "curation" / "pandas"
REVIEWED_AT = "2026-07-24"
CHENGDU_LOCATION = "Chengdu Research Base of Giant Panda Breeding, Chengdu, Sichuan, China"

PROFILE_UPDATES: dict[str, dict[str, str]] = {
    "bao-xin": {
        "birthplace": CHENGDU_LOCATION,
        "mother_slug": "a-bao",
        "intro": (
            "Bao Xin is a male giant panda born at the Chengdu Research Base on "
            "2021-06-24 to mother A Bao. He joined the Base's online presentation "
            "of the 2021 newborn cohort on 2021-10-01."
        ),
        "tags": "chengdu;newborn-cohort;2021-cohort;mother-confirmed;public-debut",
        "primary_source_ids": "src_chengdu_newborns_2021_en;src_chengdu_newborns_2021_zh",
        "notes": (
            "Official Chengdu bilingual newborn pages confirm identity, sex, birth date, "
            "mother A Bao, birth at the Base, and the 2021 online debut. "
            "Father remains unknown."
        ),
    },
    "zhen-xi": {
        "status": "alive",
        "birthplace": CHENGDU_LOCATION,
        "current_location": CHENGDU_LOCATION,
        "mother_slug": "qi-zhen",
        "intro": (
            "Zhen Xi is a female giant panda born at the Chengdu Research Base on "
            "2017-07-15 to mother Qi Zhen, with a recorded birth weight of 168 g. "
            "She joined the 2017 newborn cohort presentation and was officially "
            "observed eating bamboo at Xinghan Hall on 2024-04-01."
        ),
        "tags": (
            "chengdu;newborn-cohort;2017-cohort;mother-confirmed;public-debut;"
            "official-observation"
        ),
        "primary_source_ids": (
            "src_chengdu_newborns_2017_en;src_chengdu_newborns_2017_zh;"
            "src_chengdu_zhen_xi_visit_2024"
        ),
        "notes": (
            "Official Chengdu sources confirm identity, sex, birth date, mother Qi Zhen, "
            "birth weight, 2017 cohort debut, and a 2024-04-01 observation at "
            "Xinghan Hall. Father remains unknown."
        ),
    },
    "qing-qing-chengdu-2017-07-26": {
        "birthplace": CHENGDU_LOCATION,
        "mother_slug": "er-qiao",
        "intro": (
            "Qing Qing is a female giant panda born at the Chengdu Research Base on "
            "2017-07-26 to mother Er Qiao, with a recorded birth weight of 144 g. "
            "She joined the Base's 2017 newborn cohort presentation."
        ),
        "tags": "chengdu;newborn-cohort;2017-cohort;mother-confirmed;public-debut",
        "primary_source_ids": "src_chengdu_newborns_2017_en;src_chengdu_newborns_2017_zh",
        "notes": (
            "Official Chengdu bilingual newborn pages confirm identity, sex, birth date, "
            "mother Er Qiao, birth weight, birth at the Base, and the 2017 cohort debut. "
            "Father remains unknown."
        ),
    },
    "xiao-xin-chengdu-2017": {
        "birthplace": CHENGDU_LOCATION,
        "mother_slug": "xiao-yatou",
        "intro": (
            "Xiao Xin is a female giant panda born at the Chengdu Research Base on "
            "2017-07-26 to mother Xiao Yatou, with a recorded birth weight of 115.4 g. "
            "She joined the Base's 2017 newborn cohort presentation."
        ),
        "tags": "chengdu;newborn-cohort;2017-cohort;mother-confirmed;public-debut",
        "primary_source_ids": "src_chengdu_newborns_2017_en;src_chengdu_newborns_2017_zh",
        "notes": (
            "Official Chengdu bilingual newborn pages confirm identity, sex, birth date, "
            "mother Xiao Yatou, birth weight, birth at the Base, and the 2017 cohort debut. "
            "Father remains unknown."
        ),
    },
}

PARENT_NAME_UPDATES = {
    "a-bao": ("阿宝", "src_chengdu_newborns_2021_en;src_chengdu_newborns_2021_zh"),
    "qi-zhen": ("奇珍", "src_chengdu_newborns_2017_en;src_chengdu_newborns_2017_zh"),
    "er-qiao": ("二巧", "src_chengdu_newborns_2017_en;src_chengdu_newborns_2017_zh"),
    "xiao-yatou": ("小丫头", "src_chengdu_newborns_2017_en;src_chengdu_newborns_2017_zh"),
}

SOURCE_ROW = {
    "source_id": "src_chengdu_zhen_xi_visit_2024",
    "source_type": "official_news",
    "publisher": "Chengdu Research Base of Giant Panda Breeding",
    "title": "跨洋粉丝团来访，大熊猫再次“圈粉”！",
    "url": "https://www.panda.org.cn/cn/news/news/2024-04-02/8339.html",
    "published_date": "2024-04-02",
    "accessed_at": REVIEWED_AT,
    "reliability": "primary_fact",
    "allowed_use": "profile_facts_and_collection_media",
    "notes": (
        "Official article identifies Zhen Xi at Xinghan Hall on 2024-04-01 and labels "
        "the exact image as Zhen Xi eating bamboo."
    ),
}

EVENT_UPDATES = {
    "evt_bao_xin_birth_20210624": {
        "related_slugs": "a-bao",
        "location": CHENGDU_LOCATION,
    },
    "evt_zhen_xi_birth_20170715": {
        "related_slugs": "qi-zhen",
        "location": CHENGDU_LOCATION,
    },
    "evt_qing_qing_chengdu_2017_07_26_birth_20170726": {
        "related_slugs": "er-qiao",
        "location": CHENGDU_LOCATION,
    },
    "evt_xiao_xin_chengdu_2017_birth_20170726": {
        "related_slugs": "xiao-yatou",
        "location": CHENGDU_LOCATION,
    },
}

NEW_EVENTS = [
    {
        "event_id": "evt_bao_xin_online_debut_20211001",
        "panda_slug": "bao-xin",
        "event_type": "public_debut",
        "event_date": "2021-10-01",
        "event_date_precision": "day",
        "location": CHENGDU_LOCATION,
        "related_slugs": "",
        "source_ids": "src_chengdu_newborns_2021_en;src_chengdu_newborns_2021_zh",
        "evidence_status": "verified",
        "review_status": "reviewed",
        "notes": "Official bilingual pages document Bao Xin in the 2021 newborn online debut.",
    },
    {
        "event_id": "evt_zhen_xi_cohort_debut_20170927",
        "panda_slug": "zhen-xi",
        "event_type": "public_debut",
        "event_date": "2017-09-27",
        "event_date_precision": "day",
        "location": CHENGDU_LOCATION,
        "related_slugs": "",
        "source_ids": "src_chengdu_newborns_2017_en;src_chengdu_newborns_2017_zh",
        "evidence_status": "verified",
        "review_status": "reviewed",
        "notes": "Official bilingual pages document the 2017 newborn cohort presentation.",
    },
    {
        "event_id": "evt_qing_qing_cohort_debut_20170927",
        "panda_slug": "qing-qing-chengdu-2017-07-26",
        "event_type": "public_debut",
        "event_date": "2017-09-27",
        "event_date_precision": "day",
        "location": CHENGDU_LOCATION,
        "related_slugs": "",
        "source_ids": "src_chengdu_newborns_2017_en;src_chengdu_newborns_2017_zh",
        "evidence_status": "verified",
        "review_status": "reviewed",
        "notes": "Official bilingual pages document the 2017 newborn cohort presentation.",
    },
    {
        "event_id": "evt_xiao_xin_cohort_debut_20170927",
        "panda_slug": "xiao-xin-chengdu-2017",
        "event_type": "public_debut",
        "event_date": "2017-09-27",
        "event_date_precision": "day",
        "location": CHENGDU_LOCATION,
        "related_slugs": "",
        "source_ids": "src_chengdu_newborns_2017_en;src_chengdu_newborns_2017_zh",
        "evidence_status": "verified",
        "review_status": "reviewed",
        "notes": "Official bilingual pages document the 2017 newborn cohort presentation.",
    },
    {
        "event_id": "evt_zhen_xi_xinghan_observation_20240401",
        "panda_slug": "zhen-xi",
        "event_type": "observation",
        "event_date": "2024-04-01",
        "event_date_precision": "day",
        "location": "Xinghan Hall, Chengdu Research Base of Giant Panda Breeding",
        "related_slugs": "",
        "source_ids": "src_chengdu_zhen_xi_visit_2024",
        "evidence_status": "verified",
        "review_status": "reviewed",
        "notes": (
            "Official Chengdu article records Zhen Xi eating bamboo during the "
            "2024-04-01 visit."
        ),
    },
]

MEDIA_ROWS = [
    {
        "panda_slug": "bao-xin",
        "asset": "https://file.panda.org.cn/d/file/p/2023/07-07/fa8caf7c6301cad2711e67f1d997fcc3.jpg",
        "source_url": "https://www.panda.org.cn/cn/culture/activities/2023-07-07/6594.html",
        "rights": "All rights reserved",
        "credit": "Chengdu Research Base of Giant Panda Breeding",
        "alt_zh": "2021年新生幼仔档案中的宝新",
        "alt_en": "Bao Xin in the official 2021 newborn profile",
        "review_status": "collection_only",
        "notes": (
            "Exact image follows the Bao Xin profile and is retained for the owner's "
            "personal collection."
        ),
    },
    {
        "panda_slug": "zhen-xi",
        "asset": "https://file.panda.org.cn/d/file/p/2024/04-02/46aebe5228463b5d3eb95dbbaba3d5fb.png",
        "source_url": "https://www.panda.org.cn/cn/news/news/2024-04-02/8339.html",
        "rights": "All rights reserved",
        "credit": "Chengdu Research Base of Giant Panda Breeding",
        "alt_zh": "珍喜在成都大熊猫繁育研究基地吃竹子",
        "alt_en": "Zhen Xi eating bamboo at the Chengdu Research Base",
        "review_status": "collection_only",
        "notes": (
            "Official caption explicitly identifies Zhen Xi; retained for the owner's "
            "personal collection."
        ),
    },
    {
        "panda_slug": "qing-qing-chengdu-2017-07-26",
        "asset": "https://file.panda.org.cn/d/file/china/news/activities/2017-09-29/06a15b7f014e7c594bceacab29411f87.jpg",
        "source_url": "https://www.panda.org.cn/cn/culture/activities/2023-08-23/8079.html",
        "rights": "All rights reserved",
        "credit": "Chengdu Research Base of Giant Panda Breeding",
        "alt_zh": "2017年成都基地新生幼仔集体亮相现场；青青属于该批次",
        "alt_en": "The 2017 Chengdu newborn cohort presentation; Qing Qing belongs to this cohort",
        "review_status": "collection_only",
        "notes": (
            "Cohort photograph only. The official article confirms Qing Qing belongs "
            "to the presented cohort, but does not identify her position in this image."
        ),
    },
    {
        "panda_slug": "xiao-xin-chengdu-2017",
        "asset": "https://file.panda.org.cn/d/file/china/news/activities/2017-09-29/1064c21ec4073572c6ef520fcd6c3a1d.jpg",
        "source_url": "https://www.panda.org.cn/cn/culture/activities/2023-08-23/8079.html",
        "rights": "All rights reserved",
        "credit": "Chengdu Research Base of Giant Panda Breeding",
        "alt_zh": "2017年成都基地新生幼仔集体亮相现场；小馨属于该批次",
        "alt_en": "The 2017 Chengdu newborn cohort presentation; Xiao Xin belongs to this cohort",
        "review_status": "collection_only",
        "notes": (
            "Cohort photograph only. The official article confirms Xiao Xin belongs "
            "to the presented cohort, but does not identify her position in this image."
        ),
    },
]


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        return list(reader.fieldnames or []), [dict(row) for row in reader]


def write_csv(path: Path, fields: list[str], rows: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def merge_ids(existing: str, additions: str) -> str:
    values = {value.strip() for value in (existing + ";" + additions).split(";") if value.strip()}
    return ";".join(sorted(values))


def transform(curation_dir: Path) -> dict[str, Any]:
    panda_fields, pandas = read_csv(curation_dir / "pandas.csv")
    event_fields, events = read_csv(curation_dir / "events.csv")
    source_fields, sources = read_csv(curation_dir / "sources.csv")
    media_fields, media = read_csv(curation_dir / "media.csv")

    pandas_by_slug = {row["slug"]: row for row in pandas}
    for slug, updates in PROFILE_UPDATES.items():
        row = pandas_by_slug[slug]
        for field, value in updates.items():
            row[field] = value

    for slug, (name_zh, source_ids) in PARENT_NAME_UPDATES.items():
        row = pandas_by_slug[slug]
        row["name_zh"] = name_zh
        row["primary_source_ids"] = merge_ids(row["primary_source_ids"], source_ids)
        row["notes"] = (
            row["notes"].rstrip()
            + " Official Chengdu newborn page confirms this Chinese name in a mother role."
        ).strip()

    source_by_id = {row["source_id"]: row for row in sources}
    if SOURCE_ROW["source_id"] in source_by_id:
        source_by_id[SOURCE_ROW["source_id"]].update(SOURCE_ROW)
    else:
        sources.append(dict(SOURCE_ROW))

    event_by_id = {row["event_id"]: row for row in events}
    for event_id, updates in EVENT_UPDATES.items():
        event_by_id[event_id].update(updates)
        event_by_id[event_id]["notes"] = (
            event_by_id[event_id]["notes"].rstrip()
            + " Parent participant resolved from the official Chengdu newborn page."
        ).strip()
    for event in NEW_EVENTS:
        if event["event_id"] in event_by_id:
            event_by_id[event["event_id"]].update(event)
        else:
            events.append(dict(event))
            event_by_id[event["event_id"]] = events[-1]

    media_by_key = {(row["panda_slug"], row["asset"]): row for row in media}
    for record in MEDIA_ROWS:
        key = (record["panda_slug"], record["asset"])
        if key in media_by_key:
            media_by_key[key].update(record)
        else:
            media.append(dict(record))
            media_by_key[key] = media[-1]

    pandas.sort(key=lambda row: row["slug"])
    events.sort(key=lambda row: row["event_id"])
    sources.sort(key=lambda row: row["source_id"])
    media.sort(key=lambda row: (row["panda_slug"], row["asset"]))

    write_csv(curation_dir / "pandas.csv", panda_fields, pandas)
    write_csv(curation_dir / "events.csv", event_fields, events)
    write_csv(curation_dir / "sources.csv", source_fields, sources)
    write_csv(curation_dir / "media.csv", media_fields, media)

    return {
        "profiles_updated": sorted(PROFILE_UPDATES),
        "parent_names_resolved": sorted(PARENT_NAME_UPDATES),
        "events_added_or_updated": sorted(
            event_by_id for event_by_id in [event["event_id"] for event in NEW_EVENTS]
        ),
        "media_rows_added_or_updated": len(MEDIA_ROWS),
        "source_added_or_updated": SOURCE_ROW["source_id"],
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Apply the reviewed Chengdu profile-depth curation slice."
    )
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    staging_root = Path(
        tempfile.mkdtemp(prefix="panda-atlas-chengdu-depth-", dir=CURATION_DIR.parent)
    )
    staging = staging_root / "pandas"
    try:
        shutil.copytree(CURATION_DIR, staging)
        summary = transform(staging)
        errors, counts = validate_curation(staging)
        if errors:
            raise ValueError("\n".join(errors))
        changed = [
            filename
            for filename in ("pandas.csv", "events.csv", "sources.csv", "media.csv")
            if (CURATION_DIR / filename).read_bytes() != (staging / filename).read_bytes()
        ]
        if args.apply and changed:
            original_hashes = {
                filename: (CURATION_DIR / filename).read_bytes() for filename in changed
            }
            for filename, original in original_hashes.items():
                if (CURATION_DIR / filename).read_bytes() != original:
                    raise RuntimeError(f"Concurrent curation change detected: {filename}")
            for filename in changed:
                os.replace(staging / filename, CURATION_DIR / filename)
        print(
            json.dumps(
                {
                    "outcome": "applied" if args.apply else "dry-run",
                    "changed_files": changed,
                    "counts": counts,
                    "summary": summary,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0
    finally:
        shutil.rmtree(staging_root, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
