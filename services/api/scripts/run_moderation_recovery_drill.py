from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import HTTPException

from app.core.config import settings
from app.identity.models import AccountState, RequestIdentity
from app.review_moderation.sanction_models import (
    IssueSanctionCommand,
    SanctionKind,
    SanctionScope,
)
from app.review_moderation.sanction_service import issue_sanction

API_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = Path(__file__).resolve().parents[3]
REPORT_DIR = Path(os.getenv("RELEASE_GATE_REPORT_DIR", REPO_ROOT / ".release-gate"))
REPORT_PATH = REPORT_DIR / "moderation-recovery.json"
TEST_PATH = API_ROOT / "tests/integration/test_scoped_moderation_real_db.py"
TEST_NODES = [
    (
        "tests/integration/test_scoped_moderation_real_db.py::"
        "test_warning_projection_supersedes_and_can_be_overturned"
    ),
    (
        "tests/integration/test_scoped_moderation_real_db.py::"
        "test_sanction_appeal_overturn_and_scope_enforcement_are_transactional"
    ),
]
CHECKS = [
    "disabled-moderation-rejects-new-commands-before-database-access",
    "in-flight-appeal-can-drain-to-append-only-decision",
    "overturned-sanction-restores-authoritative-account-state",
    "warning-projection-clears-after-overturn",
    "scope-restrictions-enforce-and-restore-transactionally",
    "superseding-restrictions-leave-one-active-projection",
    "moderation-audit-outbox-and-account-state-remain-transactional",
]


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _verify_stop_boundary() -> None:
    account_id = uuid4()
    now = datetime.now(UTC)
    identity = RequestIdentity(
        account_id=uuid4(),
        email="moderation-recovery-operator@example.invalid",
        session_id="moderation-recovery-session",
        state=AccountState.ACTIVE,
        roles=frozenset({"moderator"}),
        capabilities=frozenset({"moderation.sanction.apply"}),
        authenticated_at=now,
        authentication_method="email",
        issued_at=now,
        expires_at=now + timedelta(hours=1),
        assurance_level="aal2",
        recent_auth=True,
    )
    command = IssueSanctionCommand(
        idempotency_key="moderation-recovery-disabled-command",
        expected_version=1,
        kind=SanctionKind.WARNING,
        scope=SanctionScope.ACCOUNT,
        reason_code="recovery_stop_boundary",
        internal_explanation="Recovery drill verifies that disabled commands fail closed.",
        user_visible_explanation="This command is part of a recovery drill.",
        starts_at=now,
        ends_at=None,
    )
    previous = settings.moderation_controls_enabled
    settings.moderation_controls_enabled = False
    try:
        try:
            issue_sanction(account_id, command, identity, uuid4())
        except HTTPException as error:
            if error.status_code != 404 or error.detail != {
                "code": "moderation_controls_disabled"
            }:
                raise RuntimeError(
                    "Moderation stop boundary returned an unexpected response"
                ) from error
        else:
            raise RuntimeError("Disabled moderation accepted a new command")
    finally:
        settings.moderation_controls_enabled = previous


def run_drill() -> dict[str, Any]:
    database_url_present = bool(os.getenv("REAL_DB_URL") or os.getenv("DATABASE_URL"))
    if not database_url_present:
        raise RuntimeError("REAL_DB_URL or DATABASE_URL is required")

    started_at = datetime.now(UTC)
    started = time.monotonic()
    _verify_stop_boundary()
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
            "Moderation recovery integration journey failed "
            f"with exit code {completed.returncode}"
        )

    return {
        "schema_version": 1,
        "gate": "moderation-recovery",
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
            "gate": "moderation-recovery",
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
            "Moderation recovery drill passed: new commands stopped fail closed, "
            "appeals drained to restoration, and projections remained transactional."
        )
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
