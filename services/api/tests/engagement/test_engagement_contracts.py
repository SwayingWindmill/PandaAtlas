from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.engagement.handles import hash_opaque_handle
from app.identity.models import AccountState, RequestIdentity
from app.identity.security import get_request_identity
from app.main import app

REPO_ROOT = Path(__file__).resolve().parents[4]
MIGRATION = REPO_ROOT / "infra/supabase/migrations/0011_engagement_follow_consent_passport.sql"


def identity(state: AccountState) -> RequestIdentity:
    now = datetime.now(UTC)
    return RequestIdentity(
        account_id=uuid4(),
        email="engagement@example.test",
        session_id=str(uuid4()),
        state=state,
        roles=frozenset({"member"}),
        capabilities=frozenset({"account.session.read"}),
        authenticated_at=now,
        authentication_method="otp",
        issued_at=now,
        expires_at=now + timedelta(hours=1),
        assurance_level="aal1",
        recent_auth=True,
    )


def test_opaque_handle_hash_is_deterministic_and_non_reversible_storage_value() -> None:
    raw = "opaque-follow-handle-for-contract-test"
    hashed = hash_opaque_handle(raw)
    assert len(hashed) == 64
    assert raw not in hashed
    assert hashed == hash_opaque_handle(raw)


def test_engagement_migration_is_private_and_bounded() -> None:
    sql = MIGRATION.read_text(encoding="utf-8")
    assert "create schema if not exists engagement" in sql
    assert "expires_at <= created_at + interval '1 hour'" in sql
    assert "handle_hash text not null unique" in sql
    assert "continuation_handle_hash text unique" in sql
    assert "account_subject_hash" in sql
    assert "passport_contribution_events" in sql
    assert "relationship_state engagement.follow_state," in sql
    assert "trg_passport_contribution_events_immutable_updates" in sql
    assert "before update on engagement.passport_contribution_events" in sql
    assert "revoke all on schema engagement from public" in sql
    assert "revoke all on schema engagement from %I" in sql
    assert not any(line.lstrip().lower().startswith("grant ") for line in sql.splitlines())


def test_engagement_routes_hide_when_feature_is_disabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "engagement_enabled", False)
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/follow-intents",
            json={
                "panda_id": "fixture",
                "locale": "zh",
                "return_path": "/zh/atlas/fixture",
                "request_id": str(uuid4()),
            },
        )
    assert response.status_code == 404
    assert response.json() == {"detail": "Not found"}


def test_deleting_account_cannot_create_follow(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "engagement_enabled", True)
    app.dependency_overrides[get_request_identity] = lambda: identity(AccountState.DELETING)
    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/v1/me/follows/fixture",
                json={"idempotency_key": "deleting-account-follow"},
            )
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 403
    assert response.json() == {"detail": "Account is unavailable"}
