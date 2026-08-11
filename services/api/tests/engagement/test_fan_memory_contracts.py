from pathlib import Path

from app.schemas.engagement import LocationCheckinCreate, SeenPandaUpsert

MIGRATION_0035 = (
    Path(__file__).resolve().parents[4]
    / "infra"
    / "supabase"
    / "migrations"
    / "0035_fan_checkins_and_seen_pandas.sql"
)


def test_fan_memory_tables_are_private_and_distinct() -> None:
    migration = MIGRATION_0035.read_text(encoding="utf-8")

    for table in ("location_checkins", "seen_pandas"):
        assert f"create table if not exists engagement.{table}" in migration
        assert f"revoke all on engagement.{table} from public" in migration
        assert f"revoke all on engagement.{table} from %I" in migration

    assert "place visit does not imply seeing a panda" in migration
    assert "grant select" not in migration.lower()
    assert "grant insert" not in migration.lower()
    assert "grant update" not in migration.lower()
    assert "grant delete" not in migration.lower()


def test_checkin_and_seen_panda_transport_contracts_are_independent() -> None:
    checkin = LocationCheckinCreate.model_json_schema()["properties"]
    seen = SeenPandaUpsert.model_json_schema()["properties"]

    assert {"place_id", "visited_on", "note"} == set(checkin)
    assert {"seen_on", "place_id", "note"} == set(seen)
    assert "panda_id" not in checkin
    assert "visited_on" not in seen
