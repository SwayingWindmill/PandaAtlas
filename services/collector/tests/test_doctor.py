"""Preflight `collector doctor` and minimal deployment artifact checks."""

from __future__ import annotations

import json
from dataclasses import replace
from pathlib import Path
from typing import Any

import httpx
import psycopg
import pytest
import yaml

from collector import cli, doctor
from collector.config import REPO_ROOT, Settings
from collector.store import Store

pytestmark = pytest.mark.anyio


def _settings(**overrides: Any) -> Settings:
    defaults = dict(
        database_url="postgresql://collector:collector@127.0.0.1:55432/collector",
        targets_file=REPO_ROOT / "data/collector/targets.yaml",
        pandas_source=REPO_ROOT / "data/curation/learning/published-pandas.json",
        aliases_file=REPO_ROOT / "data/collector/aliases.yaml",
        state_dir=REPO_ROOT / ".collector",
        rsshub_url="http://127.0.0.1:1200",
        xhs_mcp_url=None,
        xhs_mcp_token=None,
        douyin_api_url=None,
        douyin_api_key=None,
        weibo_crawler_dir=None,
        weibo_crawler_cmd="python weibo.py",
        weibo_cookie=None,
        mediacrawler_dir=None,
        mediacrawler_cmd="uv run main.py",
        aihot_url=None,
        aihot_token=None,
        alert_webhook=None,
        alert_format="feishu",
        rss_concurrency=4,
    )
    return Settings(**{**defaults, **overrides})


async def test_doctor_offline_passes_on_repository_catalog() -> None:
    results = await doctor.run_doctor(_settings(), offline=True)
    by_name = {item.name: item for item in results}

    assert set(by_name) == {"targets", "lexicon", "alerts", "config"}
    assert by_name["targets"].status == "ok"
    assert "49 active on host, 113 waiting" in by_name["targets"].detail
    assert "bjzoo=2" in by_name["targets"].detail
    assert "weibo_rsshub=47" in by_name["targets"].detail
    assert by_name["lexicon"].status == "ok"
    assert by_name["alerts"].status == "warn"
    assert by_name["config"].status == "ok"
    assert not doctor.has_failures(results)


async def test_doctor_flags_config_and_alert_failures(tmp_path: Path) -> None:
    missing_targets = tmp_path / "missing-targets.yaml"
    missing_pandas = tmp_path / "missing-pandas.json"

    bad = _settings(
        targets_file=missing_targets,
        pandas_source=missing_pandas,
        xhs_mcp_url="http://127.0.0.1:18060",
        xhs_mcp_token=None,
        aihot_url="https://aihot.example.test",
        aihot_token=None,
        alert_format="discord",
        rss_concurrency=0,
    )
    results = await doctor.run_doctor(bad, offline=True)
    by_name = {item.name: item for item in results}

    assert doctor.has_failures(results)
    assert by_name["targets"].status == "fail"
    assert by_name["lexicon"].status == "fail"
    assert by_name["alerts"].status == "fail"
    assert by_name["config"].status == "fail"
    assert "XHS_MCP_URL" in by_name["config"].detail
    assert "AIHOT_URL" in by_name["config"].detail

    bad_webhook = _settings(alert_webhook="ftp://not-http.example/hook")
    webhook_results = {
        item.name: item for item in await doctor.run_doctor(bad_webhook, offline=True)
    }
    assert webhook_results["alerts"].status == "fail"


async def test_doctor_warns_when_optional_keys_or_rsshub_missing() -> None:
    settings = _settings(
        rsshub_url=None,
        douyin_api_url="http://127.0.0.1:8000",
        douyin_api_key=None,
    )
    by_name = {item.name: item for item in await doctor.run_doctor(settings, offline=True)}

    assert by_name["config"].status == "warn"
    assert "DOUYIN_API_KEY" in by_name["config"].detail
    assert "RSSHUB_URL" in by_name["config"].detail
    assert not doctor.has_failures(list(by_name.values()))


async def test_doctor_online_http_probes_and_db_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_connect(*_args: Any, **_kwargs: Any) -> Any:
        raise psycopg.OperationalError("connection refused")

    monkeypatch.setattr(doctor.psycopg.AsyncConnection, "connect", fake_connect)

    seen: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(str(request.url))
        if request.url.path == "/healthz":
            return httpx.Response(404)
        if request.url.host == "127.0.0.1" and request.url.port == 1200:
            return httpx.Response(200, text="ok")
        if request.url.port == 18060:
            return httpx.Response(401)
        if request.url.port == 8000:
            return httpx.Response(503)
        raise httpx.ConnectError("refused", request=request)

    settings = _settings(
        xhs_mcp_url="http://127.0.0.1:18060",
        xhs_mcp_token="secret-token",
        douyin_api_url="http://127.0.0.1:8000",
        douyin_api_key="douyin-key",
        aihot_url="http://127.0.0.1:9000",
        aihot_token="aihot-token",
    )
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        results = await doctor.run_doctor(settings, offline=False, client=client)

    by_name = {item.name: item for item in results}
    assert seen[:2] == ["http://127.0.0.1:1200/healthz", "http://127.0.0.1:1200/"]
    assert by_name["database"].status == "fail"
    assert by_name["rsshub"].status == "ok"
    assert by_name["xhs_mcp"].status == "ok"
    assert by_name["douyin_api"].status == "fail"
    assert by_name["aihot"].status == "fail"


async def test_doctor_database_live(store: Store) -> None:
    dsn = store.pool.conninfo
    settings = replace(_settings(rsshub_url=None), database_url=dsn)
    results = await doctor.run_doctor(settings, offline=False)
    by_name = {item.name: item for item in results}
    assert by_name["database"].status == "ok"
    assert not doctor.has_failures(results)


def test_cli_doctor_offline_json_and_failure_exit_code(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("COLLECTOR_ALERT_FORMAT", "feishu")
    monkeypatch.delenv("XHS_MCP_URL", raising=False)
    monkeypatch.delenv("XHS_MCP_TOKEN", raising=False)
    monkeypatch.delenv("AIHOT_URL", raising=False)
    monkeypatch.delenv("AIHOT_INGEST_TOKEN", raising=False)

    cli.main(["doctor", "--offline", "--json"])
    payload = json.loads(capsys.readouterr().out)
    assert payload["ok"] is True
    names = {item["name"] for item in payload["checks"]}
    assert names == {"targets", "lexicon", "alerts", "config"}

    monkeypatch.setenv("COLLECTOR_ALERT_FORMAT", "invalid")
    with pytest.raises(SystemExit) as exc_info:
        cli.main(["doctor", "--offline"])
    assert exc_info.value.code == 1


def test_minimal_compose_is_valid_yaml_without_required_env_traps() -> None:
    compose_path = REPO_ROOT / "infra/collector/compose.minimal.yml"
    raw = compose_path.read_text(encoding="utf-8")
    assert ":?" not in raw

    parsed = yaml.safe_load(raw)
    assert set(parsed["services"]) == {"postgres", "redis", "rsshub", "collector"}
    assert (REPO_ROOT / "services/collector/Dockerfile").is_file()
    assert (REPO_ROOT / "infra/collector/env.minimal.example").is_file()
    assert (REPO_ROOT / "infra/collector/zhipanda-collector.service.example").is_file()
    assert (REPO_ROOT / "docs/runbooks/collector-v1-deployment.md").is_file()
