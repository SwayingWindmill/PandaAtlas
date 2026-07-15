from __future__ import annotations

import hashlib
import json
from contextvars import ContextVar, Token
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.data.golden_dataset import load_golden_dataset
from app.db.session import has_database, session_scope
from app.schemas.release import PublicPandaRelease, PublicReleaseMetadata

DATABASE_MIGRATION_VERSION = "0007"
PROJECTION_CODE_VERSION = "public-release-v2"
_request_release: ContextVar[PublicReleaseMetadata | None] = ContextVar(
    "request_public_release", default=None
)


def _golden_release_metadata() -> PublicReleaseMetadata:
    dataset = load_golden_dataset()["dataset"]
    return PublicReleaseMetadata(
        dataset_release_version=dataset["version"],
        public_schema_version=dataset["public_schema_version"],
        database_migration_version=DATABASE_MIGRATION_VERSION,
        publication_batch_id="golden-dataset",
        projection_code_version=PROJECTION_CODE_VERSION,
        released_at="2026-07-14T12:00:00Z",
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
                  coalesce(batch.published_at, batch.created_at) as released_at
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
    released_at = row["released_at"]
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
    pinned = _request_release.get()
    if pinned is not None:
        return pinned
    if has_database():
        try:
            metadata = _database_release_metadata()
        except HTTPException:
            raise
        except SQLAlchemyError as error:
            raise HTTPException(status_code=503, detail="Database unavailable") from error
        else:
            if metadata is not None:
                try:
                    _ensure_database_release_not_withdrawn(
                        metadata.dataset_release_version
                    )
                except SQLAlchemyError as error:
                    raise HTTPException(
                        status_code=503, detail="Withdrawal state unavailable"
                    ) from error
                return metadata
        raise HTTPException(status_code=503, detail="No active public release")
    return _golden_release_metadata()


def pin_current_release_metadata(
    metadata: PublicReleaseMetadata,
) -> Token[PublicReleaseMetadata | None]:
    return _request_release.set(metadata)


def reset_current_release_metadata(
    token: Token[PublicReleaseMetadata | None],
) -> None:
    _request_release.reset(token)


def release_headers(metadata: PublicReleaseMetadata) -> dict[str, str]:
    return {
        "X-PandaAtlas-Dataset-Version": metadata.dataset_release_version,
        "X-PandaAtlas-Public-Schema-Version": metadata.public_schema_version,
        "X-PandaAtlas-Database-Migration-Version": metadata.database_migration_version,
    }


def _release_artifact_candidates(version: str) -> tuple[Path, ...]:
    module_path = Path(__file__).resolve()
    candidates = [
        parent / "data" / "public-releases" / version / "pandas.json"
        for parent in module_path.parents
    ]
    candidates.append(Path.cwd() / "data" / "public-releases" / version / "pandas.json")
    return tuple(dict.fromkeys(path.resolve() for path in candidates))


def _artifact_candidates(version: str, filename: str) -> tuple[Path, ...]:
    return tuple(path.with_name(filename) for path in _release_artifact_candidates(version))


def get_current_panda_release() -> PublicPandaRelease:
    metadata = get_current_release_metadata()
    for path in _release_artifact_candidates(metadata.dataset_release_version):
        if not path.is_file():
            continue
        payload = json.loads(path.read_text(encoding="utf-8"))
        artifact_release = payload.get("release", {})
        for field in (
            "dataset_release_version",
            "public_schema_version",
            "database_migration_version",
            "publication_batch_id",
            "projection_code_version",
            "released_at",
        ):
            if artifact_release.get(field) != getattr(metadata, field):
                raise HTTPException(status_code=503, detail="Public release artifact mismatch")
        records = payload.get("records", [])
        if has_database():
            try:
                records = _filter_panda_records_for_database_withdrawals(
                    records, metadata.dataset_release_version
                )
            except SQLAlchemyError as error:
                raise HTTPException(
                    status_code=503, detail="Withdrawal state unavailable"
                ) from error
        return PublicPandaRelease(release=metadata, records=records)
    raise HTTPException(status_code=503, detail="Public release artifact unavailable")


def get_current_api_release() -> dict[str, object]:
    metadata = get_current_release_metadata()
    for path in _artifact_candidates(metadata.dataset_release_version, "api.json"):
        if not path.is_file():
            continue
        payload = json.loads(path.read_text(encoding="utf-8"))
        artifact_release = payload.get("release", {})
        for field in (
            "dataset_release_version",
            "public_schema_version",
            "database_migration_version",
            "publication_batch_id",
            "projection_code_version",
            "released_at",
        ):
            if artifact_release.get(field) != getattr(metadata, field):
                raise HTTPException(
                    status_code=503, detail="Public API release artifact mismatch"
                )
        manifest_path = path.with_name("manifest.json")
        if not manifest_path.is_file():
            raise HTTPException(status_code=503, detail="Public release manifest unavailable")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        expected_checksum = manifest.get("files", {}).get("api.json", {}).get("sha256")
        actual_checksum = hashlib.sha256(path.read_bytes()).hexdigest()
        if expected_checksum != actual_checksum:
            raise HTTPException(status_code=503, detail="Public API release checksum mismatch")
        if has_database():
            try:
                payload = _apply_database_withdrawals(
                    payload, metadata.dataset_release_version
                )
            except SQLAlchemyError as error:
                raise HTTPException(
                    status_code=503, detail="Withdrawal state unavailable"
                ) from error
        return payload
    raise HTTPException(status_code=503, detail="Public API release artifact unavailable")


def _apply_database_withdrawals(
    payload: dict[str, object], version: str
) -> dict[str, object]:
    with session_scope() as session:
        if session is None:
            raise SQLAlchemyError("Database session unavailable")
        rows = session.execute(
            text(
                """
                select entity_type, entity_id
                from public.public_api_release_withdrawals
                where dataset_release_version = :version
                """
            ),
            {"version": version},
        ).mappings().all()
    if any(row["entity_type"] is None and row["entity_id"] is None for row in rows):
        raise HTTPException(status_code=410, detail="Current public release is withdrawn")
    withdrawn = {
        (str(row["entity_type"]), str(row["entity_id"]))
        for row in rows
        if row["entity_type"] is not None and row["entity_id"] is not None
    }
    result = dict(payload)
    pandas = [
        item
        for item in result.get("pandas", [])
        if ("api_pandas", str(item.get("id"))) not in withdrawn
        and ("pandas", str(item.get("id"))) not in withdrawn
    ]
    result["pandas"] = pandas
    for key, entity_type in (
        ("distribution", "api_distribution"),
        ("habitats", "api_habitats"),
    ):
        collection = dict(result.get(key, {}))
        collection["features"] = [
            feature
            for feature in collection.get("features", [])
            if (entity_type, str(feature.get("id"))) not in withdrawn
        ]
        result[key] = collection
    result["snapshots"] = [
        item
        for item in result.get("snapshots", [])
        if ("api_snapshots", str(item.get("version"))) not in withdrawn
    ]
    stats_withdrawn = ("api_stats", "overview") in withdrawn
    stats = dict(result.get("stats", {}))
    stats["total_pandas"] = len(pandas)
    stats["featured_pandas"] = sum(
        "featured" in item.get("tags", []) for item in pandas
    )
    habitats = result.get("habitats", {}).get("features", [])
    distribution = result.get("distribution", {}).get("features", [])
    snapshots = result.get("snapshots", [])
    latest = (
        snapshots[0].get("snapshot_date")
        if snapshots
        else stats.get("latest_snapshot_date")
    )
    stats["active_habitats"] = len(habitats)
    stats["latest_snapshot_date"] = latest
    stats["wild_distribution_cells"] = sum(
        feature.get("properties", {}).get("layer") == "wild"
        and feature.get("properties", {}).get("snapshot_date") == latest
        for feature in distribution
    )
    if stats_withdrawn:
        result.pop("stats", None)
    else:
        result["stats"] = stats
    return result


def _ensure_database_release_not_withdrawn(version: str) -> None:
    with session_scope() as session:
        if session is None:
            raise SQLAlchemyError("Database session unavailable")
        row = session.execute(
            text(
                """
                select 1
                from public.public_api_release_withdrawals
                where dataset_release_version = :version
                  and entity_type is null
                  and entity_id is null
                limit 1
                """
            ),
            {"version": version},
        ).first()
    if row is not None:
        raise HTTPException(status_code=410, detail="Current public release is withdrawn")


def _filter_panda_records_for_database_withdrawals(
    records: list[dict[str, object]], version: str
) -> list[dict[str, object]]:
    with session_scope() as session:
        if session is None:
            raise SQLAlchemyError("Database session unavailable")
        rows = session.execute(
            text(
                """
                select entity_type, entity_id
                from public.public_api_release_withdrawals
                where dataset_release_version = :version
                """
            ),
            {"version": version},
        ).mappings().all()
    if any(row["entity_type"] is None and row["entity_id"] is None for row in rows):
        raise HTTPException(status_code=410, detail="Current public release is withdrawn")
    withdrawn_ids = {
        str(row["entity_id"])
        for row in rows
        if row["entity_type"] in {"pandas", "api_pandas"}
        and row["entity_id"] is not None
    }
    return [record for record in records if str(record.get("id")) not in withdrawn_ids]
