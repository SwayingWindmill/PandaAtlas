from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
MIGRATION_PATH = (
    REPO_ROOT
    / "infra"
    / "supabase"
    / "migrations"
    / "0010_identity_accounts_roles_and_capabilities.sql"
)


def migration_sql() -> str:
    return MIGRATION_PATH.read_text(encoding="utf-8").lower()


def role_capability_pairs(sql: str) -> set[tuple[str, str]]:
    section = sql.split("insert into identity.role_capabilities", 1)[1]
    values = section.split("on conflict (role_key, capability_key)", 1)[0]
    pairs: set[tuple[str, str]] = set()
    for line in values.splitlines():
        stripped = line.strip().rstrip(",")
        if not stripped.startswith("('"):
            continue
        role_key, capability_key = (
            part.strip().strip("()'") for part in stripped.split(",", 1)
        )
        pairs.add((role_key, capability_key))
    return pairs


def test_identity_schema_is_private_append_only_and_revocable() -> None:
    sql = migration_sql()

    assert "create schema if not exists identity" in sql
    assert "create table if not exists identity.role_assignments" in sql
    assert "create table if not exists identity.role_assignment_revocations" in sql
    assert "expires_at timestamptz" in sql
    assert "identity.reject_append_only_mutation" in sql
    assert "before update or delete" in sql
    assert "revoke all on schema identity from public" in sql
    assert "revoke all on schema identity from %i" in sql


def test_administrator_has_only_identity_management_not_domain_inheritance() -> None:
    pairs = role_capability_pairs(migration_sql())
    administrator_capabilities = {
        capability for role, capability in pairs if role == "administrator"
    }

    assert administrator_capabilities == {
        "account.session.read",
        "admin.shell.access",
        "identity.account.manage",
        "identity.role.manage",
    }
    assert administrator_capabilities.isdisjoint(
        {
            "archive.review",
            "archive.batch.publish",
            "archive.sensitive.publish",
            "moderation.review",
            "privacy.operate",
            "audit.export",
        }
    )


def test_sensitive_capabilities_are_explicit_and_independent() -> None:
    sql = migration_sql()
    for capability in (
        "identity.role.manage",
        "identity.account.manage",
        "import.execute",
        "archive.batch.publish",
        "archive.batch.rollback",
        "archive.batch.withdraw",
        "archive.sensitive.publish",
        "privacy.operate",
        "audit.export",
    ):
        assert f"('{capability}'," in sql
