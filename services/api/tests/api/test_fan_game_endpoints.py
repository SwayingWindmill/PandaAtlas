from app.main import app


def test_game_attempt_routes_are_registered_in_runtime_openapi() -> None:
    paths = app.openapi()["paths"]

    assert {"get", "post"}.issubset(paths["/api/v1/me/game-attempts"])
    assert "delete" in paths["/api/v1/me/game-attempts/{attempt_id}"]


def test_game_attempt_contract_does_not_accept_client_correctness() -> None:
    schema = app.openapi()["components"]["schemas"]["GameAttemptCreate"]
    properties = schema["properties"]

    assert set(properties) == {
        "target_panda_id",
        "selected_panda_id",
        "public_release_version",
    }
    assert "correct" not in properties
