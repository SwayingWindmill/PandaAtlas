import json

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

client = TestClient(app)
EDITOR_ID = "11111111-1111-4111-8111-111111111111"
REVIEWER_ID = "22222222-2222-4222-8222-222222222222"


def _payload() -> dict[str, object]:
    return {
        "title": "Authenticated workflow request",
        "reason": "Verify actor-bound authentication",
        "revisions": [
            {
                "entity_type": "panda",
                "entity_id": "2939c16f-1938-5629-928c-b36b1d5cd6ed",
                "payload": {
                    "public_record": {"birthplace": "Sichuan"},
                    "publication_checks": {
                        "references": [],
                        "residencies": [],
                        "translations": [],
                        "sources": [],
                        "media": [],
                    },
                },
            }
        ],
    }


def test_workflow_actor_token_cannot_be_spoofed(monkeypatch) -> None:
    monkeypatch.setattr(
        settings,
        "workflow_actor_tokens_json",
        json.dumps({EDITOR_ID: "editor-secret", REVIEWER_ID: "reviewer-secret"}),
    )
    response = client.post(
        "/api/v1/admin/change-sets",
        headers={
            "Authorization": "Bearer editor-secret",
            "X-Actor-Id": REVIEWER_ID,
        },
        json=_payload(),
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Workflow actor does not match bearer token"


def test_workflow_write_requires_authoritative_database(monkeypatch) -> None:
    monkeypatch.setattr(
        settings,
        "workflow_actor_tokens_json",
        json.dumps({EDITOR_ID: "editor-secret"}),
    )
    response = client.post(
        "/api/v1/admin/change-sets",
        headers={
            "Authorization": "Bearer editor-secret",
            "X-Actor-Id": EDITOR_ID,
        },
        json=_payload(),
    )
    assert response.status_code == 503
    assert response.json()["detail"] == "Authoritative database unavailable"


def test_duplicate_actor_tokens_are_rejected(monkeypatch) -> None:
    monkeypatch.setattr(
        settings,
        "workflow_actor_tokens_json",
        json.dumps({EDITOR_ID: "shared-secret", REVIEWER_ID: "shared-secret"}),
    )
    response = client.post(
        "/api/v1/admin/change-sets",
        headers={
            "Authorization": "Bearer shared-secret",
            "X-Actor-Id": EDITOR_ID,
        },
        json=_payload(),
    )
    assert response.status_code == 503
    assert response.json()["detail"] == "WORKFLOW_ACTOR_TOKENS_JSON is invalid"
