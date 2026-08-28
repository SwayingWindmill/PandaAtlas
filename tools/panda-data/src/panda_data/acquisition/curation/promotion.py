from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, date, datetime
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
from .models import DecisionAction, DecisionLog
from .workflow import validate_decision_log

PROMOTION_SCHEMA_VERSION = "panda-atlas-v2-curation-promotion/v1"
_FACT_FIELDS = {
    "identity.sex": "profile.sex",
    "identity.life_status": "profile.life_status",
    "identity.birth_date": "profile.birth_date",
    "identity.death_date": "profile.death_date",
}
_DATE_PRECISIONS = frozenset({"day", "month", "year", "unknown"})


@dataclass(frozen=True, slots=True)
class V2CurationOwnerChange:
    candidate_id: str
    owner_module: str
    operation: str
    payload: dict[str, JsonValue]
    last_verified_on: str
    source_ids: tuple[str, ...]

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "candidateId": self.candidate_id,
            "ownerModule": self.owner_module,
            "operation": self.operation,
            "payload": self.payload,
            "lastVerifiedOn": self.last_verified_on,
            "sourceIds": list(self.source_ids),
        }


@dataclass(frozen=True, slots=True)
class V2AcquisitionCurationRecommendation:
    acquisition_bundle_id: str
    pipeline_artifact_id: str
    target_panda_id: str
    recommended_by_account_id: str
    reason: str
    changes: tuple[V2CurationOwnerChange, ...]

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "acquisitionBundleId": self.acquisition_bundle_id,
            "pipelineArtifactId": self.pipeline_artifact_id,
            "targetPandaId": self.target_panda_id,
            "recommendedByAccountId": self.recommended_by_account_id,
            "reason": self.reason,
            "changes": [change.to_dict() for change in self.changes],
        }


@dataclass(frozen=True, slots=True)
class V2CurationPromotionBatch:
    acquisition_bundle_id: str
    decision_log_id: str
    pipeline_artifact_id: str
    recommendations: tuple[V2AcquisitionCurationRecommendation, ...]
    created_at: datetime
    schema_version: str = PROMOTION_SCHEMA_VERSION

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "schemaVersion": self.schema_version,
            "acquisitionBundleId": self.acquisition_bundle_id,
            "decisionLogId": self.decision_log_id,
            "pipelineArtifactId": self.pipeline_artifact_id,
            "createdAt": self.created_at.astimezone(UTC).isoformat().replace("+00:00", "Z"),
            "recommendations": [item.to_dict() for item in self.recommendations],
            "writeBoundary": {
                "authoritativeWrites": [],
                "publicationWrites": [],
            },
        }


def build_v2_curation_promotion(
    bundle: AcquisitionBundle,
    decision_log: DecisionLog,
    *,
    pipeline_artifact_id: str,
    recommended_by_account_id: str,
    reason: str,
    created_at: datetime | None = None,
) -> V2CurationPromotionBatch:
    promoted_at = created_at or datetime.now(UTC)
    _require_aware("promotion created_at", promoted_at)
    _require_uuid("pipeline_artifact_id", pipeline_artifact_id)
    _require_uuid("recommended_by_account_id", recommended_by_account_id)
    if not reason.strip():
        raise ValueError("promotion reason cannot be blank")
    if bundle.run.state is not AcquisitionRunState.COMPLETED:
        raise ValueError("V2 Curation promotion requires a completed acquisition run")
    if bundle.run.source_reviewed_at is None or bundle.run.source_review_expires_at is None:
        raise ValueError("V2 Curation promotion requires source review dates")
    if bundle.run.source_reviewed_at > promoted_at.date():
        raise ValueError("V2 Curation promotion cannot precede the source review")
    if bundle.run.source_review_expires_at < promoted_at.date():
        raise ValueError(
            f"source review expired on {bundle.run.source_review_expires_at.isoformat()}"
        )

    validate_decision_log(bundle, decision_log)
    if decision_log.updated_at > promoted_at:
        raise ValueError("V2 Curation promotion cannot precede decision log updated_at")
    effective = decision_log.effective_decisions()
    evidence_by_id = {snapshot.snapshot_id: snapshot for snapshot in bundle.evidence_snapshots}
    grouped: dict[str, list[V2CurationOwnerChange]] = defaultdict(list)

    for candidate in sorted(bundle.candidates, key=lambda item: item.candidate_id):
        decision = effective.get(candidate.candidate_id)
        if decision is None or decision.action is not DecisionAction.ACCEPTED:
            continue
        target_panda_id = _target_panda_id(candidate)
        snapshot = evidence_by_id[candidate.evidence_snapshot_id]
        if snapshot.body_sha256 != candidate.evidence_body_sha256:
            raise ValueError(f"accepted candidate {candidate.candidate_id} evidence hash drifted")
        if snapshot.status != 200 or snapshot.block_state is not EvidenceBlockState.CLEAR:
            raise ValueError(
                f"accepted candidate {candidate.candidate_id} evidence is not clear HTTP 200"
            )
        if candidate.normalized_value is None:
            raise ValueError(
                "accepted candidate "
                f"{candidate.candidate_id} is source absence, not a promotable fact"
            )
        if candidate.candidate_kind is CandidateKind.MEDIA_METADATA:
            raise ValueError(
                "accepted candidate "
                f"{candidate.candidate_id} is media metadata; Media owns that path"
            )
        grouped[target_panda_id].append(
            _owner_change(candidate, last_verified_on=decision.decided_at.date())
        )

    if not grouped:
        raise ValueError("V2 Curation promotion requires at least one accepted matched candidate")

    recommendations = tuple(
        V2AcquisitionCurationRecommendation(
            acquisition_bundle_id=bundle.bundle_id,
            pipeline_artifact_id=pipeline_artifact_id,
            target_panda_id=target_panda_id,
            recommended_by_account_id=recommended_by_account_id,
            reason=reason.strip(),
            changes=tuple(sorted(changes, key=lambda item: item.candidate_id)),
        )
        for target_panda_id, changes in sorted(grouped.items())
    )
    return V2CurationPromotionBatch(
        acquisition_bundle_id=bundle.bundle_id,
        decision_log_id=decision_log.decision_log_id,
        pipeline_artifact_id=pipeline_artifact_id,
        recommendations=recommendations,
        created_at=promoted_at,
    )


def _target_panda_id(candidate: FieldCandidate) -> str:
    match = candidate.identity_match
    if match.state is not IdentityMatchState.MATCHED:
        raise ValueError(
            f"accepted candidate {candidate.candidate_id} requires an unambiguous matched Panda"
        )
    if match.matched_panda_id is None:
        raise ValueError(
            f"accepted candidate {candidate.candidate_id} is matched only by legacy slug; "
            "V2 promotion requires an authoritative Panda UUID"
        )
    _require_uuid("matched_panda_id", match.matched_panda_id)
    return match.matched_panda_id


def _owner_change(candidate: FieldCandidate, *, last_verified_on: date) -> V2CurationOwnerChange:
    if candidate.candidate_kind is CandidateKind.IDENTITY:
        owner_module, operation, payload = _identity_change(candidate)
    elif candidate.candidate_kind is CandidateKind.RELATIONSHIP:
        owner_module, operation, payload = _parentage_change(candidate)
    elif candidate.candidate_kind is CandidateKind.RESIDENCY:
        owner_module, operation, payload = _residency_change(candidate)
    elif candidate.candidate_kind is CandidateKind.EVENT:
        owner_module, operation, payload = _event_change(candidate)
    else:
        raise ValueError(f"unsupported V2 promotion kind {candidate.candidate_kind.value}")
    return V2CurationOwnerChange(
        candidate_id=candidate.candidate_id,
        owner_module=owner_module,
        operation=operation,
        payload=payload,
        last_verified_on=last_verified_on.isoformat(),
        source_ids=(candidate.source_id,),
    )


def _identity_change(candidate: FieldCandidate) -> tuple[str, str, dict[str, JsonValue]]:
    field = candidate.field_path
    if field.startswith("identity.names.") or ".alias" in field:
        return _name_change(candidate)
    if "external_identifier" in field or "external-identifiers" in field:
        return _external_identifier_change(candidate)
    field_key = _FACT_FIELDS.get(field)
    if field_key is None:
        raise ValueError(f"unsupported V2 Panda fact field {field}")
    operation = {
        ConflictState.NEW: "fact.propose",
        ConflictState.MISSING_CURRENT_VALUE: "fact.propose",
        ConflictState.UNCHANGED: "fact.corroborate",
        ConflictState.ENRICHMENT: "fact.refine",
        ConflictState.CONTRADICTION: "fact.dispute",
    }.get(candidate.conflict_state)
    if operation is None:
        raise ValueError(
            f"accepted candidate {candidate.candidate_id} has no V2 fact operation for "
            f"{candidate.conflict_state.value}"
        )
    return (
        "panda",
        operation,
        {
            "fieldKey": field_key,
            "value": candidate.normalized_value,
            "certainty": "confirmed",
        },
    )


def _name_change(candidate: FieldCandidate) -> tuple[str, str, dict[str, JsonValue]]:
    if candidate.conflict_state is ConflictState.CONTRADICTION:
        raise ValueError(
            "accepted name candidate "
            f"{candidate.candidate_id} requires explicit identity conflict review"
        )
    if candidate.conflict_state is ConflictState.NOT_COMPARED:
        raise ValueError(f"accepted name candidate {candidate.candidate_id} was not compared")
    value = _text_value(candidate.normalized_value, "name")
    parts = candidate.field_path.split(".")
    language_tag = parts[-1] if len(parts) > 1 else "und"
    if ".alias" in candidate.field_path:
        name_kind = "alias"
    elif ".pinyin" in candidate.field_path:
        name_kind = "pinyin"
    elif ".historical" in candidate.field_path:
        name_kind = "historical_name"
    elif ".historic_spelling" in candidate.field_path:
        name_kind = "historic_spelling"
    elif ".nickname" in candidate.field_path:
        name_kind = "nickname"
    else:
        name_kind = "official"
    operation = (
        "name.corroborate"
        if candidate.conflict_state is ConflictState.UNCHANGED
        else "name.add"
    )
    return (
        "panda",
        operation,
        {"languageTag": language_tag, "nameKind": name_kind, "value": value},
    )


def _external_identifier_change(
    candidate: FieldCandidate,
) -> tuple[str, str, dict[str, JsonValue]]:
    if candidate.conflict_state in {
        ConflictState.CONTRADICTION,
        ConflictState.NOT_COMPARED,
    }:
        raise ValueError(
            "accepted external identifier candidate "
            f"{candidate.candidate_id} requires explicit conflict review"
        )
    value = candidate.normalized_value
    if not isinstance(value, dict):
        raise ValueError("external identifier candidates require structured normalized values")
    system = value.get("system")
    identifier = value.get("value")
    if (
        not isinstance(system, str)
        or not system
        or not isinstance(identifier, str)
        or not identifier
    ):
        raise ValueError("external identifier candidates require system and value")
    operation = (
        "external_identifier.corroborate"
        if candidate.conflict_state is ConflictState.UNCHANGED
        else "external_identifier.add"
    )
    return "panda", operation, {"system": system, "value": identifier}


def _parentage_change(candidate: FieldCandidate) -> tuple[str, str, dict[str, JsonValue]]:
    if candidate.conflict_state not in {
        ConflictState.NEW,
        ConflictState.MISSING_CURRENT_VALUE,
    }:
        raise ValueError(
            "accepted parentage candidate "
            f"{candidate.candidate_id} is {candidate.conflict_state.value}; "
            "only new resolved parentage can use parentage.create"
        )
    role = candidate.field_path.removeprefix("relationship.").removeprefix("parentage.")
    if role not in {"father", "mother"}:
        raise ValueError(f"unsupported parentage role {role}")
    value = candidate.normalized_value
    if not isinstance(value, dict):
        raise ValueError("parentage promotion requires a resolved structured parent reference")
    parent_id = value.get("parent_id") or value.get("panda_id")
    if not isinstance(parent_id, str):
        raise ValueError(
            f"accepted parentage candidate {candidate.candidate_id} has no resolved parent UUID"
        )
    _require_uuid("parent_id", parent_id)
    status = value.get("status", "confirmed")
    if status not in {"confirmed", "tentative", "disputed", "superseded"}:
        raise ValueError(f"unsupported parentage status {status!r}")
    return (
        "lineage",
        "parentage.create",
        {"parentId": parent_id, "parentRole": role, "status": status},
    )


def _residency_change(candidate: FieldCandidate) -> tuple[str, str, dict[str, JsonValue]]:
    if candidate.conflict_state not in {
        ConflictState.NEW,
        ConflictState.MISSING_CURRENT_VALUE,
    }:
        raise ValueError(
            "accepted residency candidate "
            f"{candidate.candidate_id} is {candidate.conflict_state.value}; "
            "existing residency reconciliation requires a dedicated owner operation"
        )
    value = candidate.normalized_value
    if not isinstance(value, dict):
        raise ValueError("residency promotion requires a resolved structured value")
    place_id = value.get("place_id")
    if not isinstance(place_id, str):
        raise ValueError(
            f"accepted residency candidate {candidate.candidate_id} has no resolved place UUID"
        )
    _require_uuid("place_id", place_id)
    residency_type = value.get("residency_type")
    if residency_type is None and candidate.field_path == "residency.current_location":
        residency_type = "primary"
    if residency_type not in {"primary", "temporary", "transit", "quarantine"}:
        raise ValueError(f"unsupported residency type {residency_type!r}")
    start_on, start_precision = _life_date(value.get("start") or value.get("start_date"))
    end_on, end_precision = _life_date(value.get("end") or value.get("end_date"))
    status = value.get("status", "confirmed")
    if status not in {"confirmed", "confirmed_country_level", "provisional"}:
        raise ValueError(f"unsupported residency status {status!r}")
    payload: dict[str, JsonValue] = {
        "placeId": place_id,
        "residencyType": residency_type,
        "startPrecision": start_precision,
        "status": status,
    }
    if start_on is not None:
        payload["startOn"] = start_on
    if end_on is not None or end_precision != "unknown":
        payload["endPrecision"] = end_precision
        if end_on is not None:
            payload["endOn"] = end_on
    return "life_history", "residency.create", payload


def _event_change(candidate: FieldCandidate) -> tuple[str, str, dict[str, JsonValue]]:
    if candidate.conflict_state is not ConflictState.NEW:
        raise ValueError(
            "accepted event candidate "
            f"{candidate.candidate_id} is {candidate.conflict_state.value}; "
            "only genuinely new events can use event.create"
        )
    value = candidate.normalized_value
    if not isinstance(value, dict):
        raise ValueError("event promotion requires a structured normalized value")
    event_type = value.get("event_type")
    if not isinstance(event_type, str) or not event_type:
        raise ValueError("event promotion requires event_type")
    occurred_on, occurred_precision = _life_date(
        value.get("event_date") or value.get("date")
    )
    payload: dict[str, JsonValue] = {
        "eventType": event_type,
        "eventStatus": value.get("event_status", "completed"),
        "occurredPrecision": occurred_precision,
    }
    if occurred_on is not None:
        payload["occurredOn"] = occurred_on
    for source_key, target_key in (
        ("from_place_id", "fromPlaceId"),
        ("to_place_id", "toPlaceId"),
        ("place_id", "toPlaceId"),
    ):
        place_id = value.get(source_key)
        if place_id is not None:
            if not isinstance(place_id, str):
                raise ValueError(f"event {source_key} must be a UUID string")
            _require_uuid(source_key, place_id)
            payload[target_key] = place_id
    has_location = value.get("location") is not None
    has_resolved_place = "toPlaceId" in payload or "fromPlaceId" in payload
    if has_location and not has_resolved_place:
        raise ValueError(
            "accepted event candidate "
            f"{candidate.candidate_id} has source location text but no resolved place UUID"
        )
    participant_ids = value.get("participant_ids")
    if participant_ids is not None:
        if not isinstance(participant_ids, list) or not all(
            isinstance(item, str) for item in participant_ids
        ):
            raise ValueError("event participant_ids must be UUID strings")
        for participant_id in participant_ids:
            _require_uuid("participant_id", participant_id)
        payload["participantIds"] = participant_ids
    related = value.get("related_slugs")
    if related and participant_ids is None:
        raise ValueError(
            "accepted event candidate "
            f"{candidate.candidate_id} has unresolved related panda references"
        )
    summary = value.get("summary")
    if isinstance(summary, str) and summary.strip():
        payload["summary"] = summary.strip()
    return "life_history", "event.create", payload


def _life_date(value: JsonValue) -> tuple[str | None, str]:
    if value is None:
        return None, "unknown"
    if isinstance(value, dict):
        raw = value.get("value")
        precision = value.get("precision")
    else:
        raw = value
        precision = None
    if raw is None:
        return None, "unknown"
    if not isinstance(raw, str):
        raise ValueError("life-history dates must normalize to strings")
    text = raw.strip()
    if precision is None:
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
            precision = "day"
        elif re.fullmatch(r"\d{4}-\d{2}", text):
            precision = "month"
        elif re.fullmatch(r"\d{4}", text):
            precision = "year"
        else:
            precision = "unknown"
    if not isinstance(precision, str) or precision not in _DATE_PRECISIONS:
        raise ValueError(f"unsupported date precision {precision!r}")
    if precision == "unknown":
        return None, "unknown"
    if precision == "year":
        if not re.fullmatch(r"\d{4}", text):
            raise ValueError(f"year-precision date must be YYYY, got {text!r}")
        return f"{text}-01-01", "year"
    if precision == "month":
        if not re.fullmatch(r"\d{4}-\d{2}", text):
            raise ValueError(f"month-precision date must be YYYY-MM, got {text!r}")
        date.fromisoformat(f"{text}-01")
        return f"{text}-01", "month"
    date.fromisoformat(text)
    return text, "day"


def _text_value(value: JsonValue, label: str) -> str:
    if isinstance(value, str) and value.strip():
        return value.strip()
    if isinstance(value, dict):
        nested = value.get("value") or value.get("name")
        if isinstance(nested, str) and nested.strip():
            return nested.strip()
    raise ValueError(f"{label} candidate requires a non-empty text value")


def _require_uuid(label: str, value: str) -> None:
    try:
        UUID(value)
    except ValueError as error:
        raise ValueError(f"{label} must be a UUID") from error


def _require_aware(label: str, value: datetime) -> None:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{label} must include a timezone")


__all__ = [
    "PROMOTION_SCHEMA_VERSION",
    "V2AcquisitionCurationRecommendation",
    "V2CurationOwnerChange",
    "V2CurationPromotionBatch",
    "build_v2_curation_promotion",
]
