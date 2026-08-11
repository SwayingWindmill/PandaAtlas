from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
MIGRATION = (
    REPO_ROOT
    / "infra"
    / "supabase"
    / "migrations"
    / "0038_admin_product_role_alignment.sql"
)


def test_administrator_includes_ordinary_editor_authority_only() -> None:
    migration = MIGRATION.read_text(encoding="utf-8")

    for capability in (
        "archive.change_set.create",
        "archive.accountable.validate",
        "archive.accountable.publish",
        "archive.accountable.metrics",
        "archive.workbench.read",
    ):
        assert f"('administrator', '{capability}')" in migration

    for capability in (
        "archive.sensitive.merge_split",
        "archive.sensitive.takedown",
        "moderation.review",
        "privacy.operate",
        "audit.export",
    ):
        assert f"('administrator', '{capability}')" not in migration
