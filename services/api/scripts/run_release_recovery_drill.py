from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sqlite3
import tempfile
import time
from copy import deepcopy
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.data.golden_dataset import load_golden_dataset
from app.projection.public_release import PublicRelease, PublicReleaseInput, build_public_release

ROOT = Path(__file__).resolve().parents[3]
DEFAULT_REPORT = ROOT / ".release-gate" / "recovery-drill.json"
MIGRATION = (
    ROOT / "infra" / "cloudflare" / "d1" / "migrations" / "0005_versioned_public_releases.sql"
)
FIRST_VERSION = "2026.07.14.3"
SECOND_VERSION = "2026.07.14.4"
CHECKED_RELEASE_DIR = ROOT / "data" / "public-releases" / FIRST_VERSION
DRILL_TIME = datetime(2026, 7, 15, 8, 0, tzinfo=UTC)
STATE_TABLES = (
    "public_releases",
    "public_release_records",
    "public_release_pointer",
    "public_release_withdrawals",
)


class RecoveryDrillError(RuntimeError):
    """Raised when a release recovery invariant is not satisfied."""


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise RecoveryDrillError(message)


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _canonical_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def _load_checked_release() -> PublicRelease:
    manifest = json.loads((CHECKED_RELEASE_DIR / "manifest.json").read_text(encoding="utf-8"))
    d1_sql = (CHECKED_RELEASE_DIR / "d1.sql").read_text(encoding="utf-8")
    descriptor = manifest["files"]["d1.sql"]
    _require(len(d1_sql.encode("utf-8")) == descriptor["bytes"], "checked D1 byte count drifted")
    _require(_sha256(d1_sql) == descriptor["sha256"], "checked D1 SHA-256 drifted")
    release_metadata = {
        key: str(manifest[key])
        for key in (
            "dataset_release_version",
            "public_schema_version",
            "database_migration_version",
            "publication_batch_id",
            "projection_code_version",
            "released_at",
        )
    }
    _require(
        release_metadata["dataset_release_version"] == FIRST_VERSION,
        "checked release version does not match the drill baseline",
    )
    return PublicRelease(
        release_metadata=release_metadata,
        manifest=manifest,
        files={"d1.sql": d1_sql},
    )


def _build_release(version: str, batch_id: str) -> PublicRelease:
    source_state = deepcopy(load_golden_dataset())
    source_state["dataset"]["version"] = version
    return build_public_release(
        PublicReleaseInput(
            source_state=source_state,
            publication_batch_id=batch_id,
            projection_code_version="recovery-drill-v1",
            database_migration_version="0007",
            released_at=DRILL_TIME,
        )
    )


def _open_database() -> sqlite3.Connection:
    database = sqlite3.connect(":memory:")
    database.executescript(MIGRATION.read_text(encoding="utf-8"))
    return database


def _table_rows(database: sqlite3.Connection, table: str) -> list[list[Any]]:
    rows = database.execute(f"select * from {table}").fetchall()
    return sorted((list(row) for row in rows), key=_canonical_json)


def _state_payload(
    database: sqlite3.Connection, tables: tuple[str, ...] = STATE_TABLES
) -> dict[str, list[list[Any]]]:
    return {table: _table_rows(database, table) for table in tables}


def _state_sha256(database: sqlite3.Connection, tables: tuple[str, ...] = STATE_TABLES) -> str:
    return _sha256(_canonical_json(_state_payload(database, tables)))


def _current_version(database: sqlite3.Connection) -> str | None:
    row = database.execute("select dataset_release_version from current_public_release").fetchone()
    return None if row is None else str(row[0])


def _switch_pointer(database: sqlite3.Connection, version: str, switched_at: str) -> None:
    database.execute("begin immediate")
    database.execute(
        "update public_release_pointer "
        "set dataset_release_version = ?, switched_at = ? where singleton = 1",
        (version, switched_at),
    )
    database.commit()


def _append_operation(journal: list[dict[str, Any]], operation: str, **payload: str) -> None:
    journal.append({"sequence": len(journal) + 1, "operation": operation, **payload})


def _execute_release_inside_transaction(database: sqlite3.Connection, d1_sql: str) -> None:
    statement = ""
    for line in d1_sql.splitlines():
        statement += f"{line}\n"
        if not sqlite3.complete_statement(statement):
            continue
        normalized = statement.strip().lower()
        if normalized not in {"begin immediate;", "commit;"}:
            database.execute(statement)
        statement = ""
    _require(not statement.strip(), "D1 artifact ended with an incomplete SQL statement")


def _exercise_atomic_switch(
    database: sqlite3.Connection,
    first: PublicRelease,
    second: PublicRelease,
    journal: list[dict[str, Any]],
) -> None:
    database.executescript(first.files["d1.sql"])
    _require(_current_version(database) == FIRST_VERSION, "first release did not become active")
    _append_operation(journal, "apply-release", dataset_release_version=FIRST_VERSION)

    try:
        database.execute("begin immediate")
        _execute_release_inside_transaction(database, second.files["d1.sql"])
        _require(
            database.execute(
                "select dataset_release_version from public_release_pointer where singleton = 1"
            ).fetchone()
            == (SECOND_VERSION,),
            "candidate pointer was not reached before failure injection",
        )
        database.execute(
            "insert into public_releases select * from public_releases "
            "where dataset_release_version = ?",
            (SECOND_VERSION,),
        )
    except sqlite3.IntegrityError:
        database.rollback()
    else:
        database.rollback()
        raise RecoveryDrillError("injected candidate failure did not abort")

    _require(
        _current_version(database) == FIRST_VERSION, "failed switch changed the active pointer"
    )
    _require(
        database.execute(
            "select count(*) from public_releases where dataset_release_version = ?",
            (SECOND_VERSION,),
        ).fetchone()
        == (0,),
        "failed switch left partial candidate history",
    )

    database.executescript(second.files["d1.sql"])
    _append_operation(journal, "apply-release", dataset_release_version=SECOND_VERSION)
    _require(
        _current_version(database) == SECOND_VERSION, "second release did not switch atomically"
    )
    _require(
        database.execute("select count(*) from public_releases").fetchone() == (2,),
        "successful switch did not retain both immutable releases",
    )


def _exercise_rollback(database: sqlite3.Connection, journal: list[dict[str, Any]]) -> None:
    switched_at = "2026-07-15T08:01:00Z"
    _switch_pointer(database, FIRST_VERSION, switched_at)
    _require(
        _current_version(database) == FIRST_VERSION, "rollback did not restore the prior release"
    )
    _append_operation(
        journal,
        "switch-pointer",
        dataset_release_version=FIRST_VERSION,
        switched_at=switched_at,
    )


def _exercise_entity_withdrawal(
    database: sqlite3.Connection, journal: list[dict[str, Any]]
) -> tuple[str, str]:
    entity = database.execute(
        "select entity_type, entity_id from current_public_records "
        "where entity_type = 'api_pandas' order by entity_id limit 1"
    ).fetchone()
    _require(entity is not None, "no current entity was available for withdrawal")
    before = database.execute("select count(*) from current_public_records").fetchone()[0]
    reason = "Recovery drill entity withdrawal"
    withdrawn_at = "2026-07-15T08:02:00Z"
    database.execute(
        "insert into public_release_withdrawals "
        "(dataset_release_version, entity_type, entity_id, reason, withdrawn_at) "
        "values (?, ?, ?, ?, ?)",
        (
            FIRST_VERSION,
            entity[0],
            entity[1],
            reason,
            withdrawn_at,
        ),
    )
    database.commit()
    after = database.execute("select count(*) from current_public_records").fetchone()[0]
    _require(after == before - 1, "entity withdrawal did not remove exactly one current record")
    _require(_current_version(database) == FIRST_VERSION, "entity withdrawal hid the whole release")
    _append_operation(
        journal,
        "withdraw-entity",
        dataset_release_version=FIRST_VERSION,
        entity_type=str(entity[0]),
        entity_id=str(entity[1]),
        reason=reason,
        withdrawn_at=withdrawn_at,
    )
    return str(entity[0]), str(entity[1])


def _exercise_whole_release_withdrawal(
    database: sqlite3.Connection, journal: list[dict[str, Any]]
) -> None:
    reason = "Recovery drill whole-release withdrawal"
    withdrawn_at = "2026-07-15T08:03:00Z"
    database.execute(
        "insert into public_release_withdrawals "
        "(dataset_release_version, reason, withdrawn_at) values (?, ?, ?)",
        (
            FIRST_VERSION,
            reason,
            withdrawn_at,
        ),
    )
    database.commit()
    _require(_current_version(database) is None, "whole-release withdrawal did not fail closed")
    _require(
        database.execute("select count(*) from public_releases").fetchone() == (2,),
        "whole-release withdrawal rewrote release history",
    )
    _append_operation(
        journal,
        "withdraw-release",
        dataset_release_version=FIRST_VERSION,
        reason=reason,
        withdrawn_at=withdrawn_at,
    )


def _exercise_cache_purge(cache_root: Path) -> tuple[int, int, int]:
    for version in (FIRST_VERSION, SECOND_VERSION):
        version_dir = cache_root / version
        version_dir.mkdir(parents=True, exist_ok=True)
        (version_dir / "atlas-response.json").write_text(
            _canonical_json({"dataset_release_version": version}),
            encoding="utf-8",
        )
    before = sum(path.is_file() for path in cache_root.rglob("*"))
    started = time.perf_counter_ns()
    shutil.rmtree(cache_root)
    cache_root.mkdir(parents=True)
    duration_ms = max(0, round((time.perf_counter_ns() - started) / 1_000_000))
    after = sum(path.is_file() for path in cache_root.rglob("*"))
    _require(before == 2 and after == 0, "cache purge left stale release entries")
    return before, after, duration_ms


def _expect_immutable_rejection(
    database: sqlite3.Connection, statement: str, failure_message: str
) -> None:
    try:
        database.execute(statement)
    except sqlite3.IntegrityError:
        database.rollback()
    else:
        database.rollback()
        raise RecoveryDrillError(failure_message)


def _assert_immutable_history(
    database: sqlite3.Connection, history_before: str
) -> tuple[str, str, str]:
    append_only_before = _state_sha256(
        database,
        ("public_releases", "public_release_records", "public_release_withdrawals"),
    )
    mutations = (
        (
            "update public_releases set publication_batch_id = 'rewritten'",
            "immutable release metadata accepted an update",
        ),
        ("delete from public_releases", "immutable release metadata accepted a delete"),
        (
            "update public_release_records set public_json = '{}'",
            "immutable release records accepted an update",
        ),
        ("delete from public_release_records", "immutable release records accepted a delete"),
        (
            "update public_release_withdrawals set reason = 'rewritten'",
            "append-only withdrawals accepted an update",
        ),
        (
            "delete from public_release_withdrawals",
            "append-only withdrawals accepted a delete",
        ),
    )
    for statement, failure_message in mutations:
        _expect_immutable_rejection(database, statement, failure_message)

    history_after = _state_sha256(database, ("public_releases", "public_release_records"))
    _require(history_after == history_before, "rollback or withdrawal rewrote immutable history")
    append_only_after = _state_sha256(
        database,
        ("public_releases", "public_release_records", "public_release_withdrawals"),
    )
    _require(
        append_only_after == append_only_before,
        "rejected mutations changed append-only operational history",
    )
    return history_after, append_only_before, append_only_after


def _rebuild_database(
    releases: dict[str, PublicRelease],
    journal: list[dict[str, Any]],
) -> tuple[sqlite3.Connection, int, int]:
    started = time.perf_counter_ns()
    rebuilt = _open_database()
    replayed = 0
    for item in journal:
        operation = item["operation"]
        if operation == "apply-release":
            version = str(item["dataset_release_version"])
            rebuilt.executescript(releases[version].files["d1.sql"])
        elif operation == "switch-pointer":
            _switch_pointer(
                rebuilt,
                str(item["dataset_release_version"]),
                str(item["switched_at"]),
            )
        elif operation == "withdraw-entity":
            rebuilt.execute(
                "insert into public_release_withdrawals "
                "(dataset_release_version, entity_type, entity_id, reason, withdrawn_at) "
                "values (?, ?, ?, ?, ?)",
                (
                    item["dataset_release_version"],
                    item["entity_type"],
                    item["entity_id"],
                    item["reason"],
                    item["withdrawn_at"],
                ),
            )
            rebuilt.commit()
        elif operation == "withdraw-release":
            rebuilt.execute(
                "insert into public_release_withdrawals "
                "(dataset_release_version, reason, withdrawn_at) values (?, ?, ?)",
                (
                    item["dataset_release_version"],
                    item["reason"],
                    item["withdrawn_at"],
                ),
            )
            rebuilt.commit()
        else:
            raise RecoveryDrillError(f"unknown recovery journal operation: {operation}")
        replayed += 1
    duration_ms = max(0, round((time.perf_counter_ns() - started) / 1_000_000))
    return rebuilt, duration_ms, replayed


def run_recovery_drill(report_path: Path) -> dict[str, Any]:
    checks: list[dict[str, str]] = []
    evidence: dict[str, Any] = {"cache_mode": "local-filesystem-surrogate"}
    metrics: dict[str, int] = {}
    journal: list[dict[str, Any]] = []
    active_check = "setup"
    started_at = datetime.now(UTC)

    try:
        first = _load_checked_release()
        second = _build_release(SECOND_VERSION, "recovery-drill-b")
        repeated_second = _build_release(SECOND_VERSION, "recovery-drill-b")
        _require(
            second.files == repeated_second.files, "candidate release rebuild was not deterministic"
        )
        evidence["release_d1_sha256"] = {
            FIRST_VERSION: _sha256(first.files["d1.sql"]),
            SECOND_VERSION: _sha256(second.files["d1.sql"]),
        }
        evidence["checked_manifest_d1_sha256"] = first.manifest["files"]["d1.sql"]["sha256"]

        with tempfile.TemporaryDirectory(prefix="panda-recovery-drill-") as temporary:
            database = _open_database()
            active_check = "atomic-switch"
            _exercise_atomic_switch(database, first, second, journal)
            evidence["atomic_failure_stage"] = "after-record-inserts-and-pointer-update"
            checks.append({"id": active_check, "status": "passed"})
            history_before = _state_sha256(database, ("public_releases", "public_release_records"))
            evidence["history_sha256_before"] = history_before

            active_check = "prior-version-rollback"
            _exercise_rollback(database, journal)
            checks.append({"id": active_check, "status": "passed"})

            active_check = "entity-withdrawal"
            entity_type, entity_id = _exercise_entity_withdrawal(database, journal)
            evidence["withdrawn_entity"] = {"entity_type": entity_type, "entity_id": entity_id}
            checks.append({"id": active_check, "status": "passed"})

            active_check = "whole-release-withdrawal"
            _exercise_whole_release_withdrawal(database, journal)
            checks.append({"id": active_check, "status": "passed"})

            active_check = "cache-purge"
            cache_before, cache_after, cache_duration_ms = _exercise_cache_purge(
                Path(temporary) / "cache"
            )
            evidence["cache_entries_before_purge"] = cache_before
            evidence["cache_entries_after_purge"] = cache_after
            metrics["cache_purge_duration_ms"] = cache_duration_ms
            checks.append({"id": active_check, "status": "passed"})

            active_check = "immutable-history"
            (
                evidence["history_sha256_after"],
                evidence["append_only_history_sha256_before_mutation"],
                evidence["append_only_history_sha256_after_mutation"],
            ) = _assert_immutable_history(database, history_before)
            checks.append({"id": active_check, "status": "passed"})

            active_check = "deterministic-d1-rebuild"
            evidence["operational_state_sha256"] = _state_sha256(database)
            releases = {FIRST_VERSION: first, SECOND_VERSION: second}
            rebuilt, rebuild_duration_ms, replayed = _rebuild_database(releases, journal)
            evidence["rebuilt_state_sha256"] = _state_sha256(rebuilt)
            evidence["operation_journal"] = journal
            evidence["operation_journal_sha256"] = _sha256(_canonical_json(journal))
            metrics["d1_rebuild_duration_ms"] = rebuild_duration_ms
            metrics["journal_operations"] = len(journal)
            metrics["replayed_operations"] = replayed
            metrics["recovery_point_loss_operations"] = len(journal) - replayed
            _require(
                evidence["operational_state_sha256"] == evidence["rebuilt_state_sha256"],
                "rebuilt D1 state differs from the exercised operational state",
            )
            _require(
                metrics["recovery_point_loss_operations"] == 0,
                "D1 rebuild did not replay every append-only operation",
            )
            checks.append({"id": active_check, "status": "passed"})
            rebuilt.close()
            database.close()
    except Exception as error:
        checks.append({"id": active_check, "status": "failed", "detail": str(error)})

    result = {
        "schema_version": 1,
        "outcome": "passed" if all(check["status"] == "passed" for check in checks) else "failed",
        "started_at": started_at.isoformat().replace("+00:00", "Z"),
        "finished_at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "release_versions": [FIRST_VERSION, SECOND_VERSION],
        "checks": checks,
        "metrics": metrics,
        "evidence": evidence,
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return result


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Exercise PandaAtlas immutable-release rollback and recovery invariants"
    )
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    result = run_recovery_drill(args.report.resolve())
    print(
        f"RELEASE_RECOVERY_DRILL_RESULT outcome={result['outcome']} report={args.report.resolve()}"
    )
    for check in result["checks"]:
        detail = f" — {check['detail']}" if check.get("detail") else ""
        print(f"[recovery-drill] {check['status']:<6} {check['id']}{detail}")
    return 0 if result["outcome"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
