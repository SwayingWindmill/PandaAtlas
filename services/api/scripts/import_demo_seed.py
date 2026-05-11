import os
from pathlib import Path

import psycopg


def get_repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def collect_sql_paths(directory: Path) -> list[Path]:
    sql_paths = sorted(directory.glob("*.sql"))
    if not sql_paths:
        raise FileNotFoundError(f"No SQL files found in: {directory}")
    return sql_paths


def get_seed_paths(root_dir: Path | None = None) -> list[Path]:
    resolved_root = root_dir or get_repo_root()
    seed_dir = resolved_root / "infra" / "supabase" / "seed"
    return collect_sql_paths(seed_dir)


def read_sql_file(sql_path: Path) -> str:
    return sql_path.read_text(encoding="utf-8").lstrip("\ufeff")


def normalize_database_url(database_url: str) -> str:
    if database_url.startswith("postgresql+psycopg://"):
        return database_url.replace("postgresql+psycopg://", "postgresql://", 1)
    return database_url


def apply_sql_files(database_url: str, sql_paths: list[Path]) -> None:
    with psycopg.connect(normalize_database_url(database_url)) as conn:
        for sql_path in sql_paths:
            sql = read_sql_file(sql_path)
            try:
                with conn.cursor() as cursor:
                    cursor.execute(sql)
                conn.commit()
            except Exception as exc:
                conn.rollback()
                raise RuntimeError(f"Failed applying SQL file: {sql_path}") from exc
            print(f"Applied SQL file: {sql_path}")


def resolve_database_url() -> str:
    database_url = os.getenv("REAL_DB_URL") or os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL or REAL_DB_URL is required")
    return database_url


def main() -> None:
    apply_sql_files(resolve_database_url(), get_seed_paths())


if __name__ == "__main__":
    main()
