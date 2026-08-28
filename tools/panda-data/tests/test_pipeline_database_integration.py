from __future__ import annotations

import os
from uuid import uuid4

import psycopg
import pytest
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from panda_data.pipeline import PipelineJob, PipelineResult
from panda_data.pipeline.database import PipelineRepository

TEST_DATABASE_URL = os.getenv("PANDA_DATA_TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL,
    reason="PANDA_DATA_TEST_DATABASE_URL is required for PostgreSQL integration tests",
)


def _pipeline_connection():
    return psycopg.connect(TEST_DATABASE_URL, row_factory=dict_row)


def test_pipeline_role_is_technically_capable_but_cannot_mutate_business_truth() -> None:
    job = PipelineJob(jobType="identity.resolve", parameters={"fixture": True})

    with _pipeline_connection() as connection:
        repository = PipelineRepository(connection)
        assert repository.create_job(job)
        assert repository.mark_job_running(job.job_id)
        assert repository.finish_job(
            PipelineResult(
                jobId=job.job_id,
                correlationId=job.correlation_id,
                state="completed",
            )
        )
        assert isinstance(repository.identity_exports(), list)
        assert isinstance(repository.source_exports(), list)
        assert isinstance(repository.media_exports(), list)

        queue_job = PipelineJob(jobType="media.enrich", parameters={"fixture": True})
        message_id = repository.enqueue_job(queue_job)
        messages = repository.read_jobs(visibility_timeout_seconds=30, quantity=10)
        message = next(item for item in messages if item["msg_id"] == message_id)
        assert message["message"]["jobId"] == str(queue_job.job_id)
        assert repository.archive_job(message_id)

    immutable_job = PipelineJob(jobType="identity.resolve", parameters={"batch": "original"})
    with _pipeline_connection() as connection:
        assert PipelineRepository(connection).create_job(immutable_job)

    with pytest.raises(psycopg.errors.ObjectNotInPrerequisiteState):
        with _pipeline_connection() as connection:
            connection.execute(
                "update pipeline.jobs set parameters = %s where job_id = %s",
                (Jsonb({"batch": "tampered"}), immutable_job.job_id),
            )

    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        with _pipeline_connection() as connection:
            connection.execute("insert into panda.pandas (panda_id) values (%s)", (uuid4(),))

    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        with _pipeline_connection() as connection:
            connection.execute(
                "select pgmq.send('integration_updates'::text, %s::jsonb, 0::integer)",
                (Jsonb({"eventId": str(uuid4())}),),
            )
