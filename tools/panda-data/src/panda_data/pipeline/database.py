from __future__ import annotations

import os
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from typing import Any, Literal
from uuid import UUID

import psycopg
from psycopg import Connection
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from panda_data.pipeline.models import ArtifactManifest, PipelineJob, PipelineResult

AttemptOutcome = Literal["completed", "failed"]


class PipelineDatabaseError(RuntimeError):
    pass


def database_url() -> str:
    value = os.getenv("PANDA_DATA_DATABASE_URL", "").strip()
    if not value:
        raise PipelineDatabaseError(
            "PANDA_DATA_DATABASE_URL is required for database-backed panda-data jobs"
        )
    return value


@contextmanager
def connect_pipeline_database(url: str | None = None) -> Iterator[Connection[dict[str, Any]]]:
    with psycopg.connect(url or database_url(), row_factory=dict_row) as connection:
        yield connection


class PipelineRepository:
    """Narrow database adapter for pipeline technical state and owner-published views."""

    def __init__(self, connection: Connection[dict[str, Any]]) -> None:
        self.connection = connection

    def create_job(self, job: PipelineJob) -> bool:
        payload = job.validated_wire()
        with self.connection.cursor() as cursor:
            cursor.execute(
                """
                insert into pipeline.jobs (
                  job_id, job_type, contract_version, correlation_id,
                  parameters, input_artifacts, requested_at
                ) values (%s, %s, %s, %s, %s, %s, %s)
                on conflict (job_id) do nothing
                returning job_id
                """,
                (
                    job.job_id,
                    job.job_type,
                    payload["schemaVersion"],
                    job.correlation_id,
                    Jsonb(job.parameters),
                    Jsonb([artifact.to_wire() for artifact in job.input_artifacts]),
                    job.requested_at,
                ),
            )
            return cursor.fetchone() is not None

    def mark_job_running(self, job_id: UUID) -> bool:
        now = datetime.now(UTC)
        with self.connection.cursor() as cursor:
            cursor.execute(
                """
                update pipeline.jobs
                set state = 'running', started_at = %s, updated_at = %s
                where job_id = %s and state = 'queued'
                returning job_id
                """,
                (now, now, job_id),
            )
            return cursor.fetchone() is not None

    def record_attempt(
        self,
        *,
        job_id: UUID,
        attempt_number: int,
        worker_id: str,
        started_at: datetime,
        outcome: AttemptOutcome,
        error_code: str | None = None,
        error_message: str | None = None,
        completed_at: datetime | None = None,
    ) -> None:
        finished_at = completed_at or datetime.now(UTC)
        with self.connection.cursor() as cursor:
            cursor.execute(
                """
                insert into pipeline.attempts (
                  job_id, attempt_number, worker_id, started_at, completed_at,
                  outcome, error_code, error_message
                ) values (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    job_id,
                    attempt_number,
                    worker_id,
                    started_at,
                    finished_at,
                    outcome,
                    error_code,
                    error_message,
                ),
            )

    def register_artifact(self, manifest: ArtifactManifest) -> None:
        payload = manifest.validated_wire()
        with self.connection.cursor() as cursor:
            cursor.execute(
                """
                insert into pipeline.artifacts (
                  artifact_id, job_id, artifact_kind, storage_bucket, storage_key,
                  content_sha256, byte_size, media_type, contract_schema_id, manifest, created_at
                ) values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    manifest.artifact_id,
                    manifest.produced_by_job_id,
                    manifest.artifact_kind,
                    manifest.storage.bucket,
                    manifest.storage.object_key,
                    manifest.sha256,
                    manifest.byte_size,
                    manifest.media_type,
                    manifest.contract.schema_id if manifest.contract else None,
                    Jsonb(payload),
                    manifest.created_at,
                ),
            )

    def finish_job(self, result: PipelineResult) -> bool:
        result.validated_wire()
        error_code = result.error.code if result.error else None
        error_message = result.error.message if result.error else None
        with self.connection.cursor() as cursor:
            cursor.execute(
                """
                update pipeline.jobs
                set state = %s,
                    completed_at = %s,
                    error_code = %s,
                    error_message = %s,
                    updated_at = %s
                where job_id = %s and state = 'running'
                returning job_id
                """,
                (
                    result.state,
                    result.completed_at,
                    error_code,
                    error_message,
                    result.completed_at,
                    result.job_id,
                ),
            )
            return cursor.fetchone() is not None

    def enqueue_job(self, job: PipelineJob) -> int:
        payload = job.validated_wire()
        with self.connection.cursor() as cursor:
            cursor.execute("select pipeline.enqueue_job(%s)", (Jsonb(payload),))
            row = cursor.fetchone()
            if row is None:
                raise PipelineDatabaseError("pipeline.enqueue_job returned no message id")
            return int(row["enqueue_job"])

    def read_jobs(
        self,
        *,
        visibility_timeout_seconds: int = 300,
        quantity: int = 10,
    ) -> list[dict[str, Any]]:
        with self.connection.cursor() as cursor:
            cursor.execute(
                "select msg_id, read_ct, message from pipeline.read_jobs(%s, %s)",
                (visibility_timeout_seconds, quantity),
            )
            return list(cursor.fetchall())

    def archive_job(self, message_id: int) -> bool:
        with self.connection.cursor() as cursor:
            cursor.execute("select pipeline.archive_job(%s)", (message_id,))
            row = cursor.fetchone()
            return bool(row and row["archive_job"])

    def set_job_visibility(
        self,
        message_id: int,
        *,
        visibility_timeout_seconds: int,
    ) -> dict[str, Any] | None:
        with self.connection.cursor() as cursor:
            cursor.execute(
                "select msg_id, read_ct, message from pipeline.set_job_visibility(%s, %s)",
                (message_id, visibility_timeout_seconds),
            )
            return cursor.fetchone()

    def enqueue_result(self, result: PipelineResult) -> int:
        payload = result.validated_wire()
        with self.connection.cursor() as cursor:
            cursor.execute("select pipeline.enqueue_result(%s)", (Jsonb(payload),))
            row = cursor.fetchone()
            if row is None:
                raise PipelineDatabaseError("pipeline.enqueue_result returned no message id")
            return int(row["enqueue_result"])

    def identity_exports(self) -> list[dict[str, Any]]:
        with self.connection.cursor() as cursor:
            cursor.execute(
                """
                select panda_id, canonical_slug, names, external_identifiers, updated_at
                from panda.pipeline_identity_export_v1
                order by panda_id
                """
            )
            return list(cursor.fetchall())

    def source_exports(self) -> list[dict[str, Any]]:
        with self.connection.cursor() as cursor:
            cursor.execute(
                """
                select source_id, publisher, title, url, published_on, last_verified_on,
                       language_tag, access_state, evidence_tier, public_summary, content_sha256
                from evidence.pipeline_source_export_v1
                order by source_id
                """
            )
            return list(cursor.fetchall())

    def media_exports(self) -> list[dict[str, Any]]:
        with self.connection.cursor() as cursor:
            cursor.execute(
                """
                select asset_id, source_id, storage_bucket, storage_key, content_sha256,
                       media_type, byte_size, title, creator, copyright_text, license,
                       attribution_text, rights_status, eligibility_status, taken_at,
                       pandas, updated_at
                from media.pipeline_asset_export_v1
                order by asset_id
                """
            )
            return list(cursor.fetchall())
