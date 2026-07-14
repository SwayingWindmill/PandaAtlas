from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_current_release_reports_independent_versions_and_licenses() -> None:
    response = client.get("/api/v1/releases/current")

    assert response.status_code == 200
    payload = response.json()
    assert payload["dataset_release_version"] == "2026.07.14.2"
    assert payload["public_schema_version"] == "1.0.0"
    assert payload["database_migration_version"] == "0006"
    assert payload["licenses"]["structured_data"] == "ODC-By-1.0"


def test_public_api_responses_carry_current_release_headers() -> None:
    response = client.get("/api/v1/pandas", params={"page_size": 1})

    assert response.status_code == 200
    assert response.headers["X-PandaAtlas-Dataset-Version"] == "2026.07.14.2"
    assert response.headers["X-PandaAtlas-Public-Schema-Version"] == "1.0.0"
    assert response.headers["X-PandaAtlas-Database-Migration-Version"] == "0006"
