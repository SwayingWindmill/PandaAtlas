from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from sqlalchemy import text

from app.core.config import settings
from app.db.session import configure_database, session_scope

MIGRATIONS_DIR = Path(__file__).resolve().parents[3] / "infra" / "supabase" / "migrations"
REQUIRED_EXTENSIONS = {"pgmq", "postgis"}
REQUIRED_RELATIONS = {
    "identity.accounts",
    "integration.outbox_events",
    "public.archive_release_pointer",
    "public.archive_validation_results",
    "public.change_sets",
    "public.entity_revisions",
    "public.public_release_pointer",
    "public.publication_batches",
}
PRIVATE_SCHEMAS = {
    "audit",
    "engagement",
    "identity",
    "integration",
    "notification",
    "privacy",
    "review_moderation",
}
BROWSER_ROLES = ("anon", "authenticated")


def expected_migrations(migrations_dir: Path = MIGRATIONS_DIR) -> tuple[str, ...]:
    return tuple(
        sorted(
            {
                path.name.split("_", 1)[0]
                for path in migrations_dir.iterdir()
                if path.is_file()
                and path.suffix == ".sql"
                and "_" in path.name
                and path.name.split("_", 1)[0].isdigit()
            }
        )
    )


def _emit(payload: dict[str, Any]) -> None:
    print(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True))


def main() -> int:
    configure_database(settings.database_url)
    failures: list[str] = []
    evidence: dict[str, Any] = {}
    tracked_migrations = expected_migrations()
    with session_scope() as session:
        if session is None:
            _emit({"outcome": "failed", "failures": ["database session unavailable"]})
            return 1

        migrations = tuple(
            str(row[0])
            for row in session.execute(
                text(
                    """
                    select version
                    from supabase_migrations.schema_migrations
                    order by version
                    """
                )
            )
        )
        evidence["migration_versions"] = list(migrations)
        if migrations != tracked_migrations:
            failures.append(
                f"migration history differs: expected {tracked_migrations}, got {migrations}"
            )

        extensions = {
            str(row[0])
            for row in session.execute(
                text("select extname from pg_extension where extname = any(:names)"),
                {"names": sorted(REQUIRED_EXTENSIONS)},
            )
        }
        evidence["extensions"] = sorted(extensions)
        missing_extensions = sorted(REQUIRED_EXTENSIONS - extensions)
        if missing_extensions:
            failures.append(f"missing extensions: {missing_extensions}")

        relations = {
            relation: session.execute(
                text("select to_regclass(:relation) is not null"),
                {"relation": relation},
            ).scalar_one()
            for relation in sorted(REQUIRED_RELATIONS)
        }
        evidence["relations"] = relations
        missing_relations = [name for name, present in relations.items() if not present]
        if missing_relations:
            failures.append(f"missing relations: {missing_relations}")

        seed_counts = {
            "pandas": int(
                session.execute(text("select count(*) from public.pandas")).scalar_one()
            ),
            "publication_batches": int(
                session.execute(
                    text("select count(*) from public.publication_batches")
                ).scalar_one()
            ),
        }
        evidence["seed_counts"] = seed_counts
        if any(seed_counts.values()):
            failures.append(f"seedless database contains application data: {seed_counts}")

        pointers = session.execute(
            text(
                """
                select
                  archive.latest_release_id,
                  public_pointer.active_batch_id
                from public.archive_release_pointer archive
                cross join public.public_release_pointer public_pointer
                where archive.singleton = true and public_pointer.singleton = true
                """
            )
        ).mappings().one()
        evidence["pointers"] = {
            "archive_release_id": (
                str(pointers["latest_release_id"])
                if pointers["latest_release_id"] is not None
                else None
            ),
            "public_release_id": (
                str(pointers["active_batch_id"])
                if pointers["active_batch_id"] is not None
                else None
            ),
        }
        if pointers["latest_release_id"] is not None or pointers["active_batch_id"] is not None:
            failures.append("seedless release pointers must start empty")

        browser_privileges: dict[str, dict[str, bool]] = {}
        for role in BROWSER_ROLES:
            browser_privileges[role] = {
                schema: bool(
                    session.execute(
                        text("select has_schema_privilege(:role, :schema, 'usage')"),
                        {"role": role, "schema": schema},
                    ).scalar_one()
                )
                for schema in sorted(PRIVATE_SCHEMAS)
            }
        evidence["browser_schema_usage"] = browser_privileges
        leaked = [
            f"{role}:{schema}"
            for role, schemas in browser_privileges.items()
            for schema, allowed in schemas.items()
            if allowed
        ]
        if leaked:
            failures.append(f"browser roles can use private schemas: {leaked}")

    outcome = "passed" if not failures else "failed"
    _emit({"outcome": outcome, "failures": failures, "evidence": evidence})
    return 0 if not failures else 1


if __name__ == "__main__":
    raise SystemExit(main())
