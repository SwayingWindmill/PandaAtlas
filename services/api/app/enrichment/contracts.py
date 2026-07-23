from __future__ import annotations

from hashlib import sha256
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, JsonValue, model_validator

from app.acquisition.contracts import canonical_json_bytes
from app.identity_resolution import (
    IdentityCandidateRecord,
    IdentityFeatureSet,
    IdentityNameClaim,
)
from app.knowledge.contracts import PopulationContext

SCHEMA_VERSION = "panda-atlas-identity-extraction/v1"


class EnrichmentModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, validate_default=True)


class IdentityFieldEvidence(EnrichmentModel):
    evidence_snapshot_id: str = Field(min_length=1)
    evidence_body_sha256: str = Field(pattern="^[0-9a-f]{64}$")
    field_path: str = Field(min_length=1)
    raw_value: JsonValue
    normalized_value: JsonValue
    language: str = Field(min_length=1)
    source_locator: dict[str, JsonValue] = Field(min_length=1)
    parser_name: str = Field(min_length=1)
    parser_version: str = Field(min_length=1)


def _has_normalized_support(
    evidence_values: tuple[JsonValue, ...],
    expected: JsonValue,
) -> bool:
    expected_key = canonical_json_bytes(expected)
    if any(canonical_json_bytes(value) == expected_key for value in evidence_values):
        return True
    if isinstance(expected, list):
        evidence_keys = {canonical_json_bytes(value) for value in evidence_values}
        return all(canonical_json_bytes(value) in evidence_keys for value in expected)
    return False


def _require_normalized_support(
    evidence_by_path: dict[str, tuple[JsonValue, ...]],
    field_path: str,
    expected: JsonValue,
) -> None:
    if not _has_normalized_support(evidence_by_path.get(field_path, ()), expected):
        raise ValueError(f"{field_path} normalized evidence does not support the extracted value")


class IdentitySubjectExtraction(EnrichmentModel):
    source_id: str = Field(min_length=1)
    intake_candidate_id: str = Field(min_length=1)
    subject_key: str = Field(min_length=1)
    names: tuple[IdentityNameClaim, ...] = Field(min_length=1)
    features: IdentityFeatureSet
    population_context: PopulationContext = PopulationContext.UNKNOWN
    evidence: tuple[IdentityFieldEvidence, ...] = Field(min_length=1)

    @property
    def record_id(self) -> str:
        digest = sha256(
            canonical_json_bytes(
                {
                    "source_id": self.source_id,
                    "subject_key": self.subject_key,
                }
            )
        ).hexdigest()
        return f"identity-record-{digest}"

    @model_validator(mode="after")
    def validate_extraction(self) -> IdentitySubjectExtraction:
        name_keys = [
            (name.language.casefold(), name.kind.casefold(), name.value.casefold())
            for name in self.names
        ]
        if len(name_keys) != len(set(name_keys)):
            raise ValueError("identity extraction contains duplicate names")

        evidence_keys = [
            canonical_json_bytes(item.model_dump(mode="json")) for item in self.evidence
        ]
        if len(evidence_keys) != len(set(evidence_keys)):
            raise ValueError("identity extraction contains duplicate evidence")

        evidence_paths = {item.field_path for item in self.evidence}
        required_paths = {"identity.names"}
        if self.features.birth_date is not None:
            required_paths.add("identity.birth_date")
        elif self.features.birth_year is not None:
            required_paths.add("identity.birth_year")
        if self.features.sex is not None:
            required_paths.add("identity.sex")
        if self.features.parent_ids:
            required_paths.add("identity.parent_ids")
        if self.features.parent_names:
            required_paths.add("identity.parent_names")
        if self.features.institution_ids:
            required_paths.add("identity.institution_ids")
        if self.features.movement_institution_ids:
            required_paths.add("identity.movement_institution_ids")
        if self.features.source_relationship_ids:
            required_paths.add("identity.source_relationship_ids")
        if self.features.external_identifiers:
            required_paths.add("identity.external_identifiers")
        if self.features.stable_wild_identifier is not None:
            required_paths.add("identity.stable_wild_identifier")
        if self.features.is_group_observation:
            required_paths.add("identity.group_observation")
        if self.population_context is not PopulationContext.UNKNOWN:
            required_paths.add("identity.population_context")

        missing_paths = tuple(sorted(required_paths - evidence_paths))
        if missing_paths:
            raise ValueError(
                "identity extraction is missing field evidence for: " + ", ".join(missing_paths)
            )

        evidence_values: dict[str, list[JsonValue]] = {}
        for item in self.evidence:
            evidence_values.setdefault(item.field_path, []).append(item.normalized_value)
        evidence_by_path = {
            field_path: tuple(values) for field_path, values in evidence_values.items()
        }

        _require_normalized_support(
            evidence_by_path,
            "identity.names",
            [name.value for name in self.names],
        )
        if self.features.birth_date is not None:
            _require_normalized_support(
                evidence_by_path,
                "identity.birth_date",
                self.features.birth_date.isoformat(),
            )
        elif self.features.birth_year is not None:
            _require_normalized_support(
                evidence_by_path,
                "identity.birth_year",
                self.features.birth_year,
            )
        if self.features.sex is not None:
            _require_normalized_support(
                evidence_by_path,
                "identity.sex",
                self.features.sex,
            )
        if self.features.parent_ids:
            _require_normalized_support(
                evidence_by_path,
                "identity.parent_ids",
                list(self.features.parent_ids),
            )
        if self.features.parent_names:
            _require_normalized_support(
                evidence_by_path,
                "identity.parent_names",
                list(self.features.parent_names),
            )
        if self.features.institution_ids:
            _require_normalized_support(
                evidence_by_path,
                "identity.institution_ids",
                list(self.features.institution_ids),
            )
        if self.features.movement_institution_ids:
            _require_normalized_support(
                evidence_by_path,
                "identity.movement_institution_ids",
                list(self.features.movement_institution_ids),
            )
        if self.features.source_relationship_ids:
            _require_normalized_support(
                evidence_by_path,
                "identity.source_relationship_ids",
                list(self.features.source_relationship_ids),
            )
        if self.features.external_identifiers:
            _require_normalized_support(
                evidence_by_path,
                "identity.external_identifiers",
                [
                    {"system": item.system, "value": item.value}
                    for item in self.features.external_identifiers
                ],
            )
        if self.features.stable_wild_identifier is not None:
            _require_normalized_support(
                evidence_by_path,
                "identity.stable_wild_identifier",
                self.features.stable_wild_identifier,
            )
        if self.features.is_group_observation:
            _require_normalized_support(
                evidence_by_path,
                "identity.group_observation",
                True,
            )
        if self.population_context is not PopulationContext.UNKNOWN:
            _require_normalized_support(
                evidence_by_path,
                "identity.population_context",
                self.population_context.value,
            )
        return self


def identity_candidate_batch_id(
    extractions: tuple[IdentitySubjectExtraction, ...],
) -> str:
    digest = sha256(
        canonical_json_bytes([item.model_dump(mode="json") for item in extractions])
    ).hexdigest()
    return f"identity-extraction-batch-{digest}"


class IdentityCandidateBatch(EnrichmentModel):
    schema_version: Literal[SCHEMA_VERSION] = SCHEMA_VERSION
    batch_id: str = Field(min_length=1)
    extractions: tuple[IdentitySubjectExtraction, ...]
    candidates: tuple[IdentityCandidateRecord, ...]
    write_boundary: dict[str, tuple[str, ...]] = Field(
        default_factory=lambda: {
            "trusted_write_targets": (),
            "publication_write_targets": (),
        }
    )

    @model_validator(mode="after")
    def validate_batch(self) -> IdentityCandidateBatch:
        if self.write_boundary != {
            "trusted_write_targets": (),
            "publication_write_targets": (),
        }:
            raise ValueError("identity extraction batches cannot write trusted or public data")

        extraction_ids = tuple(item.record_id for item in self.extractions)
        candidate_ids = tuple(item.record_id for item in self.candidates)
        if extraction_ids != tuple(sorted(set(extraction_ids))):
            raise ValueError("identity extractions must be unique and sorted by record ID")
        if candidate_ids != extraction_ids:
            raise ValueError("identity candidates must map one-to-one to extractions")
        if self.batch_id != identity_candidate_batch_id(self.extractions):
            raise ValueError("identity extraction batch ID does not match its content")

        for extraction, candidate in zip(self.extractions, self.candidates, strict=True):
            if candidate.names != extraction.names:
                raise ValueError("identity candidate names drifted from extraction")
            if candidate.features != extraction.features:
                raise ValueError("identity candidate features drifted from extraction")
            if candidate.source_ids != (extraction.source_id,):
                raise ValueError("identity candidate source drifted from extraction")
            if candidate.population_context is not extraction.population_context:
                raise ValueError("identity candidate population context drifted from extraction")
        return self
