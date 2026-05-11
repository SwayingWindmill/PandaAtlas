import pytest
from smoke_test_public_api import build_public_read_summary


def _requester_factory(overrides: dict[str, dict[str, object]] | None = None):
    payloads: dict[str, dict[str, object]] = {
        "health": {"status": "ok", "db": "ok"},
        "api/v1/pandas": {
            "meta": {"total": 1},
            "items": [{"id": "panda-1", "slug": "he-hua"}],
        },
        "api/v1/pandas/he-hua": {
            "id": "panda-1",
            "slug": "he-hua",
            "birthplace": "Chengdu",
        },
        "api/v1/pandas/he-hua/lineage?ancestor_depth=2&descendant_depth=2": {
            "focus_id": "panda-1",
            "nodes": [{"id": "panda-1"}],
        },
        "api/v1/map/habitats?bbox=102.5,29.7,104.2,31.8&level=national": {
            "features": [{"id": "habitat-1"}],
        },
        "api/v1/map/distribution?bbox=100,25,110,36&layer=wild": {
            "features": [
                {
                    "properties": {
                        "cell_code": "QXL-001",
                        "snapshot_date": "2026-03-05",
                    }
                }
            ],
        },
        "api/v1/map/snapshots": {
            "items": [{"snapshot_date": "2026-03-05", "version": "mock-v3"}],
        },
        "api/v1/stats/overview": {
            "total_pandas": 12,
            "latest_snapshot_date": "2026-03-05",
            "featured_pandas": 11,
        },
    }
    if overrides:
        payloads.update(overrides)

    def requester(path: str) -> dict[str, object]:
        return payloads[path]

    return requester


def test_build_public_read_summary_success() -> None:
    summary = build_public_read_summary(_requester_factory())

    assert summary["pandas_first_slug"] == "he-hua"
    assert summary["distribution_first_cell_code"] == "QXL-001"
    assert summary["stats_total_pandas"] == 12
    assert summary["stats_latest_snapshot_date"] == "2026-03-05"
    assert summary["stats_featured_pandas"] == 11


def test_build_public_read_summary_accepts_disabled_database_state() -> None:
    requester = _requester_factory({"health": {"status": "ok", "db": "disabled"}})

    summary = build_public_read_summary(requester)

    assert summary["health_db"] == "disabled"


def test_build_public_read_summary_raises_on_empty_pandas() -> None:
    requester = _requester_factory({"api/v1/pandas": {"meta": {"total": 0}, "items": []}})

    with pytest.raises(RuntimeError, match="pandas endpoint returned empty dataset"):
        build_public_read_summary(requester)


def test_build_public_read_summary_raises_on_missing_slug() -> None:
    requester = _requester_factory(
        {"api/v1/pandas": {"meta": {"total": 1}, "items": [{"id": "panda-1"}]}}
    )

    with pytest.raises(RuntimeError, match="usable slug"):
        build_public_read_summary(requester)


def test_build_public_read_summary_raises_on_lineage_focus_mismatch() -> None:
    requester = _requester_factory(
        {
            "api/v1/pandas/he-hua/lineage?ancestor_depth=2&descendant_depth=2": {
                "focus_id": "other-panda",
                "nodes": [{"id": "other-panda"}],
            }
        }
    )

    with pytest.raises(RuntimeError, match="lineage endpoint returned mismatched focus"):
        build_public_read_summary(requester)


def test_build_public_read_summary_raises_on_empty_distribution() -> None:
    requester = _requester_factory(
        {"api/v1/map/distribution?bbox=100,25,110,36&layer=wild": {"features": []}}
    )

    with pytest.raises(RuntimeError, match="distribution endpoint returned empty dataset"):
        build_public_read_summary(requester)


def test_build_public_read_summary_raises_on_invalid_stats() -> None:
    requester = _requester_factory(
        {
            "api/v1/stats/overview": {
                "total_pandas": 12,
                "latest_snapshot_date": "",
                "featured_pandas": 0,
            }
        }
    )

    with pytest.raises(RuntimeError, match="stats endpoint returned invalid"):
        build_public_read_summary(requester)
