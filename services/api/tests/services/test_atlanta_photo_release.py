from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

from app.projection.public_release import PublicReleaseInput, build_public_release

ROOT = Path(__file__).resolve().parents[4]
SOURCE_PATH = ROOT / "data" / "reviewed-batches" / "2026.07.20.1" / "source.json"
NEW_SLUGS = {"lun-lun", "yang-yang", "ya-lun"}


def build_release():
    source = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    return build_public_release(
        PublicReleaseInput(
            source_state=source,
            publication_batch_id="atlanta-first-photo-batch",
            projection_code_version="public-release-v4",
            database_migration_version="0007",
            released_at=datetime(2026, 7, 20, 3, 30, tzinfo=UTC),
        )
    )


def test_atlanta_photo_release_has_ten_pandas_and_three_available_media_assets() -> None:
    release = build_release()
    api = json.loads(release.files["api.json"])
    snapshot = json.loads(release.files["pandas.json"])

    assert api["release"]["dataset_release_version"] == "2026.07.20.1"
    assert api["release"]["public_schema_version"] == "1.2.0"
    assert len(api["pandas"]) == 10
    assert sum(item.get("status") == "available" for item in snapshot["media"]) == 3

    expanded = {item["slug"]: item for item in api["pandas"] if item["slug"] in NEW_SLUGS}
    assert expanded.keys() == NEW_SLUGS
    for slug, panda in expanded.items():
        assert len(panda["events"]) >= 3, slug
        assert len(panda["media"]) == 1, slug
        assert panda["media"][0]["status"] == "available"
        assert panda["cover_image_url"].endswith("-w1200.webp")
        assert panda["current_place"]["facility_id"]
        assert panda["current_place"]["last_verified_at"] == "2026-07-20"


def test_ya_lun_parentage_and_shared_return_event_are_not_inferred_or_duplicated() -> None:
    release = build_release()
    api = json.loads(release.files["api.json"])
    expanded = {item["slug"]: item for item in api["pandas"] if item["slug"] in NEW_SLUGS}

    assert expanded["ya-lun"]["father_id"] == expanded["yang-yang"]["id"]
    assert expanded["ya-lun"]["mother_id"] == expanded["lun-lun"]["id"]

    shared_event_ids = {
        event["id"]
        for panda in expanded.values()
        for event in panda["events"]
        if event["event_type"] == "transfer" and event["event_date"] == "2024-10-12"
    }
    assert shared_event_ids == {"event-zoo-atlanta-return-2024"}


def test_release_media_contains_no_internal_storage_or_original_asset_paths() -> None:
    release = build_release()
    serialized = "\n".join(release.files.values())

    assert ".media-work" not in serialized
    assert "originals/" not in serialized
    assert "Special:Redirect/file" not in serialized
    assert "storage_bucket" not in serialized
    assert "storage_path" not in serialized
