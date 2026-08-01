from __future__ import annotations

from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[4]
CANONICAL = REPO_ROOT / "services" / "api" / "openapi" / "panda-atlas-v1.yaml"
FRAGMENT = REPO_ROOT / "services" / "api" / "openapi" / "moderation-v1.yaml"


def test_canonical_openapi_registers_moderation_paths() -> None:
    canonical = yaml.safe_load(CANONICAL.read_text(encoding="utf-8"))

    for path in (
        "/api/v1/moderation/notice",
        "/api/v1/moderation/appeals",
        "/api/v1/admin/moderation/accounts",
        "/api/v1/admin/moderation/accounts/{account_id}/sanctions",
        "/api/v1/admin/moderation/accounts/{account_id}/temporary-submission-freezes",
        "/api/v1/admin/moderation/accounts/{account_id}/sanctions/{sanction_id}/restore",
        "/api/v1/admin/moderation/appeals",
        "/api/v1/admin/moderation/appeals/{appeal_case_id}/acknowledge",
        "/api/v1/admin/moderation/appeals/{appeal_case_id}/decide",
        "/api/v1/admin/moderation/metrics",
    ):
        assert path in canonical["paths"]


def test_moderation_openapi_exposes_versioned_commands_and_explicit_capabilities() -> None:
    fragment = yaml.safe_load(FRAGMENT.read_text(encoding="utf-8"))
    operations = {
        operation["operationId"]
        for path in fragment["paths"].values()
        for operation in path.values()
        if isinstance(operation, dict) and "operationId" in operation
    }

    assert {
        "getCurrentModerationNotice",
        "openModerationAppeal",
        "listModerationAccounts",
        "issueModerationSanction",
        "issueTemporarySubmissionFreeze",
        "restoreModerationSanction",
        "listModerationAppeals",
        "acknowledgeModerationAppeal",
        "decideModerationAppeal",
        "getModerationMetrics",
    } <= operations
    schemas = fragment["components"]["schemas"]
    assert "expected_version" in schemas["IssueSanctionCommand"]["properties"]
    assert "idempotency_key" in schemas["IssueSanctionCommand"]["properties"]
    assert "internal_explanation" in schemas["IssueSanctionCommand"]["properties"]
    assert "user_visible_explanation" in schemas["IssueSanctionCommand"]["properties"]
