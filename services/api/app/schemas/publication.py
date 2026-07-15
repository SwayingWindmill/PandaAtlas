from datetime import date, datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.schemas.map import (
    DistributionGeoJsonFeature,
    DistributionSnapshot,
    HabitatGeoJsonFeature,
)
from app.schemas.panda import LocalizedPublicContent, PandaDetail, PublicMediaRelease
from app.schemas.stats import OverviewStats

ChangeSetStatus = Literal["draft", "submitted", "approved", "rejected"]
ReviewDecision = Literal["approved", "rejected"]
BatchStatus = Literal["draft", "published"]
PublicationOperation = Literal["release", "rollback", "withdrawal"]
PreviewCategory = Literal[
    "unresolved_reference",
    "residency_conflict",
    "translation_state",
    "source_availability",
    "license_problem",
]


class PandaPublicRecord(BaseModel):
    slug: str | None = None
    name_zh: str | None = None
    name_en: str | None = None
    gender: Literal["male", "female", "unknown"] | None = None
    birth_date: date | None = None
    death_date: date | None = None
    status: Literal["alive", "deceased", "unknown"] | None = None
    birthplace: str | None = None
    current_location: str | None = None
    intro: str | None = None
    tags: list[str] | None = None
    is_featured: bool | None = None
    search_terms: list[str] | None = None
    record_tier: Literal[
        "complete_first_pass", "identity_first_pass", "dependency_stub"
    ] | None = None
    localized_content: list[LocalizedPublicContent] | None = None
    media_release: PublicMediaRelease | None = None
    revision_summaries: list[LocalizedPublicContent] | None = None

    model_config = {"extra": "forbid"}


PANDA_PUBLIC_REVISION_FIELDS = set(PandaPublicRecord.model_fields)


class EntityRevisionCreate(BaseModel):
    entity_type: str = Field(min_length=1, max_length=80)
    entity_id: str = Field(min_length=1, max_length=200)
    payload: "EntityRevisionPayload"

    @model_validator(mode="after")
    def validate_public_projection(self) -> "EntityRevisionCreate":
        if self.entity_type == "panda":
            UUID(self.entity_id)
            unsupported = set(self.payload.public_record) - PANDA_PUBLIC_REVISION_FIELDS
            if unsupported:
                fields = ", ".join(sorted(unsupported))
                raise ValueError(f"Unsupported or restricted panda public fields: {fields}")
            PandaPublicRecord.model_validate(self.payload.public_record)
            return self
        runtime_models = {
            "api_pandas": PandaDetail,
            "api_distribution": DistributionGeoJsonFeature,
            "api_habitats": HabitatGeoJsonFeature,
            "api_snapshots": DistributionSnapshot,
            "api_stats": OverviewStats,
        }
        model = runtime_models.get(self.entity_type)
        if model is None:
            raise ValueError("Unsupported public projection entity type")
        validated = model.model_validate(self.payload.public_record)
        if self.entity_type == "api_pandas" and str(validated.id) != self.entity_id:
            raise ValueError("api_pandas entity_id must match public_record.id")
        if self.entity_type in {"api_distribution", "api_habitats"}:
            if validated.id is None or str(validated.id) != self.entity_id:
                raise ValueError(f"{self.entity_type} entity_id must match public_record.id")
        if self.entity_type == "api_snapshots" and validated.version != self.entity_id:
            raise ValueError("api_snapshots entity_id must match public_record.version")
        if self.entity_type == "api_stats" and self.entity_id != "overview":
            raise ValueError("api_stats entity_id must be overview")
        return self


class PublicationReferenceCheck(BaseModel):
    target_type: str = Field(min_length=1, max_length=80)
    target_id: str = Field(min_length=1, max_length=200)
    resolved: bool


class PublicationResidencyCheck(BaseModel):
    panda_id: str = Field(min_length=1, max_length=200)
    start_date: str
    end_date: str | None = None


class PublicationTranslationCheck(BaseModel):
    language_tag: str = Field(min_length=1, max_length=40)
    status: str = Field(min_length=1, max_length=40)


class PublicationSourceCheck(BaseModel):
    id: str = Field(min_length=1, max_length=200)
    access_state: str = Field(min_length=1, max_length=40)


class PublicationMediaCheck(BaseModel):
    id: str = Field(min_length=1, max_length=200)
    license: str | None


class PublicationChecks(BaseModel):
    references: list[PublicationReferenceCheck]
    residencies: list[PublicationResidencyCheck]
    translations: list[PublicationTranslationCheck]
    sources: list[PublicationSourceCheck]
    media: list[PublicationMediaCheck]


class EntityRevisionPayload(BaseModel):
    public_record: dict[str, Any] = Field(min_length=1)
    publication_checks: PublicationChecks


class EntityRevisionRead(EntityRevisionCreate):
    id: UUID
    revision_number: int
    created_by: UUID
    substantive_modified_by: UUID


class ChangeSetCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    reason: str = Field(min_length=1, max_length=2000)
    revisions: list[EntityRevisionCreate] = Field(min_length=1)


class ChangeSetRead(BaseModel):
    id: UUID
    title: str
    reason: str
    status: ChangeSetStatus
    created_by: UUID
    revisions: list[EntityRevisionRead]
    reviewed_by: UUID | None = None
    review_reason: str | None = None


class ChangeSetReview(BaseModel):
    decision: ReviewDecision
    reason: str = Field(min_length=1, max_length=2000)


class PublicationBatchCreate(BaseModel):
    change_set_ids: list[UUID] = Field(min_length=1)
    public_schema_version: Literal["1.0.0"]
    data_version: str = Field(min_length=1, max_length=120)
    database_migration_version: str = Field(default="0007", min_length=1, max_length=120)
    projection_code_version: str = Field(default="public-release-v2", min_length=1, max_length=200)
    reason: str = Field(min_length=1, max_length=2000)
    correlation_id: UUID


class PublicationIssueRead(BaseModel):
    category: PreviewCategory
    entity_type: str
    entity_id: str
    detail: str


class PublicationPreviewRead(BaseModel):
    is_publishable: bool
    issues: list[PublicationIssueRead]


class PublicationBatchRead(BaseModel):
    id: UUID
    change_set_ids: list[UUID]
    public_schema_version: str
    data_version: str
    database_migration_version: str
    projection_code_version: str
    reason: str
    correlation_id: UUID
    operation: PublicationOperation
    status: BatchStatus
    created_by: UUID
    published_by: UUID | None = None
    published_at: datetime | None = None
    previous_batch_id: UUID | None = None
    rollback_target_id: UUID | None = None
    withdrawal_target_id: UUID | None = None


class PublicationAction(BaseModel):
    reason: str = Field(min_length=1, max_length=2000)
    correlation_id: UUID
    data_version: str = Field(min_length=1, max_length=120)
