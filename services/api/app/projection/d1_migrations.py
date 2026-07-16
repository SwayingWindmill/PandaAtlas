from __future__ import annotations

from pathlib import Path

D1_RELATIONSHIP_MIGRATIONS = (
    "0003_lineage_residency_events.sql",
    "0006_residency_overlap_triggers.sql",
    "0007_residency_overlap_update_trigger.sql",
)

D1_PUBLIC_RELEASE_MIGRATIONS = (
    "0005_versioned_public_releases.sql",
    "0007a_public_releases_immutable_update.sql",
    "0007b_public_releases_immutable_delete.sql",
    "0007c_public_release_records_immutable_update.sql",
    "0007d_public_release_records_immutable_delete.sql",
    "0007e_public_release_withdrawals_immutable_update.sql",
    "0007f_public_release_withdrawals_immutable_delete.sql",
)


def read_d1_migration_bundle(
    repository_root: Path,
    migration_names: tuple[str, ...],
) -> str:
    migrations_directory = repository_root / "infra" / "cloudflare" / "d1" / "migrations"
    return "\n\n".join(
        (migrations_directory / migration_name)
        .read_text(encoding="utf-8-sig")
        .strip()
        for migration_name in migration_names
    ) + "\n"
