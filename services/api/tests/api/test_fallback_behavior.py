from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.data.mock_data import MOCK_PANDAS
from app.main import app
from app.services import map_service, panda_service, stats_service

client = TestClient(app)


@pytest.fixture
def simulate_db_outage(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    def raise_panda_db(*args: object, **kwargs: object) -> object:
        raise panda_service.SQLAlchemyError("Database unavailable")

    def raise_map_db(*args: object, **kwargs: object) -> object:
        raise map_service.SQLAlchemyError("Database unavailable")

    def raise_stats_db(*args: object, **kwargs: object) -> object:
        raise stats_service.SQLAlchemyError("Database unavailable")

    monkeypatch.setattr(panda_service, "has_database", lambda: True)
    monkeypatch.setattr(panda_service, "_list_pandas_from_db", raise_panda_db)
    monkeypatch.setattr(panda_service, "_resolve_public_ref_from_db", raise_panda_db)
    monkeypatch.setattr(panda_service, "_get_panda_by_id_from_db", raise_panda_db)
    monkeypatch.setattr(panda_service, "_get_panda_lineage_from_db", raise_panda_db)

    monkeypatch.setattr(map_service, "has_database", lambda: True)
    monkeypatch.setattr(map_service, "_distribution_from_db", raise_map_db)
    monkeypatch.setattr(map_service, "_habitats_from_db", raise_map_db)
    monkeypatch.setattr(map_service, "_snapshots_from_db", raise_map_db)

    monkeypatch.setattr(stats_service, "has_database", lambda: True)
    monkeypatch.setattr(stats_service, "_overview_from_db", raise_stats_db)

    yield


def test_public_reads_fall_back_to_mock_data_when_enabled(
    simulate_db_outage: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "db_use_mock_fallback", True)

    pandas_response = client.get("/api/v1/pandas")
    assert pandas_response.status_code == 200
    pandas_payload = pandas_response.json()
    assert pandas_payload["meta"]["total"] == len(MOCK_PANDAS)

    panda_slug = pandas_payload["items"][0]["slug"]

    detail_response = client.get(f"/api/v1/pandas/{panda_slug}")
    assert detail_response.status_code == 200
    assert detail_response.json()["slug"] == panda_slug

    lineage_response = client.get(
        f"/api/v1/pandas/{panda_slug}/lineage",
        params={"ancestor_depth": 2, "descendant_depth": 2},
    )
    assert lineage_response.status_code == 200
    assert lineage_response.json()["focus_id"] == pandas_payload["items"][0]["id"]

    distribution_response = client.get(
        "/api/v1/map/distribution",
        params={"bbox": "100,25,110,36", "layer": "wild"},
    )
    assert distribution_response.status_code == 200
    assert len(distribution_response.json()["features"]) >= 1

    habitats_response = client.get(
        "/api/v1/map/habitats",
        params={"bbox": "102.5,29.7,104.2,31.8", "level": "national"},
    )
    assert habitats_response.status_code == 200
    assert len(habitats_response.json()["features"]) >= 1

    snapshots_response = client.get("/api/v1/map/snapshots")
    assert snapshots_response.status_code == 200
    assert len(snapshots_response.json()["items"]) >= 1

    stats_response = client.get("/api/v1/stats/overview")
    assert stats_response.status_code == 200
    stats_payload = stats_response.json()
    assert stats_payload["total_pandas"] == len(MOCK_PANDAS)
    assert stats_payload["latest_snapshot_date"] == "2026-03-05"


@pytest.mark.parametrize(
    ("path", "params"),
    [
        ("/api/v1/pandas", None),
        (f"/api/v1/pandas/{MOCK_PANDAS[0]['slug']}", None),
        (
            f"/api/v1/pandas/{MOCK_PANDAS[0]['slug']}/lineage",
            {"ancestor_depth": 2, "descendant_depth": 2},
        ),
        ("/api/v1/map/distribution", {"bbox": "100,25,110,36", "layer": "wild"}),
        ("/api/v1/map/habitats", {"bbox": "102.5,29.7,104.2,31.8", "level": "national"}),
        ("/api/v1/map/snapshots", None),
        ("/api/v1/stats/overview", None),
    ],
)
def test_public_reads_return_503_when_fallback_disabled(
    path: str,
    params: dict[str, object] | None,
    simulate_db_outage: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "db_use_mock_fallback", False)

    response = client.get(path, params=params)
    assert response.status_code == 503
    assert response.json()["detail"] == "Database unavailable"
