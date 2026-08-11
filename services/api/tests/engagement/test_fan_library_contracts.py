from pathlib import Path

from app.schemas.engagement import CollectionCreate, CollectionRead, FavoriteRead

MIGRATION_0034 = (
    Path(__file__).resolve().parents[4]
    / "infra"
    / "supabase"
    / "migrations"
    / "0034_fan_favorites_and_collections.sql"
)


def test_fan_library_tables_are_private_and_bounded() -> None:
    migration = MIGRATION_0034.read_text(encoding="utf-8")

    for table in ("collections", "collection_pandas"):
        assert f"create table if not exists engagement.{table}" in migration
        assert f"revoke all on engagement.{table} from public" in migration
        assert f"revoke all on engagement.{table} from %I" in migration

    assert "create table if not exists engagement.favorites" not in migration
    assert "grant select" not in migration.lower()
    assert "grant insert" not in migration.lower()
    assert "grant update" not in migration.lower()
    assert "grant delete" not in migration.lower()


def test_favorite_and_collection_transport_models_keep_distinct_semantics() -> None:
    favorite_schema = FavoriteRead.model_json_schema()
    collection_schema = CollectionRead.model_json_schema()

    assert set(favorite_schema["required"]) == {"panda_id", "favorited_at"}
    assert set(collection_schema["required"]) == {
        "collection_id",
        "name",
        "panda_ids",
        "created_at",
        "updated_at",
    }
    assert "state" not in favorite_schema.get("properties", {})
    assert "follow_id" not in favorite_schema.get("properties", {})


def test_collection_name_has_a_bounded_transport_contract() -> None:
    schema = CollectionCreate.model_json_schema()["properties"]["name"]

    assert schema["minLength"] == 1
    assert schema["maxLength"] == 80
