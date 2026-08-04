from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.api.v1.privacy import (
    require_privacy_status_identity,
    require_recent_privacy_requester,
)
from app.core.config import settings
from app.identity.models import AccountState, RequestIdentity
from app.main import app


def _identity(
    *,
    state: AccountState = AccountState.ACTIVE,
    recent_auth: bool = True,
) -> RequestIdentity:
    now = datetime.now(UTC)
    return RequestIdentity(
        account_id=uuid4(),
        email="privacy-boundary@example.invalid",
        session_id=str(uuid4()),
        state=state,
        roles=frozenset({"member"}),
        capabilities=frozenset({"account.session.read"}),
        authenticated_at=now if recent_auth else now - timedelta(hours=1),
        authentication_method="otp",
        issued_at=now,
        expires_at=now + timedelta(hours=1),
        assurance_level="aal1",
        recent_auth=recent_auth,
    )


def test_privacy_flag_rolls_back_before_authentication_or_database_access(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "privacy_operations_enabled", False)

    with TestClient(app) as client:
        response = client.get("/api/v1/privacy/requests")

    assert response.status_code == 404
    assert response.json() == {"detail": "Not found"}


def test_privacy_request_creation_requires_recent_authentication() -> None:
    with pytest.raises(HTTPException) as denied:
        require_recent_privacy_requester(_identity(recent_auth=False))

    assert denied.value.status_code == 403
    assert denied.value.detail == "Authentication within the last 15 minutes is required"


def test_deleting_account_can_read_privacy_request_status() -> None:
    identity = _identity(state=AccountState.DELETING)

    assert require_privacy_status_identity(identity) is identity


def test_deleting_account_cannot_create_another_privacy_request() -> None:
    with pytest.raises(HTTPException) as denied:
        require_recent_privacy_requester(_identity(state=AccountState.DELETING))

    assert denied.value.status_code == 403
    assert denied.value.detail == "Account is unavailable"
