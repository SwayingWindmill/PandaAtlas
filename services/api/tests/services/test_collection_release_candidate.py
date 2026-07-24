from __future__ import annotations

import csv
import json
import shutil
import subprocess
import sys
from copy import deepcopy
from datetime import UTC, datetime
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from app.projection.collection_release import build_collection_release_candidate
from app.projection.public_release import PublicReleaseInput, build_public_release

ROOT = Path(__file__).resolve().parents[4]
API_ROOT = ROOT / "services" / "api"
CURATION_DIR = ROOT / "data" / "curation" / "pandas"
BASE_SOURCE_PATH = ROOT / "data" / "reviewed-batches" / "2026.07.23.1" / "source.json"
RELEASED_AT = datetime(2026, 7, 24, 4, 0, tzinfo=UTC)
RELEASE_VERSION = "2026.07.24.1"
PUBLICATION_BATCH_ID = "collection-curation-2026-07-24"
NEW_PROFILE_SLUGS = {
    "bao-xin",
    "cheng-lan",
    "da-mei-changsha",
    "jin-xiao",
    "jing-liang",
    "lun-hui",
    "ni-ke",
    "ni-na",
    "pu-pu-shenyang",
    "qi-fu-changsha",
    "qing-qing-chengdu-2017-07-26",
    "xiao-xin-chengdu-2017",
    "ya-li",
    "ya-song",
    "zhao-mei",
    "zhen-xi",
    "zhi-ma",
    "zhi-shi",
}


def _base_source() -> dict[str, object]:
    return json.loads(BASE_SOURCE_PATH.read_text(encoding="utf-8"))


def _candidate(curation_dir: Path = CURATION_DIR):
    return build_collection_release_candidate(
        base_source_state=_base_source(),
        curation_dir=curation_dir,
        release_version=RELEASE_VERSION,
        publication_batch_id=PUBLICATION_BATCH_ID,
        released_at=RELEASED_AT,
    )


def _by_slug(source: dict[str, object]) -> dict[str, dict[str, object]]:
    return {record["public"]["canonical_slug"]: record for record in source["pandas"]}


def test_collection_release_candidate_is_deterministic_and_preserves_base_semantics() -> None:
    base = _base_source()
    original = deepcopy(base)
    first = build_collection_release_candidate(
        base_source_state=base,
        curation_dir=CURATION_DIR,
        release_version=RELEASE_VERSION,
        publication_batch_id=PUBLICATION_BATCH_ID,
        released_at=RELEASED_AT,
    )
    second = _candidate()

    assert base == original
    assert first.source_json() == second.source_json()
    assert first.report_json() == second.report_json()
    assert first.report["report_id"] == second.report["report_id"]

    summary = first.report["summary"]
    assert summary["base_panda_count"] == 16
    assert summary["eligible_curation_panda_count"] == 28
    assert summary["included_curation_panda_count"] == 28
    assert summary["added_profile_count"] == 18
    assert summary["preserved_profile_count"] == 10
    assert summary["deferred_profile_count"] == 0
    assert summary["result_panda_count"] == 34
    assert summary["risk_tier_counts"] == {"high": 10, "medium": 18}
    assert summary["action_counts"] == {"add": 18, "preserve": 10}
    assert summary["event_changes"] == {
        "added": 15,
        "replaced": 0,
        "skipped_existing_semantic": 30,
        "skipped_missing_source": 0,
    }
    assert summary["residency_changes"] == {
        "added": 0,
        "skipped_without_reviewed_start": 14,
    }
    assert set(first.report["added_profile_slugs"]) == NEW_PROFILE_SLUGS

    base_by_slug = _by_slug(original)
    result_by_slug = _by_slug(first.source_state)
    for slug in first.report["preserved_profile_slugs"]:
        assert result_by_slug[slug] == base_by_slug[slug]

    residency_panda_ids = {
        record["public"]["panda_id"] for record in first.source_state["residencies"]
    }
    media_by_panda_id = {
        record["public"]["panda_id"]: record for record in first.source_state["media"]
    }
    for slug in NEW_PROFILE_SLUGS:
        expected_id = str(uuid5(NAMESPACE_URL, f"https://zhipanda.com/pandas/{slug}"))
        record = result_by_slug[slug]
        assert record["id"] == expected_id
        assert record["public"]["record_tier"] == "identity_first_pass"
        assert expected_id not in residency_panda_ids
        assert media_by_panda_id[expected_id]["public"] == {
            "display_mode": "designed_empty_state",
            "license_state": "no_licensed_media",
            "panda_id": expected_id,
            "source_ids": [],
        }

    residency_gap_decisions = [
        decision
        for decision in first.report["profile_decisions"]
        if "reviewed_current_residency_start" in decision["gaps"]
    ]
    assert len(residency_gap_decisions) == 14

    event_semantics = [
        (participant, public["event_type"], public["event_date"])
        for record in first.source_state["events"]
        for public in (record["public"],)
        for participant in public.get("participants", [])
    ]
    assert len(event_semantics) == len(set(event_semantics))

    public_release = build_public_release(
        PublicReleaseInput(
            source_state=first.source_state,
            publication_batch_id=PUBLICATION_BATCH_ID,
            projection_code_version="collection-release-v1",
            database_migration_version="0007",
            released_at=RELEASED_AT,
        )
    )
    assert public_release.manifest["record_counts"]["pandas"] == 34
    assert public_release.manifest["record_counts"]["api_pandas"] == 34
    api_snapshot = json.loads(public_release.files["api.json"])
    assert len(api_snapshot["pandas"]) == 34
    assert first.report["write_boundary"] == {
        "reviewed_batch": "local-only-until-explicit-apply",
        "public_release": "local-only-until-explicit-apply",
        "d1_activation": False,
        "r2_upload": False,
        "deployment": False,
    }


def test_collection_release_candidate_defers_one_invalid_profile_without_blocking_others(
    tmp_path: Path,
) -> None:
    curation_dir = tmp_path / "curation"
    shutil.copytree(CURATION_DIR, curation_dir)
    pandas_path = curation_dir / "pandas.csv"
    with pandas_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        fields = tuple(reader.fieldnames or ())
        rows = [dict(row) for row in reader]
    for row in rows:
        if row["slug"] == "bao-xin":
            row["primary_source_ids"] = ""
    with pandas_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)

    candidate = _candidate(curation_dir)
    summary = candidate.report["summary"]
    assert summary["included_curation_panda_count"] == 27
    assert summary["added_profile_count"] == 17
    assert summary["deferred_profile_count"] == 1
    assert summary["result_panda_count"] == 33
    decision = next(
        item for item in candidate.report["profile_decisions"] if item["slug"] == "bao-xin"
    )
    assert decision["action"] == "deferred"
    assert decision["risk_tier"] == "blocked"
    assert decision["reasons"] == ["No primary source IDs are attached to the curation row."]


def test_collection_release_cli_is_dry_run_by_default_and_reproducible(
    tmp_path: Path,
) -> None:
    reviewed_root = tmp_path / "reviewed"
    public_root = tmp_path / "public"
    base_dir = reviewed_root / "2026.07.23.1"
    base_dir.mkdir(parents=True)
    shutil.copyfile(BASE_SOURCE_PATH, base_dir / "source.json")
    command = [
        sys.executable,
        str(API_ROOT / "scripts" / "build_collection_release_candidate.py"),
        "--base-version",
        "2026.07.23.1",
        "--release-version",
        RELEASE_VERSION,
        "--publication-batch-id",
        PUBLICATION_BATCH_ID,
        "--released-at",
        "2026-07-24T04:00:00Z",
        "--curation-dir",
        str(CURATION_DIR),
        "--reviewed-root",
        str(reviewed_root),
        "--public-root",
        str(public_root),
    ]

    dry_run = subprocess.run(
        command,
        cwd=API_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    assert json.loads(dry_run.stdout)["outcome"] == "dry-run"
    assert not (reviewed_root / RELEASE_VERSION).exists()
    assert not (public_root / RELEASE_VERSION).exists()

    applied = subprocess.run(
        [*command, "--apply"],
        cwd=API_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    assert json.loads(applied.stdout)["outcome"] == "applied"
    assert sorted(path.name for path in (reviewed_root / RELEASE_VERSION).iterdir()) == [
        "risk-report.json",
        "source.json",
    ]
    assert (public_root / RELEASE_VERSION / "manifest.json").is_file()

    checked = subprocess.run(
        [*command, "--check"],
        cwd=API_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    assert json.loads(checked.stdout)["outcome"] == "checked"
