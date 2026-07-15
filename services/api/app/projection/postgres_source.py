from __future__ import annotations

import json
from datetime import UTC
from uuid import UUID

from sqlalchemy import create_engine, text

from app.projection.public_release import PublicReleaseInput

PUBLIC_LICENSES = {
    "structured_data": "ODC-By-1.0",
    "original_text": "CC-BY-4.0",
    "third_party_media": "per-item",
}


def load_reviewed_postgres_release(
    *, database_url: str, publication_batch_id: UUID
) -> PublicReleaseInput:
    """Load the immutable latest revisions linked to one published release batch."""
    engine = create_engine(database_url, pool_pre_ping=True)
    with engine.connect() as connection:
        batch = connection.execute(
            text(
                """
                select
                  id, public_schema_version, data_version,
                  database_migration_version, projection_code_version, published_at
                from public.publication_batches
                where id = :batch_id
                  and status = 'published'
                  and operation = 'release'
                """
            ),
            {"batch_id": publication_batch_id},
        ).mappings().first()
        if batch is None:
            raise ValueError("Publication batch is not a published release")
        revisions = connection.execute(
            text(
                """
                with ranked as (
                  select
                    revision.entity_type,
                    revision.entity_id,
                    revision.payload,
                    row_number() over (
                      partition by revision.entity_type, revision.entity_id
                      order by revision.revision_number desc, revision.created_at desc
                    ) as position
                  from public.publication_batch_change_sets batch_change_set
                  join public.change_set_revisions change_revision
                    on change_revision.change_set_id = batch_change_set.change_set_id
                  join public.entity_revisions revision
                    on revision.id = change_revision.revision_id
                  where batch_change_set.batch_id = :batch_id
                )
                select entity_type, entity_id, payload
                from ranked
                where position = 1
                order by entity_type, entity_id
                """
            ),
            {"batch_id": publication_batch_id},
        ).mappings().all()
    engine.dispose()

    records = []
    for revision in revisions:
        payload = revision["payload"]
        if isinstance(payload, str):
            payload = json.loads(payload)
        public_record = payload.get("public_record") if isinstance(payload, dict) else None
        if not isinstance(public_record, dict):
            raise ValueError("Published revision has no public_record object")
        records.append(
            {
                "entity_type": revision["entity_type"],
                "id": revision["entity_id"],
                "public": public_record,
            }
        )

    published_at = batch["published_at"]
    if published_at is None:
        raise ValueError("Published release has no published_at timestamp")
    if published_at.tzinfo is None:
        published_at = published_at.replace(tzinfo=UTC)
    return PublicReleaseInput(
        source_state={
            "dataset": {
                "version": batch["data_version"],
                "public_schema_version": batch["public_schema_version"],
                "licenses": PUBLIC_LICENSES,
            },
            "records": records,
        },
        publication_batch_id=str(batch["id"]),
        projection_code_version=batch["projection_code_version"],
        database_migration_version=batch["database_migration_version"],
        released_at=published_at,
    )
