from __future__ import annotations

import re
from collections import defaultdict
from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Literal
from uuid import UUID

from panda_data.contracts import validate_contract

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

OwnerModule = Literal["panda", "lineage", "life_history"]
OwnerOperation = Literal[
    "fact.propose",
    "fact.corroborate",
    "fact.dispute",
    "name.add",
    "name.corroborate",
    "external_identifier.add",
    "external_identifier.corroborate",
    "parentage.create",
    "residency.create",
    "event.create",
]

_ALLOWED_PARENTAGE_STATUSES = frozenset({"confirmed", "tentative", "disputed", "superseded"})
_ALLOWED_RESIDENCY_TYPES = frozenset({"primary", "temporary", "transit", "quarantine"})
_ALLOWED_RESIDENCY_STATUSES = frozenset({"confirmed", "confirmed_country_level", "provisional"})
_ALLOWED_EVENT_TYPES = frozenset(
    {
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
    }
)
_ALLOWED_EVENT_STATUSES = frozenset({"announced", "completed", "cancelled", "disputed"})
_ALLOWED_DATE_PRECISIONS = frozenset({"day", "month", "year", "unknown"})


@dataclass(frozen=True, slots=True)
class V2CurationResolutionContext:
    """Reviewed/read-only IDs needed to translate source-local references into V2 owner IDs."""

    panda_ids_by_slug: Mapping[str, str]
    place_ids_by_key: Mapping[str, str]
    target_panda_ids_by_source_identity: Mapping[str, str] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class AcquisitionCurationChange:
    candidate_id: str
    owner_module: OwnerModule
    operation: OwnerOperation
    payload: dict[str, JsonValue]
    last_verified_on: str
    source_ids: tuple[str, ...]

    def to_wire(self) -> dict[str, JsonValue]:
        return {
            "candidateId": self.candidate_id,
            "ownerModule": self.owner_module,
            "operation": self.operation,
            "payload": self.payload,
            "lastVerifiedOn": self.last_verified_on,
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

    def to_wire(self) -> dict[str, JsonValue]:
        payload: dict[str, JsonValue] = {
            "acquisitionBundleId": self.acquisition_bundle_id,
            "pipelineArtifactId": self.pipeline_artifact_id,
            "targetPandaId": self.target_panda_id,
            "recommendedByAccountId": self.recommended_by_account_id,
            "reason": self.reason,
            "changes": [change.to_wire() for change in self.changes],
        }
        validate_contract("acquisition-curation-recommendation", payload)
        return payload


def build_acquisition_curation_recommendations(
    bundle: AcquisitionBundle,
    decision_log: DecisionLog,
    *,
    pipeline_artifact_id: str,
    recommended_by_account_id: str,
    reason: str,
    resolution: V2CurationResolutionContext,
    created_at: datetime | None = None,
) -> tuple[AcquisitionCurationRecommendation, ...]:
    """Translate reviewed candidates into the Nest V2 acquisition Curation intake shape.

    The adapter is deliberately read-only. It resolves only IDs supplied by the acquisition
    bundle or an explicit reviewed resolution context and never creates/merges identities,
    places, facts, lineage, or life-history rows.
    """

    generated_at = created_at or datetime.now(UTC)
    _require_aware("created_at", generated_at)
    _require_uuid("pipeline_artifact_id", pipeline_artifact_id)
    _require_uuid("recommended_by_account_id", recommended_by_account_id)
    if not reason.strip() or reason != reason.strip():
        raise ValueError("reason must be a non-empty trimmed string")
    if bundle.run.state is not AcquisitionRunState.COMPLETED:
        raise ValueError("V2 Curation recommendations require a completed acquisition run")
    if bundle.run.source_reviewed_at is None or bundle.run.source_review_expires_at is None:
        raise ValueError("V2 Curation recommendations require source review dates")
    if bundle.run.source_reviewed_at > generated_at.date():
        raise ValueError("recommendation creation cannot precede the source review")
    if bundle.run.source_review_expires_at < generated_at.date():
        raise ValueError(
            f"source review expired on {bundle.run.source_review_expires_at.isoformat()}"
        )

    validate_decision_log(bundle, decision_log)
    if decision_log.updated_at > generated_at:
        raise ValueError("recommendation creation cannot precede decision-log updates")

    effective = decision_log.effective_decisions()
    snapshots = {snapshot.snapshot_id: snapshot for snapshot in bundle.evidence_snapshots}
    grouped: dict[str, list[AcquisitionCurationChange]] = defaultdict(list)

    for candidate in sorted(bundle.candidates, key=lambda item: item.candidate_id):
        decision = effective.get(candidate.candidate_id)
        if decision is None or decision.action is not DecisionAction.ACCEPTED:
            continue
        snapshot = snapshots.get(candidate.evidence_snapshot_id)
        if snapshot is None or snapshot.body_sha256 != candidate.evidence_body_sha256:
            raise ValueError(f"accepted candidate {candidate.candidate_id} has invalid evidence")
        if snapshot.block_state is not EvidenceBlockState.CLEAR or snapshot.status != 200:
            raise ValueError(
                f"accepted candidate {candidate.candidate_id} evidence is not clear HTTP 200"
            )

        target_panda_id = _resolve_target_panda_id(candidate, resolution)
        change = _candidate_change(candidate, resolution, snapshot.captured_at.date().isoformat())
        grouped[target_panda_id].append(change)

    if not grouped:
        raise ValueError(
            "V2 Curation recommendation export requires at least one accepted candidate"
        )

    recommendations = tuple(
        AcquisitionCurationRecommendation(
            acquisition_bundle_id=bundle.bundle_id,
            pipeline_artifact_id=pipeline_artifact_id,
            target_panda_id=target_panda_id,
            recommended_by_account_id=recommended_by_account_id,
            reason=reason,
            changes=tuple(sorted(changes, key=lambda item: item.candidate_id)),
        )
        for target_panda_id, changes in sorted(grouped.items())
    )
    for recommendation in recommendations:
        recommendation.to_wire()
    return recommendations


def _resolve_target_panda_id(
    candidate: FieldCandidate,
    resolution: V2CurationResolutionContext,
) -> str:
    match = candidate.identity_match
    if match.state is IdentityMatchState.AMBIGUOUS:
        raise ValueError(
            f"accepted candidate {candidate.candidate_id} has ambiguous panda identity"
        )
    if match.state is IdentityMatchState.NOT_ATTEMPTED:
        raise ValueError(
            f"accepted candidate {candidate.candidate_id} has unresolved panda identity"
        )

    if match.state is IdentityMatchState.MATCHED:
        if match.matched_panda_id:
            return _require_uuid("matched panda ID", match.matched_panda_id)
        if match.matched_canonical_slug:
            resolved = resolution.panda_ids_by_slug.get(match.matched_canonical_slug)
            if resolved:
                return _require_uuid("resolved panda ID", resolved)
        raise ValueError(
            f"accepted candidate {candidate.candidate_id} matched only by slug without a "
            "reviewed V2 ID"
        )

    explicit = resolution.target_panda_ids_by_source_identity.get(match.source_identity)
    if explicit:
        return _require_uuid("reviewed target panda ID", explicit)
    raise ValueError(
        f"accepted candidate {candidate.candidate_id} has unmatched source identity; "
        "review/create the Panda identity before Curation promotion"
    )


def _candidate_change(
    candidate: FieldCandidate,
    resolution: V2CurationResolutionContext,
    last_verified_on: str,
) -> AcquisitionCurationChange:
    if candidate.normalized_value is None:
        raise ValueError(f"accepted candidate {candidate.candidate_id} is source absence")
    if candidate.candidate_kind is CandidateKind.MEDIA_METADATA:
        raise ValueError("media metadata is not owned by the acquisition Curation adapter")

    if candidate.candidate_kind is CandidateKind.IDENTITY:
        owner, operation, payload = _identity_change(candidate)
    elif candidate.candidate_kind is CandidateKind.RELATIONSHIP:
        owner, operation, payload = _relationship_change(candidate, resolution)
    elif candidate.candidate_kind is CandidateKind.RESIDENCY:
        owner, operation, payload = _residency_change(candidate, resolution)
    elif candidate.candidate_kind is CandidateKind.EVENT:
        owner, operation, payload = _event_change(candidate, resolution)
    else:
        raise ValueError(f"unsupported candidate kind {candidate.candidate_kind.value}")

    return AcquisitionCurationChange(
        candidate_id=candidate.candidate_id,
        owner_module=owner,
        operation=operation,
        payload=payload,
        last_verified_on=last_verified_on,
        source_ids=(candidate.source_id,),
    )


def _identity_change(
    candidate: FieldCandidate,
) -> tuple[OwnerModule, OwnerOperation, dict[str, JsonValue]]:
    field = candidate.field_path
    if not field.startswith("identity."):
        raise ValueError(f"unsupported identity field path {field}")

    name = _name_payload(field, candidate.normalized_value)
    if name is not None:
        operation: OwnerOperation = (
            "name.corroborate"
            if candidate.conflict_state is ConflictState.UNCHANGED
            else "name.add"
        )
        return "panda", operation, name

    identifier = _external_identifier_payload(field, candidate.normalized_value)
    if identifier is not None:
        operation = (
            "external_identifier.corroborate"
            if candidate.conflict_state is ConflictState.UNCHANGED
            else "external_identifier.add"
        )
        return "panda", operation, identifier

    fact_key = _fact_key(field)
    if candidate.conflict_state is ConflictState.UNCHANGED:
        operation = "fact.corroborate"
    elif candidate.conflict_state is ConflictState.CONTRADICTION:
        operation = "fact.dispute"
    else:
        operation = "fact.propose"
    certainty = "provisional" if operation == "fact.dispute" else "confirmed"
    return (
        "panda",
        operation,
        {
            "fieldKey": fact_key,
            "value": candidate.normalized_value,
            "certainty": certainty,
        },
    )


def _name_payload(field: str, value: JsonValue) -> dict[str, JsonValue] | None:
    if field.startswith("identity.aliases."):
        language = field.removeprefix("identity.aliases.")
        kind = "alias"
    elif field.startswith("identity.names."):
        remainder = field.removeprefix("identity.names.")
        parts = remainder.split(".")
        if len(parts) < 2:
            return None
        raw_kind, language = parts[0], ".".join(parts[1:])
        kind = {
            "official": "official",
            "official_romanization": "official_romanization",
            "pinyin": "pinyin",
            "alias": "alias",
            "aliases": "alias",
            "historic_spelling": "historic_spelling",
            "historical": "historical_name",
            "historical_name": "historical_name",
            "nickname": "nickname",
        }.get(raw_kind)
        if kind is None:
            return None
    elif field.startswith("identity.historical_names."):
        language = field.removeprefix("identity.historical_names.")
        kind = "historical_name"
    else:
        return None

    text = value.get("value") if isinstance(value, dict) else value
    if not isinstance(text, str) or not text.strip():
        raise ValueError(f"name candidate {field} requires a non-empty string value")
    if not language:
        raise ValueError(f"name candidate {field} requires a language tag")
    return {"languageTag": _language_tag(language), "nameKind": kind, "value": text.strip()}


def _external_identifier_payload(field: str, value: JsonValue) -> dict[str, JsonValue] | None:
    prefixes = ("identity.external_identifier.", "identity.external_identifiers.")
    prefix = next((item for item in prefixes if field.startswith(item)), None)
    if prefix is None:
        return None
    if isinstance(value, dict):
        system = value.get("system")
        identifier = value.get("value")
    else:
        system = field.removeprefix(prefix)
        identifier = value
    if not isinstance(system, str) or not system.strip():
        raise ValueError(f"external identifier candidate {field} requires system")
    if not isinstance(identifier, str) or not identifier.strip():
        raise ValueError(f"external identifier candidate {field} requires value")
    return {"system": system.strip(), "value": identifier.strip()}


def _fact_key(field: str) -> str:
    suffix = field.removeprefix("identity.")
    if not suffix or not re.fullmatch(r"[a-z][a-z0-9_.-]{0,120}", suffix):
        raise ValueError(f"unsupported Panda fact field path {field}")
    return f"profile.{suffix}"


def _relationship_change(
    candidate: FieldCandidate,
    resolution: V2CurationResolutionContext,
) -> tuple[OwnerModule, OwnerOperation, dict[str, JsonValue]]:
    if not candidate.field_path.startswith("relationship."):
        raise ValueError(f"unsupported relationship field path {candidate.field_path}")
    role = candidate.field_path.removeprefix("relationship.")
    if role not in {"father", "mother"}:
        raise ValueError(f"parentage role {role} is unresolved; father or mother is required")
    value = candidate.normalized_value
    status = "disputed" if candidate.conflict_state is ConflictState.CONTRADICTION else "confirmed"
    if isinstance(value, dict):
        raw_status = value.get("status")
        if isinstance(raw_status, str) and raw_status in _ALLOWED_PARENTAGE_STATUSES:
            status = raw_status
    parent_id = _resolve_parent_id(value, resolution)
    return (
        "lineage",
        "parentage.create",
        {"parentId": parent_id, "parentRole": role, "status": status},
    )


def _resolve_parent_id(value: JsonValue, resolution: V2CurationResolutionContext) -> str:
    if isinstance(value, dict):
        for key in ("parent_id", "panda_id", "parentId", "pandaId"):
            direct = value.get(key)
            if isinstance(direct, str) and direct:
                return _require_uuid("parent panda ID", direct)
        slug = value.get("canonical_slug") or value.get("canonicalSlug")
        if isinstance(slug, str) and slug:
            resolved = resolution.panda_ids_by_slug.get(slug)
            if resolved:
                return _require_uuid("resolved parent panda ID", resolved)
        if value.get("source_name") or value.get("sourceName"):
            raise ValueError(
                "parentage source text is unresolved; canonical parent identity is required"
            )
    elif isinstance(value, str):
        resolved = resolution.panda_ids_by_slug.get(value)
        if resolved:
            return _require_uuid("resolved parent panda ID", resolved)
    raise ValueError("parentage candidate cannot be resolved to a reviewed V2 Panda ID")


def _residency_change(
    candidate: FieldCandidate,
    resolution: V2CurationResolutionContext,
) -> tuple[OwnerModule, OwnerOperation, dict[str, JsonValue]]:
    if not candidate.field_path.startswith("residency."):
        raise ValueError(f"unsupported residency field path {candidate.field_path}")
    value = candidate.normalized_value
    place_id = _resolve_place_id(value, resolution)
    raw_kind = candidate.field_path.removeprefix("residency.")
    residency_type = raw_kind if raw_kind in _ALLOWED_RESIDENCY_TYPES else "primary"
    status = (
        "provisional" if candidate.conflict_state is ConflictState.CONTRADICTION else "confirmed"
    )
    payload: dict[str, JsonValue] = {
        "placeId": place_id,
        "residencyType": residency_type,
        "startPrecision": "unknown",
        "status": status,
    }
    if isinstance(value, dict):
        raw_type = value.get("residency_type") or value.get("residencyType")
        if isinstance(raw_type, str) and raw_type in _ALLOWED_RESIDENCY_TYPES:
            payload["residencyType"] = raw_type
        raw_status = value.get("status")
        if isinstance(raw_status, str) and raw_status in _ALLOWED_RESIDENCY_STATUSES:
            payload["status"] = raw_status
        start_on, start_precision = _owner_date(
            value.get("start_date") or value.get("startDate") or value.get("start"),
            value.get("start_precision") or value.get("startPrecision"),
        )
        end_on, end_precision = _owner_date(
            value.get("end_date") or value.get("endDate") or value.get("end"),
            value.get("end_precision") or value.get("endPrecision"),
        )
        payload["startPrecision"] = start_precision
        if start_on is not None:
            payload["startOn"] = start_on
        if end_on is not None or end_precision != "unknown":
            payload["endPrecision"] = end_precision
        if end_on is not None:
            payload["endOn"] = end_on
    return "life_history", "residency.create", payload


def _event_change(
    candidate: FieldCandidate,
    resolution: V2CurationResolutionContext,
) -> tuple[OwnerModule, OwnerOperation, dict[str, JsonValue]]:
    value = candidate.normalized_value
    if not isinstance(value, dict):
        raise ValueError("event candidates require a structured normalized value")
    event_type = value.get("event_type") or value.get("eventType")
    if not isinstance(event_type, str) or event_type not in _ALLOWED_EVENT_TYPES:
        raise ValueError(f"unsupported V2 life-event type {event_type!r}")
    event_status = (
        "disputed" if candidate.conflict_state is ConflictState.CONTRADICTION else "completed"
    )
    raw_status = value.get("event_status") or value.get("eventStatus") or value.get("status")
    if isinstance(raw_status, str) and raw_status in _ALLOWED_EVENT_STATUSES:
        event_status = raw_status

    occurred_on, precision = _date_object(
        value.get("event_date") or value.get("eventDate") or value.get("date")
    )
    payload: dict[str, JsonValue] = {
        "eventType": event_type,
        "eventStatus": event_status,
        "occurredPrecision": precision,
    }
    if occurred_on is not None:
        payload["occurredOn"] = occurred_on

    from_value = (
        value.get("from_place_id")
        or value.get("fromPlaceId")
        or value.get("from_location")
        or value.get("fromLocation")
    )
    to_value = (
        value.get("to_place_id")
        or value.get("toPlaceId")
        or value.get("to_location")
        or value.get("toLocation")
    )
    if from_value is not None:
        payload["fromPlaceId"] = _resolve_place_id(from_value, resolution)
    if to_value is not None:
        payload["toPlaceId"] = _resolve_place_id(to_value, resolution)
    elif value.get("location") is not None:
        payload["toPlaceId"] = _resolve_place_id(value["location"], resolution)

    related = value.get("related_slugs") or value.get("relatedSlugs") or []
    reference_kind = value.get("related_reference_kind") or value.get("relatedReferenceKind")
    if related:
        if reference_kind not in {None, "canonical-slug"}:
            raise ValueError(
                "event related source text is unresolved; canonical Panda identities are required"
            )
        if not isinstance(related, list) or any(not isinstance(item, str) for item in related):
            raise ValueError("event related Panda references must be canonical slug strings")
        payload["participantIds"] = [
            _require_uuid(
                "event participant Panda ID", _resolved_slug(item, resolution.panda_ids_by_slug)
            )
            for item in related
        ]
    summary = value.get("summary")
    if isinstance(summary, str) and summary.strip():
        payload["summary"] = summary.strip()
    return "life_history", "event.create", payload


def _resolve_place_id(value: JsonValue, resolution: V2CurationResolutionContext) -> str:
    if isinstance(value, dict):
        for key in ("place_id", "placeId"):
            direct = value.get(key)
            if isinstance(direct, str) and direct:
                return _require_uuid("place ID", direct)
        for key in ("canonical_slug", "canonicalSlug", "place", "slug", "location", "name"):
            candidate = value.get(key)
            if isinstance(candidate, str) and candidate:
                resolved = resolution.place_ids_by_key.get(candidate)
                if resolved:
                    return _require_uuid("resolved place ID", resolved)
    elif isinstance(value, str):
        resolved = resolution.place_ids_by_key.get(value)
        if resolved:
            return _require_uuid("resolved place ID", resolved)
        try:
            return _require_uuid("place ID", value)
        except ValueError:
            pass
    raise ValueError("location candidate cannot be resolved to a reviewed V2 Place ID")


def _date_object(value: JsonValue) -> tuple[str | None, str]:
    if isinstance(value, dict):
        return _owner_date(value.get("value"), value.get("precision"))
    return _owner_date(value, None)


def _owner_date(value: JsonValue, precision_value: JsonValue) -> tuple[str | None, str]:
    precision = precision_value if isinstance(precision_value, str) else None
    text = value if isinstance(value, str) else None
    if text is None or not text.strip():
        return None, "unknown"
    text = text.strip()
    if precision is None:
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
            precision = "day"
        elif re.fullmatch(r"\d{4}-\d{2}", text):
            precision = "month"
        elif re.fullmatch(r"\d{4}", text):
            precision = "year"
        else:
            precision = "unknown"
    precision = precision.casefold().replace("-", "_")
    precision = {"exact": "day", "date": "day"}.get(precision, precision)
    if precision not in _ALLOWED_DATE_PRECISIONS:
        precision = "unknown"
    if precision == "day":
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
            raise ValueError(f"day precision requires YYYY-MM-DD, got {text!r}")
        return text, precision
    if precision == "month":
        if not re.fullmatch(r"\d{4}-\d{2}", text):
            raise ValueError(f"month precision requires YYYY-MM, got {text!r}")
        return f"{text}-01", precision
    if precision == "year":
        if not re.fullmatch(r"\d{4}", text):
            raise ValueError(f"year precision requires YYYY, got {text!r}")
        return f"{text}-01-01", precision
    return None, "unknown"


def _language_tag(value: str) -> str:
    normalized = value.strip()
    if normalized.casefold() in {"zh", "zh_cn", "zh-cn", "cn"}:
        return "zh-CN"
    return normalized.replace("_", "-")


def _resolved_slug(slug: str, values: Mapping[str, str]) -> str:
    resolved = values.get(slug)
    if not resolved:
        raise ValueError(f"canonical Panda slug {slug!r} has no reviewed V2 ID")
    return resolved


def _require_uuid(label: str, value: str) -> str:
    try:
        return str(UUID(value))
    except (ValueError, TypeError, AttributeError) as error:
        raise ValueError(f"{label} must be a UUID") from error


def _require_aware(label: str, value: datetime) -> None:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{label} must include a timezone")


__all__ = [
    "AcquisitionCurationChange",
    "AcquisitionCurationRecommendation",
    "V2CurationResolutionContext",
    "build_acquisition_curation_recommendations",
]
