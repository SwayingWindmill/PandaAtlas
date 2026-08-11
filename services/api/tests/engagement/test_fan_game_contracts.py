from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
MIGRATION_0037 = (
    REPO_ROOT
    / "infra"
    / "supabase"
    / "migrations"
    / "0037_guess_panda_attempt_history.sql"
)


def test_game_attempt_history_is_private_and_optional() -> None:
    migration = MIGRATION_0037.read_text(encoding="utf-8")

    assert "create table if not exists engagement.game_attempts" in migration
    assert "game_type = 'guess_panda'" in migration
    assert "revoke all on engagement.game_attempts from public" in migration
    assert "revoke all on engagement.game_attempts from %I" in migration
    assert "Anonymous play remains persistence-free" in migration
    assert "grant select" not in migration.lower()
    assert "grant insert" not in migration.lower()
