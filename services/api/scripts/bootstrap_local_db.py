from pathlib import Path

import psycopg
from import_demo_seed import (
    apply_sql_files,
    collect_sql_paths,
    get_repo_root,
    get_seed_paths,
    normalize_database_url,
    resolve_database_url,
)

LOCAL_AUTH_COMPAT_SQL = """
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select null::uuid
$$;
"""


def get_migration_paths(root_dir: Path | None = None) -> list[Path]:
    resolved_root = root_dir or get_repo_root()
    migration_dir = resolved_root / "infra" / "supabase" / "migrations"
    return collect_sql_paths(migration_dir)


def ensure_clean_target(database_url: str) -> None:
    project_tables = [
        "public.pandas",
        "public.habitats",
        "public.sightings",
        "public.distribution_snapshots",
        "public.distribution_cells",
        "public.media_assets",
        "public.panda_media",
        "public.admin_import_jobs",
        "public.user_roles",
    ]
    project_types = [
        "panda_status",
        "sighting_source_type",
        "distribution_layer",
        "import_job_status",
        "app_user_role",
    ]

    with psycopg.connect(normalize_database_url(database_url)) as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                select coalesce(array_agg(name order by name), '{}'::text[])
                from (
                  select rel_name as name
                  from unnest(%s::text[]) as rel_name
                  where to_regclass(rel_name) is not null
                ) existing_tables
                """
                ,
                (project_tables,),
            )
            existing_tables = cursor.fetchone()
            cursor.execute(
                """
                select coalesce(array_agg(t.typname order by t.typname), '{}'::text[])
                from pg_type t
                join pg_namespace n on n.oid = t.typnamespace
                where n.nspname = 'public'
                  and t.typname = any(%s::text[])
                """,
                (project_types,),
            )
            existing_types = cursor.fetchone()

    existing_table_names = existing_tables[0] if existing_tables else []
    existing_type_names = existing_types[0] if existing_types else []

    if existing_table_names or existing_type_names:
        details = []
        if existing_table_names:
            details.append(f"tables: {', '.join(existing_table_names)}")
        if existing_type_names:
            details.append(f"types: {', '.join(existing_type_names)}")
        joined_details = "; ".join(details)
        raise RuntimeError(
            "Target database already contains Panda Atlas schema artifacts. "
            "Reset the local DB before running bootstrap_local_db.py. "
            f"Existing artifacts: {joined_details}."
        )


def ensure_local_auth_compat(database_url: str) -> None:
    with psycopg.connect(normalize_database_url(database_url)) as conn:
        with conn.cursor() as cursor:
            cursor.execute(LOCAL_AUTH_COMPAT_SQL)
        conn.commit()


def main() -> None:
    database_url = resolve_database_url()
    root_dir = get_repo_root()
    migration_paths = get_migration_paths(root_dir)
    seed_paths = get_seed_paths(root_dir)

    ensure_clean_target(database_url)
    ensure_local_auth_compat(database_url)

    apply_sql_files(database_url, migration_paths)
    apply_sql_files(database_url, seed_paths)

    target_dir = root_dir / "infra" / "supabase"
    print(
        "Bootstrap completed using "
        f"{len(migration_paths)} migrations and {len(seed_paths)} seed files "
        f"from {target_dir}"
    )


if __name__ == "__main__":
    main()
