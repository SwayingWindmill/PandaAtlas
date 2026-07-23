from __future__ import annotations

from datetime import datetime
from hashlib import sha256

from app.acquisition.contracts import canonical_json_bytes

from .contracts import (
    CanonicalIdentityRecord,
    IdentityAuditRecord,
    IdentityChangeKind,
    IdentityChangeSet,
    IdentityRiskLevel,
    IdentityRollbackPlan,
)


def plan_identity_merge(
    *,
    operation_id: str,
    before_records: tuple[CanonicalIdentityRecord, ...],
    merged_record: CanonicalIdentityRecord,
    decided_at: datetime,
    actor: str,
    evidence: tuple[str, ...],
) -> IdentityChangeSet:
    ordered_before = tuple(sorted(before_records, key=lambda record: record.panda_id))
    if len({record.panda_id for record in ordered_before}) != len(ordered_before):
        raise ValueError("merge inputs contain duplicate panda IDs")
    if merged_record.panda_id not in {record.panda_id for record in ordered_before}:
        raise ValueError("merged survivor must retain one existing panda ID")
    return _build_changeset(
        operation_id=operation_id,
        kind=IdentityChangeKind.MERGE,
        before_records=ordered_before,
        after_records=(merged_record,),
        decided_at=decided_at,
        actor=actor,
        evidence=evidence,
        rollback=IdentityRollbackPlan(
            remove_panda_ids=(merged_record.panda_id,),
            restore_records=ordered_before,
        ),
    )


def plan_identity_split(
    *,
    operation_id: str,
    before_record: CanonicalIdentityRecord,
    split_records: tuple[CanonicalIdentityRecord, ...],
    decided_at: datetime,
    actor: str,
    evidence: tuple[str, ...],
) -> IdentityChangeSet:
    ordered_after = tuple(sorted(split_records, key=lambda record: record.panda_id))
    if len({record.panda_id for record in ordered_after}) != len(ordered_after):
        raise ValueError("split outputs contain duplicate panda IDs")
    if before_record.panda_id not in {record.panda_id for record in ordered_after}:
        raise ValueError("one split output must retain the original panda ID")
    return _build_changeset(
        operation_id=operation_id,
        kind=IdentityChangeKind.SPLIT,
        before_records=(before_record,),
        after_records=ordered_after,
        decided_at=decided_at,
        actor=actor,
        evidence=evidence,
        rollback=IdentityRollbackPlan(
            remove_panda_ids=tuple(record.panda_id for record in ordered_after),
            restore_records=(before_record,),
        ),
    )


def _build_changeset(
    *,
    operation_id: str,
    kind: IdentityChangeKind,
    before_records: tuple[CanonicalIdentityRecord, ...],
    after_records: tuple[CanonicalIdentityRecord, ...],
    decided_at: datetime,
    actor: str,
    evidence: tuple[str, ...],
    rollback: IdentityRollbackPlan,
) -> IdentityChangeSet:
    if decided_at.tzinfo is None or decided_at.utcoffset() is None:
        raise ValueError("identity operation timestamp must be timezone-aware")
    if not evidence:
        raise ValueError("identity operation requires human-readable evidence")
    before_hashes = tuple(_record_hash(record) for record in before_records)
    after_hashes = tuple(_record_hash(record) for record in after_records)
    rollback_payload = rollback.model_dump(mode="json")
    audit_payload = {
        "operation_id": operation_id,
        "kind": kind.value,
        "decided_at": decided_at.isoformat(),
        "actor": actor,
        "evidence": list(evidence),
        "before_hashes": list(before_hashes),
        "after_hashes": list(after_hashes),
        "rollback": rollback_payload,
    }
    audit = IdentityAuditRecord(
        audit_id=f"identity-audit-{sha256(canonical_json_bytes(audit_payload)).hexdigest()}",
        operation_id=operation_id,
        kind=kind,
        risk=IdentityRiskLevel.HIGH,
        decided_at=decided_at,
        actor=actor,
        evidence=evidence,
        before_hashes=before_hashes,
        after_hashes=after_hashes,
        rollback_payload=rollback_payload,
    )
    return IdentityChangeSet(
        operation_id=operation_id,
        kind=kind,
        before_records=before_records,
        after_records=after_records,
        before_hashes=before_hashes,
        after_hashes=after_hashes,
        audit=audit,
        rollback=rollback,
    )


def _record_hash(record: CanonicalIdentityRecord) -> str:
    return sha256(canonical_json_bytes(record.model_dump(mode="json"))).hexdigest()
