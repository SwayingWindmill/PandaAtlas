from __future__ import annotations

import argparse
import json
import os
import re
import tomllib
import uuid
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit, urlunsplit

import httpx
import psycopg

REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_CONFIG = REPO_ROOT / "infra" / "supabase" / "config.toml"
DEFAULT_REPORT = REPO_ROOT / ".release-gate" / "zhipanda-foundation.json"
DEFAULT_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
DEFAULT_API_URL = "http://127.0.0.1:54321"
MINIMUM_PGMQ_VERSION = (1, 5, 1)
MAXIMUM_PGMQ_VERSION = (2, 0, 0)
FORBIDDEN_API_SCHEMAS = {"integration", "pgmq", "pgmq_public", "storage"}
HIGH_CONFIDENCE_SECRET_PATTERNS = {
    "supabase-secret-key": re.compile(r"sb_secret_[A-Za-z0-9_-]{12,}"),
    "jwt": re.compile(r"eyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}"),
    "default-admin-token": re.compile(r"ADMIN_API_TOKEN[^\n]*:-[^}\s]+"),
}


class FoundationCheckError(RuntimeError):
    """Raised when a required foundation invariant is not satisfied."""


def utc_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def parse_version(value: str) -> tuple[int, ...]:
    parts = re.findall(r"\d+", value)
    if not parts:
        raise ValueError(f"Version contains no numeric components: {value!r}")
    return tuple(int(part) for part in parts[:4])


def redact_database_url(database_url: str) -> str:
    parsed = urlsplit(database_url.replace("postgresql+psycopg://", "postgresql://", 1))
    hostname = parsed.hostname or ""
    port = f":{parsed.port}" if parsed.port else ""
    username = f"{parsed.username}@" if parsed.username else ""
    return urlunsplit((parsed.scheme, f"{username}{hostname}{port}", parsed.path, "", ""))


def load_config(config_path: Path = DEFAULT_CONFIG) -> dict[str, Any]:
    return tomllib.loads(config_path.read_text(encoding="utf-8"))


def expected_migration_versions(root: Path = REPO_ROOT) -> list[str]:
    migrations = sorted((root / "infra" / "supabase" / "migrations").glob("*.sql"))
    if not migrations:
        raise FoundationCheckError("No Supabase migrations were found")
    return [migration.stem.split("_", 1)[0] for migration in migrations]


def static_configuration_evidence(root: Path = REPO_ROOT) -> dict[str, Any]:
    config_path = root / "infra" / "supabase" / "config.toml"
    package_path = root / "package.json"
    compose_path = root / "docker-compose.yml"
    config = load_config(config_path)
    package = json.loads(package_path.read_text(encoding="utf-8-sig"))
    compose_text = compose_path.read_text(encoding="utf-8-sig")

    api_schemas = set(config.get("api", {}).get("schemas", []))
    exposed_forbidden = sorted(api_schemas & FORBIDDEN_API_SCHEMAS)
    if exposed_forbidden:
        raise FoundationCheckError(
            f"Private schemas exposed through Data API: {', '.join(exposed_forbidden)}"
        )
    if config.get("api", {}).get("auto_expose_new_tables") is not False:
        raise FoundationCheckError("api.auto_expose_new_tables must be false")
    if config.get("db", {}).get("major_version") != 17:
        raise FoundationCheckError("Supabase PostgreSQL major version must remain pinned to 17")
    if config.get("db", {}).get("seed", {}).get("sql_paths") != ["./seed/*.sql"]:
        raise FoundationCheckError("All ordered seed SQL files must run during reset")
    if not config.get("auth", {}).get("enabled"):
        raise FoundationCheckError("Local Supabase Auth must be enabled")
    if not config.get("storage", {}).get("enabled"):
        raise FoundationCheckError("Local Supabase Storage must be enabled")

    cli_version = package.get("devDependencies", {}).get("supabase")
    if cli_version != "2.110.0":
        raise FoundationCheckError("Supabase CLI must be pinned exactly to 2.110.0")

    if "postgis/postgis:" in compose_text:
        raise FoundationCheckError("The legacy plain PostGIS service must not remain in Compose")
    if "ADMIN_API_TOKEN: ${ADMIN_API_TOKEN:?" not in compose_text:
        raise FoundationCheckError(
            "Compose must require ADMIN_API_TOKEN instead of defaulting a token"
        )

    scanned_paths = [config_path, package_path, compose_path]
    secret_findings: list[str] = []
    for path in scanned_paths:
        text = path.read_text(encoding="utf-8-sig")
        for finding_name, pattern in HIGH_CONFIDENCE_SECRET_PATTERNS.items():
            if pattern.search(text):
                secret_findings.append(f"{path.relative_to(root)}:{finding_name}")
    if secret_findings:
        raise FoundationCheckError(
            "High-confidence secret material detected: " + ", ".join(secret_findings)
        )

    return {
        "project_id": config.get("project_id"),
        "postgres_major": config["db"]["major_version"],
        "api_schemas": sorted(api_schemas),
        "supabase_cli": cli_version,
        "migration_versions": expected_migration_versions(root),
        "secret_scan_paths": [str(path.relative_to(root)) for path in scanned_paths],
    }


def _fetch_service_health(api_url: str) -> dict[str, int]:
    endpoints = {
        "auth": f"{api_url.rstrip('/')}/auth/v1/health",
        "storage": f"{api_url.rstrip('/')}/storage/v1/status",
    }
    statuses: dict[str, int] = {}
    with httpx.Client(timeout=10.0, follow_redirects=False) as client:
        for name, endpoint in endpoints.items():
            response = client.get(endpoint)
            statuses[name] = response.status_code
            if response.status_code != 200:
                raise FoundationCheckError(
                    f"{name} health endpoint returned HTTP {response.status_code}"
                )
    return statuses


def _extension_versions(cursor: psycopg.Cursor[Any]) -> dict[str, str]:
    cursor.execute(
        """
        select e.extname, e.extversion
        from pg_extension e
        where e.extname = any(%s)
        order by e.extname
        """,
        (["pgcrypto", "postgis", "pgmq"],),
    )
    return {str(name): str(version) for name, version in cursor.fetchall()}


def _assert_private_role_boundaries(cursor: psycopg.Cursor[Any]) -> dict[str, bool]:
    results: dict[str, bool] = {}
    for role_name in ("anon", "authenticated"):
        cursor.execute("select exists(select 1 from pg_roles where rolname = %s)", (role_name,))
        exists = bool(cursor.fetchone()[0])
        if not exists:
            raise FoundationCheckError(f"Expected Supabase role is missing: {role_name}")
        for schema_name in ("integration", "pgmq"):
            cursor.execute(
                "select has_schema_privilege(%s, %s, 'usage')",
                (role_name, schema_name),
            )
            has_usage = bool(cursor.fetchone()[0])
            results[f"{role_name}:{schema_name}"] = has_usage
            if has_usage:
                raise FoundationCheckError(
                    f"Role {role_name} unexpectedly has USAGE on private schema {schema_name}"
                )
    return results


def _queue_function_names(cursor: psycopg.Cursor[Any]) -> list[str]:
    cursor.execute(
        """
        select distinct p.proname
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'pgmq'
          and p.proname = any(%s)
        order by p.proname
        """,
        (["archive", "create", "drop_queue", "metrics", "read", "send", "set_vt"],),
    )
    return [str(row[0]) for row in cursor.fetchall()]


def _exercise_queue(connection: psycopg.Connection[Any]) -> dict[str, Any]:
    queue_name = f"foundation_smoke_{uuid.uuid4().hex[:12]}"
    expected_functions = {"archive", "create", "drop_queue", "metrics", "read", "send", "set_vt"}
    with connection.cursor() as cursor:
        function_names = set(_queue_function_names(cursor))
        missing = sorted(expected_functions - function_names)
        if missing:
            raise FoundationCheckError(f"Required PGMQ functions are missing: {', '.join(missing)}")

        cursor.execute("select pgmq.create(%s)", (queue_name,))
        cursor.execute(
            "select pgmq.send(%s, %s::jsonb)",
            (queue_name, json.dumps({"event_id": str(uuid.uuid4()), "schema_version": 1})),
        )
        message_id = int(cursor.fetchone()[0])
        cursor.execute("select msg_id, read_ct from pgmq.read(%s, %s, %s)", (queue_name, 30, 1))
        row = cursor.fetchone()
        if row is None or int(row[0]) != message_id or int(row[1]) != 1:
            raise FoundationCheckError(
                "PGMQ read/visibility semantics did not return the sent message"
            )
        cursor.execute("select pgmq.set_vt(%s, %s, %s)", (queue_name, message_id, 0))
        cursor.execute("select pgmq.archive(%s, %s)", (queue_name, message_id))
        if cursor.fetchone()[0] is not True:
            raise FoundationCheckError("PGMQ archive did not acknowledge the message")
        cursor.execute("select queue_length from pgmq.metrics(%s)", (queue_name,))
        queue_length = int(cursor.fetchone()[0])
        if queue_length != 0:
            raise FoundationCheckError("PGMQ queue was not empty after archive")
        cursor.execute("select pgmq.drop_queue(%s)", (queue_name,))
    connection.commit()
    return {"functions": sorted(function_names), "temporary_queue": queue_name}


def _prove_transactional_send(database_url: str) -> int:
    rolled_back_message_id: int
    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                "select pgmq.send(%s, %s::jsonb)",
                (
                    "integration_events",
                    json.dumps({"event_id": str(uuid.uuid4()), "rollback_probe": True}),
                ),
            )
            rolled_back_message_id = int(cursor.fetchone()[0])
        connection.rollback()

    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                "select count(*) from pgmq.q_integration_events where msg_id = %s",
                (rolled_back_message_id,),
            )
            if int(cursor.fetchone()[0]) != 0:
                raise FoundationCheckError("Rolled-back PGMQ send left a visible message")
    return rolled_back_message_id


def database_evidence(database_url: str, root: Path = REPO_ROOT) -> dict[str, Any]:
    normalized_url = database_url.replace("postgresql+psycopg://", "postgresql://", 1)
    with psycopg.connect(normalized_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute("show server_version")
            server_version = str(cursor.fetchone()[0])
            if parse_version(server_version)[0] != 17:
                raise FoundationCheckError(f"Expected PostgreSQL 17, got {server_version}")

            extensions = _extension_versions(cursor)
            missing_extensions = sorted({"pgcrypto", "postgis", "pgmq"} - extensions.keys())
            if missing_extensions:
                raise FoundationCheckError(
                    "Required extensions are missing: " + ", ".join(missing_extensions)
                )
            pgmq_version = parse_version(extensions["pgmq"])
            if pgmq_version < MINIMUM_PGMQ_VERSION or pgmq_version >= MAXIMUM_PGMQ_VERSION:
                raise FoundationCheckError(
                    f"PGMQ {extensions['pgmq']} is outside the supported >=1.5.1,<2.0 range"
                )

            cursor.execute("select to_regclass('integration.outbox_events')::text")
            if cursor.fetchone()[0] != "integration.outbox_events":
                raise FoundationCheckError("Transactional Outbox table is missing")
            cursor.execute("select to_regclass('pgmq.q_integration_events')::text")
            if cursor.fetchone()[0] != "pgmq.q_integration_events":
                raise FoundationCheckError("Logged integration_events queue is missing")
            cursor.execute(
                """
                select c.relpersistence
                from pg_class c
                join pg_namespace n on n.oid = c.relnamespace
                where n.nspname = 'pgmq'
                  and c.relname = 'q_integration_events'
                """
            )
            queue_persistence = cursor.fetchone()
            if queue_persistence is None or queue_persistence[0] != "p":
                raise FoundationCheckError("integration_events must use a logged PostgreSQL table")

            cursor.execute(
                "select public, file_size_limit from storage.buckets where id = %s",
                ("panda-atlas-private",),
            )
            bucket = cursor.fetchone()
            if bucket is None or bool(bucket[0]) or int(bucket[1]) != 52_428_800:
                raise FoundationCheckError("Private Storage bucket is missing or publicly exposed")

            cursor.execute("select count(*) from public.pandas")
            panda_count = int(cursor.fetchone()[0])
            if panda_count < 1:
                raise FoundationCheckError("Seed data did not preserve readable Panda records")
            for relation in (
                "public.change_sets",
                "public.public_release_pointer",
                "public.public_api_release_withdrawals",
            ):
                cursor.execute(f"select count(*) from {relation}")
                cursor.fetchone()

            cursor.execute(
                "select version from supabase_migrations.schema_migrations order by version"
            )
            applied_versions = [str(row[0]) for row in cursor.fetchall()]
            missing_migrations = sorted(
                set(expected_migration_versions(root)) - set(applied_versions)
            )
            if missing_migrations:
                raise FoundationCheckError(
                    "Migrations missing from Supabase history: " + ", ".join(missing_migrations)
                )

            private_role_privileges = _assert_private_role_boundaries(cursor)

        queue_evidence = _exercise_queue(connection)

    rollback_probe_id = _prove_transactional_send(normalized_url)
    return {
        "server_version": server_version,
        "extensions": extensions,
        "applied_migrations": applied_versions,
        "panda_seed_count": panda_count,
        "integration_queue_persistence": str(queue_persistence[0]),
        "private_role_schema_usage": private_role_privileges,
        "queue_smoke": queue_evidence,
        "rolled_back_message_id": rollback_probe_id,
    }


def run_check(
    check_id: str,
    operation: Callable[[], dict[str, Any]],
    checks: list[dict[str, str]],
    evidence: dict[str, Any],
) -> None:
    try:
        result = operation()
    except Exception as error:  # noqa: BLE001 - each check must be reported independently
        checks.append({"id": check_id, "status": "failed", "detail": str(error)})
    else:
        checks.append({"id": check_id, "status": "passed", "detail": "ok"})
        evidence[check_id] = result


def run_foundation_preflight(
    *,
    database_url: str = DEFAULT_DATABASE_URL,
    api_url: str = DEFAULT_API_URL,
    report_path: Path = DEFAULT_REPORT,
    root: Path = REPO_ROOT,
) -> dict[str, Any]:
    checks: list[dict[str, str]] = []
    evidence: dict[str, Any] = {}

    run_check(
        "static-configuration",
        lambda: static_configuration_evidence(root),
        checks,
        evidence,
    )
    run_check("auth-storage-health", lambda: _fetch_service_health(api_url), checks, evidence)
    run_check(
        "database-extensions-migrations-and-queue",
        lambda: database_evidence(database_url, root),
        checks,
        evidence,
    )

    outcome = "passed" if all(check["status"] == "passed" for check in checks) else "failed"
    report = {
        "version": 1,
        "generated_at": utc_now(),
        "outcome": outcome,
        "environment": {
            "database_url": redact_database_url(database_url),
            "api_url": api_url,
        },
        "checks": checks,
        "evidence": evidence,
        "fallback": {
            "transport": "celery+redis",
            "status": "not-implemented",
            "activation": "Only after the PGMQ hard fallback conditions in issue #165 are met.",
        },
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return report


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Verify the pinned ZhiPanda local foundation")
    parser.add_argument(
        "--database-url",
        default=os.getenv("FOUNDATION_DATABASE_URL", DEFAULT_DATABASE_URL),
    )
    parser.add_argument(
        "--api-url",
        default=os.getenv("FOUNDATION_API_URL", DEFAULT_API_URL),
    )
    parser.add_argument(
        "--report",
        type=Path,
        default=Path(os.getenv("FOUNDATION_REPORT", DEFAULT_REPORT)),
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    report = run_foundation_preflight(
        database_url=args.database_url,
        api_url=args.api_url,
        report_path=args.report,
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    raise SystemExit(0 if report["outcome"] == "passed" else 1)


if __name__ == "__main__":
    main()
