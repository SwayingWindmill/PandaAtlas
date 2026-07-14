from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.data.golden_dataset import load_golden_dataset
from app.db.session import has_database, session_scope
from app.schemas.release import PublicReleaseMetadata

DATABASE_MIGRATION_VERSION = "0006"
PROJECTION_CODE_VERSION = "public-release-v1"


def _golden_release_metadata() -> PublicReleaseMetadata:
    dataset = load_golden_dataset()["dataset"]
    return PublicReleaseMetadata(
        dataset_release_version=dataset["version"],
        public_schema_version=dataset["public_schema_version"],
        database_migration_version=DATABASE_MIGRATION_VERSION,
        publication_batch_id="golden-dataset",
        projection_code_version=PROJECTION_CODE_VERSION,
        released_at="2026-07-14T00:00:00Z",
        licenses=dataset["licenses"],
    )


def _database_release_metadata() -> PublicReleaseMetadata | None:
    with session_scope() as session:
        if session is None:
            raise SQLAlchemyError("Database session unavailable")
        row = session.execute(
            text(
                """
                select
                  batch.id,
                  batch.public_schema_version,
                  batch.data_version,
                  batch.operation,
                  batch.database_migration_version,
                  batch.projection_code_version,
                  batch.created_at
                from public.public_release_pointer pointer
                join public.publication_batches batch on batch.id = pointer.active_batch_id
                where pointer.singleton = true
                """
            )
        ).mappings().first()
    if row is None:
        return None
    if row["operation"] == "withdrawal":
        raise HTTPException(status_code=410, detail="Current public release is withdrawn")
    released_at = row["created_at"]
    if hasattr(released_at, "isoformat"):
        released_at = released_at.isoformat().replace("+00:00", "Z")
    return PublicReleaseMetadata(
        dataset_release_version=row["data_version"],
        public_schema_version=row["public_schema_version"],
        database_migration_version=row["database_migration_version"],
        publication_batch_id=str(row["id"]),
        projection_code_version=row["projection_code_version"],
        released_at=str(released_at),
        licenses=_golden_release_metadata().licenses,
    )


def get_current_release_metadata() -> PublicReleaseMetadata:
    if has_database():
        try:
            metadata = _database_release_metadata()
            if metadata is not None:
                return metadata
        except HTTPException:
            raise
        except SQLAlchemyError as error:
            if not settings.db_use_mock_fallback:
                raise HTTPException(status_code=503, detail="Database unavailable") from error
    return _golden_release_metadata()


def release_headers(metadata: PublicReleaseMetadata) -> dict[str, str]:
    return {
        "X-PandaAtlas-Dataset-Version": metadata.dataset_release_version,
        "X-PandaAtlas-Public-Schema-Version": metadata.public_schema_version,
        "X-PandaAtlas-Database-Migration-Version": metadata.database_migration_version,
    }
