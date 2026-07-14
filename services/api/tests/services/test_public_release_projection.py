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


def test_golden_release_is_deterministic_and_cross_surface_versions_match() -> None:
    first = build_public_release(_release_input())
    second = build_public_release(_release_input())

    assert first.files == second.files
    assert first.manifest == second.manifest
    assert first.manifest["dataset_release_version"] == "2026.07.14.2"
    assert first.manifest["public_schema_version"] == "1.0.0"
    assert first.manifest["database_migration_version"] == "0006"
    assert first.manifest["publication_batch_id"] == "batch-golden-2026-07-14"
    assert first.manifest["projection_code_version"] == "git:db1e0fd"
    assert first.manifest["released_at"] == "2026-07-14T08:00:00Z"

    snapshot = json.loads(first.files["pandas.json"])
    assert len(snapshot["records"]) == 7
    assert snapshot["release"] == first.release_metadata

    csv_rows = list(csv.DictReader(io.StringIO(first.files["pandas.csv"])))
    assert len(csv_rows) == 7
    assert {row["dataset_release_version"] for row in csv_rows} == {"2026.07.14.2"}
    assert {row["public_schema_version"] for row in csv_rows} == {"1.0.0"}

    for filename, descriptor in first.manifest["files"].items():
        assert descriptor["sha256"] == first.checksum(filename)
        assert descriptor["bytes"] == len(first.files[filename].encode("utf-8"))


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


def test_projection_rejects_an_incompatible_public_schema() -> None:
    release_input = _release_input()
    release_input.source_state["dataset"]["public_schema_version"] = "2.0.0"

    with pytest.raises(ProjectionCompatibilityError, match="2.0.0"):
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
    migration = (
        ROOT / "infra" / "cloudflare" / "d1" / "migrations" / "0005_versioned_public_releases.sql"
    ).read_text(encoding="utf-8")
    database.executescript(migration)

    first = build_public_release(_release_input())
    database.executescript(first.files["d1.sql"])

    second_input = _release_input()
    second_input.source_state["dataset"]["version"] = "2026.07.14.3"
    second = build_public_release(second_input)
    database.executescript(second.files["d1.sql"])
    assert database.execute(
        "select dataset_release_version from current_public_release"
    ).fetchone() == ("2026.07.14.3",)

    with pytest.raises(sqlite3.IntegrityError, match="immutable"):
        database.execute(
            "update public_release_records set public_json = '{}' "
            "where dataset_release_version = '2026.07.14.2'"
        )

    database.execute(
        "update public_release_pointer set dataset_release_version = '2026.07.14.2' "
        "where singleton = 1"
    )
    assert database.execute(
        "select dataset_release_version from current_public_release"
    ).fetchone() == ("2026.07.14.2",)

    database.execute(
        "insert into public_release_withdrawals "
        "(dataset_release_version, reason, withdrawn_at) values (?, ?, ?)",
        ("2026.07.14.2", "Emergency wildlife safety withdrawal", "2026-07-14T09:00:00Z"),
    )
    assert database.execute("select count(*) from current_public_release").fetchone() == (0,)
    assert database.execute("select count(*) from public_releases").fetchone() == (2,)


def test_checked_in_golden_release_rebuilds_byte_for_byte() -> None:
    release = build_public_release(
        PublicReleaseInput(
            source_state=deepcopy(load_golden_dataset()),
            publication_batch_id="golden-dataset",
            projection_code_version="public-release-v1",
            database_migration_version="0006",
            released_at=datetime(2026, 7, 14, tzinfo=UTC),
        )
    )
    directory = ROOT / "data" / "public-releases" / "2026.07.14.2"

    for filename, content in release.files.items():
        assert (directory / filename).read_text(encoding="utf-8") == content
    assert json.loads((directory / "manifest.json").read_text(encoding="utf-8")) == release.manifest
