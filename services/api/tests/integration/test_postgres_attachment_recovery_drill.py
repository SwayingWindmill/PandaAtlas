import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

API_ROOT = Path(__file__).resolve().parents[2]


def test_postgres_and_attachment_recovery_cli_leaves_sanitized_evidence(
    tmp_path: Path,
) -> None:
    if os.getenv("RUN_POSTGRES_ATTACHMENT_RECOVERY_TESTS") != "1":
        pytest.skip("Set RUN_POSTGRES_ATTACHMENT_RECOVERY_TESTS=1 to run the Docker drill")

    report_path = tmp_path / "postgres-attachment-recovery.json"
    completed = subprocess.run(
        [
            sys.executable,
            "scripts/run_postgres_attachment_recovery_drill.py",
            "--report",
            str(report_path),
        ],
        cwd=API_ROOT,
        check=False,
        capture_output=True,
        text=True,
        timeout=240,
    )

    assert completed.returncode == 0, completed.stdout + completed.stderr
    report = json.loads(report_path.read_text(encoding="utf-8"))
    assert report["status"] == "passed"
    assert report["environment"] == {
        "approval_id": "disposable-local-postgis-synthetic-only",
        "classification": "approved-disposable-local-non-production",
        "postgres_image": "postgis/postgis:16-3.4",
        "attachment_store": "local-filesystem-versioned-surrogate",
    }
    assert report["metrics"]["recovery_point_loss_operations"] == 1
    assert report["metrics"]["recovery_point_age_seconds"] <= 900
    assert report["metrics"]["rpo_within_target"] is True
    assert report["metrics"]["database_attachment_restore_seconds"] >= 0
    assert report["metrics"]["database_attachment_restore_seconds"] <= 14400
    assert report["metrics"]["restore_component_within_rto_target"] is True
    assert report["evidence"]["source_state_sha256"] == report["evidence"][
        "restored_state_sha256"
    ]
    assert report["evidence"]["attachment_sha256"] == report["evidence"][
        "restored_attachment_sha256"
    ]
    assert report["evidence"]["available_object_versions_before_incident"] == [
        "drill-v1",
        "drill-v2",
    ]
    assert report["evidence"]["restored_object_version"] == "drill-v1"
    assert "database_url" not in json.dumps(report).lower()
    assert [check["id"] for check in report["checks"]] == [
        "docker-runtime",
        "migrations-applied",
        "logical-backup",
        "destructive-incident",
        "postgres-restore",
        "attachment-restore",
        "reference-integrity",
        "recovery-objectives",
    ]
