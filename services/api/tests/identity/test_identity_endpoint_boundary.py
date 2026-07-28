from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.api.v1.identity import create_role_assignment
from app.core.config import settings
from app.identity.models import AccountState, RequestIdentity
from app.identity.security import get_optional_request_identity, get_request_identity
from app.main import app
from app.schemas.identity import RoleAssignmentCreate


def make_identity(*capabilities: str) -> RequestIdentity:
    now = datetime.now(UTC)
    return RequestIdentity(
        account_id=uuid4(),
        email="operator@example.test",
        session_id=str(uuid4()),
        state=AccountState.ACTIVE,
        roles=frozenset({"fixture"}),
        capabilities=frozenset(capabilities),
        authenticated_at=now,
        authentication_method="otp",
        issued_at=now,
        expires_at=now + timedelta(hours=1),
        assurance_level="aal1",
        recent_auth=True,
    )


def test_identity_session_does_not_depend_on_public_release(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    identity = make_identity("account.session.read")

    def fail_release_lookup() -> None:
        raise AssertionError("identity session consulted public release state")

    monkeypatch.setattr("app.main.get_current_release_metadata", fail_release_lookup)
    app.dependency_overrides[get_request_identity] = lambda: identity
    try:
        with TestClient(app) as client:
            response = client.get("/api/v1/identity/session")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["account_id"] == str(identity.account_id)
    assert "x-pandaatlas-dataset-version" not in response.headers


def test_admin_session_hides_missing_capability(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    identity = make_identity("account.session.read")
    monkeypatch.setattr(settings, "admin_shell_enabled", True)
    monkeypatch.setattr("app.identity.security._record_decision", lambda *args, **kwargs: None)
    app.dependency_overrides[get_optional_request_identity] = lambda: identity
    try:
        with TestClient(app) as client:
            response = client.get("/api/v1/admin/session")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 404
    assert response.json() == {"detail": "Not found"}


def test_admin_session_returns_effective_capabilities(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    identity = make_identity("account.session.read", "admin.shell.access")
    monkeypatch.setattr(settings, "admin_shell_enabled", True)
    app.dependency_overrides[get_optional_request_identity] = lambda: identity
    try:
        with TestClient(app) as client:
            response = client.get("/api/v1/admin/session")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["capabilities"] == [
        "account.session.read",
        "admin.shell.access",
    ]


def test_role_manager_cannot_assign_a_role_to_self() -> None:
    actor = make_identity("identity.role.manage")
    payload = RoleAssignmentCreate(
        account_id=actor.account_id,
        role_key="reviewer",
        reason="Self-elevation must be rejected by the command boundary.",
        idempotency_key="self-role-assignment-178",
    )

    with pytest.raises(HTTPException) as denied:
        create_role_assignment(payload, actor, uuid4())

    assert denied.value.status_code == 403
    assert denied.value.detail == "Self-assignment of roles is not allowed"
