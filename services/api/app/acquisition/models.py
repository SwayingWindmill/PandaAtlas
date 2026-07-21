from __future__ import annotations

from collections.abc import Mapping
from dataclasses import asdict, dataclass, field
from enum import StrEnum
from hashlib import sha256
from typing import Any


class CapabilityMode(StrEnum):
    PUBLIC_HTTP = "public-http"
    AUTHORIZED_SESSION = "authorized-session"
    BROWSER_RENDERED = "browser-rendered"
    APPROVED_PROXY = "approved-proxy"
    STEALTH_LAB = "stealth-lab"


class BlockState(StrEnum):
    CLEAR = "clear"
    AUTHORIZATION_REQUIRED = "authorization-required"
    HUMAN_CHALLENGE_REQUIRED = "human-challenge-required"
    RATE_LIMITED = "rate-limited"
    BLOCKED = "blocked"


@dataclass(frozen=True, slots=True)
class SourcePolicy:
    source_id: str
    allowed_hosts: tuple[str, ...]
    capability: CapabilityMode = CapabilityMode.PUBLIC_HTTP
    obey_robots: bool = True
    requests_per_minute: int = 12
    concurrency_per_host: int = 1
    authorized_session_ref: str | None = None
    approved_proxy_ref: str | None = None
    proxy_rotation: bool = False
    challenge_action: str = "stop-and-review"


@dataclass(frozen=True, slots=True)
class ResponseEnvelope:
    requested_url: str
    final_url: str
    status: int
    headers: Mapping[str, str]
    body: bytes


@dataclass(frozen=True, slots=True)
class EvidenceSnapshot:
    engine: str
    engine_version: str
    requested_url: str
    final_url: str
    status: int
    headers: Mapping[str, str]
    body_bytes: int
    body_sha256: str
    block_state: BlockState
    capability: CapabilityMode
    selector_mode: str
    notes: tuple[str, ...] = ()

    def to_dict(self) -> dict[str, Any]:
        result = asdict(self)
        result["block_state"] = self.block_state.value
        result["capability"] = self.capability.value
        result["headers"] = dict(sorted(self.headers.items()))
        return result

    @classmethod
    def from_response(
        cls,
        *,
        engine: str,
        engine_version: str,
        response: ResponseEnvelope,
        block_state: BlockState,
        capability: CapabilityMode,
        selector_mode: str,
        notes: tuple[str, ...] = (),
    ) -> EvidenceSnapshot:
        headers = {str(key).lower(): str(value) for key, value in response.headers.items()}
        return cls(
            engine=engine,
            engine_version=engine_version,
            requested_url=response.requested_url,
            final_url=response.final_url,
            status=response.status,
            headers=headers,
            body_bytes=len(response.body),
            body_sha256=sha256(response.body).hexdigest(),
            block_state=block_state,
            capability=capability,
            selector_mode=selector_mode,
            notes=notes,
        )


@dataclass(frozen=True, slots=True)
class CandidateRecord:
    source_url: str
    evidence_sha256: str
    panda_name_zh: str
    panda_name_en: str
    institution_name: str
    engine: str
    review_state: str = "candidate"

    def to_dict(self) -> dict[str, str]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class EngineResult:
    engine: str
    fixture: str
    evidence: EvidenceSnapshot
    candidate: CandidateRecord | None
    deterministic_match: bool
    adaptive_suggestion: Mapping[str, Any] | None = None
    metrics_ms: Mapping[str, float] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "engine": self.engine,
            "fixture": self.fixture,
            "evidence": self.evidence.to_dict(),
            "candidate": self.candidate.to_dict() if self.candidate else None,
            "deterministic_match": self.deterministic_match,
            "adaptive_suggestion": dict(self.adaptive_suggestion)
            if self.adaptive_suggestion
            else None,
            "metrics_ms": dict(self.metrics_ms),
        }
