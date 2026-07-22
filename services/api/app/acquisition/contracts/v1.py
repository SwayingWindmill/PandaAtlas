from __future__ import annotations

import json
from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from enum import StrEnum
from hashlib import sha256
from typing import TypeAlias
from urllib.parse import urlparse

SCHEMA_VERSION = "panda-atlas-acquisition-bundle/v1"
_HEX_DIGITS = frozenset("0123456789abcdef")

JsonScalar: TypeAlias = str | int | float | bool | None
JsonValue: TypeAlias = JsonScalar | list["JsonValue"] | dict[str, "JsonValue"]


class AcquisitionMode(StrEnum):
    FIXTURE = "fixture"
    LIVE = "live"
    IMPORTED = "imported"


class AcquisitionRunState(StrEnum):
    STARTED = "started"
    COMPLETED = "completed"
    BLOCKED = "blocked"
    FAILED = "failed"


class CandidateKind(StrEnum):
    IDENTITY = "identity"
    RELATIONSHIP = "relationship"
    RESIDENCY = "residency"
    EVENT = "event"
    MEDIA_METADATA = "media-metadata"


class EvidenceBlockState(StrEnum):
    CLEAR = "clear"
    AUTHORIZATION_REQUIRED = "authorization-required"
    HUMAN_CHALLENGE_REQUIRED = "human-challenge-required"
    RATE_LIMITED = "rate-limited"
    BLOCKED = "blocked"


class AcquisitionCapability(StrEnum):
    PUBLIC_HTTP = "public-http"
    AUTHORIZED_SESSION = "authorized-session"
    BROWSER_RENDERED = "browser-rendered"


class SourceLocatorKind(StrEnum):
    API_FIELD = "api-field"
    JSON_PATH = "json-path"
    CSS_SELECTOR = "css-selector"
    XPATH = "xpath"
    TEXT_SPAN = "text-span"
    DOCUMENT_SECTION = "document-section"


class IdentityMatchState(StrEnum):
    NOT_ATTEMPTED = "not-attempted"
    MATCHED = "matched"
    AMBIGUOUS = "ambiguous"
    UNMATCHED = "unmatched"


class ConflictState(StrEnum):
    NOT_COMPARED = "not-compared"
    NEW = "new"
    UNCHANGED = "unchanged"
    ENRICHMENT = "enrichment"
    CONTRADICTION = "contradiction"
    MISSING_CURRENT_VALUE = "missing-current-value"


class CandidateReviewState(StrEnum):
    UNREVIEWED = "unreviewed"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    DEFERRED = "deferred"


@dataclass(frozen=True, slots=True)
class AcquisitionRun:
    run_id: str
    source_id: str
    adapter_id: str
    adapter_version: str
    parser_name: str
    parser_version: str
    mode: AcquisitionMode
    state: AcquisitionRunState
    started_at: datetime
    completed_at: datetime | None = None
    cohort: str | None = None
    source_reviewed_at: date | None = None
    source_review_expires_at: date | None = None
    notes: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        for label, value in (
            ("run_id", self.run_id),
            ("source_id", self.source_id),
            ("adapter_id", self.adapter_id),
            ("adapter_version", self.adapter_version),
            ("parser_name", self.parser_name),
            ("parser_version", self.parser_version),
        ):
            _require_non_empty(label, value)
        _require_aware_datetime("started_at", self.started_at)
        if self.completed_at is not None:
            _require_aware_datetime("completed_at", self.completed_at)
            if self.completed_at < self.started_at:
                raise ValueError("completed_at cannot precede started_at")
        if self.state is AcquisitionRunState.STARTED and self.completed_at is not None:
            raise ValueError("started acquisition runs cannot have completed_at")
        if self.state is not AcquisitionRunState.STARTED and self.completed_at is None:
            raise ValueError("terminal acquisition runs require completed_at")
        if (self.source_reviewed_at is None) != (self.source_review_expires_at is None):
            raise ValueError("source review dates must be provided together")
        if (
            self.source_reviewed_at is not None
            and self.source_review_expires_at is not None
            and self.source_review_expires_at < self.source_reviewed_at
        ):
            raise ValueError("source review expiry cannot precede its review date")
        if self.mode is AcquisitionMode.LIVE and self.source_reviewed_at is None:
            raise ValueError("live acquisition runs require source review dates")

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "run_id": self.run_id,
            "source_id": self.source_id,
            "adapter_id": self.adapter_id,
            "adapter_version": self.adapter_version,
            "parser_name": self.parser_name,
            "parser_version": self.parser_version,
            "mode": self.mode.value,
            "state": self.state.value,
            "started_at": _format_datetime(self.started_at),
            "completed_at": (
                _format_datetime(self.completed_at) if self.completed_at is not None else None
            ),
            "cohort": self.cohort,
            "source_reviewed_at": (
                self.source_reviewed_at.isoformat() if self.source_reviewed_at is not None else None
            ),
            "source_review_expires_at": (
                self.source_review_expires_at.isoformat()
                if self.source_review_expires_at is not None
                else None
            ),
            "notes": list(self.notes),
        }


@dataclass(frozen=True, slots=True)
class EvidenceSnapshot:
    source_id: str
    requested_url: str
    final_url: str
    captured_at: datetime
    status: int
    headers: Mapping[str, str]
    body_bytes: int
    body_sha256: str
    block_state: EvidenceBlockState
    capability: AcquisitionCapability
    content_type: str | None = None
    notes: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        _require_non_empty("source_id", self.source_id)
        _require_https_url("requested_url", self.requested_url)
        _require_https_url("final_url", self.final_url)
        _require_aware_datetime("captured_at", self.captured_at)
        if not 100 <= self.status <= 599:
            raise ValueError("status must be a valid HTTP status code")
        if self.body_bytes < 0:
            raise ValueError("body_bytes cannot be negative")
        _require_sha256("body_sha256", self.body_sha256)
        normalized_headers = {
            str(key).strip().lower(): str(value).strip()
            for key, value in self.headers.items()
            if str(key).strip()
        }
        object.__setattr__(self, "headers", dict(sorted(normalized_headers.items())))

    @property
    def snapshot_id(self) -> str:
        return _stable_id(
            "evidence",
            {
                "source_id": self.source_id,
                "requested_url": self.requested_url,
                "final_url": self.final_url,
                "status": self.status,
                "body_sha256": self.body_sha256,
            },
        )

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "evidence_snapshot_id": self.snapshot_id,
            "source_id": self.source_id,
            "requested_url": self.requested_url,
            "final_url": self.final_url,
            "captured_at": _format_datetime(self.captured_at),
            "status": self.status,
            "headers": dict(self.headers),
            "body_bytes": self.body_bytes,
            "body_sha256": self.body_sha256,
            "block_state": self.block_state.value,
            "capability": self.capability.value,
            "content_type": self.content_type,
            "notes": list(self.notes),
        }

    @classmethod
    def from_http_response(
        cls,
        *,
        source_id: str,
        requested_url: str,
        final_url: str,
        captured_at: datetime,
        status: int,
        headers: Mapping[str, str],
        body: bytes,
        block_state: EvidenceBlockState,
        capability: AcquisitionCapability,
        notes: tuple[str, ...] = (),
    ) -> EvidenceSnapshot:
        content_type = next(
            (str(value) for key, value in headers.items() if str(key).lower() == "content-type"),
            None,
        )
        return cls(
            source_id=source_id,
            requested_url=requested_url,
            final_url=final_url,
            captured_at=captured_at,
            status=status,
            headers=headers,
            body_bytes=len(body),
            body_sha256=sha256(body).hexdigest(),
            block_state=block_state,
            capability=capability,
            content_type=content_type,
            notes=notes,
        )


@dataclass(frozen=True, slots=True)
class SourceLocator:
    kind: SourceLocatorKind
    value: str
    attribute: str | None = None
    occurrence: int | None = None

    def __post_init__(self) -> None:
        _require_non_empty("source locator value", self.value)
        if self.occurrence is not None and self.occurrence < 0:
            raise ValueError("source locator occurrence cannot be negative")

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "kind": self.kind.value,
            "value": self.value,
            "attribute": self.attribute,
            "occurrence": self.occurrence,
        }


@dataclass(frozen=True, slots=True)
class PandaIdentityMatch:
    state: IdentityMatchState
    source_identity: str
    matched_panda_id: str | None = None
    matched_canonical_slug: str | None = None
    candidate_panda_ids: tuple[str, ...] = ()
    notes: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        _require_non_empty("source_identity", self.source_identity)
        if self.state is IdentityMatchState.MATCHED:
            if not self.matched_panda_id and not self.matched_canonical_slug:
                raise ValueError("matched identity requires a panda ID or canonical slug")
            if self.candidate_panda_ids:
                raise ValueError("matched identity cannot retain ambiguous candidate IDs")
        elif self.matched_panda_id is not None or self.matched_canonical_slug is not None:
            raise ValueError("only matched identity state may contain a matched panda")
        if self.state is IdentityMatchState.AMBIGUOUS and len(self.candidate_panda_ids) < 2:
            raise ValueError("ambiguous identity requires at least two candidate panda IDs")
        if self.state is not IdentityMatchState.AMBIGUOUS and self.candidate_panda_ids:
            raise ValueError("candidate panda IDs are only valid for ambiguous matches")

    @property
    def identity_key(self) -> str:
        return self.matched_panda_id or self.matched_canonical_slug or self.source_identity

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "state": self.state.value,
            "source_identity": self.source_identity,
            "matched_panda_id": self.matched_panda_id,
            "matched_canonical_slug": self.matched_canonical_slug,
            "candidate_panda_ids": list(self.candidate_panda_ids),
            "notes": list(self.notes),
        }


@dataclass(frozen=True, slots=True)
class CurrentTrustedValue:
    present: bool
    value: JsonValue = None
    assertion_ids: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        _validate_json_value(self.value)
        if not self.present and self.value is not None:
            raise ValueError("missing trusted values cannot carry a value")
        if not self.present and self.assertion_ids:
            raise ValueError("missing trusted values cannot reference assertion IDs")

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "present": self.present,
            "value": self.value,
            "assertion_ids": list(self.assertion_ids),
        }


@dataclass(frozen=True, slots=True)
class FieldCandidate:
    source_id: str
    evidence_snapshot_id: str
    evidence_body_sha256: str
    candidate_kind: CandidateKind
    subject_key: str
    field_path: str
    source_locator: SourceLocator
    raw_value: JsonValue
    normalized_value: JsonValue
    identity_match: PandaIdentityMatch
    current_trusted_value: CurrentTrustedValue
    parser_name: str
    parser_version: str
    conflict_state: ConflictState = ConflictState.NOT_COMPARED
    review_state: CandidateReviewState = CandidateReviewState.UNREVIEWED
    notes: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        for label, value in (
            ("source_id", self.source_id),
            ("evidence_snapshot_id", self.evidence_snapshot_id),
            ("subject_key", self.subject_key),
            ("field_path", self.field_path),
            ("parser_name", self.parser_name),
            ("parser_version", self.parser_version),
        ):
            _require_non_empty(label, value)
        _require_sha256("evidence_body_sha256", self.evidence_body_sha256)
        _validate_json_value(self.raw_value)
        _validate_json_value(self.normalized_value)

    @property
    def candidate_id(self) -> str:
        return _stable_id(
            "candidate",
            {
                "source_id": self.source_id,
                "evidence_snapshot_id": self.evidence_snapshot_id,
                "candidate_kind": self.candidate_kind.value,
                "subject_key": self.subject_key,
                "field_path": self.field_path,
                "source_locator": self.source_locator.to_dict(),
                "normalized_value": self.normalized_value,
                "parser_name": self.parser_name,
                "parser_version": self.parser_version,
            },
        )

    @property
    def deduplication_key(self) -> str:
        return _stable_id(
            "dedupe",
            {
                "source_id": self.source_id,
                "panda_identity": self.identity_match.identity_key,
                "candidate_kind": self.candidate_kind.value,
                "field_path": self.field_path,
                "normalized_value": self.normalized_value,
                "evidence_body_sha256": self.evidence_body_sha256,
            },
        )

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "candidate_id": self.candidate_id,
            "deduplication_key": self.deduplication_key,
            "source_id": self.source_id,
            "evidence_snapshot_id": self.evidence_snapshot_id,
            "evidence_body_sha256": self.evidence_body_sha256,
            "candidate_kind": self.candidate_kind.value,
            "subject_key": self.subject_key,
            "field_path": self.field_path,
            "source_locator": self.source_locator.to_dict(),
            "raw_value": self.raw_value,
            "normalized_value": self.normalized_value,
            "identity_match": self.identity_match.to_dict(),
            "current_trusted_value": self.current_trusted_value.to_dict(),
            "parser_name": self.parser_name,
            "parser_version": self.parser_version,
            "conflict_state": self.conflict_state.value,
            "review_state": self.review_state.value,
            "notes": list(self.notes),
        }


@dataclass(frozen=True, slots=True)
class AcquisitionBundle:
    run: AcquisitionRun
    evidence_snapshots: tuple[EvidenceSnapshot, ...]
    candidates: tuple[FieldCandidate, ...]
    created_at: datetime
    schema_version: str = SCHEMA_VERSION
    trusted_write_targets: tuple[str, ...] = field(default=(), repr=False)
    publication_write_targets: tuple[str, ...] = field(default=(), repr=False)

    def __post_init__(self) -> None:
        if self.schema_version != SCHEMA_VERSION:
            raise ValueError(f"schema_version must equal {SCHEMA_VERSION}")
        _require_aware_datetime("created_at", self.created_at)
        if self.trusted_write_targets or self.publication_write_targets:
            raise ValueError(
                "acquisition bundles cannot expose trusted or publication write targets"
            )

        snapshots_by_id: dict[str, EvidenceSnapshot] = {}
        for snapshot in self.evidence_snapshots:
            if snapshot.source_id != self.run.source_id:
                raise ValueError("evidence snapshot source does not match acquisition run")
            if snapshot.snapshot_id in snapshots_by_id:
                raise ValueError("bundle contains duplicate evidence snapshot IDs")
            snapshots_by_id[snapshot.snapshot_id] = snapshot

        candidate_ids: set[str] = set()
        deduplication_keys: set[str] = set()
        for candidate in self.candidates:
            if candidate.source_id != self.run.source_id:
                raise ValueError("field candidate source does not match acquisition run")
            if (
                candidate.parser_name != self.run.parser_name
                or candidate.parser_version != self.run.parser_version
            ):
                raise ValueError("field candidate parser does not match acquisition run")
            snapshot = snapshots_by_id.get(candidate.evidence_snapshot_id)
            if snapshot is None:
                raise ValueError("field candidate references an unknown evidence snapshot")
            if snapshot.body_sha256 != candidate.evidence_body_sha256:
                raise ValueError("field candidate evidence hash does not match its snapshot")
            if candidate.candidate_id in candidate_ids:
                raise ValueError("bundle contains duplicate candidate IDs")
            if candidate.deduplication_key in deduplication_keys:
                raise ValueError("bundle contains duplicate candidate deduplication keys")
            candidate_ids.add(candidate.candidate_id)
            deduplication_keys.add(candidate.deduplication_key)

    @property
    def bundle_id(self) -> str:
        return _stable_id(
            "bundle",
            {
                "schema_version": self.schema_version,
                "run": self.run.to_dict(),
                "evidence_snapshots": [item.to_dict() for item in self.evidence_snapshots],
                "candidates": [item.to_dict() for item in self.candidates],
            },
        )

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "schema_version": self.schema_version,
            "bundle_id": self.bundle_id,
            "created_at": _format_datetime(self.created_at),
            "run": self.run.to_dict(),
            "evidence_snapshots": [item.to_dict() for item in self.evidence_snapshots],
            "candidates": [item.to_dict() for item in self.candidates],
            "write_boundary": {
                "trusted_write_targets": [],
                "publication_write_targets": [],
            },
        }


def canonical_json_bytes(value: JsonValue) -> bytes:
    _validate_json_value(value)
    return json.dumps(
        value,
        ensure_ascii=False,
        allow_nan=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def _stable_id(prefix: str, payload: JsonValue) -> str:
    return f"{prefix}-{sha256(canonical_json_bytes(payload)).hexdigest()}"


def _validate_json_value(value: JsonValue) -> None:
    try:
        json.dumps(value, ensure_ascii=False, allow_nan=False, sort_keys=True)
    except (TypeError, ValueError) as error:
        raise ValueError("candidate values must be finite JSON values") from error


def _require_non_empty(label: str, value: str) -> None:
    if not value.strip():
        raise ValueError(f"{label} cannot be empty")


def _require_sha256(label: str, value: str) -> None:
    normalized = value.lower()
    if len(normalized) != 64 or any(character not in _HEX_DIGITS for character in normalized):
        raise ValueError(f"{label} must be a lowercase SHA-256 digest")
    if value != normalized:
        raise ValueError(f"{label} must be lowercase")


def _require_aware_datetime(label: str, value: datetime) -> None:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{label} must include a timezone")


def _format_datetime(value: datetime) -> str:
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def _require_https_url(label: str, value: str) -> None:
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.hostname:
        raise ValueError(f"{label} must be an absolute HTTPS URL")
