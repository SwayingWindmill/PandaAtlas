from app.main import app


def test_admin_media_private_upload_routes_are_explicit() -> None:
    paths = app.openapi()["paths"]

    assert "post" in paths["/api/v1/admin/media/upload-url"]
    assert "get" in paths["/api/v1/admin/media/uploads"]
    assert "post" in paths["/api/v1/admin/media/uploads/{upload_id}"]


def test_admin_media_upload_reservation_does_not_expose_storage_paths() -> None:
    schema = app.openapi()["components"]["schemas"]["AdminMediaUploadReservationRead"]
    fields = set(schema["properties"])

    assert fields == {"upload_id", "upload_reference", "expires_at", "upload_path", "state"}
    assert "storage_bucket" not in fields
    assert "storage_object_key" not in fields
