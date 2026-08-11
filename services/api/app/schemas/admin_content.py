from __future__ import annotations

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

AdminPublicationState = Literal["draft", "published"]
AdminWorkflowState = Literal[
    "none",
    "draft",
    "submitted",
    "approved",
    "rejected",
    "validation_failed",
    "ready",
    "publishing",
    "published",
    "publish_failed",
    "superseded",
    "rolled_back",
    "withdrawn",
]
AdminDataQuality = Literal["verified", "likely", "uncertain"]


class AdminPandaCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name_zh: str = Field(min_length=1, max_length=200)
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", min_length=1, max_length=160)
    gender: Literal["male", "female", "unknown"] = "unknown"
    birth_date: date | None = None


class AdminPandaBasicChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name_zh: str = Field(min_length=1, max_length=200)
    name_en: str | None = Field(default=None, max_length=200)
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", min_length=1, max_length=160)
    gender: Literal["male", "female", "unknown"]
    birth_date: date | None = None
    death_date: date | None = None
    status: Literal["alive", "deceased", "unknown"]
    birthplace: str | None = Field(default=None, max_length=300)
    current_location: str | None = Field(default=None, max_length=300)
    intro: str | None = Field(default=None, max_length=4000)
    tags: list[str] = Field(default_factory=list, max_length=30)
    is_featured: bool = False
    reason: str = Field(min_length=3, max_length=2000)


class AdminPandaListItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    slug: str
    name_zh: str
    name_en: str | None
    gender: str
    birth_date: date | None
    current_location: str | None
    publication_state: AdminPublicationState
    workflow_state: AdminWorkflowState
    completeness: int = Field(ge=0, le=100)
    data_quality: AdminDataQuality
    has_cover: bool
    source_count: int
    updated_at: datetime
    last_editor: str | None = None
    working_change_set_id: UUID | None = None


class AdminPandaListRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[AdminPandaListItem]
    total: int
    page: int
    page_size: int


class AdminPandaNameRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    value: str
    language_tag: str
    name_kind: str
    is_primary: bool
    publication_status: str
    source_ids: list[str]


class AdminPandaParentRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    assertion_id: str
    role: Literal["father", "mother"]
    status: str
    parent_id: UUID
    parent_slug: str
    parent_name_zh: str
    parent_name_en: str | None
    parent_birth_date: date | None
    source_ids: list[str]


class AdminPandaResidencyRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    residency_type: str
    start_date: date
    start_precision: str
    end_date: date | None
    end_precision: str | None
    status: str
    publication_status: str
    facility_id: UUID | None
    facility_name: str | None
    coarse_location: str | None
    source_ids: list[str]


class AdminPandaEventRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    event_type: str
    event_status: str
    event_date: date
    event_date_precision: str
    publication_status: str
    source_ids: list[str]


class AdminPandaMediaRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    title: str | None = None
    photographer: str | None = None
    copyright_text: str | None = None
    license: str | None = None
    taken_at: datetime | None = None
    storage_bucket: str | None = None
    storage_path: str | None = None
    url: str | None = None
    source_url: str | None = None
    credit: str | None = None
    alt_zh: str | None = None
    alt_en: str | None = None
    source_ids: list[str] = Field(default_factory=list)
    is_cover: bool
    display_order: int = 0


class AdminEvidenceSourceRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    publisher: str
    title: str
    url: str
    published_at: date | None
    last_verified_at: date
    access_state: str
    publication_status: str
    evidence_tier: str | None


class AdminPandaWorkflowRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    change_set_id: UUID | None = None
    status: AdminWorkflowState = "none"
    governance_version: int | None = None
    validation_state: str | None = None
    validation_reason: str | None = None
    base_archive_version: str
    can_validate: bool = False
    can_publish: bool = False


class AdminPandaDetailRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    panda: AdminPandaListItem
    status: str
    death_date: date | None
    birthplace: str | None
    intro: str | None
    tags: list[str]
    is_featured: bool
    names: list[AdminPandaNameRead]
    parents: list[AdminPandaParentRead]
    residencies: list[AdminPandaResidencyRead]
    events: list[AdminPandaEventRead]
    media: list[AdminPandaMediaRead]
    sources: list[AdminEvidenceSourceRead]
    workflow: AdminPandaWorkflowRead
    quality_issues: list[str]


class AdminPandaDraftCreatedRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    slug: str
    name_zh: str
    publication_state: Literal["draft"] = "draft"


class AdminPandaChangeSetRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    change_set_id: UUID
    status: AdminWorkflowState
    governance_version: int


class AdminPandaNameCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    value: str = Field(min_length=1, max_length=200)
    language_tag: str = Field(min_length=2, max_length=40)
    name_kind: Literal[
        "official",
        "official_romanization",
        "pinyin",
        "alias",
        "historic_spelling",
        "historical_name",
        "nickname",
    ]
    is_primary: bool = False
    source_ids: list[str] = Field(default_factory=list, max_length=20)
    reason: str = Field(min_length=3, max_length=2000)


class AdminPandaParentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["father", "mother"]
    parent_id: UUID
    status: Literal["confirmed", "tentative", "disputed"] = "confirmed"
    source_ids: list[str] = Field(min_length=1, max_length=20)
    reason: str = Field(min_length=3, max_length=2000)


class AdminPandaResidencyCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    residency_type: Literal["primary", "temporary", "transit", "quarantine"] = "primary"
    start_date: date
    start_precision: Literal["day", "month", "year", "unknown"] = "day"
    end_date: date | None = None
    end_precision: Literal["day", "month", "year", "unknown"] | None = None
    facility_id: UUID | None = None
    coarse_location: str | None = Field(default=None, max_length=300)
    status: Literal["confirmed", "confirmed_country_level", "provisional"] = "confirmed"
    source_ids: list[str] = Field(min_length=1, max_length=20)
    reason: str = Field(min_length=3, max_length=2000)


class AdminPandaEventCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event_type: Literal[
        "birth",
        "arrival",
        "transfer",
        "return",
        "naming",
        "public_debut",
        "selection",
        "announcement",
        "observation",
        "death",
    ]
    event_date: date
    event_date_precision: Literal["day", "month", "year", "unknown"] = "day"
    event_status: Literal["announced", "completed", "cancelled", "disputed"] = "completed"
    facility_id: UUID | None = None
    coarse_location: str | None = Field(default=None, max_length=300)
    source_ids: list[str] = Field(min_length=1, max_length=20)
    reason: str = Field(min_length=3, max_length=2000)


class AdminEvidenceSourceCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_id: str = Field(pattern=r"^[a-z0-9][a-z0-9._:-]{2,199}$")
    publisher: str = Field(min_length=1, max_length=300)
    title: str = Field(min_length=1, max_length=500)
    url: str = Field(pattern=r"^https://", max_length=2000)
    published_at: date | None = None
    last_verified_at: date
    language_tag: str = Field(min_length=2, max_length=40)
    access_state: Literal[
        "accessible", "redirected", "changed", "unavailable", "archived", "restricted"
    ] = "accessible"
    evidence_tier: Literal["primary", "secondary", "unverified"] = "unverified"
    reason: str = Field(min_length=3, max_length=2000)


class AdminPandaMediaCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    media_id: str = Field(pattern=r"^[a-z0-9][a-z0-9._:-]{2,199}$")
    source_url: str = Field(pattern=r"^https://", max_length=2000)
    url: str = Field(pattern=r"^https://", max_length=2000)
    rights: Literal[
        "owned",
        "licensed",
        "permission_granted",
        "public_domain",
        "external_reference",
    ]
    credit: str = Field(min_length=1, max_length=500)
    alt_zh: str = Field(min_length=1, max_length=500)
    alt_en: str = Field(min_length=1, max_length=500)
    source_ids: list[str] = Field(min_length=1, max_length=20)
    sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    mime_type: Literal["image/jpeg", "image/png", "image/webp"]
    width: int = Field(gt=0)
    height: int = Field(gt=0)
    byte_size: int = Field(ge=0)
    derivative_url: str = Field(pattern=r"^https://", max_length=2000)
    derivative_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    derivative_width: int = Field(gt=0)
    derivative_height: int = Field(gt=0)
    is_cover: bool = False
    reason: str = Field(min_length=3, max_length=2000)


class AdminContentCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: str = Field(min_length=3, max_length=2000)


class AdminValidationIssueRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category: str
    entity_type: str
    entity_id: str
    detail: str


class AdminPandaValidationRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    change_set_id: UUID
    outcome: Literal["ready", "validation_failed"]
    governance_version: int
    base_archive_version: str
    issues: list[AdminValidationIssueRead]


class AdminPandaPublishRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    change_set_id: UUID
    release_id: UUID
    data_version: str
    published_at: datetime
    public_projection_status: str


class AdminDashboardIssue(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str
    label: str
    count: int
    href: str


class AdminRecentActivityRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    actor: str
    action: str
    object_type: str
    object_id: str
    occurred_at: datetime


class AdminContentDashboardRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    panda_total: int
    panda_published: int
    panda_draft: int
    panda_incomplete: int
    pending_media: int
    recent_sources: int
    issues: list[AdminDashboardIssue]
    recent_activity: list[AdminRecentActivityRead]


AdminCenterDomain = Literal[
    "locations",
    "relationships",
    "events",
    "images",
    "sources",
    "users",
]


class AdminCenterItemRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    domain: AdminCenterDomain
    entity_type: str
    title: str
    subtitle: str | None = None
    state: str
    issue_codes: list[str] = Field(default_factory=list)
    panda_id: UUID | None = None
    panda_name: str | None = None
    href: str | None = None
    updated_at: datetime | None = None


class AdminCenterRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    domain: AdminCenterDomain
    items: list[AdminCenterItemRead]
    total: int
    page: int
    page_size: int
    issue_count: int
