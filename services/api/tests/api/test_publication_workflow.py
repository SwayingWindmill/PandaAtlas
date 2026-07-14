import json
from uuid import UUID

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

client = TestClient(app)
EDITOR_ID = "11111111-1111-4111-8111-111111111111"
REVIEWER_ID = "22222222-2222-4222-8222-222222222222"
PUBLISHER_ID = "33333333-3333-4333-8333-333333333333"


def _headers(actor_id: str) -> dict[str, str]:
    return {
        "Authorization": "Bearer dev-admin-token",
        "X-Actor-Id": actor_id,
    }


def _create_change_set(title: str) -> dict[str, object]:
    response = client.post(
        "/api/v1/admin/change-sets",
        headers=_headers(EDITOR_ID),
        json={
            "title": title,
            "reason": "Curator correction backed by reviewed sources",
            "revisions": [
                {
                    "entity_type": "panda",
                    "entity_id": title.lower().replace(" ", "-"),
                    "payload": {"publication_checks": {}},
                }
            ],
        },
    )
    assert response.status_code == 201
    return response.json()


def _submit_and_review(change_set_id: str, decision: str = "approved") -> dict[str, object]:
    submitted = client.post(
        f"/api/v1/admin/change-sets/{change_set_id}/submit",
        headers=_headers(EDITOR_ID),
    )
    assert submitted.status_code == 200
    assert submitted.json()["status"] == "submitted"

    reviewed = client.post(
        f"/api/v1/admin/change-sets/{change_set_id}/reviews",
        headers=_headers(REVIEWER_ID),
        json={"decision": decision, "reason": "Independent source review complete"},
    )
    assert reviewed.status_code == 200
    return reviewed.json()


def _create_and_publish_batch(change_set_id: str, data_version: str) -> dict[str, object]:
    created = client.post(
        "/api/v1/admin/publication-batches",
        headers=_headers(PUBLISHER_ID),
        json={
            "change_set_ids": [change_set_id],
            "public_schema_version": "1.0.0",
            "data_version": data_version,
            "reason": "Publish independently reviewed archive changes",
            "correlation_id": str(UUID(int=int(data_version.split(".")[-1]))),
        },
    )
    assert created.status_code == 201
    batch = created.json()

    preview = client.get(
        f"/api/v1/admin/publication-batches/{batch['id']}/preview",
        headers=_headers(PUBLISHER_ID),
    )
    assert preview.status_code == 200
    assert preview.json() == {"is_publishable": True, "issues": []}

    published = client.post(
        f"/api/v1/admin/publication-batches/{batch['id']}/publish",
        headers=_headers(PUBLISHER_ID),
    )
    assert published.status_code == 200
    assert published.json()["status"] == "published"
    assert published.json()["published_by"] == PUBLISHER_ID
    return published.json()


def test_four_eyes_publication_lifecycle_end_to_end() -> None:
    rejected = _create_change_set("Rejected revision")
    assert rejected["status"] == "draft"

    submitted = client.post(
        f"/api/v1/admin/change-sets/{rejected['id']}/submit",
        headers=_headers(EDITOR_ID),
    )
    assert submitted.status_code == 200

    self_review = client.post(
        f"/api/v1/admin/change-sets/{rejected['id']}/reviews",
        headers=_headers(EDITOR_ID),
        json={"decision": "approved", "reason": "Approve my own work"},
    )
    assert self_review.status_code == 409
    assert "independent reviewer" in self_review.json()["detail"]

    rejection = client.post(
        f"/api/v1/admin/change-sets/{rejected['id']}/reviews",
        headers=_headers(REVIEWER_ID),
        json={"decision": "rejected", "reason": "Source date is ambiguous"},
    )
    assert rejection.status_code == 200
    assert rejection.json()["status"] == "rejected"

    rejected_batch = client.post(
        "/api/v1/admin/publication-batches",
        headers=_headers(PUBLISHER_ID),
        json={
            "change_set_ids": [rejected["id"]],
            "public_schema_version": "1.0.0",
            "data_version": "2026.07.14.0",
            "reason": "Must fail",
            "correlation_id": "00000000-0000-4000-8000-000000000010",
        },
    )
    assert rejected_batch.status_code == 409

    first = _create_change_set("First approved revision")
    first_approved = _submit_and_review(str(first["id"]))
    assert first_approved["status"] == "approved"
    first_batch = _create_and_publish_batch(str(first["id"]), "2026.07.14.1")

    second = _create_change_set("Second approved revision")
    second_approved = _submit_and_review(str(second["id"]))
    assert second_approved["status"] == "approved"
    _create_and_publish_batch(str(second["id"]), "2026.07.14.2")

    rollback = client.post(
        f"/api/v1/admin/publication-batches/{first_batch['id']}/rollback",
        headers=_headers(PUBLISHER_ID),
        json={
            "reason": "Regression in the newer public release",
            "correlation_id": "00000000-0000-4000-8000-000000000003",
            "data_version": "2026.07.14.3",
        },
    )
    assert rollback.status_code == 201
    assert rollback.json()["operation"] == "rollback"
    assert rollback.json()["rollback_target_id"] == first_batch["id"]

    withdrawal = client.post(
        f"/api/v1/admin/publication-batches/{rollback.json()['id']}/withdraw",
        headers=_headers(PUBLISHER_ID),
        json={
            "reason": "Emergency copyright withdrawal",
            "correlation_id": "00000000-0000-4000-8000-000000000004",
            "data_version": "2026.07.14.4",
        },
    )
    assert withdrawal.status_code == 201
    assert withdrawal.json()["operation"] == "withdrawal"
    assert withdrawal.json()["withdrawal_target_id"] == rollback.json()["id"]


def test_production_actor_identity_is_bound_to_the_bearer_token(monkeypatch) -> None:
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(
        settings,
        "workflow_actor_tokens_json",
        json.dumps(
            {
                EDITOR_ID: "editor-secret",
                REVIEWER_ID: "reviewer-secret",
            }
        ),
    )
    response = client.post(
        "/api/v1/admin/change-sets",
        headers={
            "Authorization": "Bearer editor-secret",
            "X-Actor-Id": REVIEWER_ID,
        },
        json={
            "title": "Spoofed actor",
            "reason": "Must not be accepted",
            "revisions": [
                {
                    "entity_type": "panda",
                    "entity_id": "spoofed-actor",
                    "payload": {"publication_checks": {}},
                }
            ],
        },
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Workflow actor does not match bearer token"
