from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.identity.models import (
    AccountState,
    RequestIdentity,
    account_state_transition_allowed,
)
from app.identity.security import require_capability


def identity_with(
    *capabilities: str,
    state: AccountState = AccountState.ACTIVE,
    recent_auth: bool = True,
) -> RequestIdentity:
    now = datetime.now(UTC)
    return RequestIdentity(
        account_id=uuid4(),
        email="operator@example.test",
        session_id=str(uuid4()),
        state=state,
        roles=frozenset({"fixture"}),
        capabilities=frozenset(capabilities),
        authenticated_at=now if recent_auth else now - timedelta(hours=1),
        authentication_method="otp",
        issued_at=now,
        expires_at=now + timedelta(hours=1),
        assurance_level="aal1",
        recent_auth=recent_auth,
    )


def test_capability_dependency_allows_only_explicit_capability(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    decisions: list[tuple[str, str]] = []
    monkeypatch.setattr(
        "app.identity.security._record_decision",
        lambda identity, *, capability, outcome, reason, correlation_id: decisions.append(
            (outcome, reason)
        ),
    )
    dependency = require_capability("identity.role.manage", recent_auth=True)

    result = dependency(
        identity_with("identity.role.manage"),
        uuid4(),
        None,
        None,
    )

    assert result.has_capability("identity.role.manage")
    assert decisions == [("allowed", "recent-auth-confirmed")]


def test_capability_dependency_distinguishes_forbidden_and_safe_not_found(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.identity.security._record_decision", lambda *args, **kwargs: None)

    with pytest.raises(HTTPException) as forbidden:
        require_capability("archive.review")(
            identity_with("admin.shell.access"),
            uuid4(),
            None,
            None,
        )
    assert forbidden.value.status_code == 403

    with pytest.raises(HTTPException) as hidden:
        require_capability("admin.shell.access", hide_forbidden=True)(
            identity_with(),
            uuid4(),
            None,
            None,
        )
    assert hidden.value.status_code == 404
    assert hidden.value.detail == "Not found"


def test_inactive_and_stale_sessions_fail_closed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.identity.security._record_decision", lambda *args, **kwargs: None)

    with pytest.raises(HTTPException) as inactive:
        require_capability("archive.review")(
            identity_with("archive.review", state=AccountState.SUSPENDED),
            uuid4(),
            None,
            None,
        )
    assert inactive.value.status_code == 403
    assert inactive.value.detail == "Account is unavailable"

    with pytest.raises(HTTPException) as stale:
        require_capability("identity.role.manage", recent_auth=True)(
            identity_with("identity.role.manage", recent_auth=False),
            uuid4(),
            None,
            None,
        )
    assert stale.value.status_code == 403
    assert "15 minutes" in stale.value.detail


def test_admin_shell_feature_flag_returns_safe_not_found(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "admin_shell_enabled", False)
    dependency = require_capability(
        "admin.shell.access",
        hide_forbidden=True,
        admin_shell=True,
    )

    with pytest.raises(HTTPException) as hidden:
        dependency(
            identity_with("admin.shell.access"),
            uuid4(),
            None,
            None,
        )

    assert hidden.value.status_code == 404


def test_account_state_transition_graph_keeps_deleted_terminal() -> None:
    assert account_state_transition_allowed(AccountState.ACTIVE, AccountState.SUSPENDED)
    assert account_state_transition_allowed(AccountState.ACTIVE, AccountState.DELETING)
    assert account_state_transition_allowed(AccountState.SUSPENDED, AccountState.ACTIVE)
    assert account_state_transition_allowed(AccountState.DELETING, AccountState.DELETED)

    assert not account_state_transition_allowed(AccountState.ACTIVE, AccountState.DELETED)
    assert not account_state_transition_allowed(AccountState.DELETING, AccountState.ACTIVE)
    assert not account_state_transition_allowed(AccountState.DELETED, AccountState.ACTIVE)
