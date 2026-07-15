from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.config import settings
from app.data.golden_dataset import trusted_panda_details
from app.main import app
from app.schemas.panda import ImportSourceOption
from app.services import map_service, panda_service, stats_service

client = TestClient(app)
ADMIN_HEADERS = {"Authorization": "Bearer dev-admin-token"}


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"


def test_list_pandas() -> None:
    response = client.get("/api/v1/pandas")
    assert response.status_code == 200
    payload = response.json()
    assert payload["meta"]["total"] >= 1
    assert len(payload["items"]) >= 1


def test_public_read_endpoints_share_the_active_release() -> None:
    release_response = client.get("/api/v1/releases/current")
    assert release_response.status_code == 200
    release = release_response.json()
    expected_headers = {
        "x-pandaatlas-dataset-version": release["dataset_release_version"],
        "x-pandaatlas-public-schema-version": release["public_schema_version"],
        "x-pandaatlas-database-migration-version": release[
            "database_migration_version"
        ],
    }

    pandas_response = client.get("/api/v1/pandas", params={"page_size": 100})
    assert pandas_response.status_code == 200
    pandas = pandas_response.json()
    assert pandas["meta"]["total"] == 7
    panda = next(item for item in pandas["items"] if item["slug"] == "xiao-qi-ji")

    responses = [
        pandas_response,
        client.get(f"/api/v1/pandas/{panda['slug']}"),
        client.get(f"/api/v1/pandas/{panda['slug']}/lineage"),
        client.get(
            "/api/v1/map/distribution",
            params={"bbox": "100,25,110,36", "layer": "wild"},
        ),
        client.get("/api/v1/map/habitats"),
        client.get("/api/v1/map/snapshots"),
        client.get("/api/v1/stats/overview"),
    ]
    for response in responses:
        assert response.status_code == 200
        for header, value in expected_headers.items():
            assert response.headers[header] == value

    detail = responses[1].json()
    assert detail["public_revision"]["data_version"] == release[
        "dataset_release_version"
    ]
    assert {node["id"] for node in responses[2].json()["nodes"]} <= {
        item["id"] for item in pandas["items"]
    }
    assert responses[-1].json()["total_pandas"] == pandas["meta"]["total"]


def test_public_reads_do_not_consult_mutable_legacy_repositories(monkeypatch) -> None:
    def fail(*_args: object, **_kwargs: object) -> object:
        raise AssertionError("mutable legacy repository was called")

    monkeypatch.setattr(panda_service, "list_pandas", fail)
    monkeypatch.setattr(panda_service, "get_panda_by_ref", fail)
    monkeypatch.setattr(panda_service, "get_panda_lineage_by_ref", fail)
    monkeypatch.setattr(map_service, "get_distribution", fail)
    monkeypatch.setattr(map_service, "get_habitats", fail)
    monkeypatch.setattr(map_service, "list_distribution_snapshots", fail)
    monkeypatch.setattr(stats_service, "get_overview_stats", fail)

    for path, params in (
        ("/api/v1/pandas", None),
        ("/api/v1/pandas/mei-xiang", None),
        ("/api/v1/pandas/mei-xiang/lineage", None),
        ("/api/v1/map/distribution", {"bbox": "100,25,110,36"}),
        ("/api/v1/map/habitats", None),
        ("/api/v1/map/snapshots", None),
        ("/api/v1/stats/overview", None),
    ):
        assert client.get(path, params=params).status_code == 200


def test_generated_openapi_declares_release_headers_and_failure_states() -> None:
    schema = client.get("/openapi.json").json()
    for path in (
        "/api/v1/pandas",
        "/api/v1/pandas/{panda_ref}",
        "/api/v1/pandas/{panda_ref}/lineage",
        "/api/v1/map/distribution",
        "/api/v1/map/habitats",
        "/api/v1/map/snapshots",
        "/api/v1/stats/overview",
    ):
        responses = schema["paths"][path]["get"]["responses"]
        assert {"200", "410", "503"} <= set(responses)
        assert "X-PandaAtlas-Dataset-Version" in responses["200"]["headers"]


def test_list_pandas_filters_by_habitat() -> None:
    habitat_id = str(uuid4())

    response = client.get("/api/v1/pandas", params={"habitat_id": habitat_id})
    assert response.status_code == 200

    payload = response.json()
    actual_ids = {item["id"] for item in payload["items"]}
    assert actual_ids == set()


def test_list_pandas_filters_within_current_release() -> None:
    expected_ids = {
        record["id"]
        for record in trusted_panda_details()
        if record["gender"] == "female"
    }
    response = client.get("/api/v1/pandas", params={"gender": "female"})
    assert response.status_code == 200
    assert {item["id"] for item in response.json()["items"]} == expected_ids


def test_get_panda_detail() -> None:
    list_response = client.get("/api/v1/pandas")
    assert list_response.status_code == 200
    panda_id = list_response.json()["items"][0]["id"]

    response = client.get(f"/api/v1/pandas/{panda_id}")
    assert response.status_code == 200
    payload = response.json()
    assert payload["id"] == panda_id
    assert "birthplace" in payload
    assert "father_id" in payload
    assert "mother_id" in payload


def test_get_panda_detail_by_slug() -> None:
    list_response = client.get("/api/v1/pandas")
    assert list_response.status_code == 200
    panda = list_response.json()["items"][0]

    response = client.get(f"/api/v1/pandas/{panda['slug']}")
    assert response.status_code == 200
    payload = response.json()
    assert payload["id"] == panda["id"]
    assert payload["slug"] == panda["slug"]


def test_get_panda_lineage() -> None:
    list_response = client.get("/api/v1/pandas")
    assert list_response.status_code == 200
    panda_id = list_response.json()["items"][0]["id"]

    response = client.get(
        f"/api/v1/pandas/{panda_id}/lineage",
        params={"ancestor_depth": 3, "descendant_depth": 3},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["focus_id"] == panda_id
    assert len(payload["nodes"]) >= 1
    assert payload["meta"]["ancestor_depth"] == 3
    assert payload["meta"]["descendant_depth"] == 3


def test_get_panda_lineage_by_slug() -> None:
    list_response = client.get("/api/v1/pandas")
    assert list_response.status_code == 200
    panda = list_response.json()["items"][0]

    response = client.get(
        f"/api/v1/pandas/{panda['slug']}/lineage",
        params={"ancestor_depth": 2, "descendant_depth": 2},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["focus_id"] == panda["id"]


def test_get_panda_lineage_not_found() -> None:
    response = client.get(f"/api/v1/pandas/{uuid4()}/lineage")
    assert response.status_code == 404


def test_distribution_requires_bbox() -> None:
    response = client.get("/api/v1/map/distribution")
    assert response.status_code == 422


def test_distribution_with_bbox() -> None:
    response = client.get(
        "/api/v1/map/distribution",
        params={"bbox": "100,25,110,36", "layer": "wild", "zoom": 4},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["type"] == "FeatureCollection"
    assert len(payload["features"]) >= 1
    first = payload["features"][0]
    assert first["properties"]["layer"] == "wild"
    assert "cell_code" in first["properties"]
    assert "snapshot_date" in first["properties"]
    assert payload["meta"]["truncated"] is False
    assert payload["meta"]["limit"] == 1500
    assert payload["meta"]["requested_zoom"] == 4


def test_distribution_filters_snapshot_date() -> None:
    response = client.get(
        "/api/v1/map/distribution",
        params={
            "bbox": "100,25,110,36",
            "layer": "wild",
            "snapshot_date": "2026-03-05",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert len(payload["features"]) >= 1
    assert all(
        feature["properties"]["snapshot_date"] == "2026-03-05"
        for feature in payload["features"]
    )


def test_habitats_filter_by_bbox_and_level() -> None:
    response = client.get(
        "/api/v1/map/habitats",
        params={"bbox": "103.1,30.8,104.1,31.8", "level": "national"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["type"] == "FeatureCollection"
    assert len(payload["features"]) >= 1
    assert all(
        feature["properties"]["level"] == "national" for feature in payload["features"]
    )
    assert payload["meta"]["truncated"] is False
    assert payload["meta"]["limit"] == 2000
    assert payload["meta"]["requested_zoom"] is None

    empty_response = client.get(
        "/api/v1/map/habitats",
        params={"bbox": "120,40,121,41", "level": "national"},
    )
    assert empty_response.status_code == 200
    assert empty_response.json()["features"] == []


def test_map_snapshots() -> None:
    response = client.get("/api/v1/map/snapshots")
    assert response.status_code == 200
    payload = response.json()
    assert "items" in payload
    assert len(payload["items"]) >= 1
    first = payload["items"][0]
    assert "snapshot_date" in first
    assert "version" in first


def test_stats_overview() -> None:
    response = client.get("/api/v1/stats/overview")
    assert response.status_code == 200
    payload = response.json()
    assert "total_pandas" in payload
    assert "active_habitats" in payload
    assert "latest_snapshot_date" in payload
    assert "featured_pandas" in payload


def test_admin_import_requires_auth() -> None:
    response = client.post("/api/v1/admin/import-jobs", json={"source_name": "seed.csv"})
    assert response.status_code == 401


def test_admin_import_sources_require_auth() -> None:
    response = client.get("/api/v1/admin/import-sources")
    assert response.status_code == 401


def test_admin_import_lists_approved_sources() -> None:
    response = client.get("/api/v1/admin/import-sources", headers=ADMIN_HEADERS)
    assert response.status_code == 200
    payload = response.json()
    assert "items" in payload
    assert {item["name"] for item in payload["items"]} == {
        "0001_demo_seed.sql",
        "0002_atlas_catalog_seed.sql",
    }


def test_admin_import_rejects_default_token_outside_development(monkeypatch) -> None:
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "admin_api_token", "dev-admin-token")

    response = client.post(
        "/api/v1/admin/import-jobs",
        headers={"Authorization": "Bearer dev-admin-token"},
        json={"source_name": "0001_demo_seed.sql"},
    )

    assert response.status_code == 503
    assert (
        response.json()["detail"]
        == "ADMIN_API_TOKEN must be set to a non-default value outside development"
    )


def test_admin_import_sources_reject_default_token_outside_development(
    monkeypatch,
) -> None:
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "admin_api_token", "dev-admin-token")

    response = client.get(
        "/api/v1/admin/import-sources",
        headers={"Authorization": "Bearer dev-admin-token"},
    )

    assert response.status_code == 503
    assert (
        response.json()["detail"]
        == "ADMIN_API_TOKEN must be set to a non-default value outside development"
    )


def test_admin_import_create_and_fetch() -> None:
    create = client.post(
        "/api/v1/admin/import-jobs",
        headers=ADMIN_HEADERS,
        json={"source_name": "0001_demo_seed.sql"},
    )
    assert create.status_code == 201
    job_id = create.json()["id"]
    assert create.json()["summary"]["source_name"] == "0001_demo_seed.sql"
    assert create.json()["summary"]["source_path"] == "infra/supabase/seed/0001_demo_seed.sql"

    fetch = client.get(
        f"/api/v1/admin/import-jobs/{job_id}",
        headers=ADMIN_HEADERS,
    )
    assert fetch.status_code == 200
    assert fetch.json()["id"] == job_id


def test_admin_import_job_fetch_requires_auth() -> None:
    response = client.get(f"/api/v1/admin/import-jobs/{uuid4()}")
    assert response.status_code == 401


def test_admin_import_create_rejects_unapproved_source() -> None:
    response = client.post(
        "/api/v1/admin/import-jobs",
        headers=ADMIN_HEADERS,
        json={"source_name": "missing.sql"},
    )
    assert response.status_code == 422
    assert response.json()["detail"] == "Import source is not approved: missing.sql"


def test_admin_import_run_success() -> None:
    create = client.post(
        "/api/v1/admin/import-jobs",
        headers=ADMIN_HEADERS,
        json={"source_name": "0001_demo_seed.sql"},
    )
    assert create.status_code == 201
    job_id = create.json()["id"]

    run = client.post(
        f"/api/v1/admin/import-jobs/{job_id}/run",
        headers=ADMIN_HEADERS,
    )
    assert run.status_code == 200
    assert run.json()["status"] == "succeeded"
    assert run.json()["error_log"] is None
    assert run.json()["summary"]["mode"] == "mock"
    assert run.json()["summary"]["source_name"] == "0001_demo_seed.sql"
    assert run.json()["summary"]["failure_reason"] is None


def test_admin_import_run_requires_auth() -> None:
    response = client.post(f"/api/v1/admin/import-jobs/{uuid4()}/run")
    assert response.status_code == 401


def test_admin_import_run_rejects_rerun_after_success() -> None:
    create = client.post(
        "/api/v1/admin/import-jobs",
        headers=ADMIN_HEADERS,
        json={"source_name": "0001_demo_seed.sql"},
    )
    assert create.status_code == 201
    job_id = create.json()["id"]

    first_run = client.post(f"/api/v1/admin/import-jobs/{job_id}/run", headers=ADMIN_HEADERS)
    assert first_run.status_code == 200

    second_run = client.post(f"/api/v1/admin/import-jobs/{job_id}/run", headers=ADMIN_HEADERS)
    assert second_run.status_code == 409
    assert second_run.json()["detail"] == "Import job has already completed successfully"


def test_admin_import_run_failure_with_error_log(monkeypatch) -> None:
    create = client.post(
        "/api/v1/admin/import-jobs",
        headers=ADMIN_HEADERS,
        json={"source_name": "0001_demo_seed.sql"},
    )
    assert create.status_code == 201
    job_id = create.json()["id"]

    monkeypatch.setattr(
        "app.services.import_service._resolve_source_path",
        lambda _source_name: (
            ImportSourceOption(
                name="0001_demo_seed.sql",
                label="Demo seed dataset",
                source_path="infra/supabase/seed/0001_demo_seed.sql",
            ),
            Path("missing-approved-source.sql"),
        ),
    )

    run = client.post(
        f"/api/v1/admin/import-jobs/{job_id}/run",
        headers=ADMIN_HEADERS,
    )
    assert run.status_code == 200
    assert run.json()["status"] == "failed"
    assert run.json()["error_log"] is not None
    assert run.json()["summary"]["failure_reason"] is not None
