from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.identity.models import AccountState, RequestIdentity
from app.identity.security import get_optional_request_identity
from app.main import app


def _admin_identity() -> RequestIdentity:
    now = datetime.now(UTC)
    return RequestIdentity(
        account_id=uuid4(),
        email="map-close-operator@example.invalid",
        session_id=str(uuid4()),
        state=AccountState.ACTIVE,
        roles=frozenset({"administrator"}),
        capabilities=frozenset({"account.session.read", "admin.shell.access"}),
        authenticated_at=now,
        authentication_method="otp",
        issued_at=now,
        expires_at=now + timedelta(hours=1),
        assurance_level="aal1",
        recent_auth=True,
    )


def test_identity_flag_rolls_back_to_safe_404(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "identity_auth_enabled", False)
    with TestClient(app) as client:
        response = client.get("/api/v1/identity/session")
    assert response.status_code == 404
    assert response.json() == {"detail": "Not found"}


def test_engagement_flag_rolls_back_before_database_access(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "engagement_enabled", False)
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/follow-intents",
            json={
                "panda_id": "00000000-0000-4000-8000-000000000181",
                "locale": "zh",
                "return_path": "/zh/pandas/ignored",
                "request_id": str(uuid4()),
            },
        )
    assert response.status_code == 404
    assert response.json() == {"detail": "Not found"}


def test_admin_shell_flag_revokes_shell_without_revoking_identity(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    identity = _admin_identity()
    monkeypatch.setattr(settings, "admin_shell_enabled", False)
    app.dependency_overrides[get_optional_request_identity] = lambda: identity
    try:
        with TestClient(app) as client:
            response = client.get("/api/v1/admin/session")
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 404
    assert response.json() == {"detail": "Not found"}
