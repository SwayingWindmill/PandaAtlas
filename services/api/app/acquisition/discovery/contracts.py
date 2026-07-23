from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, model_validator

from app.knowledge.contracts import SourceAccessBasis, SourceEvidence, SourceKind

SCHEMA_VERSION = "panda-atlas-discovery-intake/v1"


class DiscoveryModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, validate_default=True)


class DiscoveryPolicyState(StrEnum):
    CLEAR = "clear"
    CAPTCHA = "captcha"
    AUTH_MISMATCH = "auth-mismatch"
    PAYWALL = "paywall"
    ACCESS_CONTROL = "access-control"
    POLICY_MISMATCH = "policy-mismatch"
    HTTP_403 = "http-403"
    HTTP_429 = "http-429"
    HTTP_451 = "http-451"
    UNEXPECTED_BLOCKING = "unexpected-blocking"


class MaterialChangeState(StrEnum):
    NEW = "new"
    CHANGED = "changed"
    REMOVED = "removed"
    UNCHANGED = "unchanged"


class DiscoveryRunState(StrEnum):
    COMPLETED = "completed"
    STOPPED = "stopped"


class DiscoveryQuery(DiscoveryModel):
    query_id: str = Field(min_length=1)
    text: str = Field(min_length=1)
    language: str = Field(min_length=2)
    provider_id: str = Field(min_length=1)
    access_basis: SourceAccessBasis
    access_reference: str | None = None

    @model_validator(mode="after")
    def validate_access_reference(self) -> DiscoveryQuery:
        if self.access_basis is SourceAccessBasis.PUBLIC:
            if self.access_reference is not None:
                raise ValueError("public discovery queries cannot carry an access reference")
        elif self.access_reference is None or not self.access_reference.strip():
            raise ValueError("non-public discovery queries require an access reference")
        return self


class DiscoveryMaterialEvent(DiscoveryModel):
    event_type: Literal["material"] = "material"
    query_id: str = Field(min_length=1)
    sequence: int = Field(ge=1)
    url: HttpUrl
    title: str = Field(min_length=1)
    publisher: str = Field(min_length=1)
    language: str = Field(min_length=2)
    source_kind: SourceKind
    is_first_hand: bool
    access_basis: SourceAccessBasis
    publication_date: date | None = None
    collected_at: datetime
    content_sha256: str = Field(pattern="^[0-9a-f]{64}$")
    body_bytes: int = Field(ge=0)
    content_type: str | None = None
    snapshot_reference: str | None = None
    policy_state: DiscoveryPolicyState
    http_status: int = Field(ge=100, le=599)

    @model_validator(mode="after")
    def validate_material_event(self) -> DiscoveryMaterialEvent:
        if self.policy_state is not DiscoveryPolicyState.CLEAR:
            raise ValueError("material events require a clear policy state")
        if not 200 <= self.http_status < 300:
            raise ValueError("material events require a successful HTTP status")
        if self.collected_at.tzinfo is None or self.collected_at.utcoffset() is None:
            raise ValueError("material collection timestamp must be timezone-aware")
        return self


class DiscoveryStopEvent(DiscoveryModel):
    event_type: Literal["stop"] = "stop"
    query_id: str = Field(min_length=1)
    sequence: int = Field(ge=1)
    url: HttpUrl
    access_basis: SourceAccessBasis
    collected_at: datetime
    policy_state: DiscoveryPolicyState
    http_status: int | None = Field(default=None, ge=100, le=599)
    detail: str = Field(min_length=1)

    @model_validator(mode="after")
    def validate_stop_event(self) -> DiscoveryStopEvent:
        if self.policy_state is DiscoveryPolicyState.CLEAR:
            raise ValueError("stop events require a blocking policy state")
        expected_status = {
            DiscoveryPolicyState.HTTP_403: 403,
            DiscoveryPolicyState.HTTP_429: 429,
            DiscoveryPolicyState.HTTP_451: 451,
        }.get(self.policy_state)
        if expected_status is not None and self.http_status != expected_status:
            raise ValueError("HTTP stop policy state does not match its status")
        if self.collected_at.tzinfo is None or self.collected_at.utcoffset() is None:
            raise ValueError("discovery stop timestamp must be timezone-aware")
        return self


DiscoveryEvent = DiscoveryMaterialEvent | DiscoveryStopEvent


class DiscoveryInventoryItem(DiscoveryModel):
    source_key: str = Field(min_length=1)
    query_ids: tuple[str, ...] = Field(min_length=1)
    canonical_url: str = Field(min_length=1)
    content_sha256: str = Field(pattern="^[0-9a-f]{64}$")
    title: str = Field(min_length=1)
    publisher: str = Field(min_length=1)
    language: str = Field(min_length=2)
    source_kind: SourceKind
    is_first_hand: bool
    access_basis: SourceAccessBasis
    publication_date: date | None = None
    last_collected_at: datetime
    body_bytes: int = Field(ge=0)
    content_type: str | None = None
    snapshot_reference: str | None = None
    known_source_id: str | None = None


class DiscoveryInventory(DiscoveryModel):
    schema_version: Literal[SCHEMA_VERSION] = SCHEMA_VERSION
    items: tuple[DiscoveryInventoryItem, ...] = ()

    @model_validator(mode="after")
    def validate_inventory(self) -> DiscoveryInventory:
        source_keys = [item.source_key for item in self.items]
        canonical_urls = [item.canonical_url for item in self.items]
        if len(source_keys) != len(set(source_keys)):
            raise ValueError("discovery inventory contains duplicate source keys")
        if len(canonical_urls) != len(set(canonical_urls)):
            raise ValueError("discovery inventory contains duplicate canonical URLs")
        if any(item.query_ids != tuple(sorted(set(item.query_ids))) for item in self.items):
            raise ValueError("discovery inventory query IDs must be unique and sorted")
        return self


class DiscoveryManifestEntry(DiscoveryModel):
    source_key: str = Field(min_length=1)
    query_ids: tuple[str, ...] = Field(min_length=1)
    change_state: MaterialChangeState
    canonical_url: str = Field(min_length=1)
    observed_urls: tuple[str, ...] = Field(min_length=1)
    content_sha256: str = Field(pattern="^[0-9a-f]{64}$")
    previous_content_sha256: str | None = Field(default=None, pattern="^[0-9a-f]{64}$")
    content_group_id: str = Field(min_length=1)
    is_content_representative: bool
    intake_candidate_id: str | None = None
    source: SourceEvidence
    publication_date: date | None = None
    collected_at: datetime
    body_bytes: int = Field(ge=0)
    content_type: str | None = None
    snapshot_reference: str | None = None
    policy_state: DiscoveryPolicyState
    known_source_id: str | None = None

    @model_validator(mode="after")
    def validate_change_state(self) -> DiscoveryManifestEntry:
        if self.query_ids != tuple(sorted(set(self.query_ids))):
            raise ValueError("manifest entry query IDs must be unique and sorted")
        if self.policy_state is not DiscoveryPolicyState.CLEAR:
            raise ValueError("manifest material entries require a clear policy state")
        if self.change_state is MaterialChangeState.NEW:
            if self.previous_content_sha256 is not None:
                raise ValueError("new material cannot have a previous content hash")
        elif self.change_state is MaterialChangeState.CHANGED:
            if (
                self.previous_content_sha256 is None
                or self.previous_content_sha256 == self.content_sha256
            ):
                raise ValueError("changed material requires a different previous content hash")
        elif self.previous_content_sha256 != self.content_sha256:
            raise ValueError("unchanged and removed material must retain the prior content hash")
        if self.intake_candidate_id is not None and (
            self.change_state not in {MaterialChangeState.NEW, MaterialChangeState.CHANGED}
            or not self.is_content_representative
        ):
            raise ValueError("intake candidates require representative new or changed material")
        return self


class DiscoveryStopRecord(DiscoveryModel):
    query_id: str = Field(min_length=1)
    sequence: int = Field(ge=1)
    url: str = Field(min_length=1)
    access_basis: SourceAccessBasis
    collected_at: datetime
    policy_state: DiscoveryPolicyState
    http_status: int | None = None
    detail: str = Field(min_length=1)

    @model_validator(mode="after")
    def validate_stop_record(self) -> DiscoveryStopRecord:
        if self.policy_state is DiscoveryPolicyState.CLEAR:
            raise ValueError("stop records require a blocking policy state")
        if self.collected_at.tzinfo is None or self.collected_at.utcoffset() is None:
            raise ValueError("discovery stop record timestamp must be timezone-aware")
        return self


class DiscoverySummary(DiscoveryModel):
    query_count: int = Field(ge=1)
    entry_count: int = Field(ge=0)
    new_count: int = Field(ge=0)
    changed_count: int = Field(ge=0)
    removed_count: int = Field(ge=0)
    unchanged_count: int = Field(ge=0)
    unknown_source_count: int = Field(ge=0)
    intake_candidate_count: int = Field(ge=0)
    stop_count: int = Field(ge=0)
    languages: tuple[str, ...]


class DiscoveryRunRequest(DiscoveryModel):
    run_id: str = Field(min_length=1)
    created_at: datetime
    queries: tuple[DiscoveryQuery, ...] = Field(min_length=1)
    events: tuple[DiscoveryEvent, ...] = ()

    @model_validator(mode="after")
    def validate_run(self) -> DiscoveryRunRequest:
        if self.created_at.tzinfo is None or self.created_at.utcoffset() is None:
            raise ValueError("discovery run timestamp must be timezone-aware")
        query_ids = [query.query_id for query in self.queries]
        if len(query_ids) != len(set(query_ids)):
            raise ValueError("discovery run contains duplicate query IDs")
        known_query_ids = set(query_ids)
        event_keys: set[tuple[str, int]] = set()
        query_by_id = {query.query_id: query for query in self.queries}
        stop_sequence_by_query: dict[str, int] = {}
        for event in self.events:
            if event.query_id not in known_query_ids:
                raise ValueError("discovery event references an unknown query")
            key = (event.query_id, event.sequence)
            if key in event_keys:
                raise ValueError("discovery query contains duplicate event sequence numbers")
            event_keys.add(key)
            if event.access_basis is not query_by_id[event.query_id].access_basis:
                raise ValueError("discovery event access basis does not match its query")
            if isinstance(event, DiscoveryStopEvent):
                if event.query_id in stop_sequence_by_query:
                    raise ValueError("discovery query cannot contain multiple stop events")
                stop_sequence_by_query[event.query_id] = event.sequence
        for event in self.events:
            stop_sequence = stop_sequence_by_query.get(event.query_id)
            if stop_sequence is not None and event.sequence > stop_sequence:
                raise ValueError("discovery events cannot continue after a stop event")
        return self


class DiscoveryManifest(DiscoveryModel):
    schema_version: Literal[SCHEMA_VERSION] = SCHEMA_VERSION
    manifest_id: str = Field(min_length=1)
    run_id: str = Field(min_length=1)
    created_at: datetime
    state: DiscoveryRunState
    entries: tuple[DiscoveryManifestEntry, ...]
    stops: tuple[DiscoveryStopRecord, ...] = ()
    summary: DiscoverySummary
    write_boundary: dict[str, tuple[str, ...]] = Field(
        default_factory=lambda: {
            "trusted_write_targets": (),
            "publication_write_targets": (),
        }
    )

    @model_validator(mode="after")
    def validate_manifest(self) -> DiscoveryManifest:
        expected_boundary = {
            "trusted_write_targets": (),
            "publication_write_targets": (),
        }
        if self.write_boundary != expected_boundary:
            raise ValueError("discovery manifests cannot declare trusted or publication writes")
        if (self.state is DiscoveryRunState.STOPPED) != bool(self.stops):
            raise ValueError("discovery manifest state must match its stop records")
        source_keys = [entry.source_key for entry in self.entries]
        canonical_urls = [entry.canonical_url for entry in self.entries]
        if len(source_keys) != len(set(source_keys)):
            raise ValueError("discovery manifest contains duplicate source keys")
        if len(canonical_urls) != len(set(canonical_urls)):
            raise ValueError("discovery manifest contains duplicate canonical URLs")
        stop_queries = [stop.query_id for stop in self.stops]
        if len(stop_queries) != len(set(stop_queries)):
            raise ValueError("discovery manifest contains duplicate query stop records")
        expected_counts = {
            MaterialChangeState.NEW: sum(
                entry.change_state is MaterialChangeState.NEW for entry in self.entries
            ),
            MaterialChangeState.CHANGED: sum(
                entry.change_state is MaterialChangeState.CHANGED for entry in self.entries
            ),
            MaterialChangeState.REMOVED: sum(
                entry.change_state is MaterialChangeState.REMOVED for entry in self.entries
            ),
            MaterialChangeState.UNCHANGED: sum(
                entry.change_state is MaterialChangeState.UNCHANGED for entry in self.entries
            ),
        }
        if self.summary.entry_count != len(self.entries):
            raise ValueError("discovery summary entry count does not match the manifest")
        if (
            self.summary.new_count != expected_counts[MaterialChangeState.NEW]
            or self.summary.changed_count != expected_counts[MaterialChangeState.CHANGED]
            or self.summary.removed_count != expected_counts[MaterialChangeState.REMOVED]
            or self.summary.unchanged_count != expected_counts[MaterialChangeState.UNCHANGED]
        ):
            raise ValueError("discovery summary change counts do not match the manifest")
        if self.summary.unknown_source_count != sum(
            entry.known_source_id is None for entry in self.entries
        ):
            raise ValueError("discovery summary unknown-source count does not match the manifest")
        if self.summary.intake_candidate_count != sum(
            entry.intake_candidate_id is not None for entry in self.entries
        ):
            raise ValueError("discovery summary intake count does not match the manifest")
        if self.summary.stop_count != len(self.stops):
            raise ValueError("discovery summary stop count does not match the manifest")
        if self.summary.languages != tuple(sorted(set(self.summary.languages))):
            raise ValueError("discovery summary languages must be unique and sorted")
        return self


class DiscoveryRunResult(DiscoveryModel):
    manifest: DiscoveryManifest
    inventory: DiscoveryInventory
