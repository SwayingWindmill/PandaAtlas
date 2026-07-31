from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = API_ROOT / "scripts" / "run_notification_staging_drill.py"
SECRET_NAMES = (
    "RESEND_API_KEY",
    "RESEND_FROM_EMAIL",
    "RESEND_WEBHOOK_SECRET",
    "AUTH_SMTP_HOST",
    "AUTH_SMTP_PORT",
    "AUTH_SMTP_USERNAME",
    "AUTH_SMTP_PASSWORD",
    "AUTH_SMTP_FROM_EMAIL",
    "NOTIFICATION_STAGING_TO_EMAIL",
)


def _environment(report_dir: Path) -> dict[str, str]:
    env = os.environ.copy()
    for name in SECRET_NAMES:
        env.pop(name, None)
    env["RELEASE_GATE_REPORT_DIR"] = str(report_dir)
    env.pop("RUN_NOTIFICATION_STAGING", None)
    return env


def test_staging_drill_records_environment_block_without_provider_request(tmp_path: Path) -> None:
    result = subprocess.run(
        [sys.executable, str(SCRIPT)],
        cwd=API_ROOT,
        env=_environment(tmp_path),
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0
    report = json.loads((tmp_path / "notification-staging.json").read_text(encoding="utf-8"))
    assert report["outcome"] == "environment-blocked"
    assert report["provider_request_attempted"] is False
    assert set(report["missing_environment"]) == set(SECRET_NAMES)


def test_required_staging_drill_blocks_the_final_gate_without_credentials(tmp_path: Path) -> None:
    env = _environment(tmp_path)
    env["RUN_NOTIFICATION_STAGING"] = "1"
    result = subprocess.run(
        [sys.executable, str(SCRIPT)],
        cwd=API_ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 2
    report = json.loads((tmp_path / "notification-staging.json").read_text(encoding="utf-8"))
    assert report["outcome"] == "environment-blocked"
    assert report["provider_request_attempted"] is False


def test_staging_drill_rejects_reused_credentials_before_provider_request(tmp_path: Path) -> None:
    env = _environment(tmp_path)
    shared = "same-provider-credential"
    env.update(
        {
            "RUN_NOTIFICATION_STAGING": "1",
            "RESEND_API_KEY": shared,
            "RESEND_FROM_EMAIL": "ZhiPanda <updates@example.invalid>",
            "RESEND_WEBHOOK_SECRET": shared,
            "AUTH_SMTP_HOST": "smtp.example.invalid",
            "AUTH_SMTP_PORT": "587",
            "AUTH_SMTP_USERNAME": "auth-user",
            "AUTH_SMTP_PASSWORD": "".join(("different", "-", "value")),
            "AUTH_SMTP_FROM_EMAIL": "auth@example.invalid",
            "NOTIFICATION_STAGING_TO_EMAIL": "sandbox@example.invalid",
        }
    )
    result = subprocess.run(
        [sys.executable, str(SCRIPT)],
        cwd=API_ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 1
    report = json.loads((tmp_path / "notification-staging.json").read_text(encoding="utf-8"))
    assert report["outcome"] == "failed"
    assert "must be distinct" in report["reason"]
    assert "provider_request_attempted" not in report
