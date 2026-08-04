from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

API_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = Path(__file__).resolve().parents[3]
REPORT_DIR = Path(os.getenv("RELEASE_GATE_REPORT_DIR", REPO_ROOT / ".release-gate"))
REPORT_PATH = REPORT_DIR / "audit-integrity-recovery.json"
TEST_PATH = API_ROOT / "tests/integration/test_unified_audit_real_db.py"
TEST_NODES = [
    (
        "tests/integration/test_unified_audit_real_db.py::"
        "test_integrity_summary_detects_late_append_only_event"
    ),
    (
        "tests/integration/test_unified_audit_real_db.py::"
        "test_retention_maintenance_removes_only_expired_exports"
    ),
]
CHECKS = [
    "completed-audit-window-can-be-sealed-and-verified",
    "late-append-only-fact-causes-integrity-mismatch",
    "audit-fact-mutation-is-denied",
    "expired-export-ciphertext-is-removed",
    "active-export-ciphertext-is-retained",
    "retention-maintenance-replay-is-idempotent",
    "maintenance-fact-and-run-record-remain-append-only",
]


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run_drill() -> dict[str, Any]:
    database_url_present = bool(os.getenv("REAL_DB_URL") or os.getenv("DATABASE_URL"))
    if not database_url_present:
        raise RuntimeError("REAL_DB_URL or DATABASE_URL is required")

    started_at = datetime.now(UTC)
    started = time.monotonic()
    environment = os.environ.copy()
    environment["RUN_REAL_DB_TESTS"] = "1"
    command = [sys.executable, "-m", "pytest", "-q", *TEST_NODES]
    completed = subprocess.run(
        command,
        cwd=API_ROOT,
        env=environment,
        text=True,
        capture_output=True,
        check=False,
    )
    if completed.stdout:
        print(completed.stdout, end="")
    if completed.stderr:
        print(completed.stderr, end="", file=sys.stderr)
    if completed.returncode != 0:
        raise RuntimeError(
            "Audit integrity recovery integration journey failed "
            f"with exit code {completed.returncode}"
        )

    return {
        "schema_version": 1,
        "gate": "audit-integrity-recovery",
        "outcome": "passed",
        "started_at": started_at.isoformat(),
        "finished_at": datetime.now(UTC).isoformat(),
        "duration_seconds": round(time.monotonic() - started, 6),
        "test_nodes": TEST_NODES,
        "checks": CHECKS,
        "evidence": {
            "test_source_sha256": _sha256(TEST_PATH),
            "database_url_present": database_url_present,
            "database_url_copied": False,
        },
    }


def main() -> int:
    try:
        report = run_drill()
    except Exception as error:  # noqa: BLE001 - release evidence must record failures.
        report = {
            "schema_version": 1,
            "gate": "audit-integrity-recovery",
            "outcome": "failed",
            "finished_at": datetime.now(UTC).isoformat(),
            "test_nodes": TEST_NODES,
            "checks": [],
            "error": str(error),
            "evidence": {
                "database_url_present": bool(
                    os.getenv("REAL_DB_URL") or os.getenv("DATABASE_URL")
                ),
                "database_url_copied": False,
            },
        }
        exit_code = 1
    else:
        exit_code = 0

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    if exit_code:
        print(report["error"], file=sys.stderr)
    else:
        print(
            "Audit integrity recovery drill passed: late facts were detected, "
            "append-only boundaries held, and expired ciphertext was removed."
        )
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
