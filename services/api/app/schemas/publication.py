from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

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
PANDA_PUBLIC_REVISION_FIELDS = {
    "name_zh",
    "name_en",
    "gender",
    "birth_date",
    "death_date",
    "status",
    "birthplace",
    "current_location",
    "intro",
    "tags",
    "is_featured",
}


class EntityRevisionCreate(BaseModel):
    entity_type: str = Field(min_length=1, max_length=80)
    entity_id: str = Field(min_length=1, max_length=200)
    payload: "EntityRevisionPayload"

    @model_validator(mode="after")
    def validate_public_projection(self) -> "EntityRevisionCreate":
        if self.entity_type != "panda":
            raise ValueError("Issue #9 publication revisions currently support panda records")
        UUID(self.entity_id)
        unsupported = set(self.payload.public_record) - PANDA_PUBLIC_REVISION_FIELDS
        if unsupported:
            fields = ", ".join(sorted(unsupported))
            raise ValueError(f"Unsupported or restricted panda public fields: {fields}")
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
