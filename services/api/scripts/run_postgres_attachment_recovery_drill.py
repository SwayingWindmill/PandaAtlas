from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import tempfile
import time
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATIONS_DIR = REPO_ROOT / "infra" / "supabase" / "migrations"
DEFAULT_REPORT = REPO_ROOT / ".release-gate" / "postgres-attachment-recovery.json"
POSTGRES_IMAGE = "postgis/postgis:16-3.4"
SOURCE_DATABASE = "panda_recovery_source"
RESTORE_DATABASE = "panda_recovery_restore"
ATTACHMENT_ID = "6f6137b2-57d5-4ef2-b0bc-3712d2ac4d23"
SOURCE_ID = "recovery-drill-evidence-source"
ATTACHMENT_BUCKET = "restricted-evidence"
ATTACHMENT_KEY = "recovery-drill/safe-fixture.txt"
ATTACHMENT_VERSION = "drill-v1"
ATTACHMENT_BYTES = (
    b"PandaAtlas non-production recovery fixture. No personal or restricted data.\n"
)


class RecoveryDrillError(RuntimeError):
    """Raised when a recovery invariant is not satisfied."""


class EnvironmentUnavailable(RecoveryDrillError):
    """Raised when Docker cannot provide the disposable recovery environment."""


def _utc_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def _sha256_json(payload: Any) -> str:
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return _sha256_bytes(encoded.encode("utf-8"))


def _run(
    args: list[str],
    *,
    input_text: str | None = None,
    timeout: int = 120,
    environment_check: bool = False,
) -> str:
    try:
        completed = subprocess.run(
            args,
            input=input_text,
            capture_output=True,
            text=True,
            check=False,
            timeout=timeout,
        )
    except FileNotFoundError as error:
        raise EnvironmentUnavailable(f"required command is unavailable: {args[0]}") from error
    except subprocess.TimeoutExpired as error:
        raise RecoveryDrillError(f"command timed out: {args[0]}") from error

    if completed.returncode != 0:
        detail = completed.stderr.strip().splitlines()
        message = detail[-1] if detail else f"exit code {completed.returncode}"
        error_type = EnvironmentUnavailable if environment_check else RecoveryDrillError
        raise error_type(f"{args[0]} failed: {message}")
    return completed.stdout.strip()


def _docker(container: str, *args: str, input_text: str | None = None) -> str:
    return _run(["docker", "exec", "-i", container, *args], input_text=input_text)


def _psql(container: str, database: str, sql: str) -> str:
    return _docker(
        container,
        "psql",
        "--username",
        "postgres",
        "--dbname",
        database,
        "--set",
        "ON_ERROR_STOP=1",
        "--tuples-only",
        "--no-align",
        input_text=sql,
    )


def _wait_for_postgres(container: str) -> None:
    deadline = time.monotonic() + 60
    consecutive_ready = 0
    while time.monotonic() < deadline:
        completed = subprocess.run(
            [
                "docker",
                "exec",
                container,
                "pg_isready",
                "--username",
                "postgres",
                "--dbname",
                SOURCE_DATABASE,
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        if completed.returncode == 0:
            consecutive_ready += 1
            if consecutive_ready == 3:
                return
        else:
            consecutive_ready = 0
        time.sleep(1)
    raise EnvironmentUnavailable("disposable PostgreSQL did not become ready within 60 seconds")


def _apply_migrations(container: str) -> list[str]:
    bootstrap = """
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid
language sql stable as $$ select null::uuid $$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end $$;
"""
    _psql(container, SOURCE_DATABASE, bootstrap)

    applied: list[str] = []
    for migration in sorted(MIGRATIONS_DIR.glob("*.sql")):
        _psql(container, SOURCE_DATABASE, migration.read_text(encoding="utf-8-sig"))
        applied.append(migration.name)
    if "0008_evidence_attachments.sql" not in applied:
        raise RecoveryDrillError("evidence attachment migration was not applied")
    return applied


def _seed_recovery_fixture(container: str, attachment_sha256: str) -> None:
    _psql(
        container,
        SOURCE_DATABASE,
        f"""
insert into public.evidence_sources (
  id, publisher, title, url, published_at, last_verified_at, language_tag,
  access_state, publication_status, evidence_tier, public_summary
) values (
  '{SOURCE_ID}', 'PandaAtlas', 'Safe recovery drill fixture',
  'https://example.invalid/panda-atlas-recovery-fixture', '2026-07-15',
  '2026-07-15', 'en', 'restricted', 'restricted', 'internal', null
);

insert into public.evidence_attachments (
  id, source_id, storage_bucket, storage_key, object_version,
  content_sha256, byte_size, media_type, publication_status
) values (
  '{ATTACHMENT_ID}'::uuid, '{SOURCE_ID}', '{ATTACHMENT_BUCKET}',
  '{ATTACHMENT_KEY}', '{ATTACHMENT_VERSION}', '{attachment_sha256}',
  {len(ATTACHMENT_BYTES)}, 'text/plain', 'restricted'
);

create table public.recovery_drill_checkpoint (
  singleton boolean primary key default true check (singleton),
  operation_sequence bigint not null,
  recorded_at timestamptz not null default now()
);
insert into public.recovery_drill_checkpoint (operation_sequence) values (1);
""",
    )


def _logical_state(container: str, database: str) -> dict[str, Any]:
    source_json = _psql(
        container,
        database,
        """
select coalesce(json_agg(row_to_json(record) order by record.id), '[]'::json)::text
from (
  select id, publisher, title, url, published_at::text, last_verified_at::text,
         language_tag, access_state, publication_status, evidence_tier, public_summary
  from public.evidence_sources
) record;
""",
    )
    attachment_json = _psql(
        container,
        database,
        """
select coalesce(json_agg(row_to_json(record) order by record.id), '[]'::json)::text
from (
  select id::text, source_id, storage_bucket, storage_key, object_version,
         content_sha256, byte_size, media_type, publication_status
  from public.evidence_attachments
) record;
""",
    )
    checkpoint = int(
        _psql(
            container,
            database,
            "select operation_sequence from public.recovery_drill_checkpoint where singleton;",
        )
    )
    return {
        "sources": json.loads(source_json),
        "attachments": json.loads(attachment_json),
        "checkpoint_operation_sequence": checkpoint,
    }


def _record_check(checks: list[dict[str, str]], check_id: str, detail: str) -> None:
    checks.append({"id": check_id, "status": "passed", "detail": detail})


def run_recovery_drill(report_path: Path) -> dict[str, Any]:
    started_at = _utc_now()
    started = time.monotonic()
    checks: list[dict[str, str]] = []
    metrics: dict[str, int | float] = {}
    evidence: dict[str, Any] = {}
    container = f"panda-atlas-recovery-{uuid.uuid4().hex[:12]}"
    container_started = False

    try:
        _run(["docker", "version", "--format", "{{.Server.Version}}"], environment_check=True)
        _record_check(checks, "docker-runtime", "Docker daemon is available")

        _run(
            [
                "docker",
                "run",
                "--detach",
                "--rm",
                "--name",
                container,
                "--env",
                "POSTGRES_PASSWORD=panda-recovery-local-only",
                "--env",
                f"POSTGRES_DB={SOURCE_DATABASE}",
                POSTGRES_IMAGE,
            ],
            timeout=180,
            environment_check=True,
        )
        container_started = True
        _wait_for_postgres(container)

        applied_migrations = _apply_migrations(container)
        evidence["applied_migrations"] = applied_migrations
        _record_check(
            checks,
            "migrations-applied",
            f"Applied {len(applied_migrations)} forward-only migrations",
        )

        attachment_sha256 = _sha256_bytes(ATTACHMENT_BYTES)
        with tempfile.TemporaryDirectory(prefix="panda-postgres-attachment-recovery-") as temp:
            workspace = Path(temp)
            source_store = workspace / "source-store"
            backup_store = workspace / "independent-backup"
            restored_store = workspace / "restored-store"
            source_object = source_store / ATTACHMENT_KEY
            backup_object = backup_store / ATTACHMENT_KEY
            restored_object = restored_store / ATTACHMENT_KEY
            source_object.parent.mkdir(parents=True, exist_ok=True)
            source_object.write_bytes(ATTACHMENT_BYTES)
            _seed_recovery_fixture(container, attachment_sha256)

            source_state = _logical_state(container, SOURCE_DATABASE)
            source_state_sha256 = _sha256_json(source_state)
            evidence["source_state_sha256"] = source_state_sha256
            evidence["attachment_sha256"] = attachment_sha256

            backup_started = time.monotonic()
            _docker(
                container,
                "pg_dump",
                "--username",
                "postgres",
                "--dbname",
                SOURCE_DATABASE,
                "--format=custom",
                "--no-owner",
                "--no-acl",
                "--file=/tmp/panda-atlas-recovery.dump",
            )
            dump_sha256 = _docker(
                container,
                "sha256sum",
                "/tmp/panda-atlas-recovery.dump",
            ).split()[0]
            backup_object.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source_object, backup_object)
            metrics["logical_backup_seconds"] = round(time.monotonic() - backup_started, 6)
            evidence["logical_dump_sha256"] = dump_sha256
            evidence["attachment_backup_sha256"] = _sha256_bytes(backup_object.read_bytes())
            _record_check(
                checks,
                "logical-backup",
                "Created a PostgreSQL custom-format dump and independent attachment copy",
            )

            _psql(
                container,
                SOURCE_DATABASE,
                "delete from public.evidence_attachments where id = "
                f"'{ATTACHMENT_ID}'::uuid;",
            )
            source_object.unlink()
            remaining = int(
                _psql(
                    container,
                    SOURCE_DATABASE,
                    "select count(*) from public.evidence_attachments "
                    f"where id = '{ATTACHMENT_ID}'::uuid;",
                )
            )
            if remaining != 0 or source_object.exists():
                raise RecoveryDrillError(
                    "destructive incident did not remove both reference and object"
                )
            _record_check(
                checks,
                "destructive-incident",
                "Removed the attachment metadata and object after the recovery point",
            )

            restore_started = time.monotonic()
            _docker(container, "createdb", "--username", "postgres", RESTORE_DATABASE)
            _docker(
                container,
                "pg_restore",
                "--username",
                "postgres",
                "--dbname",
                RESTORE_DATABASE,
                "--exit-on-error",
                "--no-owner",
                "--no-acl",
                "/tmp/panda-atlas-recovery.dump",
            )
            restored_state = _logical_state(container, RESTORE_DATABASE)
            restored_state_sha256 = _sha256_json(restored_state)
            evidence["restored_state_sha256"] = restored_state_sha256
            if restored_state_sha256 != source_state_sha256:
                raise RecoveryDrillError(
                    "restored PostgreSQL logical state differs from backup state"
                )
            _record_check(
                checks,
                "postgres-restore",
                "Restored the custom-format dump into a separate PostgreSQL database",
            )

            restored_object.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(backup_object, restored_object)
            restored_attachment_sha256 = _sha256_bytes(restored_object.read_bytes())
            evidence["restored_attachment_sha256"] = restored_attachment_sha256
            if restored_attachment_sha256 != attachment_sha256:
                raise RecoveryDrillError("restored attachment checksum differs from metadata")
            _record_check(
                checks,
                "attachment-restore",
                "Restored the versioned attachment from the independent backup copy",
            )

            integrity_count = int(
                _psql(
                    container,
                    RESTORE_DATABASE,
                    """
select count(*)
from public.evidence_attachments attachment
join public.evidence_sources source on source.id = attachment.source_id
where attachment.id = '6f6137b2-57d5-4ef2-b0bc-3712d2ac4d23'::uuid
  and attachment.content_sha256 = '"""
                    + attachment_sha256
                    + "'\n  and attachment.byte_size = "
                    + str(len(ATTACHMENT_BYTES))
                    + ";",
                )
            )
            if integrity_count != 1:
                raise RecoveryDrillError("restored attachment reference integrity check failed")
            _record_check(
                checks,
                "reference-integrity",
                "Restored metadata references the restored object with matching size and checksum",
            )

            target_checkpoint = int(source_state["checkpoint_operation_sequence"])
            restored_checkpoint = int(restored_state["checkpoint_operation_sequence"])
            recovery_point_loss = target_checkpoint - restored_checkpoint
            metrics["target_checkpoint_operations"] = target_checkpoint
            metrics["restored_checkpoint_operations"] = restored_checkpoint
            metrics["recovery_point_loss_operations"] = recovery_point_loss
            metrics["recovery_time_seconds"] = round(time.monotonic() - restore_started, 6)
            if recovery_point_loss != 0:
                raise RecoveryDrillError("restored checkpoint lost committed recovery operations")
            _record_check(
                checks,
                "recovery-objectives",
                "Recovered the selected logical point with zero lost committed operations",
            )

        report = {
            "schema_version": "1.0.0",
            "drill": "postgres-attachment-recovery",
            "status": "passed",
            "started_at": started_at,
            "completed_at": _utc_now(),
            "environment": {
                "classification": "approved-disposable-local-non-production",
                "postgres_image": POSTGRES_IMAGE,
                "attachment_store": "local-filesystem-versioned-surrogate",
            },
            "checks": checks,
            "metrics": {
                **metrics,
                "total_duration_seconds": round(time.monotonic() - started, 6),
            },
            "evidence": evidence,
            "limitations": [
                "Exercises PostgreSQL logical restore, not provider-managed PITR/WAL recovery.",
                "Exercises a versioned local-filesystem attachment surrogate, not remote R2.",
                "Provider-managed PITR and remote attachment restore remain staging requirements.",
            ],
        }
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        return report
    finally:
        if container_started:
            subprocess.run(
                ["docker", "rm", "--force", container],
                capture_output=True,
                text=True,
                check=False,
                timeout=30,
            )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Exercise PostgreSQL logical and evidence-attachment recovery"
    )
    parser.add_argument(
        "--report",
        type=Path,
        default=DEFAULT_REPORT,
        help="Path for the sanitized JSON evidence report",
    )
    args = parser.parse_args()

    try:
        report = run_recovery_drill(args.report.resolve())
    except EnvironmentUnavailable as error:
        print(f"[postgres-attachment-recovery] environment blocked: {error}")
        return 2
    except RecoveryDrillError as error:
        print(f"[postgres-attachment-recovery] failed: {error}")
        return 1

    for check in report["checks"]:
        print(
            f"[postgres-attachment-recovery] {check['status']:<6} "
            f"{check['id']}: {check['detail']}"
        )
    print(f"[postgres-attachment-recovery] report: {args.report.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
