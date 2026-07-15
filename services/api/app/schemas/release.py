from typing import Any

from pydantic import BaseModel


class PublicReleaseMetadata(BaseModel):
    dataset_release_version: str
    public_schema_version: str
    database_migration_version: str
    publication_batch_id: str
    projection_code_version: str
    released_at: str
    licenses: dict[str, str]


class PublicPandaRelease(BaseModel):
    release: PublicReleaseMetadata
    records: list[dict[str, Any]]
