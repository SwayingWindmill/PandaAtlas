from __future__ import annotations

import argparse
import copy
import json
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
API_ROOT = REPO_ROOT / "services" / "api"
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app.projection.public_release import PublicReleaseInput, build_public_release  # noqa: E402

BASE_VERSION = "2026.07.24.2"
RELEASE_VERSION = "2026.07.31.1"
PUBLIC_SCHEMA_VERSION = "1.3.0"
PUBLICATION_BATCH_ID = "public-experiences-first-cohort-2026-07-31"
PROJECTION_CODE_VERSION = "public-experience-v1"
DATABASE_MIGRATION_VERSION = "0007"
RELEASED_AT = datetime(2026, 7, 31, 12, 0, tzinfo=UTC)
YONG_BA_ID = "35f40679-1253-58f4-a2c5-7669ea81cf6e"
YONG_BA_SOURCE_ID = "src_gpg_yongba_death"
LUN_HUI_ID = "09ebb49d-7bbe-56d1-8059-f5008338eab7"
ZHEN_XI_ID = "47714294-e602-5f67-9a58-b0f43b7c5be5"
CHENGDU_RESEARCH_BASE_ID = "7b09ec20-5a9c-5041-a2f3-eca29a2bc8b0"


def _load_source() -> dict[str, Any]:
    path = REPO_ROOT / "data" / "reviewed-batches" / BASE_VERSION / "source.json"
    return json.loads(path.read_text(encoding="utf-8"))


def _promote_yong_ba(source: dict[str, Any]) -> None:
    dependency = next(record for record in source["related_pandas"] if record["id"] == YONG_BA_ID)
    source["related_pandas"] = [
        record for record in source["related_pandas"] if record["id"] != YONG_BA_ID
    ]
    source["pandas"] = [record for record in source["pandas"] if record["id"] != YONG_BA_ID]
    source["pandas"].append(
        {
            "id": YONG_BA_ID,
            "publication_status": "published",
            "public": {
                "canonical_slug": "yong-ba",
                "legacy_slugs": [],
                "record_tier": "identity_first_pass",
                "names": [
                    {
                        "language": "en",
                        "value": "Yong Ba",
                        "kind": "romanized",
                        "primary": True,
                        "source_ids": [YONG_BA_SOURCE_ID],
                    }
                ],
                "aliases": [],
                "external_identifiers": [],
                "sex": "unknown",
                "life_status": "deceased",
                "content": [
                    {
                        "locale": "zh-CN",
                        "translation_status": "approved",
                        "summary": (
                            "仅以英文罗马字 Yong Ba 发布的历史亲缘身份。现有公开来源确认其已死亡，"
                            "但出生日期、死亡日期、中文名与完整生平尚未达到公开审核要求。"
                        ),
                    },
                    {
                        "locale": "en",
                        "translation_status": "approved",
                        "summary": (
                            "A historic lineage identity published under the romanized name "
                            "Yong Ba. The current public source confirms that he died, while "
                            "birth date, death date, Chinese name, and a full life history "
                            "remain unverified for publication."
                        ),
                    },
                ],
                "revision_summaries": [
                    {
                        "locale": "zh-CN",
                        "summary": "将历史亲缘依赖提升为基础公开档案，并明确保留日期与命名缺口。",
                    },
                    {
                        "locale": "en",
                        "summary": (
                            "Promoted a historic lineage dependency to a basic public "
                            "profile while retaining explicit date and naming gaps."
                        ),
                    },
                ],
            },
            "restricted": {
                **dependency.get("restricted", {}),
                "curator_notes": (
                    "Historic first-cohort profile. Life status is supported by the "
                    "reviewed secondary source; parentage remains tentative and no dates "
                    "or Chinese name are inferred."
                ),
            },
        }
    )
    source["facts"] = [
        fact
        for fact in source["facts"]
        if not (
            fact.get("public", {}).get("subject_id") == YONG_BA_ID
            and fact.get("public", {}).get("field") == "life_status"
        )
    ]
    source["facts"].append(
        {
            "id": "fact-yong-ba-life-status",
            "publication_status": "published",
            "public": {
                "subject_id": YONG_BA_ID,
                "field": "life_status",
                "value": "deceased",
                "conclusion_status": "confirmed",
                "source_ids": [YONG_BA_SOURCE_ID],
                "last_verified_at": "2026-05-11",
                "freshness": {
                    "policy": "stable_identity_fact",
                    "max_age_days": None,
                    "state": "current",
                },
            },
            "restricted": {
                "curator_notes": (
                    "The reviewed source confirms death but does not support a public death date."
                )
            },
        }
    )
    source["media"] = [
        media for media in source["media"] if media.get("public", {}).get("panda_id") != YONG_BA_ID
    ]
    source["media"].append(
        {
            "id": "media-yong-ba-none",
            "publication_status": "published",
            "public": {
                "panda_id": YONG_BA_ID,
                "license_state": "no_licensed_media",
                "display_mode": "designed_empty_state",
                "source_ids": [],
            },
            "restricted": {
                "curator_notes": "No reviewed licensed media is attached to this historic identity."
            },
        }
    )


def _ensure_lun_hui_residency(source: dict[str, Any]) -> None:
    source["residencies"] = [
        residency
        for residency in source["residencies"]
        if residency.get("public", {}).get("panda_id") != LUN_HUI_ID
    ]
    source["residencies"].append(
        {
            "id": "res-lun-hui-chengdu-research-base",
            "publication_status": "published",
            "public": {
                "panda_id": LUN_HUI_ID,
                "facility_id": CHENGDU_RESEARCH_BASE_ID,
                "residency_type": "primary",
                "start_date": "2021-07-25",
                "end_date": None,
                "status": "confirmed",
                "last_verified_at": "2026-07-24",
                "source_ids": [
                    "src_chengdu_newborns_2021_zh",
                    "src_gpg_chengdu_base_current_page_6",
                    "src_gpg_meet_world_page_24",
                ],
            },
            "restricted": {
                "curator_notes": (
                    "Current Chengdu Research Base residency compiled from the reviewed "
                    "birth and current-holding sources used by the confirmed location fact."
                )
            },
        }
    )


def _ensure_zhen_xi_residency(source: dict[str, Any]) -> None:
    source["residencies"] = [
        residency
        for residency in source["residencies"]
        if residency.get("public", {}).get("panda_id") != ZHEN_XI_ID
    ]
    source["residencies"].append(
        {
            "id": "res-zhen-xi-chengdu-research-base",
            "publication_status": "published",
            "public": {
                "panda_id": ZHEN_XI_ID,
                "facility_id": CHENGDU_RESEARCH_BASE_ID,
                "residency_type": "primary",
                "start_date": "2024-04-01",
                "end_date": None,
                "status": "confirmed",
                "last_verified_at": "2026-07-24",
                "source_ids": ["src_chengdu_zhen_xi_visit_2024"],
            },
            "restricted": {
                "curator_notes": (
                    "Current Chengdu Research Base residency begins at the exact official "
                    "Xinghan Hall observation date and does not infer earlier continuity."
                )
            },
        }
    )


def transform(source: dict[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(source)
    dataset = result["dataset"]
    dataset["base_dataset_version"] = BASE_VERSION
    dataset["version"] = RELEASE_VERSION
    dataset["public_schema_version"] = PUBLIC_SCHEMA_VERSION
    dataset["title"] = f"PandaAtlas public experiences first cohort {RELEASE_VERSION}"
    dataset["core_panda_count"] = 39
    dataset["expansion_panda_ids"] = []
    dataset["partial_profile_panda_ids"] = [YONG_BA_ID]
    _promote_yong_ba(result)
    _ensure_lun_hui_residency(result)
    _ensure_zhen_xi_residency(result)
    for collection in (
        "events",
        "facilities",
        "facts",
        "institutions",
        "media",
        "pandas",
        "parentage_assertions",
        "places",
        "related_pandas",
        "residencies",
        "sources",
    ):
        result[collection].sort(key=lambda record: str(record["id"]))
    return result


def build() -> tuple[dict[str, Any], Any]:
    source = transform(_load_source())
    release = build_public_release(
        PublicReleaseInput(
            source_state=source,
            publication_batch_id=PUBLICATION_BATCH_ID,
            projection_code_version=PROJECTION_CODE_VERSION,
            database_migration_version=DATABASE_MIGRATION_VERSION,
            released_at=RELEASED_AT,
        )
    )
    return source, release


def write_release(source: dict[str, Any], release: Any) -> None:
    reviewed_dir = REPO_ROOT / "data" / "reviewed-batches" / RELEASE_VERSION
    release_dir = REPO_ROOT / "data" / "public-releases" / RELEASE_VERSION
    reviewed_dir.mkdir(parents=True, exist_ok=True)
    release_dir.mkdir(parents=True, exist_ok=True)
    (reviewed_dir / "source.json").write_text(
        json.dumps(source, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    for filename, content in release.files.items():
        (release_dir / filename).write_bytes(content.encode("utf-8"))
    (release_dir / "manifest.json").write_text(
        json.dumps(release.manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build the immutable first public-experiences cohort release."
    )
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    source, release = build()
    api_payload = json.loads(release.files["api.json"])
    summary = {
        "outcome": "applied" if args.apply else "dry-run",
        "release": release.release_metadata,
        "record_counts": release.manifest["record_counts"],
        "pandas": len(api_payload["pandas"]),
        "events": len(api_payload["events"]),
        "parentage_assertions": len(api_payload["parentage_assertions"]),
        "family_stories": [story["slug"] for story in api_payload["family_stories"]],
        "profile_cohort": api_payload["profile_cohort"],
    }
    if args.apply:
        write_release(source, release)
    print(json.dumps(summary, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
