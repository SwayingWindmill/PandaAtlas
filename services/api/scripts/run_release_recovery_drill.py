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


def _exercise_atomic_switch(
    database: sqlite3.Connection,
    first: PublicRelease,
    second: PublicRelease,
) -> None:
    database.executescript(first.files["d1.sql"])
    _require(_current_version(database) == FIRST_VERSION, "first release did not become active")

    try:
        database.execute("begin immediate")
        metadata = second.release_metadata
        values = (
            metadata["dataset_release_version"],
            metadata["public_schema_version"],
            metadata["database_migration_version"],
            metadata["publication_batch_id"],
            metadata["projection_code_version"],
            metadata["released_at"],
            _canonical_json(second.manifest["licenses"]),
        )
        database.execute(
            "insert into public_releases values (?, ?, ?, ?, ?, ?, ?)",
            values,
        )
        database.execute(
            "insert into public_releases values (?, ?, ?, ?, ?, ?, ?)",
            values,
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
    _require(
        _current_version(database) == SECOND_VERSION, "second release did not switch atomically"
    )
    _require(
        database.execute("select count(*) from public_releases").fetchone() == (2,),
        "successful switch did not retain both immutable releases",
    )


def _exercise_rollback(database: sqlite3.Connection) -> None:
    _switch_pointer(database, FIRST_VERSION, "2026-07-15T08:01:00Z")
    _require(
        _current_version(database) == FIRST_VERSION, "rollback did not restore the prior release"
    )


def _exercise_entity_withdrawal(database: sqlite3.Connection) -> tuple[str, str]:
    entity = database.execute(
        "select entity_type, entity_id from current_public_records "
        "where entity_type = 'api_pandas' order by entity_id limit 1"
    ).fetchone()
    _require(entity is not None, "no current entity was available for withdrawal")
    before = database.execute("select count(*) from current_public_records").fetchone()[0]
    database.execute(
        "insert into public_release_withdrawals "
        "(dataset_release_version, entity_type, entity_id, reason, withdrawn_at) "
        "values (?, ?, ?, ?, ?)",
        (
            FIRST_VERSION,
            entity[0],
            entity[1],
            "Recovery drill entity withdrawal",
            "2026-07-15T08:02:00Z",
        ),
    )
    database.commit()
    after = database.execute("select count(*) from current_public_records").fetchone()[0]
    _require(after == before - 1, "entity withdrawal did not remove exactly one current record")
    _require(_current_version(database) == FIRST_VERSION, "entity withdrawal hid the whole release")
    return str(entity[0]), str(entity[1])


def _exercise_whole_release_withdrawal(database: sqlite3.Connection) -> None:
    database.execute(
        "insert into public_release_withdrawals "
        "(dataset_release_version, reason, withdrawn_at) values (?, ?, ?)",
        (
            FIRST_VERSION,
            "Recovery drill whole-release withdrawal",
            "2026-07-15T08:03:00Z",
        ),
    )
    database.commit()
    _require(_current_version(database) is None, "whole-release withdrawal did not fail closed")
    _require(
        database.execute("select count(*) from public_releases").fetchone() == (2,),
        "whole-release withdrawal rewrote release history",
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


def _assert_immutable_history(database: sqlite3.Connection, history_before: str) -> str:
    try:
        database.execute(
            "update public_release_records set public_json = '{}' "
            "where dataset_release_version = ?",
            (SECOND_VERSION,),
        )
    except sqlite3.IntegrityError:
        database.rollback()
    else:
        database.rollback()
        raise RecoveryDrillError("immutable release records accepted an update")

    try:
        database.execute("update public_release_withdrawals set reason = 'rewritten'")
    except sqlite3.IntegrityError:
        database.rollback()
    else:
        database.rollback()
        raise RecoveryDrillError("append-only withdrawals accepted an update")

    history_after = _state_sha256(database, ("public_releases", "public_release_records"))
    _require(history_after == history_before, "rollback or withdrawal rewrote immutable history")
    return history_after


def _rebuild_database(
    first: PublicRelease,
    second: PublicRelease,
    operational: sqlite3.Connection,
) -> tuple[sqlite3.Connection, int]:
    started = time.perf_counter_ns()
    rebuilt = _open_database()
    rebuilt.executescript(first.files["d1.sql"])
    rebuilt.executescript(second.files["d1.sql"])
    pointer = operational.execute(
        "select dataset_release_version, switched_at "
        "from public_release_pointer where singleton = 1"
    ).fetchone()
    _switch_pointer(rebuilt, str(pointer[0]), str(pointer[1]))
    withdrawals = operational.execute(
        "select dataset_release_version, entity_type, entity_id, reason, withdrawn_at "
        "from public_release_withdrawals order by id"
    ).fetchall()
    rebuilt.executemany(
        "insert into public_release_withdrawals "
        "(dataset_release_version, entity_type, entity_id, reason, withdrawn_at) "
        "values (?, ?, ?, ?, ?)",
        withdrawals,
    )
    rebuilt.commit()
    duration_ms = max(0, round((time.perf_counter_ns() - started) / 1_000_000))
    return rebuilt, duration_ms


def run_recovery_drill(report_path: Path) -> dict[str, Any]:
    checks: list[dict[str, str]] = []
    evidence: dict[str, Any] = {"cache_mode": "local-filesystem-surrogate"}
    metrics: dict[str, int] = {"recovery_point_loss_operations": 0}
    active_check = "setup"
    started_at = datetime.now(UTC)

    try:
        first = _build_release(FIRST_VERSION, "recovery-drill-a")
        second = _build_release(SECOND_VERSION, "recovery-drill-b")
        repeated_second = _build_release(SECOND_VERSION, "recovery-drill-b")
        _require(
            second.files == repeated_second.files, "candidate release rebuild was not deterministic"
        )
        evidence["release_d1_sha256"] = {
            FIRST_VERSION: _sha256(first.files["d1.sql"]),
            SECOND_VERSION: _sha256(second.files["d1.sql"]),
        }

        with tempfile.TemporaryDirectory(prefix="panda-recovery-drill-") as temporary:
            database = _open_database()
            active_check = "atomic-switch"
            _exercise_atomic_switch(database, first, second)
            checks.append({"id": active_check, "status": "passed"})
            history_before = _state_sha256(database, ("public_releases", "public_release_records"))
            evidence["history_sha256_before"] = history_before

            active_check = "prior-version-rollback"
            _exercise_rollback(database)
            checks.append({"id": active_check, "status": "passed"})

            active_check = "entity-withdrawal"
            entity_type, entity_id = _exercise_entity_withdrawal(database)
            evidence["withdrawn_entity"] = {"entity_type": entity_type, "entity_id": entity_id}
            checks.append({"id": active_check, "status": "passed"})

            active_check = "whole-release-withdrawal"
            _exercise_whole_release_withdrawal(database)
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
            evidence["history_sha256_after"] = _assert_immutable_history(database, history_before)
            checks.append({"id": active_check, "status": "passed"})

            active_check = "deterministic-d1-rebuild"
            evidence["operational_state_sha256"] = _state_sha256(database)
            rebuilt, rebuild_duration_ms = _rebuild_database(first, second, database)
            evidence["rebuilt_state_sha256"] = _state_sha256(rebuilt)
            metrics["d1_rebuild_duration_ms"] = rebuild_duration_ms
            _require(
                evidence["operational_state_sha256"] == evidence["rebuilt_state_sha256"],
                "rebuilt D1 state differs from the exercised operational state",
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
