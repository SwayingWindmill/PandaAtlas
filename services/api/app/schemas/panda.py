from datetime import UTC, date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class HabitatSummary(BaseModel):
    id: UUID
    name: str
    province: str | None = None


class MediaDerivative(BaseModel):
    kind: str
    url: str
    sha256: str
    mime_type: str
    width: int = Field(gt=0)
    height: int = Field(gt=0)
    bytes: int = Field(ge=0)


class MediaAsset(BaseModel):
    id: str
    panda_id: str | None = None
    url: str | None = None
    source_url: str | None = None
    rights: str | None = None
    credit: str | None = None
    alt_zh: str | None = None
    alt_en: str | None = None
    status: str = Field(default="unavailable", pattern="^(available|withdrawn|unavailable)$")
    sha256: str | None = None
    mime_type: str | None = None
    width: int | None = Field(default=None, gt=0)
    height: int | None = Field(default=None, gt=0)
    bytes: int | None = Field(default=None, ge=0)
    derivatives: list[MediaDerivative] = Field(default_factory=list)
    source_ids: list[str] = Field(default_factory=list)
    storage_bucket: str | None = Field(default=None, exclude=True)
    storage_path: str | None = Field(default=None, exclude=True)
    title: str | None = Field(default=None, exclude=True)
    photographer: str | None = Field(default=None, exclude=True)
    signed_url: str | None = Field(default=None, exclude=True)


class IdentityNameRecord(BaseModel):
    value: str
    language: str
    kind: str
    primary: bool
    source_ids: list[str]


class LegacySlugRecord(BaseModel):
    value: str
    source_ids: list[str]


class ExternalIdentifierRecord(BaseModel):
    system: str
    value: str
    source_ids: list[str]


class PandaIdentityProfile(BaseModel):
    stable_id: UUID
    canonical_slug: str
    names: list[IdentityNameRecord]
    aliases: list[IdentityNameRecord]
    legacy_slugs: list[LegacySlugRecord]
    external_identifiers: list[ExternalIdentifierRecord]


class PublicFactConclusion(BaseModel):
    field: str
    value: Any | None
    status: str = Field(pattern="^(confirmed|provisional|disputed|superseded)$")
    last_verified_at: date
    assertion_ids: list[str]
    source_ids: list[str]
    candidate_values: list[Any]
    superseded_values: list[Any]


class PublicSourceSummary(BaseModel):
    id: str
    publisher: str
    title: str
    url: str
    published_at: date | None = None
    last_verified_at: date
    language: str
    access_state: str


class LocalizedPublicContent(BaseModel):
    locale: str
    summary: str

    model_config = {"extra": "forbid"}


class PublicMediaRelease(BaseModel):
    license_state: str = Field(
        pattern="^(licensed|no_licensed_media|source_link_only)$"
    )
    display_mode: str = Field(
        pattern="^(gallery|designed_empty_state|link_to_source)$"
    )
    source_ids: list[str]

    model_config = {"extra": "forbid"}


class PublicRevisionSummary(BaseModel):
    data_version: str
    public_schema_version: str
    summaries: list[LocalizedPublicContent]


class PandaBase(BaseModel):
    id: UUID
    slug: str
    name_zh: str
    name_en: str | None = None
    gender: str = Field(pattern="^(male|female|unknown)$")
    status: str = Field(pattern="^(alive|deceased|unknown)$")
    birth_date: date | None = None
    current_location: str | None = None
    cover_image_url: str | None = None
    search_terms: list[str] = Field(default_factory=list)


class PandaListItem(PandaBase):
    pass


class CurrentPlaceSummary(BaseModel):
    facility_id: UUID | None = None
    coarse_location: str | None = None
    status: str = Field(pattern="^(confirmed|confirmed_country_level|provisional)$")


class PandaResidencySummary(CurrentPlaceSummary):
    id: str
    residency_type: str = Field(pattern="^(primary|temporary|transit|quarantine)$")
    start_date: date
    start_precision: str = Field(default="day", pattern="^(day|month|year)$")
    end_date: date | None = None
    end_precision: str | None = Field(default=None, pattern="^(day|month|year)$")
    source_ids: list[str]


class PandaDomainEventSummary(BaseModel):
    id: str
    event_type: str = Field(pattern="^transfer$")
    event_status: str = Field(pattern="^(announced|completed|cancelled|disputed)$")
    event_date: date
    event_date_precision: str = Field(default="day", pattern="^(day|month|year)$")
    participants: list[UUID]
    from_facility_id: UUID | None = None
    from_coarse_location: str | None = None
    to_facility_id: UUID | None = None
    to_coarse_location: str | None = None
    source_ids: list[str]
    changes_current_residency: bool


class PandaDetail(PandaBase):
    intro: str | None = None
    birthplace: str | None = None
    tags: list[str] = Field(default_factory=list)
    father_id: UUID | None = None
    mother_id: UUID | None = None
    habitats: list[HabitatSummary] = Field(default_factory=list)
    media: list[MediaAsset] = Field(default_factory=list)
    identity: PandaIdentityProfile | None = None
    conclusions: list[PublicFactConclusion] = Field(default_factory=list)
    sources: list[PublicSourceSummary] = Field(default_factory=list)
    current_place: CurrentPlaceSummary | None = None
    residencies: list[PandaResidencySummary] = Field(default_factory=list)
    events: list[PandaDomainEventSummary] = Field(default_factory=list)
    record_tier: str | None = None
    localized_content: list[LocalizedPublicContent] = Field(default_factory=list)
    media_release: PublicMediaRelease | None = None
    public_revision: PublicRevisionSummary | None = None


class PandaLineageNode(PandaBase):
    intro: str | None = None
    tags: list[str] = Field(default_factory=list)
    father_id: UUID | None = None
    mother_id: UUID | None = None


class PandaLineageEdge(BaseModel):
    parent_id: UUID
    child_id: UUID


class PandaLineageRelationship(BaseModel):
    subject_id: UUID
    related_id: UUID
    kind: str = Field(pattern="^(parent|child|sibling|grandparent)$")
    path: list[UUID]


class PandaLineageMeta(BaseModel):
    ancestor_depth: int
    descendant_depth: int


class PandaLineageResponse(BaseModel):
    focus_id: UUID
    nodes: list[PandaLineageNode]
    edges: list[PandaLineageEdge]
    relationships: list[PandaLineageRelationship] = Field(default_factory=list)
    meta: PandaLineageMeta


class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total: int


class PaginatedPandasResponse(BaseModel):
    items: list[PandaListItem]
    meta: PaginationMeta


class ImportSourceOption(BaseModel):
    name: str
    label: str
    source_path: str


class ImportSourceList(BaseModel):
    items: list[ImportSourceOption]


class ImportJobCreate(BaseModel):
    source_name: str


class ImportJobSummary(BaseModel):
    rows_total: int = 0
    rows_success: int = 0
    rows_failed: int = 0
    source_name: str = ""
    source_path: str = ""
    mode: str = ""
    failure_reason: str | None = None


class ImportJob(BaseModel):
    id: UUID
    source_name: str
    source_uri: str | None = None
    status: str = Field(pattern="^(queued|running|succeeded|failed)$")
    summary: ImportJobSummary = Field(default_factory=ImportJobSummary)
    error_log: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
