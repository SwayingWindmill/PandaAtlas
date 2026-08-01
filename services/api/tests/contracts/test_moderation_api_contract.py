from __future__ import annotations

from pathlib import Path

from fastapi.routing import APIRoute

from app.api.router import api_router


REPO_ROOT = Path(__file__).resolve().parents[4]
ROUTER_SOURCE = REPO_ROOT / "services" / "api" / "app" / "api" / "v1" / "admin_moderation.py"
SERVICE_SOURCE = (
    REPO_ROOT
    / "services"
    / "api"
    / "app"
    / "review_moderation"
    / "moderation_service.py"
)


def _operations() -> set[tuple[str, str]]:
    return {
        (method, route.path)
        for route in api_router.routes
        if isinstance(route, APIRoute)
        for method in route.methods
    }


def test_moderation_routes_are_bounded_and_registered() -> None:
    operations = _operations()

    for method, path in (
        ("GET", "/api/v1/admin/moderation/accounts/{account_id}"),
        ("POST", "/api/v1/admin/moderation/accounts/{account_id}/actions"),
        ("POST", "/api/v1/admin/moderation/actions/{action_id}/restore"),
        ("GET", "/api/v1/admin/moderation/appeals"),
        ("POST", "/api/v1/admin/moderation/appeals/{appeal_case_id}/claim"),
        ("POST", "/api/v1/admin/moderation/appeals/{appeal_case_id}/decide"),
        ("GET", "/api/v1/moderation/actions"),
        ("GET", "/api/v1/moderation/appeals"),
        ("POST", "/api/v1/moderation/appeals"),
        ("GET", "/api/v1/moderation/appeals/{appeal_case_id}"),
    ):
        assert (method, path) in operations


def test_staff_commands_use_explicit_capabilities_and_recent_auth() -> None:
    source = ROUTER_SOURCE.read_text(encoding="utf-8")

    for capability in (
        "moderation.case.read",
        "moderation.sanction.issue",
        "moderation.sanction.manage",
        "moderation.appeal.decide",
        "moderation.metrics",
    ):
        assert capability in source
    assert 'require_capability("moderation.sanction.manage", recent_auth=True)' in source
    assert 'require_capability("moderation.appeal.decide", recent_auth=True)' in source


def test_suspended_user_appeal_uses_identity_and_user_safe_projection() -> None:
    source = ROUTER_SOURCE.read_text(encoding="utf-8")

    assert "AppealSubmitter = Annotated[RequestIdentity, Depends(get_request_identity)]" in source
    assert "_user_safe_appeal(submit_appeal(command, identity, correlation_id))" in source
    assert "_user_safe_appeal(get_appeal(appeal_case_id, account_id=identity.account_id))" in source
    assert "response_model=MyAppealCaseRead" in source
    assert "internal_resolution=appeal.internal_resolution" not in source


def test_service_uses_authoritative_identity_state_and_canonical_outbox() -> None:
    source = SERVICE_SOURCE.read_text(encoding="utf-8")

    assert "update identity.accounts" in source
    assert "insert into identity.account_state_events" in source
    assert "insert into identity.authorization_audit_events" in source
    assert "insert into integration.outbox_events" in source
    assert "moderation_outbox_events" not in source
    assert "Reviewer may issue only a submission freeze" in source
    assert "Reviewer freeze may not exceed 24 hours" in source
