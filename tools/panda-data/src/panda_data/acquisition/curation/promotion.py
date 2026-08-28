from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from enum import StrEnum
from uuid import UUID

from ..contracts import (
    AcquisitionBundle,
    AcquisitionRunState,
    CandidateKind,
    ConflictState,
    EvidenceBlockState,
    FieldCandidate,
    IdentityMatchState,
)
from ..contracts.v1 import JsonValue
from .models import CuratorDecision, DecisionAction, DecisionLog
from .workflow import validate_decision_log

DEFAULT_PROMOTION_REASON = (
    "Promote reviewed panda-data acquisition candidates through V2 Curation."
)


class CurationOwnerModule(StrEnum):
    PANDA = "panda"
    LINEAGE = "lineage"
    LIFE_HISTORY = "life_history"


class CurationOwnerOperation(StrEnum):
    FACT_PROPOSE = "fact.propose"
    FACT_CORROBORATE = "fact.corroborate"
    FACT_DISPUTE = "fact.dispute"
    NAME_ADD = "name.add"
    NAME_CORROBORATE = "name.corroborate"
    EXTERNAL_IDENTIFIER_ADD = "external_identifier.add"
    EXTERNAL_IDENTIFIER_CORROBORATE = "external_identifier.corroborate"
    PARENTAGE_CREATE = "parentage.create"
    RESIDENCY_CREATE = "residency.create"
    EVENT_CREATE = "event.create"


@dataclass(frozen=True, slots=True)
class AcquisitionCurationChange:
    candidate_id: str
    owner_module: CurationOwnerModule
    operation: CurationOwnerOperation
    payload: dict[str, JsonValue]
    last_verified_on: date
    source_ids: tuple[str, ...]

    def __post_init__(self) -> None:
        if not self.candidate_id.strip():
            raise ValueError("candidate_id cannot be empty")
        if not self.payload:
            raise ValueError("Curation owner changes require a payload")
        if not self.source_ids or any(not source_id.strip() for source_id in self.source_ids):
            raise ValueError("Curation owner changes require evidence source IDs")
        if len(set(self.source_ids)) != len(self.source_ids):
            raise ValueError("Curation owner change source IDs must be unique")

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "candidateId": self.candidate_id,
            "ownerModule": self.owner_module.value,
            "operation": self.operation.value,
            "payload": self.payload,
            "lastVerifiedOn": self.last_verified_on.isoformat(),
            "sourceIds": list(self.source_ids),
        }


@dataclass(frozen=True, slots=True)
class AcquisitionCurationRecommendation:
    acquisition_bundle_id: str
    pipeline_artifact_id: str
    target_panda_id: str
    recommended_by_account_id: str
    reason: str
    changes: tuple[AcquisitionCurationChange, ...]

    def __post_init__(self) -> None:
        if not self.acquisition_bundle_id.strip():
            raise ValueError("acquisition_bundle_id cannot be empty")
        _require_uuid("pipeline_artifact_id", self.pipeline_artifact_id)
        _require_uuid("target_panda_id", self.target_panda_id)
        _require_uuid("recommended_by_account_id", self.recommended_by_account_id)
        if not self.reason.strip() or self.reason != self.reason.strip():
            raise ValueError("reason must be a non-empty trimmed value")
        if not self.changes:
            raise ValueError("acquisition Curation recommendations require at least one change")
        candidate_ids = [change.candidate_id for change in self.changes]
        if len(set(candidate_ids)) != len(candidate_ids):
            raise ValueError("one Curation recommendation cannot repeat a candidate")

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "acquisitionBundleId": self.acquisition_bundle_id,
            "pipelineArtifactId": self.pipeline_artifact_id,
            "targetPandaId": self.target_panda_id,
            "recommendedByAccountId": self.recommended_by_account_id,
            "reason": self.reason,
            "changes": [change.to_dict() for change in self.changes],
        }


def build_acquisition_curation_recommendations(
    bundle: AcquisitionBundle,
    decision_log: DecisionLog,
    *,
    pipeline_artifact_id: str,
    recommended_by_account_id: str,
    reason: str = DEFAULT_PROMOTION_REASON,
) -> tuple[AcquisitionCurationRecommendation, ...]:
    """Translate reviewed acquisition candidates into the Nest V2 Curation intake contract.

    This is a pure adapter. It does not write Curation or authoritative owner tables. The caller
    supplies the immutable pipeline artifact ID and the real Archive Editor account that is
    recommending the reviewed changes.
    """

    _require_uuid("pipeline_artifact_id", pipeline_artifact_id)
    _require_uuid("recommended_by_account_id", recommended_by_account_id)
    if bundle.run.state is not AcquisitionRunState.COMPLETED:
        raise ValueError("V2 Curation promotion requires a completed acquisition run")
    validate_decision_log(bundle, decision_log)

    effective = decision_log.effective_decisions()
    accepted = [
        (candidate, effective[candidate.candidate_id])
        for candidate in bundle.candidates
        if (
            candidate.candidate_id in effective
            and effective[candidate.candidate_id].action is DecisionAction.ACCEPTED
        )
    ]
    if not accepted:
        raise ValueError("V2 Curation promotion requires at least one accepted candidate")

    snapshots = {snapshot.snapshot_id: snapshot for snapshot in bundle.evidence_snapshots}
    changes_by_panda: dict[str, list[AcquisitionCurationChange]] = defaultdict(list)
    for candidate, decision in accepted:
        target_panda_id = _target_panda_id(candidate)
        snapshot = snapshots.get(candidate.evidence_snapshot_id)
        if snapshot is None:
            raise ValueError(f"accepted candidate {candidate.candidate_id} has missing evidence")
        if snapshot.body_sha256 != candidate.evidence_body_sha256:
            raise ValueError(
                f"accepted candidate {candidate.candidate_id} evidence hash does not match"
            )
        if snapshot.block_state is not EvidenceBlockState.CLEAR or snapshot.status != 200:
            raise ValueError(
                f"accepted candidate {candidate.candidate_id} evidence is not clear HTTP 200"
            )
        changes_by_panda[target_panda_id].append(_change_for_candidate(candidate, decision))

    recommendations = [
        AcquisitionCurationRecommendation(
            acquisition_bundle_id=bundle.bundle_id,
            pipeline_artifact_id=pipeline_artifact_id,
            target_panda_id=target_panda_id,
            recommended_by_account_id=recommended_by_account_id,
            reason=reason,
            changes=tuple(sorted(changes, key=lambda item: item.candidate_id)),
        )
        for target_panda_id, changes in changes_by_panda.items()
    ]
    return tuple(sorted(recommendations, key=lambda item: item.target_panda_id))


def _target_panda_id(candidate: FieldCandidate) -> str:
    match = candidate.identity_match
    if match.state is IdentityMatchState.AMBIGUOUS:
        raise ValueError(
            f"accepted candidate {candidate.candidate_id} has an ambiguous panda identity"
        )
    if match.state is IdentityMatchState.NOT_ATTEMPTED:
        raise ValueError(
            f"accepted candidate {candidate.candidate_id} has not completed identity matching"
        )
    if match.state is not IdentityMatchState.MATCHED or match.matched_panda_id is None:
        raise ValueError(
            f"accepted candidate {candidate.candidate_id} has no resolved target Panda UUID; "
            "new identities and slug-only matches stay in review until identity resolution "
            "completes"
        )
    _require_uuid("matched_panda_id", match.matched_panda_id)
    return match.matched_panda_id


def _change_for_candidate(
    candidate: FieldCandidate,
    decision: CuratorDecision,
) -> AcquisitionCurationChange:
    if candidate.normalized_value is None:
        raise ValueError(
            f"accepted candidate {candidate.candidate_id} is source absence, not a promotable fact"
        )
    if candidate.conflict_state is ConflictState.NOT_COMPARED:
        raise ValueError(
            f"accepted candidate {candidate.candidate_id} was never compared with trusted state"
        )
    if candidate.candidate_kind is CandidateKind.MEDIA_METADATA:
        raise ValueError(
            f"accepted candidate {candidate.candidate_id} is media metadata; V2 Curation owner "
            "routing does not yet expose a Media operation"
        )

    if candidate.candidate_kind is CandidateKind.IDENTITY:
        owner, operation, payload = _identity_change(candidate)
    elif candidate.candidate_kind is CandidateKind.RELATIONSHIP:
        owner, operation, payload = _parentage_change(candidate)
    elif candidate.candidate_kind is CandidateKind.RESIDENCY:
        owner, operation, payload = _residency_change(candidate)
    elif candidate.candidate_kind is CandidateKind.EVENT:
        owner, operation, payload = _event_change(candidate)
    else:
        raise ValueError(f"unsupported candidate kind {candidate.candidate_kind.value}")

    return AcquisitionCurationChange(
        candidate_id=candidate.candidate_id,
        owner_module=owner,
        operation=operation,
        payload=payload,
        last_verified_on=decision.decided_at.date(),
        source_ids=(candidate.source_id,),
    )


def _identity_change(
    candidate: FieldCandidate,
) -> tuple[CurationOwnerModule, CurationOwnerOperation, dict[str, JsonValue]]:
    name = _name_contract(candidate.field_path)
    if name is not None:
        if candidate.conflict_state is ConflictState.CONTRADICTION:
            raise ValueError(
                f"identity-name contradiction {candidate.candidate_id} requires explicit name "
                "adjudication; Curation has no generic name-dispute operation"
            )
        language_tag, name_kind = name
        operation = (
            CurationOwnerOperation.NAME_CORROBORATE
            if candidate.conflict_state is ConflictState.UNCHANGED
            else CurationOwnerOperation.NAME_ADD
        )
        return (
            CurationOwnerModule.PANDA,
            operation,
            {
                "languageTag": language_tag,
                "nameKind": name_kind,
                "value": _string_value("name", candidate.normalized_value),
            },
        )

    identifier_system = _external_identifier_system(candidate.field_path)
    if identifier_system is not None:
        if candidate.conflict_state is ConflictState.CONTRADICTION:
            raise ValueError(
                f"external-identifier contradiction {candidate.candidate_id} requires explicit "
                "identity adjudication"
            )
        operation = (
            CurationOwnerOperation.EXTERNAL_IDENTIFIER_CORROBORATE
            if candidate.conflict_state is ConflictState.UNCHANGED
            else CurationOwnerOperation.EXTERNAL_IDENTIFIER_ADD
        )
        return (
            CurationOwnerModule.PANDA,
            operation,
            {
                "system": identifier_system,
                "value": _string_value("external identifier", candidate.normalized_value),
            },
        )

    field_key = _fact_field_key(candidate.field_path)
    operation = _fact_operation(candidate.conflict_state)
    return (
        CurationOwnerModule.PANDA,
        operation,
        {
            "fieldKey": field_key,
            "value": candidate.normalized_value,
            "certainty": (
                "provisional"
                if candidate.conflict_state is ConflictState.CONTRADICTION
                else "confirmed"
            ),
        },
    )


def _name_contract(field_path: str) -> tuple[str, str] | None:
    explicit = {
        "identity.names.official.zh": ("zh-CN", "official"),
        "identity.names.official.en": ("en", "official"),
        "identity.names.alias.zh": ("zh-CN", "alias"),
        "identity.names.alias.en": ("en", "alias"),
        "identity.aliases.zh": ("zh-CN", "alias"),
        "identity.aliases.en": ("en", "alias"),
        "identity.historical_names.zh": ("zh-CN", "historical_name"),
        "identity.historical_names.en": ("en", "historical_name"),
        "identity.nicknames.zh": ("zh-CN", "nickname"),
        "identity.nicknames.en": ("en", "nickname"),
        "identity.pinyin": ("zh-Latn-pinyin", "pinyin"),
    }
    return explicit.get(field_path)


def _external_identifier_system(field_path: str) -> str | None:
    prefix = "identity.external_identifiers."
    if not field_path.startswith(prefix):
        return None
    system = field_path.removeprefix(prefix).strip()
    if not system:
        raise ValueError("external identifier field path must name its source system")
    return system


def _fact_field_key(field_path: str) -> str:
    mapping = {
        "identity.sex": "profile.sex",
        "identity.gender": "profile.sex",
        "identity.birth_date": "birth.date",
        "identity.death_date": "death.date",
        "identity.status": "profile.life_status",
        "identity.life_status": "profile.life_status",
    }
    field_key = mapping.get(field_path)
    if field_key is None:
        raise ValueError(f"unsupported Panda fact field path {field_path}")
    return field_key


def _fact_operation(conflict_state: ConflictState) -> CurationOwnerOperation:
    if conflict_state is ConflictState.UNCHANGED:
        return CurationOwnerOperation.FACT_CORROBORATE
    if conflict_state is ConflictState.CONTRADICTION:
        return CurationOwnerOperation.FACT_DISPUTE
    if conflict_state in {
        ConflictState.NEW,
        ConflictState.ENRICHMENT,
        ConflictState.MISSING_CURRENT_VALUE,
    }:
        return CurationOwnerOperation.FACT_PROPOSE
    raise ValueError(f"conflict state {conflict_state.value} is not promotable as a Panda fact")


def _parentage_change(
    candidate: FieldCandidate,
) -> tuple[CurationOwnerModule, CurationOwnerOperation, dict[str, JsonValue]]:
    if not candidate.field_path.startswith("relationship."):
        raise ValueError(f"unsupported relationship field path {candidate.field_path}")
    value = candidate.normalized_value
    role = candidate.field_path.removeprefix("relationship.")
    if role == "parent":
        if not isinstance(value, dict):
            raise ValueError("generic parentage candidates require a structured normalized value")
        role = _optional_string(value, "parent_role", "parentRole") or ""
    if role not in {"father", "mother"}:
        raise ValueError(
            f"parentage role must resolve to father or mother, got {role or 'missing'}"
        )

    parent_id: str | None = None
    status: str | None = None
    if isinstance(value, str):
        parent_id = value
    elif isinstance(value, dict):
        parent_id = _optional_string(value, "parent_id", "parentId", "panda_id", "pandaId")
        status = _optional_string(value, "status")
    if parent_id is None:
        raise ValueError(
            f"parentage candidate {candidate.candidate_id} has no resolved parent Panda UUID; "
            "names and slugs are not inferred as identities"
        )
    _require_uuid("parent_id", parent_id)

    if candidate.conflict_state is ConflictState.CONTRADICTION:
        status = "disputed"
    elif status is None:
        status = "confirmed"
    if status not in {"confirmed", "tentative", "disputed"}:
        raise ValueError(f"unsupported parentage status {status}")

    return (
        CurationOwnerModule.LINEAGE,
        CurationOwnerOperation.PARENTAGE_CREATE,
        {"parentId": parent_id, "parentRole": role, "status": status},
    )


def _residency_change(
    candidate: FieldCandidate,
) -> tuple[CurationOwnerModule, CurationOwnerOperation, dict[str, JsonValue]]:
    value = candidate.normalized_value
    if not isinstance(value, dict):
        raise ValueError("residency candidates require a structured normalized value")
    place_id = _optional_string(value, "place_id", "placeId")
    if place_id is None:
        raise ValueError(
            f"residency candidate {candidate.candidate_id} has no resolved place UUID; "
            "free-text locations stay in review until Places resolution completes"
        )
    _require_uuid("place_id", place_id)

    field_kind = (
        candidate.field_path.removeprefix("residency.")
        if candidate.field_path.startswith("residency.")
        else ""
    )
    residency_type = _optional_string(value, "residency_type", "residencyType")
    if residency_type is None and field_kind in {"primary", "temporary", "transit", "quarantine"}:
        residency_type = field_kind
    residency_type = residency_type or "primary"
    if residency_type not in {"primary", "temporary", "transit", "quarantine"}:
        raise ValueError(f"unsupported residency type {residency_type}")

    start_on, start_precision = _partial_date_from_mapping(value, "start", default_unknown=True)
    payload: dict[str, JsonValue] = {
        "placeId": place_id,
        "residencyType": residency_type,
        "startPrecision": start_precision,
        "status": (
            "provisional"
            if candidate.conflict_state is ConflictState.CONTRADICTION
            else (_optional_string(value, "status") or "confirmed")
        ),
    }
    if start_on is not None:
        payload["startOn"] = start_on

    if _has_partial_date(value, "end"):
        end_on, end_precision = _partial_date_from_mapping(value, "end", default_unknown=False)
        payload["endPrecision"] = end_precision
        if end_on is not None:
            payload["endOn"] = end_on

    if payload["status"] not in {"confirmed", "confirmed_country_level", "provisional"}:
        raise ValueError(f"unsupported residency status {payload['status']}")
    return CurationOwnerModule.LIFE_HISTORY, CurationOwnerOperation.RESIDENCY_CREATE, payload


def _event_change(
    candidate: FieldCandidate,
) -> tuple[CurationOwnerModule, CurationOwnerOperation, dict[str, JsonValue]]:
    value = candidate.normalized_value
    if not isinstance(value, dict):
        raise ValueError("event candidates require a structured normalized value")
    event_type = _optional_string(value, "event_type", "eventType")
    if event_type not in {
        "birth",
        "arrival",
        "transfer",
        "return",
        "naming",
        "public_debut",
        "selection",
        "announcement",
        "observation",
        "death",
    }:
        raise ValueError(f"unsupported event type {event_type or 'missing'}")

    occurred_on, occurred_precision = _event_partial_date(value)
    event_status = (
        "disputed"
        if candidate.conflict_state is ConflictState.CONTRADICTION
        else (_optional_string(value, "event_status", "eventStatus") or "completed")
    )
    if event_status not in {"announced", "completed", "cancelled", "disputed"}:
        raise ValueError(f"unsupported event status {event_status}")

    payload: dict[str, JsonValue] = {
        "eventType": event_type,
        "eventStatus": event_status,
        "occurredPrecision": occurred_precision,
    }
    if occurred_on is not None:
        payload["occurredOn"] = occurred_on
    for target_key, aliases in (
        ("fromPlaceId", ("from_place_id", "fromPlaceId")),
        ("toPlaceId", ("to_place_id", "toPlaceId")),
    ):
        place_id = _optional_string(value, *aliases)
        if place_id is not None:
            _require_uuid(target_key, place_id)
            payload[target_key] = place_id
    summary = _optional_string(value, "summary")
    if summary is not None:
        payload["summary"] = summary
    return CurationOwnerModule.LIFE_HISTORY, CurationOwnerOperation.EVENT_CREATE, payload


def _event_partial_date(value: dict[str, JsonValue]) -> tuple[str | None, str]:
    structured = value.get("event_date")
    if isinstance(structured, dict):
        return _normalize_partial_date(structured.get("value"), structured.get("precision"))
    structured = value.get("occurred")
    if isinstance(structured, dict):
        return _normalize_partial_date(structured.get("value"), structured.get("precision"))
    raw = value.get("occurred_on", value.get("occurredOn"))
    precision = value.get("occurred_precision", value.get("occurredPrecision"))
    if raw is None and precision is None:
        return None, "unknown"
    return _normalize_partial_date(raw, precision)


def _partial_date_from_mapping(
    value: dict[str, JsonValue],
    prefix: str,
    *,
    default_unknown: bool,
) -> tuple[str | None, str]:
    structured = value.get(f"{prefix}_date")
    if isinstance(structured, dict):
        return _normalize_partial_date(structured.get("value"), structured.get("precision"))
    raw = value.get(f"{prefix}_on", value.get(f"{prefix}On", value.get(prefix)))
    precision = value.get(f"{prefix}_precision", value.get(f"{prefix}Precision"))
    if raw is None and precision is None and default_unknown:
        return None, "unknown"
    return _normalize_partial_date(raw, precision)


def _has_partial_date(value: dict[str, JsonValue], prefix: str) -> bool:
    return any(
        key in value
        for key in (
            f"{prefix}_date",
            prefix,
            f"{prefix}_on",
            f"{prefix}On",
            f"{prefix}_precision",
            f"{prefix}Precision",
        )
    )


def _normalize_partial_date(raw: JsonValue, precision_value: JsonValue) -> tuple[str | None, str]:
    if not isinstance(precision_value, str):
        raise ValueError("partial dates require an explicit day/month/year/unknown precision")
    precision = precision_value.strip().lower()
    if precision == "unknown":
        if raw is not None:
            raise ValueError("unknown-precision dates must not carry a date value")
        return None, "unknown"
    if not isinstance(raw, str) or not raw.strip():
        raise ValueError(f"{precision}-precision dates require a value")
    raw = raw.strip()
    if precision == "day":
        try:
            return date.fromisoformat(raw).isoformat(), "day"
        except ValueError as error:
            raise ValueError(f"invalid day-precision date {raw}") from error
    if precision == "month":
        try:
            parsed = date.fromisoformat(f"{raw}-01")
        except ValueError as error:
            raise ValueError(f"invalid month-precision date {raw}") from error
        return parsed.isoformat(), "month"
    if precision == "year":
        if len(raw) != 4 or not raw.isdigit():
            raise ValueError(f"invalid year-precision date {raw}")
        year = int(raw)
        if year < 1:
            raise ValueError(f"invalid year-precision date {raw}")
        return date(year, 1, 1).isoformat(), "year"
    raise ValueError(f"unsupported date precision {precision}")


def _optional_string(value: dict[str, JsonValue], *keys: str) -> str | None:
    for key in keys:
        item = value.get(key)
        if isinstance(item, str) and item.strip():
            return item.strip()
    return None


def _string_value(label: str, value: JsonValue) -> str:
    if isinstance(value, str) and value.strip():
        return value.strip()
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value)
    raise ValueError(f"{label} value must be a non-empty string or number")


def _require_uuid(label: str, value: str) -> None:
    try:
        UUID(value)
    except (ValueError, AttributeError) as error:
        raise ValueError(f"{label} must be a UUID") from error


__all__ = [
    "DEFAULT_PROMOTION_REASON",
    "AcquisitionCurationChange",
    "AcquisitionCurationRecommendation",
    "CurationOwnerModule",
    "CurationOwnerOperation",
    "build_acquisition_curation_recommendations",
]
