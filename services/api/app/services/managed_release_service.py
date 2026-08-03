from __future__ import annotations

import json
from collections import Counter
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.db.session import has_database, session_scope
from app.projection.public_release import CANONICAL_ENTITY_TYPES, _runtime_api
from app.release_manifests import load_release_manifest
from app.schemas.release import PublicPandaRelease, PublicReleaseMetadata
from app.services import release_service as file_release

pin_current_release_metadata = file_release.pin_current_release_metadata
reset_current_release_metadata = file_release.reset_current_release_metadata
release_headers = file_release.release_headers


def _active_database_release() -> tuple[UUID, PublicReleaseMetadata]:
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
                  batch.projection_code_version
                from public.public_release_pointer pointer
                join public.publication_batches batch on batch.id = pointer.active_batch_id
                where pointer.singleton = true
                """
            )
        ).mappings().one_or_none()
    if row is None:
        raise HTTPException(status_code=503, detail="No active public release")
    if str(row["operation"]) == "withdrawal":
        raise HTTPException(status_code=410, detail="Current public release is withdrawn")

    manifest = load_release_manifest(str(row["data_version"]))
    if manifest is None:
        raise HTTPException(status_code=503, detail="Public release manifest unavailable")
    for field in (
        "public_schema_version",
        "database_migration_version",
        "projection_code_version",
    ):
        if str(row[field]) != str(manifest[field]):
            raise HTTPException(status_code=503, detail="Public release manifest mismatch")

    metadata = PublicReleaseMetadata(
        dataset_release_version=str(manifest["dataset_release_version"]),
        public_schema_version=str(manifest["public_schema_version"]),
        database_migration_version=str(manifest["database_migration_version"]),
        publication_batch_id=str(manifest["publication_batch_id"]),
        projection_code_version=str(manifest["projection_code_version"]),
        released_at=str(manifest["released_at"]),
        licenses=dict(manifest["licenses"]),
    )
    return UUID(str(row["id"])), metadata


def get_current_release_metadata() -> PublicReleaseMetadata:
    pinned = file_release._request_release.get()
    if pinned is not None:
        return pinned
    if not has_database():
        return file_release.get_current_release_metadata()
    try:
        _, metadata = _active_database_release()
        file_release._ensure_database_release_not_withdrawn(
            metadata.dataset_release_version
        )
        return metadata
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise HTTPException(status_code=503, detail="Database unavailable") from error


def _published_records(
    release_id: UUID,
    metadata: PublicReleaseMetadata,
) -> list[dict[str, Any]]:
    with session_scope() as session:
        if session is None:
            raise SQLAlchemyError("Database session unavailable")
        rows = session.execute(
            text(
                """
                select distinct on (revision.entity_type, revision.entity_id)
                  revision.entity_type,
                  revision.entity_id,
                  revision.payload,
                  revision.revision_number,
                  revision.created_at
                from public.publication_batch_change_sets batch_link
                join public.change_set_revisions change_link
                  on change_link.change_set_id = batch_link.change_set_id
                join public.entity_revisions revision
                  on revision.id = change_link.revision_id
                where batch_link.batch_id = :release_id
                order by revision.entity_type, revision.entity_id,
                         revision.revision_number desc, revision.created_at desc
                """
            ),
            {"release_id": release_id},
        ).mappings().all()

    records: list[dict[str, Any]] = []
    for row in rows:
        payload = row["payload"]
        if not isinstance(payload, dict):
            payload = json.loads(payload)
        public_record = payload.get("public_record")
        if not isinstance(public_record, dict):
            raise HTTPException(status_code=503, detail="Public release revision is invalid")
        entity_type = CANONICAL_ENTITY_TYPES.get(
            str(row["entity_type"]), str(row["entity_type"])
        )
        records.append(
            {
                "entity_type": entity_type,
                "id": str(row["entity_id"]),
                "public": public_record,
            }
        )

    manifest = load_release_manifest(metadata.dataset_release_version)
    if manifest is None:
        raise HTTPException(status_code=503, detail="Public release manifest unavailable")
    counts = Counter(str(record["entity_type"]) for record in records)
    expected = {
        str(entity_type): int(count)
        for entity_type, count in dict(manifest["record_counts"]).items()
    }
    if counts != Counter(expected):
        raise HTTPException(status_code=503, detail="Public release record counts mismatch")
    return records


def _database_runtime_release() -> tuple[PublicReleaseMetadata, dict[str, Any], list[dict[str, Any]]]:
    release_id, metadata = _active_database_release()
    records = _published_records(release_id, metadata)
    release = metadata.model_dump(mode="json", exclude={"licenses"})
    source_state = {
        "dataset": {
            "version": metadata.dataset_release_version,
            "public_schema_version": metadata.public_schema_version,
            "licenses": metadata.licenses,
        },
        "records": [],
    }
    runtime = _runtime_api(source_state, release, records)
    return metadata, runtime, records


def get_current_api_release() -> dict[str, object]:
    if not has_database():
        return file_release.get_current_api_release()
    try:
        metadata, runtime, _ = _database_runtime_release()
        return file_release._apply_database_withdrawals(
            runtime, metadata.dataset_release_version
        )
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise HTTPException(status_code=503, detail="Database unavailable") from error


def get_current_panda_release() -> PublicPandaRelease:
    if not has_database():
        return file_release.get_current_panda_release()
    try:
        metadata, _, records = _database_runtime_release()
        pandas = [
            {"id": record["id"], **record["public"]}
            for record in records
            if record["entity_type"] == "pandas"
            and record["public"].get("record_tier") != "dependency_stub"
        ]
        pandas = file_release._filter_panda_records_for_database_withdrawals(
            pandas, metadata.dataset_release_version
        )
        return PublicPandaRelease(release=metadata, records=pandas)
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise HTTPException(status_code=503, detail="Database unavailable") from error
