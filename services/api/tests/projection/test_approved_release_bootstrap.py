from collections import Counter
from pathlib import Path

from app.projection.approved_release_bootstrap import (
    APPROVED_RELEASE_VERSION,
    EXPECTED_PANDA_COUNT,
    _db_entity_type,
    _revision_payload,
    load_approved_release,
)
from app.release_manifests import load_release_manifest

REPO_ROOT = Path(__file__).resolve().parents[4]


def test_reviewed_release_reproduces_committed_manifest_and_artifacts() -> None:
    bundle = load_approved_release(REPO_ROOT)

    assert bundle.version == APPROVED_RELEASE_VERSION
    assert bundle.manifest["public_schema_version"] == "1.3.0"
    assert bundle.manifest["database_migration_version"] == "0007"
    assert bundle.manifest["projection_code_version"] == "public-experience-v1"
    assert len(bundle.manifest_sha256) == 64
    assert len(bundle.source_sha256) == 64


def test_packaged_runtime_manifest_matches_reviewed_release() -> None:
    bundle = load_approved_release(REPO_ROOT)

    assert load_release_manifest(APPROVED_RELEASE_VERSION) == bundle.manifest


def test_reviewed_release_contains_complete_archive_and_runtime_snapshots() -> None:
    bundle = load_approved_release(REPO_ROOT)
    counts = Counter(str(record["entity_type"]) for record in bundle.records)

    assert counts["pandas"] == EXPECTED_PANDA_COUNT
    assert counts["api_pandas"] == EXPECTED_PANDA_COUNT
    assert counts["api_sources"] == 43
    assert counts["api_events"] == 43
    assert counts["api_parentage_assertions"] == 24
    assert counts["api_stats"] == 1


def test_bootstrap_maps_archive_types_and_keeps_runtime_types() -> None:
    assert _db_entity_type("pandas") == "panda"
    assert _db_entity_type("parentage_assertions") == "parentage_assertion"
    assert _db_entity_type("api_pandas") == "api_pandas"


def test_bootstrap_revision_payload_is_public_projection_compatible() -> None:
    payload = _revision_payload(
        {
            "entity_type": "api_stats",
            "id": "overview",
            "public": {"total_pandas": 39},
        }
    )

    assert payload == {
        "public_record": {"total_pandas": 39},
        "publication_checks": {
            "references": [],
            "sources": [],
            "residencies": [],
            "translations": [],
            "media": [],
        },
    }
