from app.main import app


def test_admin_content_routes_are_explicit_product_commands() -> None:
    paths = app.openapi()["paths"]

    assert "get" in paths["/api/v1/admin/content/dashboard"]
    assert {"get", "post"}.issubset(paths["/api/v1/admin/content/pandas"])
    assert "get" in paths["/api/v1/admin/content/pandas/{panda_id}"]
    assert "post" in paths["/api/v1/admin/content/pandas/{panda_id}/change-sets"]
    for module in ("names", "parents", "residencies", "events", "sources", "media"):
        assert "post" in paths[f"/api/v1/admin/content/pandas/{{panda_id}}/{module}"]
    assert "post" in paths[
        "/api/v1/admin/content/pandas/{panda_id}/change-sets/{change_set_id}/validate"
    ]
    assert "post" in paths[
        "/api/v1/admin/content/pandas/{panda_id}/change-sets/{change_set_id}/publish"
    ]
    assert "post" in paths[
        "/api/v1/admin/content/pandas/{panda_id}/change-sets/{change_set_id}/reopen"
    ]
    assert "get" in paths["/api/v1/admin/content/centers/{domain}"]


def test_admin_panda_create_is_minimal_draft_identity_contract() -> None:
    schema = app.openapi()["components"]["schemas"]["AdminPandaCreate"]
    properties = schema["properties"]

    assert set(properties) == {"name_zh", "slug", "gender", "birth_date"}
    assert set(schema["required"]) == {"name_zh", "slug"}
    assert "publication_status" not in properties
    assert "published" not in properties


def test_admin_panda_basic_edit_creates_change_set_instead_of_generic_patch() -> None:
    paths = app.openapi()["paths"]

    assert "patch" not in paths["/api/v1/admin/content/pandas/{panda_id}"]
    command_schema = app.openapi()["components"]["schemas"]["AdminPandaBasicChange"]
    assert "reason" in command_schema["required"]
