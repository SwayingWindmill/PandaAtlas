from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.identity.models import AccountState, RequestIdentity


class IdentitySessionRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    account_id: UUID
    email: str
    state: AccountState
    roles: list[str]
    capabilities: list[str]
    recent_auth: bool
    authenticated_at: datetime | None
    authentication_method: str | None
    assurance_level: str
    expires_at: datetime

    @classmethod
    def from_identity(cls, identity: RequestIdentity) -> IdentitySessionRead:
        return cls(
            account_id=identity.account_id,
            email=identity.email,
            state=identity.state,
            roles=sorted(identity.roles),
            capabilities=sorted(identity.capabilities),
            recent_auth=identity.recent_auth,
            authenticated_at=identity.authenticated_at,
            authentication_method=identity.authentication_method,
            assurance_level=identity.assurance_level,
            expires_at=identity.expires_at,
        )


class RoleAssignmentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    account_id: UUID
    role_key: str = Field(min_length=3, max_length=64, pattern=r"^[a-z][a-z0-9_.-]+$")
    expires_at: datetime | None = None
    reason: str = Field(min_length=8, max_length=500)
    idempotency_key: str = Field(min_length=8, max_length=255)

    @field_validator("expires_at")
    @classmethod
    def require_timezone(cls, value: datetime | None) -> datetime | None:
        if value is not None and (value.tzinfo is None or value.utcoffset() is None):
            raise ValueError("expires_at must include a timezone")
        return value


class RoleAssignmentRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    assignment_id: UUID
    account_id: UUID
    role_key: str
    assigned_by_account_id: UUID | None
    assigned_at: datetime
    expires_at: datetime | None
    reason: str
    source: str
    correlation_id: UUID
    idempotency_key: str


class RoleAssignmentRevoke(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: str = Field(min_length=8, max_length=500)
    idempotency_key: str = Field(min_length=8, max_length=255)


class RoleRevocationRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    revocation_id: UUID
    assignment_id: UUID
    revoked_by_account_id: UUID | None
    revoked_at: datetime
    reason: str
    correlation_id: UUID
    idempotency_key: str


class AccountStateChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    state: AccountState
    reason: str = Field(min_length=8, max_length=500)
    idempotency_key: str = Field(min_length=8, max_length=255)


class AccountStateRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    account_id: UUID
    email: str
    state: AccountState
    state_reason: str | None
    state_changed_at: datetime
