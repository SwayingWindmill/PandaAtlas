from app.main import app


def test_fan_memory_routes_are_registered_in_runtime_openapi() -> None:
    paths = app.openapi()["paths"]

    assert {"get", "post"}.issubset(paths["/api/v1/me/checkins"])
    assert "delete" in paths["/api/v1/me/checkins/{checkin_id}"]
    assert "get" in paths["/api/v1/me/seen-pandas"]
    assert {"get", "put", "delete"}.issubset(paths["/api/v1/me/seen-pandas/{panda_id}"])


def test_fan_memory_models_keep_checkins_and_seen_pandas_distinct() -> None:
    schemas = app.openapi()["components"]["schemas"]

    assert "LocationCheckinRead" in schemas
    assert "SeenPandaRead" in schemas
    assert "panda_id" not in schemas["LocationCheckinRead"]["properties"]
    assert "place_id" in schemas["SeenPandaRead"]["properties"]
