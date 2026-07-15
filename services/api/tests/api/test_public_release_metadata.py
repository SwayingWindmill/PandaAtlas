import json
from contextlib import contextmanager
from pathlib import Path

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app
from app.services import release_service

client = TestClient(app)
ROOT = Path(__file__).resolve().parents[4]


def test_current_release_reports_independent_versions_and_licenses() -> None:
    response = client.get("/api/v1/releases/current")

    assert response.status_code == 200
    payload = response.json()
    assert payload["dataset_release_version"] == "2026.07.14.3"
    assert payload["public_schema_version"] == "1.0.0"
    assert payload["database_migration_version"] == "0007"
    assert payload["licenses"]["structured_data"] == "ODC-By-1.0"


def test_release_api_responses_carry_current_release_headers() -> None:
    response = client.get("/api/v1/releases/current")

    assert response.status_code == 200
    assert response.headers["X-PandaAtlas-Dataset-Version"] == "2026.07.14.3"
    assert response.headers["X-PandaAtlas-Public-Schema-Version"] == "1.0.0"
    assert response.headers["X-PandaAtlas-Database-Migration-Version"] == "0007"


def test_release_api_serves_the_exact_versioned_panda_snapshot() -> None:
    response = client.get("/api/v1/releases/current/pandas")

    assert response.status_code == 200
    payload = response.json()
    assert payload["release"]["dataset_release_version"] == "2026.07.14.3"
    assert len(payload["records"]) == 7
    assert {record["canonical_slug"] for record in payload["records"]} >= {
        "mei-xiang",
        "xiao-qi-ji",
        "bao-li",
    }


class _WithdrawalResult:
    def __init__(self, rows: list[dict[str, str | None]]):
        self.rows = rows

    def mappings(self):
        return self

    def all(self):
        return self.rows


class _WithdrawalSession:
    def __init__(self, rows: list[dict[str, str | None]]):
        self.rows = rows

    def execute(self, *_args, **_kwargs):
        return _WithdrawalResult(self.rows)


def test_fastapi_entity_and_whole_release_withdrawals_are_fail_closed(monkeypatch) -> None:
    payload = json.loads(
        (
            ROOT / "data" / "public-releases" / "2026.07.14.3" / "api.json"
        ).read_text(encoding="utf-8")
    )
    panda_id = payload["pandas"][0]["id"]

    @contextmanager
    def entity_session():
        yield _WithdrawalSession(
            [{"entity_type": "api_pandas", "entity_id": panda_id}]
        )

    monkeypatch.setattr(release_service, "session_scope", entity_session)
    filtered = release_service._apply_database_withdrawals(payload, "2026.07.14.3")
    assert panda_id not in {item["id"] for item in filtered["pandas"]}
    assert filtered["stats"]["total_pandas"] == 6

    @contextmanager
    def whole_session():
        yield _WithdrawalSession([{"entity_type": None, "entity_id": None}])

    monkeypatch.setattr(release_service, "session_scope", whole_session)
    with pytest.raises(HTTPException) as error:
        release_service._apply_database_withdrawals(payload, "2026.07.14.3")
    assert error.value.status_code == 410


def test_configured_database_metadata_failure_never_falls_back(monkeypatch) -> None:
    monkeypatch.setattr(release_service, "has_database", lambda: True)

    def unavailable():
        raise release_service.SQLAlchemyError("database unavailable")

    monkeypatch.setattr(release_service, "_database_release_metadata", unavailable)

    with pytest.raises(HTTPException) as error:
        release_service.get_current_release_metadata()

    assert error.value.status_code == 503


def test_stats_withdrawal_does_not_withdraw_other_release_entities(monkeypatch) -> None:
    payload = json.loads(
        (ROOT / "data" / "public-releases" / "2026.07.14.3" / "api.json").read_text(
            encoding="utf-8"
        )
    )

    @contextmanager
    def stats_session():
        yield _WithdrawalSession(
            [{"entity_type": "api_stats", "entity_id": "overview"}]
        )

    monkeypatch.setattr(release_service, "session_scope", stats_session)
    filtered = release_service._apply_database_withdrawals(payload, "2026.07.14.3")

    assert filtered["pandas"] == payload["pandas"]
    assert "stats" not in filtered
