from __future__ import annotations

import hashlib
import json
from collections import Counter
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import NAMESPACE_URL, UUID, uuid5

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.projection.public_release import (
    CANONICAL_ENTITY_TYPES,
    PublicRelease,
    PublicReleaseInput,
    _attach_public_media,
    _project_records,
    _runtime_api,
    _runtime_records,
    build_public_release,
)

APPROVED_RELEASE_VERSION = "2026.07.31.1"
EXPECTED_PANDA_COUNT = 39
BOOTSTRAP_POLICY = "approved-release-bootstrap-v1"
REQUIRED_PUBLISH_CAPABILITY = "archive.accountable.publish"
_DB_ENTITY_TYPES = {value: key for key, value in CANONICAL_ENTITY_TYPES.items()}


class ApprovedReleaseBootstrapError(RuntimeError):
    """Raised when an approved release cannot be imported safely."""


@dataclass(frozen=True)
class ApprovedReleaseBundle:
    version: str
    source: dict[str, Any]
    manifest: dict[str, Any]
    release: PublicRelease
    records: tuple[dict[str, Any], ...]
    manifest_sha256: str
    source_sha256: str


@dataclass(frozen=True)
class ActorSnapshot:
    account_id: UUID
    roles: tuple[str, ...]
    capabilities: tuple[str, ...]
    recent_auth: bool


def _canonical_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def _sha256_json(value: object) -> str:
    return hashlib.sha256(_canonical_json(value).encode("utf-8")).hexdigest()


def _parse_released_at(value: object) -> datetime:
    if not isinstance(value, str) or not value:
        raise ApprovedReleaseBootstrapError("manifest released_at is missing")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ApprovedReleaseBootstrapError("manifest released_at must be timezone-aware")
    return parsed


def _release_records(source: dict[str, Any], release: PublicRelease) -> tuple[dict[str, Any], ...]:
    projected = _attach_public_media(
        _project_records(source), release.release_metadata["public_schema_version"]
    )
    archive_records = [
        record for record in projected if not str(record["entity_type"]).startswith("api_")
    ]
    runtime = _runtime_api(source, release.release_metadata, projected)
    runtime_records = _runtime_records(runtime)
    return tuple(
        sorted(
            [*archive_records, *runtime_records],
            key=lambda record: (str(record["entity_type"]), str(record["id"])),
        )
    )


def load_approved_release(
    repo_root: Path,
    version: str = APPROVED_RELEASE_VERSION,
) -> ApprovedReleaseBundle:
    reviewed_path = repo_root / "data" / "reviewed-batches" / version / "source.json"
    release_dir = repo_root / "data" / "public-releases" / version
    manifest_path = release_dir / "manifest.json"
    if not reviewed_path.is_file() or not manifest_path.is_file():
        raise ApprovedReleaseBootstrapError("approved release source or manifest is missing")

    source_bytes = reviewed_path.read_bytes()
    manifest_bytes = manifest_path.read_bytes()
    source = json.loads(source_bytes)
    manifest = json.loads(manifest_bytes)
    if str(source.get("dataset", {}).get("version")) != version:
        raise ApprovedReleaseBootstrapError("reviewed source version does not match request")
    if str(manifest.get("dataset_release_version")) != version:
        raise ApprovedReleaseBootstrapError("manifest version does not match request")

    release = build_public_release(
        PublicReleaseInput(
            source_state=source,
            publication_batch_id=str(manifest["publication_batch_id"]),
            projection_code_version=str(manifest["projection_code_version"]),
            database_migration_version=str(manifest["database_migration_version"]),
            released_at=_parse_released_at(manifest["released_at"]),
        )
    )
    if release.manifest != manifest:
        raise ApprovedReleaseBootstrapError(
            "reviewed source does not reproduce the committed release manifest"
        )

    for filename, metadata in sorted(dict(manifest["files"]).items()):
        path = release_dir / filename
        if not path.is_file():
            raise ApprovedReleaseBootstrapError(f"release artifact is missing: {filename}")
        disk_bytes = path.read_bytes()
        generated_bytes = release.files[filename].encode("utf-8")
        if disk_bytes != generated_bytes:
            raise ApprovedReleaseBootstrapError(
                f"release artifact does not match reviewed projection: {filename}"
            )
        if len(disk_bytes) != int(metadata["bytes"]):
            raise ApprovedReleaseBootstrapError(f"release artifact byte count differs: {filename}")
        if hashlib.sha256(disk_bytes).hexdigest() != str(metadata["sha256"]):
            raise ApprovedReleaseBootstrapError(f"release artifact hash differs: {filename}")

    records = _release_records(source, release)
    counts = Counter(str(record["entity_type"]) for record in records)
    for entity_type, expected in dict(manifest["record_counts"]).items():
        if counts[entity_type] != int(expected):
            raise ApprovedReleaseBootstrapError(
                f"record count differs for {entity_type}: {counts[entity_type]} != {expected}"
            )
    if counts["api_pandas"] != EXPECTED_PANDA_COUNT:
        raise ApprovedReleaseBootstrapError("approved release must contain exactly 39 API pandas")

    return ApprovedReleaseBundle(
        version=version,
        source=source,
        manifest=manifest,
        release=release,
        records=records,
        manifest_sha256=hashlib.sha256(manifest_bytes).hexdigest(),
        source_sha256=hashlib.sha256(source_bytes).hexdigest(),
    )


def _actor_snapshot(session: Session, actor_account_id: UUID) -> ActorSnapshot:
    account = session.execute(
        text(
            """
            select account_id, state::text, last_authenticated_at
            from identity.accounts
            where account_id = :account_id
            """
        ),
        {"account_id": actor_account_id},
    ).mappings().one_or_none()
    if account is None:
        raise ApprovedReleaseBootstrapError("actor account does not exist in Identity")
    if str(account["state"]) != "active":
        raise ApprovedReleaseBootstrapError("actor account must be active")

    role_query = text(
        """
        select distinct assignment.role_key
        from identity.role_assignments assignment
        left join identity.role_assignment_revocations revocation
          on revocation.assignment_id = assignment.assignment_id
        where assignment.account_id = :account_id
          and revocation.assignment_id is null
          and (assignment.expires_at is null or assignment.expires_at > now())
        order by assignment.role_key
        """
    )
    capability_query = text(
        """
        select distinct role_capability.capability_key
        from identity.role_assignments assignment
        join identity.role_capabilities role_capability
          on role_capability.role_key = assignment.role_key
        left join identity.role_assignment_revocations revocation
          on revocation.assignment_id = assignment.assignment_id
        where assignment.account_id = :account_id
          and revocation.assignment_id is null
          and (assignment.expires_at is null or assignment.expires_at > now())
        order by role_capability.capability_key
        """
    )
    roles = tuple(str(row[0]) for row in session.execute(role_query, {"account_id": actor_account_id}))
    capabilities = tuple(
        str(row[0])
        for row in session.execute(capability_query, {"account_id": actor_account_id})
    )
    if REQUIRED_PUBLISH_CAPABILITY not in capabilities:
        raise ApprovedReleaseBootstrapError(
            f"actor account lacks {REQUIRED_PUBLISH_CAPABILITY}"
        )

    authenticated_at = account["last_authenticated_at"]
    recent_auth = False
    if authenticated_at is not None:
        if authenticated_at.tzinfo is None:
            authenticated_at = authenticated_at.replace(tzinfo=UTC)
        age = (datetime.now(UTC) - authenticated_at).total_seconds()
        recent_auth = 0 <= age <= 900
    return ActorSnapshot(
        account_id=actor_account_id,
        roles=roles,
        capabilities=capabilities,
        recent_auth=recent_auth,
    )


def _db_entity_type(entity_type: str) -> str:
    return _DB_ENTITY_TYPES.get(entity_type, entity_type)


def _revision_payload(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "public_record": record["public"],
        "publication_checks": {
            "references": [],
            "sources": [],
            "residencies": [],
            "translations": [],
            "media": [],
        },
    }


def preflight_release(
    session: Session,
    bundle: ApprovedReleaseBundle,
    actor_account_id: UUID | None = None,
) -> dict[str, Any]:
    actor = _actor_snapshot(session, actor_account_id) if actor_account_id else None
    existing = session.execute(
        text(
            """
            select id, status, operation
            from public.publication_batches
            where data_version = :version
            """
        ),
        {"version": bundle.version},
    ).mappings().one_or_none()
    pointers = session.execute(
        text(
            """
            select
              archive.latest_release_id,
              public_pointer.active_batch_id
            from public.archive_release_pointer archive
            cross join public.public_release_pointer public_pointer
            where archive.singleton = true and public_pointer.singleton = true
            """
        )
    ).mappings().one()
    return {
        "version": bundle.version,
        "public_schema_version": bundle.manifest["public_schema_version"],
        "database_migration_version": bundle.manifest["database_migration_version"],
        "projection_code_version": bundle.manifest["projection_code_version"],
        "records": len(bundle.records),
        "pandas": bundle.manifest["record_counts"]["api_pandas"],
        "manifest_sha256": bundle.manifest_sha256,
        "source_sha256": bundle.source_sha256,
        "existing_release_id": str(existing["id"]) if existing else None,
        "existing_release_status": str(existing["status"]) if existing else None,
        "archive_release_id": (
            str(pointers["latest_release_id"]) if pointers["latest_release_id"] else None
        ),
        "public_release_id": (
            str(pointers["active_batch_id"]) if pointers["active_batch_id"] else None
        ),
        "actor_account_id": str(actor.account_id) if actor else None,
        "actor_roles": list(actor.roles) if actor else [],
        "actor_capabilities": list(actor.capabilities) if actor else [],
    }


def import_archive_release(
    session: Session,
    bundle: ApprovedReleaseBundle,
    actor_account_id: UUID,
    *,
    reason: str,
) -> UUID:
    actor = _actor_snapshot(session, actor_account_id)
    existing = session.execute(
        text(
            """
            select id, status, operation
            from public.publication_batches
            where data_version = :version
            for update
            """
        ),
        {"version": bundle.version},
    ).mappings().one_or_none()
    if existing is not None:
        if str(existing["status"]) == "published" and str(existing["operation"]) == "release":
            return UUID(str(existing["id"]))
        raise ApprovedReleaseBootstrapError("release version already exists in a non-final state")

    current_archive_version = session.execute(
        text(
            """
            select coalesce(batch.data_version, 'unpublished')
            from public.archive_release_pointer pointer
            left join public.publication_batches batch on batch.id = pointer.latest_release_id
            where pointer.singleton = true
            for update of pointer
            """
        )
    ).scalar_one()
    change_set_id = uuid5(NAMESPACE_URL, f"zhipanda:{BOOTSTRAP_POLICY}:{bundle.version}")
    partial = session.execute(
        text("select status from public.change_sets where id = :change_set_id"),
        {"change_set_id": change_set_id},
    ).scalar_one_or_none()
    if partial is not None:
        raise ApprovedReleaseBootstrapError(
            "partial bootstrap change set exists; inspect and recover before retrying"
        )

    session.execute(
        text(
            """
            insert into public.change_sets (
              id, title, reason, status, created_by, governance_mode,
              validation_state, base_archive_version, governance_version,
              risk_level, origin_context, origin_actor_id
            ) values (
              :id, :title, :reason, 'draft', :actor_id,
              'single-accountable-approver-v1', 'not_validated',
              :base_archive_version, 1, 'ordinary', 'archive', :actor_id
            )
            """
        ),
        {
            "id": change_set_id,
            "title": f"Approved Public Release {bundle.version}",
            "reason": reason,
            "actor_id": actor.account_id,
            "base_archive_version": str(current_archive_version),
        },
    )

    revision_evidence: list[dict[str, Any]] = []
    for record in bundle.records:
        entity_type = _db_entity_type(str(record["entity_type"]))
        entity_id = str(record["id"])
        revision_number = int(
            session.execute(
                text(
                    """
                    select coalesce(max(revision_number), 0) + 1
                    from public.entity_revisions
                    where entity_type = :entity_type and entity_id = :entity_id
                    """
                ),
                {"entity_type": entity_type, "entity_id": entity_id},
            ).scalar_one()
        )
        revision_id = uuid5(
            change_set_id,
            f"{entity_type}:{entity_id}:{revision_number}",
        )
        payload = _revision_payload(record)
        payload_sha256 = _sha256_json(payload)
        session.execute(
            text(
                """
                insert into public.entity_revisions (
                  id, entity_type, entity_id, revision_number, payload,
                  created_by, substantive_modified_by
                ) values (
                  :id, :entity_type, :entity_id, :revision_number,
                  cast(:payload as jsonb), :actor_id, :actor_id
                )
                """
            ),
            {
                "id": revision_id,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "revision_number": revision_number,
                "payload": _canonical_json(payload),
                "actor_id": actor.account_id,
            },
        )
        session.execute(
            text(
                """
                insert into public.change_set_revisions (change_set_id, revision_id)
                values (:change_set_id, :revision_id)
                """
            ),
            {"change_set_id": change_set_id, "revision_id": revision_id},
        )
        revision_evidence.append(
            {
                "revision_id": str(revision_id),
                "entity_type": entity_type,
                "entity_id": entity_id,
                "revision_number": revision_number,
                "payload_sha256": payload_sha256,
            }
        )

    validation_hash = _sha256_json(
        {
            "policy": BOOTSTRAP_POLICY,
            "version": bundle.version,
            "manifest_sha256": bundle.manifest_sha256,
            "source_sha256": bundle.source_sha256,
            "revision_evidence": revision_evidence,
        }
    )
    validation_result_id = uuid5(change_set_id, "validation:2")
    session.execute(
        text(
            """
            insert into public.archive_validation_results (
              validation_result_id, change_set_id, governance_version,
              outcome, risk_level, base_archive_version, validation_hash,
              issues, revision_evidence, source_evidence, attachment_evidence,
              validated_by, actor_role_snapshot, reason, correlation_id
            ) values (
              :validation_result_id, :change_set_id, 2, 'ready', 'ordinary',
              :base_archive_version, :validation_hash, '[]'::jsonb,
              cast(:revision_evidence as jsonb), '[]'::jsonb, '[]'::jsonb,
              :actor_id, cast(:roles as jsonb), :reason, :correlation_id
            )
            """
        ),
        {
            "validation_result_id": validation_result_id,
            "change_set_id": change_set_id,
            "base_archive_version": str(current_archive_version),
            "validation_hash": validation_hash,
            "revision_evidence": _canonical_json(revision_evidence),
            "actor_id": actor.account_id,
            "roles": _canonical_json(list(actor.roles)),
            "reason": reason,
            "correlation_id": uuid5(change_set_id, "correlation"),
        },
    )
    session.execute(
        text(
            """
            update public.change_sets
            set status = 'ready', validation_state = 'ready',
                validated_by = :actor_id, validated_at = now(),
                validation_reason = :reason, governance_version = 2,
                last_validation_hash = :validation_hash
            where id = :change_set_id
            """
        ),
        {
            "actor_id": actor.account_id,
            "reason": reason,
            "validation_hash": validation_hash,
            "change_set_id": change_set_id,
        },
    )

    command_payload_sha256 = _sha256_json(
        {
            "policy": BOOTSTRAP_POLICY,
            "actor_account_id": str(actor.account_id),
            "change_set_id": str(change_set_id),
            "version": bundle.version,
            "manifest_sha256": bundle.manifest_sha256,
            "reason": reason,
        }
    )
    published = session.execute(
        text(
            """
            select * from public.publish_accountable_change_set(
              :change_set_id, :actor_id, 2, :idempotency_key,
              :payload_sha256, :reason, :data_version,
              :public_schema_version, :database_migration_version,
              :projection_code_version, :correlation_id,
              cast(:roles as jsonb), cast(:capabilities as jsonb), :recent_auth
            )
            """
        ),
        {
            "change_set_id": change_set_id,
            "actor_id": actor.account_id,
            "idempotency_key": f"approved-release:{bundle.version}",
            "payload_sha256": command_payload_sha256,
            "reason": reason,
            "data_version": bundle.version,
            "public_schema_version": str(bundle.manifest["public_schema_version"]),
            "database_migration_version": str(
                bundle.manifest["database_migration_version"]
            ),
            "projection_code_version": str(bundle.manifest["projection_code_version"]),
            "correlation_id": uuid5(change_set_id, "correlation"),
            "roles": _canonical_json(list(actor.roles)),
            "capabilities": _canonical_json(list(actor.capabilities)),
            "recent_auth": actor.recent_auth,
        },
    ).mappings().one()
    return UUID(str(published["release_id"]))


def activate_public_projection(
    session: Session,
    bundle: ApprovedReleaseBundle,
    release_id: UUID,
    actor_account_id: UUID,
    *,
    reason: str,
) -> bool:
    actor = _actor_snapshot(session, actor_account_id)
    release = session.execute(
        text(
            """
            select id, data_version, public_schema_version,
                   database_migration_version, projection_code_version,
                   status, operation
            from public.publication_batches
            where id = :release_id
            for update
            """
        ),
        {"release_id": release_id},
    ).mappings().one_or_none()
    if release is None:
        raise ApprovedReleaseBootstrapError("Archive Release does not exist")
    expected_metadata = {
        "data_version": bundle.version,
        "public_schema_version": str(bundle.manifest["public_schema_version"]),
        "database_migration_version": str(bundle.manifest["database_migration_version"]),
        "projection_code_version": str(bundle.manifest["projection_code_version"]),
        "status": "published",
        "operation": "release",
    }
    for field, expected in expected_metadata.items():
        if str(release[field]) != expected:
            raise ApprovedReleaseBootstrapError(
                f"Archive Release metadata differs for {field}"
            )

    rows = session.execute(
        text(
            """
            select distinct on (revision.entity_type, revision.entity_id)
              revision.entity_type, revision.entity_id, revision.payload
            from public.publication_batch_change_sets batch_link
            join public.change_set_revisions change_link
              on change_link.change_set_id = batch_link.change_set_id
            join public.entity_revisions revision on revision.id = change_link.revision_id
            where batch_link.batch_id = :release_id
            order by revision.entity_type, revision.entity_id,
                     revision.revision_number desc, revision.created_at desc
            """
        ),
        {"release_id": release_id},
    ).mappings().all()
    actual: dict[tuple[str, str], Any] = {}
    for row in rows:
        payload = row["payload"] if isinstance(row["payload"], dict) else json.loads(row["payload"])
        public_record = payload.get("public_record")
        if not isinstance(public_record, dict):
            raise ApprovedReleaseBootstrapError("stored revision lacks public_record")
        entity_type = CANONICAL_ENTITY_TYPES.get(
            str(row["entity_type"]), str(row["entity_type"])
        )
        actual[(entity_type, str(row["entity_id"]))] = public_record
    expected = {
        (str(record["entity_type"]), str(record["id"])): record["public"]
        for record in bundle.records
    }
    if actual != expected:
        missing = sorted(set(expected) - set(actual))
        unexpected = sorted(set(actual) - set(expected))
        changed = sorted(key for key in set(actual) & set(expected) if actual[key] != expected[key])
        raise ApprovedReleaseBootstrapError(
            "stored Release projection differs from approved artifacts: "
            f"missing={len(missing)}, unexpected={len(unexpected)}, changed={len(changed)}"
        )

    current = session.execute(
        text(
            """
            select active_batch_id
            from public.public_release_pointer
            where singleton = true
            for update
            """
        )
    ).scalar_one_or_none()
    if current == release_id:
        return False
    session.execute(
        text(
            """
            update public.public_release_pointer
            set active_batch_id = :release_id, switched_at = now()
            where singleton = true
            """
        ),
        {"release_id": release_id},
    )
    session.execute(
        text(
            """
            insert into public.audit_events (
              event_type, subject_type, subject_id, actor_id,
              reason, correlation_id, metadata
            ) values (
              'public_projection.release_activated', 'publication_batch',
              :release_id, :actor_id, :reason, :correlation_id,
              cast(:metadata as jsonb)
            )
            """
        ),
        {
            "release_id": release_id,
            "actor_id": actor.account_id,
            "reason": reason,
            "correlation_id": uuid5(release_id, "public-projection"),
            "metadata": _canonical_json(
                {
                    "policy": BOOTSTRAP_POLICY,
                    "data_version": bundle.version,
                    "manifest_sha256": bundle.manifest_sha256,
                    "record_count": len(bundle.records),
                }
            ),
        },
    )
    return True
