from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal
from uuid import UUID, uuid4

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.core.security import require_admin_token, require_workflow_actor
from app.db.session import session_scope
from app.identity.jwt import SupabaseJWTVerifier, SupabaseTokenError
from app.identity.models import AccountState, RequestIdentity
from app.identity.repository import IdentityRepository

_bearer_scheme = HTTPBearer(auto_error=False)
bearer_credentials = Depends(_bearer_scheme)
_verifier_signature: tuple[object, ...] | None = None
_verifier: SupabaseJWTVerifier | None = None
LegacyMode = Literal["admin", "workflow"]


def resolve_correlation_id(
    value: Annotated[str | None, Header(alias="X-Correlation-Id")] = None,
) -> UUID:
    if value is None:
        return uuid4()
    try:
        return UUID(value)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Correlation-Id must be a UUID",
        ) from error


def get_supabase_verifier() -> SupabaseJWTVerifier:
    global _verifier, _verifier_signature
    try:
        issuer = settings.supabase_jwt_issuer()
        jwks_url = settings.supabase_jwks_url()
        algorithms = settings.supabase_jwt_algorithms()
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase JWT verification is not configured",
        ) from error

    signature: tuple[object, ...] = (
        issuer,
        settings.supabase_jwt_audience,
        jwks_url,
        algorithms,
    )
    if _verifier is None or signature != _verifier_signature:
        _verifier = SupabaseJWTVerifier(
            issuer=issuer,
            audience=settings.supabase_jwt_audience,
            jwks_url=jwks_url,
            allowed_algorithms=algorithms,
        )
        _verifier_signature = signature
    return _verifier


def get_optional_request_identity(
    correlation_id: Annotated[UUID, Depends(resolve_correlation_id)],
    credentials: HTTPAuthorizationCredentials | None = bearer_credentials,
) -> RequestIdentity | None:
    if not settings.identity_auth_enabled:
        return None
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        verified = get_supabase_verifier().verify(credentials.credentials)
    except SupabaseTokenError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from error

    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Identity database is unavailable",
                )
            return IdentityRepository(session).sync_request_identity(
                verified,
                recent_auth_seconds=settings.identity_recent_auth_seconds,
                bootstrap_admin_emails=settings.identity_bootstrap_admin_emails(),
                correlation_id=correlation_id,
            )
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Identity database request failed",
        ) from error


def get_request_identity(
    identity: Annotated[RequestIdentity | None, Depends(get_optional_request_identity)],
) -> RequestIdentity:
    if identity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return identity


def _legacy_identity(account_id: UUID, capability: str) -> RequestIdentity:
    now = datetime.now(UTC)
    return RequestIdentity(
        account_id=account_id,
        email="legacy-transition@local.invalid",
        session_id="legacy-transition",
        state=AccountState.ACTIVE,
        roles=frozenset({"legacy_transition"}),
        capabilities=frozenset({capability}),
        authenticated_at=now,
        authentication_method="legacy-transition",
        issued_at=now,
        expires_at=now + timedelta(minutes=15),
        assurance_level="aal1",
        recent_auth=True,
    )


def _require_legacy_identity(
    mode: LegacyMode,
    capability: str,
    credentials: HTTPAuthorizationCredentials | None,
    actor_id: UUID | None,
) -> RequestIdentity:
    if mode == "admin":
        require_admin_token(credentials)
        return _legacy_identity(UUID(int=0), capability)
    if actor_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing workflow actor",
        )
    verified_actor_id = require_workflow_actor(actor_id, credentials)
    return _legacy_identity(verified_actor_id, capability)


def _record_decision(
    identity: RequestIdentity,
    *,
    capability: str,
    outcome: str,
    reason: str,
    correlation_id: UUID,
) -> None:
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Identity audit database is unavailable",
                )
            IdentityRepository(session).record_authorization_decision(
                identity=identity,
                capability=capability,
                outcome=outcome,
                reason=reason,
                correlation_id=correlation_id,
            )
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Identity authorization audit failed",
        ) from error


def require_active_identity(
    identity: Annotated[RequestIdentity, Depends(get_request_identity)],
) -> RequestIdentity:
    if identity.state is not AccountState.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is unavailable",
        )
    return identity


def require_capability(
    capability: str,
    *,
    hide_forbidden: bool = False,
    recent_auth: bool = False,
    admin_shell: bool = False,
    legacy_mode: LegacyMode | None = None,
):
    def dependency(
        identity: Annotated[
            RequestIdentity | None,
            Depends(get_optional_request_identity),
        ],
        correlation_id: Annotated[UUID, Depends(resolve_correlation_id)],
        credentials: HTTPAuthorizationCredentials | None = bearer_credentials,
        actor_id: Annotated[UUID | None, Header(alias="X-Actor-Id")] = None,
    ) -> RequestIdentity:
        if identity is None:
            if legacy_mode is not None:
                return _require_legacy_identity(
                    legacy_mode,
                    capability,
                    credentials,
                    actor_id,
                )
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

        hidden_status = status.HTTP_404_NOT_FOUND if hide_forbidden else status.HTTP_403_FORBIDDEN
        hidden_detail = "Not found" if hide_forbidden else "Account is unavailable"

        if admin_shell and not settings.admin_shell_enabled:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
        if identity.state is not AccountState.ACTIVE:
            _record_decision(
                identity,
                capability=capability,
                outcome="denied",
                reason=f"account-state:{identity.state.value}",
                correlation_id=correlation_id,
            )
            raise HTTPException(status_code=hidden_status, detail=hidden_detail)
        if not identity.has_capability(capability):
            _record_decision(
                identity,
                capability=capability,
                outcome="denied",
                reason="capability-missing",
                correlation_id=correlation_id,
            )
            detail = "Not found" if hide_forbidden else "Required capability is missing"
            raise HTTPException(status_code=hidden_status, detail=detail)
        if recent_auth and not identity.recent_auth:
            _record_decision(
                identity,
                capability=capability,
                outcome="denied",
                reason="recent-auth-required",
                correlation_id=correlation_id,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Authentication within the last 15 minutes is required",
            )
        if recent_auth:
            _record_decision(
                identity,
                capability=capability,
                outcome="allowed",
                reason="recent-auth-confirmed",
                correlation_id=correlation_id,
            )
        return identity

    return dependency


ActiveIdentity = Annotated[RequestIdentity, Depends(require_active_identity)]
AdminShellIdentity = Annotated[
    RequestIdentity,
    Depends(
        require_capability(
            "admin.shell.access",
            hide_forbidden=True,
            admin_shell=True,
        )
    ),
]
