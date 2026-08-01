from __future__ import annotations

from datetime import date
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.panda import PaginationMeta, PandaDetail, PublicSourceSummary


class LocalizedEditorialContent(BaseModel):
    locale: Literal["zh-CN", "en"]
    title: str
    summary: str

    model_config = {"extra": "forbid"}


class PublicParentageAssertion(BaseModel):
    id: str
    child_id: UUID
    parent_id: UUID
    role: Literal["father", "mother"]
    status: Literal["confirmed", "tentative", "disputed", "superseded"]
    source_ids: list[str]

    model_config = {"extra": "forbid"}


PublicProfileModuleId = Literal[
    "overview",
    "story",
    "timeline",
    "family",
    "footprint",
    "media",
    "sources",
    "revisions",
]


class PublicProfileModuleSummary(BaseModel):
    id: PublicProfileModuleId
    state: Literal["complete", "partial", "empty", "unavailable"]
    item_count: int = Field(ge=0)

    model_config = {"extra": "forbid"}


class PublicProfileV2Response(BaseModel):
    panda: PandaDetail
    modules: list[PublicProfileModuleSummary]
    parentage_assertions: list[PublicParentageAssertion]
    facilities: list[dict[str, Any]]
    places: list[dict[str, Any]]
    institutions: list[dict[str, Any]]
    family_story_slugs: list[str]
    moments_href: str
    cohort_state: Literal["rich", "sparse", "historic", "standard"]
    coverage_state: Literal["complete", "partial"]
    release: dict[str, str]

    model_config = {"extra": "forbid"}


class PublicMomentParticipant(BaseModel):
    id: UUID
    slug: str
    name_zh: str
    name_en: str | None = None
    profile_available: bool = True

    model_config = {"extra": "forbid"}


class PublicMomentOccurrence(BaseModel):
    id: str
    occurrence_kind: Literal["source_event", "derived_anniversary"]
    event_type: str
    event_status: str
    occurrence_date: date
    date_precision: Literal["day", "month", "year"] = "day"
    source_event_id: str
    anniversary_year: int | None = None
    participants: list[PublicMomentParticipant]
    from_facility_id: UUID | None = None
    from_coarse_location: str | None = None
    to_facility_id: UUID | None = None
    to_coarse_location: str | None = None
    source_ids: list[str]
    changes_current_residency: bool = False

    model_config = {"extra": "forbid"}


class PublicMomentFacets(BaseModel):
    event_types: dict[str, int]
    event_statuses: dict[str, int]
    pandas: dict[str, int]
    years: dict[str, int]

    model_config = {"extra": "forbid"}


class PublicMomentsResponse(BaseModel):
    items: list[PublicMomentOccurrence]
    meta: PaginationMeta
    facets: PublicMomentFacets
    source_event_total: int = Field(ge=0)
    derived_occurrence_total: int = Field(ge=0)
    coverage_state: Literal["complete", "partial"]
    release: dict[str, str]

    model_config = {"extra": "forbid"}


class PublicFamilyStoryScope(BaseModel):
    coverage_state: Literal["complete_for_declared_scope", "partial"]
    member_ids: list[UUID]
    relationship_assertion_ids: list[str]
    excluded_relationship_assertion_ids: list[str]

    model_config = {"extra": "forbid"}


class PublicFamilyStoryChapter(BaseModel):
    id: str
    kind: str
    localized_content: list[LocalizedEditorialContent]
    member_ids: list[UUID]
    event_ids: list[str]
    relationship_assertion_ids: list[str]
    facility_ids: list[UUID]
    place_ids: list[str]

    model_config = {"extra": "forbid"}


class PublicFamilyStoryMedia(BaseModel):
    featured_panda_ids: list[UUID]
    selection_state: Literal["reviewed"]

    model_config = {"extra": "forbid"}


class PublicFamilyStoryRevision(BaseModel):
    data_version: str
    public_schema_version: str

    model_config = {"extra": "forbid"}


class PublicFamilyStorySummary(BaseModel):
    id: str
    slug: str
    story_type: str
    localized_content: list[LocalizedEditorialContent]
    scope: PublicFamilyStoryScope
    member_ids: list[UUID]
    source_ids: list[str]
    revision: PublicFamilyStoryRevision

    model_config = {"extra": "forbid"}


class PublicFamilyStoryResponse(PublicFamilyStorySummary):
    relationship_assertion_ids: list[str]
    chapters: list[PublicFamilyStoryChapter]
    media: PublicFamilyStoryMedia
    members: list[PandaDetail]
    relationships: list[PublicParentageAssertion]
    events: list[PublicMomentOccurrence]
    sources: list[PublicSourceSummary]

    model_config = {"extra": "forbid"}


class PublicFamilyStoryListResponse(BaseModel):
    items: list[PublicFamilyStorySummary]
    meta: PaginationMeta
    release: dict[str, str]

    model_config = {"extra": "forbid"}
