from app.main import app


def test_fan_library_routes_are_registered_in_runtime_openapi() -> None:
    paths = app.openapi()["paths"]

    assert "/api/v1/me/follows/{panda_id}" not in paths
    assert "get" in paths["/api/v1/me/favorites"]
    assert {"get", "post", "delete"}.issubset(paths["/api/v1/me/favorites/{panda_id}"])
    assert {"get", "post"}.issubset(paths["/api/v1/me/collections"])
    assert {"patch", "delete"}.issubset(paths["/api/v1/me/collections/{collection_id}"])
    assert {"post", "delete"}.issubset(
        paths["/api/v1/me/collections/{collection_id}/pandas/{panda_id}"]
    )


def test_favorite_and_collection_models_are_distinct_in_openapi() -> None:
    schemas = app.openapi()["components"]["schemas"]

    assert "FavoriteRead" in schemas
    assert "CollectionRead" in schemas
    assert "follow_id" not in schemas["FavoriteRead"]["properties"]
    assert "panda_ids" in schemas["CollectionRead"]["properties"]
