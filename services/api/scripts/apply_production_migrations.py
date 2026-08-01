from __future__ import annotations

import hashlib
import json
import os
import re
from dataclasses import dataclass
from pathlib import Path

import psycopg
from psycopg import Connection

MIGRATION_NAME_PATTERN = re.compile(r"^(?P<version>\d{4})_(?P<name>[a-z0-9_]+)\.sql$")
CHECKSUM_PREFIX = "-- zhipanda-sha256:"
ADVISORY_LOCK_NAME = "zhipanda-production-migrations-v1"


@dataclass(frozen=True)
class Migration:
    version: str
    name: str
    path: Path
    sql: str
    checksum: str


@dataclass(frozen=True)
class MigrationResult:
    newly_applied: tuple[str, ...]
    adopted_legacy: tuple[str, ...]


def normalize_database_url(database_url: str) -> str:
    if database_url.startswith("postgresql+psycopg://"):
        return database_url.replace("postgresql+psycopg://", "postgresql://", 1)
    return database_url


def migration_checksum(sql: str) -> str:
    return hashlib.sha256(sql.encode("utf-8")).hexdigest()


def read_boolean_environment(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    normalized = value.strip().lower()
    if normalized == "true":
        return True
    if normalized == "false":
        return False
    raise RuntimeError(f"{name} must be true or false")


def collect_migrations(directory: Path) -> list[Migration]:
    if not directory.is_dir():
        raise FileNotFoundError(f"Migration directory does not exist: {directory}")

    migrations: list[Migration] = []
    seen_versions: set[str] = set()
    for path in sorted(directory.glob("*.sql")):
        match = MIGRATION_NAME_PATTERN.fullmatch(path.name)
        if match is None:
            raise ValueError(f"Invalid production migration filename: {path.name}")
        version = match.group("version")
        if version in seen_versions:
            raise ValueError(f"Duplicate production migration version: {version}")
        seen_versions.add(version)
        sql = path.read_text(encoding="utf-8-sig")
        if not sql.strip():
            raise ValueError(f"Production migration is empty: {path.name}")
        migrations.append(
            Migration(
                version=version,
                name=match.group("name"),
                path=path,
                sql=sql,
                checksum=migration_checksum(sql),
            )
        )

    if not migrations:
        raise FileNotFoundError(f"No production migrations found in: {directory}")
    return migrations


def checksum_from_statements(statements: list[str] | None) -> str | None:
    for statement in statements or []:
        if statement.startswith(CHECKSUM_PREFIX):
            return statement.removeprefix(CHECKSUM_PREFIX).strip()
    return None


def ensure_history_table(connection: Connection[object]) -> None:
    with connection.cursor() as cursor:
        cursor.execute("create schema if not exists supabase_migrations")
        cursor.execute(
            """
            create table if not exists supabase_migrations.schema_migrations (
              version text primary key
            )
            """
        )
        cursor.execute(
            "alter table supabase_migrations.schema_migrations add column if not exists name text"
        )
        cursor.execute(
            "alter table supabase_migrations.schema_migrations "
            "add column if not exists statements text[]"
        )
    connection.commit()


def read_applied_migrations(
    connection: Connection[object],
) -> dict[str, tuple[str | None, list[str]]]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            select version, name, coalesce(statements, '{}'::text[])
            from supabase_migrations.schema_migrations
            order by version
            """
        )
        rows = cursor.fetchall()
    return {str(version): (name, list(statements)) for version, name, statements in rows}


def apply_migrations(
    connection: Connection[object],
    migrations: list[Migration],
    *,
    adopt_legacy_history: bool = False,
) -> MigrationResult:
    ensure_history_table(connection)
    with connection.cursor() as cursor:
        cursor.execute("select pg_advisory_lock(hashtext(%s))", (ADVISORY_LOCK_NAME,))

    applied = read_applied_migrations(connection)
    newly_applied: list[str] = []
    adopted_legacy: list[str] = []
    for migration in migrations:
        existing = applied.get(migration.version)
        if existing is not None:
            existing_name, existing_statements = existing
            if existing_name and existing_name != migration.name:
                raise RuntimeError(
                    "Applied migration name differs from the repository: "
                    f"{migration.path.name}"
                )
            existing_checksum = checksum_from_statements(existing_statements)
            if existing_checksum is None:
                if not adopt_legacy_history:
                    raise RuntimeError(
                        "Applied migration has no ZhiPanda checksum: "
                        f"{migration.path.name}. Audit the restored migration history, then run "
                        "once with MIGRATION_ADOPT_LEGACY_HISTORY=true."
                    )
                try:
                    with connection.cursor() as cursor:
                        cursor.execute(
                            """
                            update supabase_migrations.schema_migrations
                            set name = %s, statements = %s
                            where version = %s
                            """,
                            (
                                migration.name,
                                [f"{CHECKSUM_PREFIX}{migration.checksum}", migration.sql],
                                migration.version,
                            ),
                        )
                    connection.commit()
                except Exception as error:
                    connection.rollback()
                    raise RuntimeError(
                        f"Failed adopting legacy migration: {migration.path.name}"
                    ) from error
                adopted_legacy.append(migration.version)
                continue
            if existing_checksum != migration.checksum:
                raise RuntimeError(
                    "Applied migration checksum differs from the repository: "
                    f"{migration.path.name}"
                )
            continue

        try:
            with connection.cursor() as cursor:
                cursor.execute(migration.sql)
                cursor.execute(
                    """
                    insert into supabase_migrations.schema_migrations(version, name, statements)
                    values (%s, %s, %s)
                    """,
                    (
                        migration.version,
                        migration.name,
                        [f"{CHECKSUM_PREFIX}{migration.checksum}", migration.sql],
                    ),
                )
            connection.commit()
        except Exception as error:
            connection.rollback()
            raise RuntimeError(f"Failed applying migration: {migration.path.name}") from error
        newly_applied.append(migration.version)
        applied[migration.version] = (
            migration.name,
            [f"{CHECKSUM_PREFIX}{migration.checksum}", migration.sql],
        )
    return MigrationResult(
        newly_applied=tuple(newly_applied),
        adopted_legacy=tuple(adopted_legacy),
    )


def main() -> None:
    app_env = os.getenv("APP_ENV", "").strip().lower()
    if app_env not in {"production", "staging"}:
        raise RuntimeError(
            "APP_ENV must be production or staging for the production migration runner"
        )

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is required")

    default_directory = Path(__file__).resolve().parents[1] / "infra" / "supabase" / "migrations"
    migration_directory = Path(os.getenv("MIGRATIONS_DIR", str(default_directory))).resolve()
    migrations = collect_migrations(migration_directory)
    adopt_legacy_history = read_boolean_environment("MIGRATION_ADOPT_LEGACY_HISTORY")

    with psycopg.connect(normalize_database_url(database_url)) as connection:
        result = apply_migrations(
            connection,
            migrations,
            adopt_legacy_history=adopt_legacy_history,
        )

    print(
        json.dumps(
            {
                "status": "passed",
                "migration_count": len(migrations),
                "newly_applied": result.newly_applied,
                "adopted_legacy": result.adopted_legacy,
                "latest_version": migrations[-1].version,
            },
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
