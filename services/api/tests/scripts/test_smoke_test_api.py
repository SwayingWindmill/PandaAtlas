import json

import pytest
import smoke_test_api


def test_admin_import_enabled_defaults_to_false(monkeypatch) -> None:
    monkeypatch.delenv("RUN_ADMIN_IMPORT_SMOKE", raising=False)

    assert smoke_test_api._admin_smoke_enabled() is False


def test_main_keeps_admin_smoke_disabled_by_default(
    monkeypatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.delenv("RUN_ADMIN_IMPORT_SMOKE", raising=False)
    monkeypatch.setenv("API_BASE_URL", "http://127.0.0.1:8000")
    monkeypatch.setattr(
        smoke_test_api,
        "run_public_read_smoke",
        lambda base_url: {"base_url": base_url, "pandas_total": 12},
    )
    monkeypatch.setattr(
        smoke_test_api,
        "run_admin_import_smoke",
        lambda _base_url: {"import_status": "succeeded"},
    )

    smoke_test_api.main()
    payload = json.loads(capsys.readouterr().out)

    assert payload["admin_import_enabled"] is False
    assert "admin_import" not in payload
    assert payload["public"]["base_url"] == "http://127.0.0.1:8000/"


def test_main_adds_admin_import_summary_when_flag_enabled(
    monkeypatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("RUN_ADMIN_IMPORT_SMOKE", "1")
    monkeypatch.setenv("API_BASE_URL", "http://127.0.0.1:8000")
    monkeypatch.setattr(
        smoke_test_api,
        "run_public_read_smoke",
        lambda _base_url: {"pandas_total": 12},
    )
    monkeypatch.setattr(
        smoke_test_api,
        "run_admin_import_smoke",
        lambda base_url: {"base_url": base_url, "import_status": "succeeded"},
    )

    smoke_test_api.main()
    payload = json.loads(capsys.readouterr().out)

    assert payload["admin_import_enabled"] is True
    assert payload["admin_import"]["import_status"] == "succeeded"
    assert payload["admin_import"]["base_url"] == "http://127.0.0.1:8000/"
