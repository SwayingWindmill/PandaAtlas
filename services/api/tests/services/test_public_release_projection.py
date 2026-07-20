from __future__ import annotations

import csv
import io
import json
import sqlite3
from copy import deepcopy
from datetime import UTC, datetime
from pathlib import Path

import pytest

from app.data.golden_dataset import load_golden_dataset
from app.projection.d1_migrations import (
    D1_PUBLIC_RELEASE_MIGRATIONS,
    read_d1_migration_bundle,
)
from app.projection.public_release import (
    ProjectionCompatibilityError,
    ProjectionSecurityError,
    PublicReleaseInput,
    build_public_release,
)

RELEASED_AT = datetime(2026, 7, 14, 8, 0, tzinfo=UTC)
ROOT = Path(__file__).resolve().parents[4]


def _release_input() -> PublicReleaseInput:
    return PublicReleaseInput(
        source_state=deepcopy(load_golden_dataset()),
        publication_batch_id="batch-golden-2026-07-14",
        projection_code_version="git:db1e0fd",
        database_migration_version="0006",
        released_at=RELEASED_AT,
    )


def _licensed_media_record(panda_id: str) -> dict[str, object]:
    return {
        "id": "media-mei-xiang-licensed",
        "publication_status": "published",
        "public": {
            "panda_id": panda_id,
            "url": "https://media.example.org/media-mei-xiang-licensed-w1200.webp",
            "source_url": "https://commons.wikimedia.org/wiki/File:Mei_Xiang.jpg",
            "rights": "CC BY-SA 4.0",
            "credit": "Example Author / Wikimedia Commons",
            "alt_zh": "美香坐在竹子旁",
            "alt_en": "Mei Xiang sitting beside bamboo",
            "status": "available",
            "sha256": "a" * 64,
            "mime_type": "image/webp",
            "width": 1200,
            "height": 800,
            "bytes": 120000,
            "derivatives": [
                {
                    "kind": "width-480",
                    "url": "https://media.example.org/media-mei-xiang-licensed-w480.webp",
                    "sha256": "b" * 64,
                    "mime_type": "image/webp",
                    "width": 480,
                    "height": 320,
                    "bytes": 24000,
                },
                {
                    "kind": "width-1200",
                    "url": "https://media.example.org/media-mei-xiang-licensed-w1200.webp",
                    "sha256": "c" * 64,
                    "mime_type": "image/webp",
                    "width": 1200,
                    "height": 800,
                    "bytes": 88000,
                },
            ],
            "source_ids": ["src_smithsonian_history"],
        },
    }


def _release_input_with_media() -> PublicReleaseInput:
    release_input = _release_input()
    release_input.source_state["dataset"]["version"] = "2026.07.18.2"
    release_input.source_state["dataset"]["public_schema_version"] = "1.2.0"
    release_input.source_state["media"].append(
        _licensed_media_record("2939c16f-1938-5629-928c-b36b1d5cd6ed")
    )
    return release_input


def test_golden_release_is_deterministic_and_cross_surface_versions_match() -> None:
    first = build_public_release(_release_input())
    second = build_public_release(_release_input())

    assert first.files == second.files
    assert first.manifest == second.manifest
    assert first.manifest["dataset_release_version"] == "2026.07.18.1"
    assert first.manifest["public_schema_version"] == "1.1.0"
    assert first.manifest["database_migration_version"] == "0006"
    assert first.manifest["publication_batch_id"] == "batch-golden-2026-07-14"
    assert first.manifest["projection_code_version"] == "git:db1e0fd"
    assert first.manifest["released_at"] == "2026-07-14T08:00:00Z"

    snapshot = json.loads(first.files["pandas.json"])
    assert len(snapshot["records"]) == 7
    assert snapshot["release"] == first.release_metadata

    api_snapshot = json.loads(first.files["api.json"])
    assert api_snapshot["release"] == first.release_metadata
    assert {item["id"] for item in api_snapshot["institutions"]} == {
        "institution-ccrcgp",
        "institution-smithsonian-national-zoo",
    }
    assert {item["id"] for item in api_snapshot["places"]} == {
        "place-smithsonian-national-zoo-dc",
        "place-wolong-shenshuping-base",
    }
    assert all(item["precision"] == "locality" for item in api_snapshot["places"])
    assert len(api_snapshot["pandas"]) == 7
    assert api_snapshot["distribution"]["type"] == "FeatureCollection"
    assert api_snapshot["habitats"]["type"] == "FeatureCollection"
    assert api_snapshot["stats"]["total_pandas"] == 7
    assert "'api_pandas'" in first.files["d1.sql"]
    assert "'api_distribution'" in first.files["d1.sql"]

    csv_rows = list(csv.DictReader(io.StringIO(first.files["pandas.csv"])))
    assert len(csv_rows) == 7
    assert {row["dataset_release_version"] for row in csv_rows} == {"2026.07.18.1"}
    assert {row["public_schema_version"] for row in csv_rows} == {"1.1.0"}

    for filename, descriptor in first.manifest["files"].items():
        assert descriptor["sha256"] == first.checksum(filename)
        assert descriptor["bytes"] == len(first.files[filename].encode("utf-8"))


def test_public_media_is_identical_across_snapshot_api_csv_and_d1() -> None:
    release = build_public_release(_release_input_with_media())
    snapshot = json.loads(release.files["pandas.json"])
    api = json.loads(release.files["api.json"])
    csv_rows = list(csv.DictReader(io.StringIO(release.files["pandas.csv"])))

    media = next(item for item in snapshot["media"] if item["id"] == "media-mei-xiang-licensed")
    snapshot_panda = next(
        item for item in snapshot["records"] if item["id"] == "2939c16f-1938-5629-928c-b36b1d5cd6ed"
    )
    api_panda = next(item for item in api["pandas"] if item["id"] == snapshot_panda["id"])
    csv_panda = next(
        json.loads(row["public_json"]) for row in csv_rows if row["id"] == snapshot_panda["id"]
    )

    assert snapshot_panda["media"] == [media]
    assert api_panda["media"] == [media]
    assert not {
        "storage_bucket",
        "storage_path",
        "title",
        "photographer",
        "signed_url",
    } & media.keys()
    assert csv_panda["media"] == [media]
    assert snapshot_panda["cover_image_url"] == media["url"]
    assert api_panda["cover_image_url"] == media["url"]
    assert api_panda["media_release"] == {
        "license_state": "licensed",
        "display_mode": "gallery",
        "source_ids": ["src_smithsonian_history"],
    }

    database = sqlite3.connect(":memory:")
    database.executescript(read_d1_migration_bundle(ROOT, D1_PUBLIC_RELEASE_MIGRATIONS))
    database.executescript(release.files["d1.sql"])
    d1_media = json.loads(
        database.execute(
            "select public_json from current_public_records "
            "where entity_type = 'media' and entity_id = 'media-mei-xiang-licensed'"
        ).fetchone()[0]
    )
    d1_api_panda = json.loads(
        database.execute(
            "select public_json from current_public_records "
            "where entity_type = 'api_pandas' and entity_id = ?",
            (snapshot_panda["id"],),
        ).fetchone()[0]
    )
    assert {"id": "media-mei-xiang-licensed", **d1_media} == media
    assert d1_api_panda["media"] == [media]


def test_withdrawn_public_media_exposes_no_image_or_derivative_url() -> None:
    release_input = _release_input_with_media()
    media_public = release_input.source_state["media"][-1]["public"]
    media_public["status"] = "withdrawn"
    media_public["url"] = None
    media_public["derivatives"] = []

    release = build_public_release(release_input)
    api = json.loads(release.files["api.json"])
    panda = next(
        item for item in api["pandas"] if item["id"] == "2939c16f-1938-5629-928c-b36b1d5cd6ed"
    )
    assert panda["cover_image_url"] is None
    assert panda["media"][0]["status"] == "withdrawn"
    assert panda["media"][0]["url"] is None
    assert panda["media"][0]["derivatives"] == []
    assert "media.example.org" not in "\n".join(release.files.values())


def test_projection_excludes_restricted_drafts_and_precise_sensitive_locations() -> None:
    release_input = _release_input()
    release_input.source_state["pandas"][0]["public"]["precise_wildlife_location"] = {
        "latitude": 30.123456,
        "longitude": 102.654321,
    }

    release = build_public_release(release_input)
    serialized = "\n".join(release.files.values()).lower()

    assert "curator_notes" not in serialized
    assert "internal_completeness_score" not in serialized
    assert "review_owner" not in serialized
    assert "待審核翻譯草稿" not in serialized
    assert "precise_wildlife_location" not in serialized
    assert "30.123456" not in serialized
    assert "102.654321" not in serialized


def test_projection_fails_closed_when_sensitive_field_is_not_on_the_drop_list() -> None:
    release_input = _release_input()
    release_input.source_state["pandas"][0]["public"]["contact_email"] = "person@example.org"

    with pytest.raises(ProjectionSecurityError, match="contact_email"):
        build_public_release(release_input)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("coordinates", [102.654321, 30.123456]),
        ("latitude", 30.123456),
        ("gps", "30.123456,102.654321"),
        ("home_address", "Private residence"),
    ],
)
def test_projection_rejects_unapproved_public_fields(field: str, value: object) -> None:
    release_input = _release_input()
    release_input.source_state["pandas"][0]["public"][field] = value

    with pytest.raises(ProjectionSecurityError, match=field):
        build_public_release(release_input)


@pytest.mark.parametrize(
    ("field", "value", "message"),
    [
        ("current_location", "30.123456,102.654321", "Precise coordinates"),
        ("intro", "Contact person@example.org for details", "Personal email"),
    ],
)
def test_projection_rejects_sensitive_values_inside_allowed_fields(
    field: str, value: str, message: str
) -> None:
    release_input = _release_input()
    release_input.source_state["pandas"][0]["public"][field] = value

    with pytest.raises(ProjectionSecurityError, match=message):
        build_public_release(release_input)


def test_runtime_api_snapshot_rejects_sensitive_values() -> None:
    release_input = _release_input()
    release_input.source_state["runtime_api"] = {
        "distribution": {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "id": "unsafe",
                    "geometry": {"type": "Point", "coordinates": [0, 0]},
                    "properties": {"contact_email": "person@example.org"},
                }
            ],
        },
        "habitats": {"type": "FeatureCollection", "features": []},
        "snapshots": [],
    }

    with pytest.raises(ProjectionSecurityError, match="contact_email"):
        build_public_release(release_input)


def test_runtime_api_rejects_three_decimal_wildlife_points() -> None:
    release_input = _release_input()
    release_input.source_state["runtime_api"] = {
        "distribution": {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "id": "precise-wild-point",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [102.654, 30.123],
                    },
                    "properties": {
                        "cell_code": "unsafe",
                        "layer": "wild",
                        "density": 1,
                        "snapshot_date": "2026-07-14",
                    },
                }
            ],
        },
        "habitats": {"type": "FeatureCollection", "features": []},
        "snapshots": [],
    }

    with pytest.raises(ProjectionSecurityError, match="aggregated polygon"):
        build_public_release(release_input)


def test_reviewed_record_state_builds_a_complete_runtime_snapshot() -> None:
    fixture_input = _release_input()
    fixture_release = build_public_release(fixture_input)
    api = json.loads(fixture_release.files["api.json"])
    records = []
    for collection in (
        "sources",
        "institutions",
        "facilities",
        "pandas",
        "facts",
        "parentage_assertions",
        "residencies",
        "events",
        "media",
    ):
        records.extend(
            {
                "entity_type": collection,
                "id": item["id"],
                "public": item["public"],
            }
            for item in fixture_input.source_state.get(collection, [])
            if item.get("publication_status") == "published"
        )
    records.extend(
        {"entity_type": "api_pandas", "id": item["id"], "public": item}
        for item in api["pandas"]
    )
    records.extend(
        {
            "entity_type": "api_distribution",
            "id": str(item["id"]),
            "public": item,
        }
        for item in api["distribution"]["features"]
    )
    records.extend(
        {"entity_type": "api_habitats", "id": str(item["id"]), "public": item}
        for item in api["habitats"]["features"]
    )
    records.extend(
        {"entity_type": "api_snapshots", "id": str(item["version"]), "public": item}
        for item in api["snapshots"]
    )
    release_input = PublicReleaseInput(
        source_state={"dataset": fixture_input.source_state["dataset"], "records": records},
        publication_batch_id="reviewed-postgres-batch",
        projection_code_version="public-release-v2",
        database_migration_version="0007",
        released_at=RELEASED_AT,
    )

    release = build_public_release(release_input)
    rebuilt_api = json.loads(release.files["api.json"])
    assert len(rebuilt_api["pandas"]) == 7
    assert rebuilt_api["distribution"]["features"]
    assert rebuilt_api["habitats"]["features"]
    assert rebuilt_api["snapshots"]
    database = sqlite3.connect(":memory:")
    migration = read_d1_migration_bundle(
        ROOT,
        D1_PUBLIC_RELEASE_MIGRATIONS,
    )
    database.executescript(migration)
    database.executescript(release.files["d1.sql"])

    conflicting = deepcopy(release_input)
    api_panda = next(
        record
        for record in conflicting.source_state["records"]
        if record["entity_type"] == "api_pandas"
    )
    api_panda["public"]["name_zh"] = "冲突名称"
    with pytest.raises(ProjectionCompatibilityError, match="semantics conflict"):
        build_public_release(conflicting)


def test_projection_rejects_an_incompatible_public_schema() -> None:
    release_input = _release_input()
    release_input.source_state["dataset"]["public_schema_version"] = "2.0.0"

    with pytest.raises(ProjectionCompatibilityError, match="2.0.0"):
        build_public_release(release_input)


def test_reviewed_runtime_snapshot_requires_matching_archive_pandas() -> None:
    fixture_input = _release_input()
    fixture_release = build_public_release(fixture_input)
    api = json.loads(fixture_release.files["api.json"])
    records = [
        {"entity_type": "api_pandas", "id": item["id"], "public": item}
        for item in api["pandas"]
    ]
    records.extend(
        {
            "entity_type": "api_distribution",
            "id": str(item["id"]),
            "public": item,
        }
        for item in api["distribution"]["features"]
    )
    records.extend(
        {"entity_type": "api_habitats", "id": str(item["id"]), "public": item}
        for item in api["habitats"]["features"]
    )
    records.extend(
        {"entity_type": "api_snapshots", "id": item["version"], "public": item}
        for item in api["snapshots"]
    )
    release_input = PublicReleaseInput(
        source_state={"dataset": fixture_input.source_state["dataset"], "records": records},
        publication_batch_id="runtime-only-batch",
        projection_code_version="public-release-v2",
        database_migration_version="0007",
        released_at=RELEASED_AT,
    )

    with pytest.raises(ProjectionCompatibilityError, match="archive panda revisions"):
        build_public_release(release_input)


def test_d1_projection_is_immutable_and_switches_only_the_single_pointer() -> None:
    release = build_public_release(_release_input())
    sql = release.files["d1.sql"].lower()

    assert "insert into public_releases" in sql
    assert "insert into public_release_records" in sql
    assert "on conflict" not in sql
    assert "update public_release_pointer" in sql
    assert "begin immediate" in sql
    assert "commit" in sql
    assert "delete from public_release_records" not in sql


def test_d1_release_can_roll_back_and_withdraw_without_rewriting_history() -> None:
    database = sqlite3.connect(":memory:")
    migration = read_d1_migration_bundle(
        ROOT,
        D1_PUBLIC_RELEASE_MIGRATIONS,
    )
    database.executescript(migration)

    first = build_public_release(_release_input())
    database.executescript(first.files["d1.sql"])

    second_input = _release_input()
    second_input.source_state["dataset"]["version"] = "2026.07.14.4"
    second = build_public_release(second_input)
    database.executescript(second.files["d1.sql"])
    assert database.execute(
        "select dataset_release_version from current_public_release"
    ).fetchone() == ("2026.07.14.4",)

    with pytest.raises(sqlite3.IntegrityError, match="immutable"):
        database.execute(
            "update public_release_records set public_json = '{}' "
            "where dataset_release_version = '2026.07.14.4'"
        )

    database.execute(
        "update public_release_pointer set dataset_release_version = '2026.07.14.4' "
        "where singleton = 1"
    )
    assert database.execute(
        "select dataset_release_version from current_public_release"
    ).fetchone() == ("2026.07.14.4",)

    database.execute(
        "insert into public_release_withdrawals "
        "(dataset_release_version, reason, withdrawn_at) values (?, ?, ?)",
        ("2026.07.14.4", "Emergency wildlife safety withdrawal", "2026-07-14T09:00:00Z"),
    )
    assert database.execute("select count(*) from current_public_release").fetchone() == (0,)
    assert database.execute("select count(*) from public_releases").fetchone() == (2,)


def test_checked_in_golden_release_rebuilds_byte_for_byte() -> None:
    release = build_public_release(
        PublicReleaseInput(
            source_state=deepcopy(load_golden_dataset()),
            publication_batch_id="golden-dataset",
            projection_code_version="public-release-v3",
            database_migration_version="0007",
            released_at=datetime(2026, 7, 18, 12, tzinfo=UTC),
        )
    )
    directory = ROOT / "data" / "public-releases" / "2026.07.18.1"

    for filename, content in release.files.items():
        assert (directory / filename).read_text(encoding="utf-8") == content
    assert json.loads((directory / "manifest.json").read_text(encoding="utf-8")) == release.manifest
