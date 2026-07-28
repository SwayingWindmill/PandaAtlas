from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID


class AccountState(StrEnum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    DELETING = "deleting"
    DELETED = "deleted"


_ALLOWED_ACCOUNT_STATE_TRANSITIONS: dict[AccountState, frozenset[AccountState]] = {
    AccountState.ACTIVE: frozenset({AccountState.SUSPENDED, AccountState.DELETING}),
    AccountState.SUSPENDED: frozenset({AccountState.ACTIVE, AccountState.DELETING}),
    AccountState.DELETING: frozenset({AccountState.DELETED}),
    AccountState.DELETED: frozenset(),
}


def account_state_transition_allowed(current: AccountState, next_state: AccountState) -> bool:
    return next_state in _ALLOWED_ACCOUNT_STATE_TRANSITIONS[current]


@dataclass(frozen=True, slots=True)
class VerifiedSupabaseIdentity:
    account_id: UUID
    email: str
    session_id: str
    issued_at: datetime
    expires_at: datetime
    authenticated_at: datetime | None
    authentication_method: str | None
    assurance_level: str
    claims: dict[str, Any]


@dataclass(frozen=True, slots=True)
class RequestIdentity:
    account_id: UUID
    email: str
    session_id: str
    state: AccountState
    roles: frozenset[str]
    capabilities: frozenset[str]
    authenticated_at: datetime | None
    authentication_method: str | None
    issued_at: datetime
    expires_at: datetime
    assurance_level: str
    recent_auth: bool

    def has_capability(self, capability: str) -> bool:
        return capability in self.capabilities
