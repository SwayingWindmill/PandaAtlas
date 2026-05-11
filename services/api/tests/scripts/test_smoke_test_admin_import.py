import pytest
from smoke_test_admin_import import run_admin_import_smoke


def test_run_admin_import_smoke_success(monkeypatch) -> None:
    responses = {
        "api/v1/admin/import-sources": {
            "items": [{"name": "0001_demo_seed.sql"}],
        },
        "api/v1/admin/import-jobs": {
            "id": "job-123",
        },
        "api/v1/admin/import-jobs/job-123/run": {
            "status": "succeeded",
        },
        "api/v1/admin/import-jobs/job-123": {
            "status": "succeeded",
            "summary": {
                "source_name": "0001_demo_seed.sql",
                "source_path": "infra/supabase/seed/0001_demo_seed.sql",
                "mode": "mock",
            },
        },
    }
    calls: list[tuple[str, str, str | None, dict[str, object] | None]] = []

    def fake_request_json(
        base_url: str,
        path: str,
        *,
        method: str = "GET",
        token: str | None = None,
        payload: dict[str, object] | None = None,
    ) -> dict[str, object]:
        calls.append((base_url, path, token, payload))
        return responses[path]

    monkeypatch.setenv("ADMIN_API_TOKEN", "test-token")
    monkeypatch.setattr("smoke_test_admin_import.request_json", fake_request_json)

    summary = run_admin_import_smoke("http://127.0.0.1:8000")

    assert summary == {
        "import_job_id": "job-123",
        "import_status": "succeeded",
        "import_source_name": "0001_demo_seed.sql",
        "import_source_path": "infra/supabase/seed/0001_demo_seed.sql",
        "import_mode": "mock",
    }
    assert calls[0][0] == "http://127.0.0.1:8000/"
    assert calls[0][2] == "test-token"


def test_run_admin_import_smoke_rejects_unapproved_source(monkeypatch) -> None:
    monkeypatch.setenv("SMOKE_IMPORT_SOURCE_NAME", "missing.sql")
    monkeypatch.setattr(
        "smoke_test_admin_import.request_json",
        lambda *_args, **_kwargs: {"items": [{"name": "0001_demo_seed.sql"}]},
    )

    with pytest.raises(RuntimeError, match="SMOKE_IMPORT_SOURCE_NAME is not approved: missing.sql"):
        run_admin_import_smoke("http://127.0.0.1:8000")


@pytest.mark.parametrize(
    ("run_status", "fetch_status"),
    [("failed", "failed"), ("succeeded", "failed")],
)
def test_run_admin_import_smoke_raises_when_final_status_not_succeeded(
    monkeypatch, run_status: str, fetch_status: str
) -> None:
    responses = {
        "api/v1/admin/import-sources": {
            "items": [{"name": "0001_demo_seed.sql"}],
        },
        "api/v1/admin/import-jobs": {
            "id": "job-123",
        },
        "api/v1/admin/import-jobs/job-123/run": {
            "status": run_status,
        },
        "api/v1/admin/import-jobs/job-123": {
            "status": fetch_status,
            "summary": {
                "source_name": "0001_demo_seed.sql",
                "source_path": "infra/supabase/seed/0001_demo_seed.sql",
                "mode": "mock",
            },
        },
    }

    monkeypatch.setattr(
        "smoke_test_admin_import.request_json",
        lambda _base_url, path, **_kwargs: responses[path],
    )

    with pytest.raises(RuntimeError, match="did not succeed"):
        run_admin_import_smoke("http://127.0.0.1:8000")
