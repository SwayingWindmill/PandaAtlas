from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
MIGRATION_PATH = (
    REPO_ROOT
    / "infra"
    / "supabase"
    / "migrations"
    / "0027_privacy_requests_retention_holds.sql"
)
SERVICE_PATH = REPO_ROOT / "services" / "api" / "app" / "privacy_operations" / "service.py"


def test_privacy_schema_is_private_append_only_and_restore_safe() -> None:
    sql = MIGRATION_PATH.read_text(encoding="utf-8").lower()

    assert "create schema if not exists privacy" in sql
    assert "create table if not exists privacy.requests" in sql
    assert "create table if not exists privacy.request_events" in sql
    assert "create table if not exists privacy.context_events" in sql
    assert "create table if not exists privacy.deletion_tombstones" in sql
    assert "privacy.reject_append_only_mutation" in sql
    assert "before update or delete" in sql
    assert "rolling_backup_days = 35" in sql
    assert "revoke all on schema privacy from public" in sql
    assert "revoke all on schema privacy from %i" in sql
    assert "internal_note" not in sql
    assert "privacy_request_context_error_code_format" in sql
    assert "privacy_context_events_failure_shape" in sql


def test_deletion_request_blocks_access_in_same_transaction() -> None:
    service = SERVICE_PATH.read_text(encoding="utf-8").lower()
    create_section = service.split("def create_request", 1)[1].split(
        "def list_for_account", 1
    )[0]
    block_section = service.split("def _block_account_access", 1)[1].split(
        "def _insert_request_event", 1
    )[0]

    assert "privacyrequestkind.account_deletion" in create_section
    assert "self._block_account_access" in create_section
    assert "set state = 'deleting'" in block_section
    assert "insert into identity.account_state_events" in block_section
    assert "identity.account-state-changed" in block_section


def test_sensitive_reads_are_audited_and_bounded() -> None:
    service = SERVICE_PATH.read_text(encoding="utf-8").lower()

    assert "privacy.self-queue.read" in service
    assert "privacy.self-request.read" in service
    assert "privacy.operator-queue.read" in service
    assert "privacy.operator-request.read" in service
    assert service.count("limit 100") >= 2
    assert "cannot verify their own requests" in service
    assert "cannot process their own requests" in service


def test_retention_policy_seeds_export_and_backup_boundaries() -> None:
    sql = MIGRATION_PATH.read_text(encoding="utf-8").lower()

    assert "'privacy.export-artifact.v1', 'export_artifact', 1, 35" in sql
    assert "'privacy.backup-boundary.v1', 'backup_tombstone', 35, 35" in sql
    assert "expire no later than 24 hours" in sql
    assert "reapplied to every restore" in sql
